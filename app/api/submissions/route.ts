import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// ============================================
// RATE LIMITER
// 3 submissions per IP per 10 minutes
// In-memory: resets on cold start, fine for Vercel serverless
// ============================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

const blockedTerms = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "slut",
  "whore",
  "nigger",
  "faggot",
  "retard",
  "kill yourself",
  "suicide method",
  "bomb making",
  "how to poison",
  "white power",
  "heil hitler",
];

const blockedDomains = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "redtube.com",
  "youporn.com",
  "xhamster.com",
  "onlyfans.com",
  "chaturbate.com",
  "stripchat.com",
  "camsoda.com",
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "rb.gy",
  "is.gd",
  "buff.ly",
  "spam-example.com",
];

const suspiciousTlds = [
  ".xyz",
  ".click",
  ".top",
  ".work",
  ".loan",
  ".gq",
  ".tk",
];

const allowedCategories = new Set([
  "animals",
  "health",
  "community",
  "kindness",
  "hope",
]);

const submissionSchema = z
  .object({
    submission_type: z.enum(["original_story", "article_link"]),
    title: z
      .string()
      .trim()
      .max(200, "Title must be 200 characters or less.")
      .optional()
      .or(z.literal("")),
    summary: z
      .string()
      .trim()
      .max(500, "Summary must be 500 characters or less.")
      .optional()
      .or(z.literal("")),
    content: z.string().trim().optional().or(z.literal("")),
    source_url: z
      .string()
      .trim()
      .url("Please enter a valid article URL.")
      .optional()
      .or(z.literal("")),
    source_name: z
      .string()
      .trim()
      .max(150, "Publication name is too long.")
      .optional()
      .or(z.literal("")),
    author_name: z.string().trim().min(2, "Please enter your username.").max(120),
    author_email: z
      .string()
      .trim()
      .email("Please enter a valid email address."),
    author_bio: z
      .string()
      .trim()
      .max(300, "Bio must be 300 characters or less.")
      .optional()
      .or(z.literal("")),
    location_text: z
      .string()
      .trim()
      .max(120, "Location must be 120 characters or less.")
      .optional()
      .or(z.literal("")),
    image_url: z
      .string()
      .trim()
      .url("Please enter a valid image URL.")
      .optional()
      .or(z.literal("")),
    category_slug: z.string().optional().or(z.literal("")),
    consent_original: z.boolean().optional(),
    consent_publication_rights: z.boolean().optional(),
    consent_terms: z.boolean(),
    website: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.consent_terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent_terms"],
        message: "You must agree to the submission terms.",
      });
    }

    if (
      data.category_slug &&
      data.category_slug.trim().length > 0 &&
      !allowedCategories.has(data.category_slug.trim().toLowerCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category_slug"],
        message: "Please choose a valid category.",
      });
    }

    if (data.submission_type === "original_story") {
      if (!data.title || data.title.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["title"],
          message: "Please enter a title.",
        });
      }

      if (!data.content || data.content.trim().length < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "Please provide the full story with at least 100 characters.",
        });
      }

      if (!data.consent_original) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["consent_original"],
          message: "Please confirm this is your original story.",
        });
      }
    }

    if (data.submission_type === "article_link") {
      if (!data.source_url || data.source_url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_url"],
          message: "Please provide the article URL.",
        });
      }

      if (!data.consent_publication_rights) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["consent_publication_rights"],
          message: "Please confirm you are only submitting the article link.",
        });
      }
    }
  });

type SafeBrowsingMatch = {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: {
    url?: string;
  };
};

type SafeBrowsingResponse = {
  matches?: SafeBrowsingMatch[];
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function containsBlockedTerms(...values: Array<string | null | undefined>) {
  const haystack = values
    .map((v) => normalizeText(v))
    .join(" ")
    .replace(/\s+/g, " ");

  return blockedTerms.find((term) => haystack.includes(term)) || null;
}

function hasSpammyPatterns(value: string) {
  const text = value.trim();

  if (!text) return false;
  if (/(.)\1{7,}/i.test(text)) return true;
  if (/https?:\/\/\S+.*https?:\/\/\S+/i.test(text)) return true;
  if (/(free money|work from home|crypto giveaway|click here|buy now)/i.test(text))
    return true;
  if (/^[A-Z\s!?.]{30,}$/.test(text)) return true;

  return false;
}

function getDomainFromUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlockedDomain(value: string) {
  const domain = getDomainFromUrl(value);
  if (!domain) return false;

  return blockedDomains.some(
    (blocked) => domain === blocked || domain.endsWith(`.${blocked}`)
  );
}

function isSuspiciousUrl(value: string) {
  if (!value) return false;

  const domain = getDomainFromUrl(value);
  if (!domain) return true;

  if (suspiciousTlds.some((tld) => domain.endsWith(tld))) {
    return true;
  }

  return false;
}

function looksLikeArticleUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();

    if (path === "/" || path.length < 6) return false;

    if (
      path.includes("/tag/") ||
      path.includes("/category/") ||
      path.includes("/search") ||
      path.includes("/author/") ||
      path.includes("/topics/")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function buildModerationNotes(parsed: z.infer<typeof submissionSchema>) {
  const notes: string[] = [];

  if (parsed.summary && hasSpammyPatterns(parsed.summary)) {
    notes.push("Spam-like pattern detected in summary");
  }

  if (parsed.content && hasSpammyPatterns(parsed.content)) {
    notes.push("Spam-like pattern detected in content");
  }

  if (
    parsed.submission_type === "original_story" &&
    parsed.content &&
    parsed.content.trim().length < 180
  ) {
    notes.push("Very short original story");
  }

  return notes.length ? notes.join(" | ") : null;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/&#8242;/g, "'")
    .replace(/&#8243;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function cleanImageUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return null;

  const raw = decodeHtmlEntities(url.trim());

  if (
    !raw ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    /sprite|icon|logo|avatar|1x1|pixel/i.test(raw)
  ) {
    return null;
  }

  const cleaned = absoluteUrl(raw, baseUrl);

  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (/\.svg(\?|$)/i.test(cleaned)) return null;
  if (/sprite|icon|logo|avatar|1x1|pixel/i.test(cleaned)) return null;
  if (/generic-newsletter-signup/i.test(cleaned)) return null;

  return cleaned;
}

function inferPublicationNameFromUrl(url: string) {
  const domain = getDomainFromUrl(url);

  const known: Record<string, string> = {
    "espn.com": "ESPN",
    "washingtonpost.com": "Washington Post",
    "goodnewsnetwork.org": "Good News Network",
    "positive.news": "Positive News",
    "goodgoodgood.co": "Good Good Good",
    "foxnews.com": "Fox News",
    "nytimes.com": "New York Times",
    "theguardian.com": "The Guardian",
    "bbc.com": "BBC",
    "bbc.co.uk": "BBC",
    "cnn.com": "CNN",
    "npr.org": "NPR",
    "apnews.com": "AP News",
    "reuters.com": "Reuters",
  };

  if (known[domain]) return known[domain];

  const base = domain.split(".")[0] || domain;
  return base
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function guessTitleFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    if (!last) return "Submitted article";

    return last
      .replace(/[-_]+/g, " ")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "Submitted article";
  }
}

function normalizeExtractedTitle(title: string) {
  const cleaned = decodeHtmlEntities(title)
    .replace(/\s*[-|–—]\s*(ESPN|Washington Post|Good News Network|Positive News|Good Good Good|Fox News|CNN|BBC|Reuters|AP News|NPR|New York Times|The Guardian)\s*$/i, "")
    .trim();

  return cleaned || title.trim();
}

function extractMetaContent(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1] ?? html.match(pattern)?.[2];
    if (match) {
      return decodeHtmlEntities(match.trim());
    }
  }
  return "";
}

async function extractArticlePreview(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        title: "",
        summary: "",
        sourceName: "",
        imageUrl: null as string | null,
      };
    }

    const html = await response.text();

    const title =
      normalizeExtractedTitle(
        extractMetaContent(html, [
          /<meta[^>]+property=["']og:title["'][^>]+content="([^"]+)"[^>]*>/i,
          /<meta[^>]+property=["']og:title["'][^>]+content='([^']+)'[^>]*>/i,
          /<meta[^>]+content="([^"]+)"[^>]+property=["']og:title["'][^>]*>/i,
          /<meta[^>]+content='([^']+)'[^>]+property=["']og:title["'][^>]*>/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content="([^"]+)"[^>]*>/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content='([^']+)'[^>]*>/i,
          /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:title["'][^>]*>/i,
          /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:title["'][^>]*>/i,
          /<title[^>]*>([\s\S]*?)<\/title>/i,
        ])
      ) || guessTitleFromUrl(url);

    const summary = extractMetaContent(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+property=["']og:description["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+property=["']og:description["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+property=["']og:description["'][^>]*>/i,
      /<meta[^>]+name=["']description["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+name=["']description["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+name=["']description["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+name=["']description["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+name=["']twitter:description["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:description["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:description["'][^>]*>/i,
    ]);

    const sourceName =
      extractMetaContent(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+property=["']og:site_name["'][^>]+content='([^']+)'[^>]*>/i,
        /<meta[^>]+content="([^"]+)"[^>]+property=["']og:site_name["'][^>]*>/i,
        /<meta[^>]+content='([^']+)'[^>]+property=["']og:site_name["'][^>]*>/i,
        /<meta[^>]+name=["']application-name["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+name=["']application-name["'][^>]+content='([^']+)'[^>]*>/i,
        /<meta[^>]+content="([^"]+)"[^>]+name=["']application-name["'][^>]*>/i,
        /<meta[^>]+content='([^']+)'[^>]+name=["']application-name["'][^>]*>/i,
      ]) || inferPublicationNameFromUrl(url);

    const imagePatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+property=["']og:image["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:image["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image:src["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+name=["']twitter:image:src["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:image:src["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:image:src["'][^>]*>/i,
    ];

    let imageUrl: string | null = null;
    for (const pattern of imagePatterns) {
      const match = html.match(pattern)?.[1];
      const cleaned = cleanImageUrl(match, url);
      if (cleaned) {
        imageUrl = cleaned;
        break;
      }
    }

    return {
      title,
      summary,
      sourceName,
      imageUrl,
    };
  } catch {
    return {
      title: guessTitleFromUrl(url),
      summary: "",
      sourceName: inferPublicationNameFromUrl(url),
      imageUrl: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkGoogleSafeBrowsing(urlToCheck: string) {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey || !urlToCheck) {
    return {
      enabled: false,
      matched: false,
      matches: [] as SafeBrowsingMatch[],
      error: null as string | null,
    };
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: {
            clientId: "daily-good-news",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: urlToCheck }],
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        enabled: true,
        matched: false,
        matches: [] as SafeBrowsingMatch[],
        error: `Safe Browsing lookup failed (${response.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as SafeBrowsingResponse;
    const matches = Array.isArray(data.matches) ? data.matches : [];

    return {
      enabled: true,
      matched: matches.length > 0,
      matches,
      error: null as string | null,
    };
  } catch (error) {
    return {
      enabled: true,
      matched: false,
      matches: [] as SafeBrowsingMatch[],
      error: error instanceof Error ? error.message : "Unknown Safe Browsing error",
    };
  }
}

export async function POST(req: Request) {
  // ============================================
  // RATE LIMITING — must be first check
  // ============================================
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        error:
          "Too many submissions. Please wait a few minutes before trying again.",
      },
      { status: 429 }
    );
  }

  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error("Missing Supabase environment variables for submissions route.");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = submissionSchema.parse(body);

    if (parsed.website && parsed.website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    const blockedTerm = containsBlockedTerms(
      parsed.title,
      parsed.summary,
      parsed.content,
      parsed.author_bio
    );

    if (blockedTerm) {
      return NextResponse.json(
        {
          error:
            "Your submission contains language or content that cannot be accepted.",
        },
        { status: 400 }
      );
    }

    if (parsed.title && hasSpammyPatterns(parsed.title)) {
      return NextResponse.json(
        {
          error:
            "Your title looks suspicious or spam-like. Please revise it and try again.",
        },
        { status: 400 }
      );
    }

    if (
      parsed.submission_type === "article_link" &&
      parsed.source_url &&
      !looksLikeArticleUrl(parsed.source_url)
    ) {
      return NextResponse.json(
        {
          error:
            "Please submit a direct article link rather than a homepage, category, or search page.",
        },
        { status: 400 }
      );
    }

    if (parsed.source_url && isBlockedDomain(parsed.source_url)) {
      return NextResponse.json(
        {
          error:
            "That website is not allowed for submissions. Please submit a link from a trusted publication.",
        },
        { status: 400 }
      );
    }

    if (parsed.image_url && isBlockedDomain(parsed.image_url)) {
      return NextResponse.json(
        {
          error:
            "That image URL is not allowed. Please use an image from a trusted source.",
        },
        { status: 400 }
      );
    }

    if (parsed.source_url && isSuspiciousUrl(parsed.source_url)) {
      return NextResponse.json(
        {
          error:
            "That article link could not be accepted. Please submit the original article URL from a trusted publication.",
        },
        { status: 400 }
      );
    }

    if (parsed.image_url && isSuspiciousUrl(parsed.image_url)) {
      return NextResponse.json(
        {
          error:
            "That image URL could not be accepted. Please use an image from a trusted source.",
        },
        { status: 400 }
      );
    }

    if (parsed.source_url) {
      const safeBrowsingResult = await checkGoogleSafeBrowsing(parsed.source_url);

      if (safeBrowsingResult.matched) {
        return NextResponse.json(
          {
            error:
              "That article link appears unsafe and cannot be accepted. Please submit a different source URL.",
          },
          { status: 400 }
        );
      }
    }

    if (parsed.image_url) {
      const safeBrowsingImageResult = await checkGoogleSafeBrowsing(parsed.image_url);

      if (safeBrowsingImageResult.matched) {
        return NextResponse.json(
          {
            error:
              "That image URL appears unsafe and cannot be accepted. Please use a different image source.",
          },
          { status: 400 }
        );
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (parsed.submission_type === "article_link" && parsed.source_url) {
      const cleanSourceUrl = parsed.source_url.trim();

      const { data: existingSubmission, error: duplicateError } = await supabase
        .from("reader_submissions")
        .select("id")
        .eq("source_url", cleanSourceUrl)
        .limit(1);

      if (duplicateError) {
        console.error("Duplicate submission lookup error:", duplicateError);
        return NextResponse.json(
          { error: "Failed to validate article submission." },
          { status: 500 }
        );
      }

      if (existingSubmission && existingSubmission.length > 0) {
        return NextResponse.json(
          { error: "This article has already been submitted." },
          { status: 409 }
        );
      }

      const { data: existingStory, error: existingStoryError } = await supabase
        .from("stories")
        .select("id")
        .eq("source_url", cleanSourceUrl)
        .limit(1);

      if (existingStoryError) {
        console.error("Existing story lookup error:", existingStoryError);
        return NextResponse.json(
          { error: "Failed to validate article submission." },
          { status: 500 }
        );
      }

      if (existingStory && existingStory.length > 0) {
        return NextResponse.json(
          { error: "This article already exists in Daily Good News." },
          { status: 409 }
        );
      }
    }

    let cleanTitle = parsed.title?.trim() || "";
    let cleanSummary = parsed.summary?.trim() || null;
    const cleanContent = parsed.content?.trim() || null;
    const cleanSourceUrl = parsed.source_url?.trim() || null;
    let cleanSourceName = parsed.source_name?.trim() || null;
    const cleanAuthorName = parsed.author_name.trim();
    const cleanAuthorEmail = parsed.author_email.trim().toLowerCase();
    const cleanAuthorBio = parsed.author_bio?.trim() || null;
    const cleanLocationText = parsed.location_text?.trim() || null;
    let cleanImageUrlValue = parsed.image_url?.trim() || null;
    const cleanCategorySlug =
      parsed.category_slug && allowedCategories.has(parsed.category_slug.trim().toLowerCase())
        ? parsed.category_slug.trim().toLowerCase()
        : null;

    if (parsed.submission_type === "article_link" && cleanSourceUrl) {
      const preview = await extractArticlePreview(cleanSourceUrl);

      cleanTitle = cleanTitle || preview.title || guessTitleFromUrl(cleanSourceUrl);
      cleanSummary = cleanSummary || preview.summary || null;
      cleanSourceName = cleanSourceName || preview.sourceName || inferPublicationNameFromUrl(cleanSourceUrl);
      cleanImageUrlValue = cleanImageUrlValue || preview.imageUrl || null;
    }

    if (parsed.submission_type === "original_story") {
      cleanTitle = cleanTitle.trim();
    }

    const slug = slugify(cleanTitle || "submitted-article");

    if (parsed.submission_type === "original_story") {
      const { data: similarOriginal, error: similarOriginalError } = await supabase
        .from("reader_submissions")
        .select("id")
        .eq("submission_type", "original_story")
        .eq("author_email", cleanAuthorEmail)
        .eq("slug", slug)
        .limit(1);

      if (similarOriginalError) {
        console.error("Original story duplicate lookup error:", similarOriginalError);
        return NextResponse.json(
          { error: "Failed to validate story submission." },
          { status: 500 }
        );
      }

      if (similarOriginal && similarOriginal.length > 0) {
        return NextResponse.json(
          {
            error:
              "A very similar original story has already been submitted from this email address.",
          },
          { status: 409 }
        );
      }
    }

    const moderationNotes = buildModerationNotes(parsed);

    const insertPayload = {
      submission_type: parsed.submission_type,
      status: "pending",
      title: cleanTitle || "Submitted article",
      slug: slug || null,
      summary: cleanSummary,
      content: cleanContent,
      source_url: cleanSourceUrl,
      source_name: cleanSourceName,
      author_name: cleanAuthorName,
      author_email: cleanAuthorEmail,
      author_bio: cleanAuthorBio,
      location_text: cleanLocationText,
      image_url: cleanImageUrlValue,
      category_slug: cleanCategorySlug,
      consent_original: !!parsed.consent_original,
      consent_publication_rights: !!parsed.consent_publication_rights,
      consent_terms: parsed.consent_terms,
      moderation_notes: moderationNotes,
    };

    const { data: insertedSubmission, error: insertError } = await supabase
      .from("reader_submissions")
      .insert(insertPayload)
      .select("id, submission_type, status, submitted_at")
      .single();

    if (insertError) {
      console.error("Submission insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save your submission." },
        { status: 500 }
      );
    }

    const creationNote =
      parsed.submission_type === "original_story"
        ? "Original story submission created"
        : "Article link submission created";

    const categoryNote = cleanCategorySlug
      ? ` | Category selected: ${cleanCategorySlug}`
      : "";

    const combinedEventNote = moderationNotes
      ? `${creationNote}${categoryNote} | ${moderationNotes}`
      : `${creationNote}${categoryNote}`;

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: insertedSubmission.id,
        event_type: "created",
        notes: combinedEventNote,
      });

    if (eventError) {
      console.error("Submission event insert error:", eventError);
    }

    return NextResponse.json({
      success: true,
      submission: insertedSubmission,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields and try again.",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Unexpected submission route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}