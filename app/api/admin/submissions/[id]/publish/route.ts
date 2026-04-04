import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore cookie set issues in route handlers
        }
      },
    },
  });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/article>/gi, "\n")
    .replace(/<\/section>/gi, "\n")
    .replace(/<\/main>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

function normalizeWhitespace(text: string = "") {
  return text.replace(/\s+/g, " ").trim();
}

function splitIntoParagraphs(text: string = "") {
  return text
    .split(/\n{2,}|\r\n\r\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);
}

function removeTrailingSourceBoilerplate(text: string) {
  if (!text) return "";

  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  const trailingPatterns = [
    /\bThe post .*? appeared first on .*?\.?$/gi,
    /\bAppeared first on .*?\.?$/gi,
    /\bOriginally published on .*?\.?$/gi,
    /\bThis article originally appeared on .*?\.?$/gi,
    /\bRead the full article at .*?\.?$/gi,
    /\bRead more at .*?\.?$/gi,
    /\bRead more from .*?\.?$/gi,
    /\bMore from .*?\.?$/gi,
    /\bSource: .*?$/gi,
    /\bCourtesy of .*?$/gi,
    /\bvia .*?$/gi,
  ];

  let changed = true;

  while (changed) {
    changed = false;
    const before = cleaned;

    for (const pattern of trailingPatterns) {
      cleaned = cleaned.replace(pattern, "").trim();
    }

    cleaned = cleaned
      .replace(/\b(of|from|on|via|at|by|for|with)\s*$/gi, "")
      .replace(/[,:;–—-]\s*$/g, "")
      .replace(/\s+\./g, ".")
      .trim();

    if (cleaned !== before) {
      changed = true;
    }
  }

  return cleaned;
}

function cleanStoryText(text: string) {
  const cleaned = decodeHtmlEntities(stripHtml(text))
    .replace(/\[\u2026\]|\[\.\.\.\]/g, "")
    .replace(/The post .*? appeared first on .*?\.?/gi, "")
    .replace(/Continue reading.*$/gi, "")
    .replace(/Read more.*$/gi, "")
    .replace(/Originally published on .*?\.?/gi, "")
    .replace(/This article originally appeared on .*?\.?/gi, "")
    .replace(/Copyright \d{4}.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return removeTrailingSourceBoilerplate(cleaned);
}

function isJunkParagraph(paragraph: string = "") {
  const p = paragraph.trim().toLowerCase();

  if (!p) return true;
  if (p.length < 40) return true;

  const junkPatterns = [
    /^(photo|image|credit|caption)\b/,
    /^(read more|see also|related:?)\b/,
    /^(sign up|signup|subscribe)\b/,
    /newsletter/,
    /follow us on/,
    /click here/,
    /advertisement/,
    /affiliate/,
    /^copyright\b/,
    /^published\b/,
    /^updated\b/,
    /^share this\b/,
    /^watch:?\b/,
    /^listen:?\b/,
    /^more from\b/,
    /^source:?\b/,
  ];

  if (junkPatterns.some((pattern) => pattern.test(p))) {
    return true;
  }

  return false;
}

function cleanArticleContent(rawContent: string = "") {
  if (!rawContent) return "";

  const cleaned = cleanStoryText(rawContent);
  const paragraphs = splitIntoParagraphs(cleaned)
    .map(removeTrailingSourceBoilerplate)
    .filter((p) => !isJunkParagraph(p));

  return paragraphs.join("\n\n").trim();
}

function truncateNicely(text: string, maxLength: number) {
  const cleaned = removeTrailingSourceBoilerplate(normalizeWhitespace(text));

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength);

  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? ")
  );

  let truncated = "";

  if (lastSentenceEnd > 120) {
    truncated = sliced.slice(0, lastSentenceEnd + 1).trim();
  } else {
    const lastSpace = sliced.lastIndexOf(" ");
    if (lastSpace > 120) {
      truncated = sliced.slice(0, lastSpace).trim();
    } else {
      truncated = sliced.trim();
    }
  }

  truncated = removeTrailingSourceBoilerplate(truncated)
    .replace(/\b(of|from|on|via|at|by|for|with)\s*$/gi, "")
    .replace(/[,:;–—-]\s*$/g, "")
    .trim();

  return `${truncated}...`;
}

function buildSummaryFromContent(cleanedContent: string, fallbackDescription = "") {
  const paragraphs = splitIntoParagraphs(cleanedContent)
    .map(removeTrailingSourceBoilerplate)
    .filter((p) => !isJunkParagraph(p));

  if (paragraphs.length === 0) {
    return fallbackDescription
      ? truncateNicely(cleanStoryText(fallbackDescription), 900)
      : "";
  }

  const selected: string[] = [];

  for (const paragraph of paragraphs) {
    if (selected.length >= 3) break;
    if (paragraph.length < 80) continue;

    selected.push(paragraph);

    const currentLength = selected.join("\n\n").length;

    if (selected.length >= 2 && currentLength >= 600) {
      break;
    }
  }

  if (selected.length === 0) {
    selected.push(paragraphs[0]);
  }

  let summary = selected.join("\n\n").trim();

  if (summary.length > 900) {
    summary = truncateNicely(summary, 900);
  }

  return summary;
}

function getDomainFromUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
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

function detectCategory(
  submissionType: "original_story" | "article_link",
  title: string | null,
  summary: string | null,
  content: string | null,
  sourceName: string | null
) {
  const haystack = [
    title || "",
    summary || "",
    content || "",
    sourceName || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("dog") ||
    haystack.includes("cat") ||
    haystack.includes("animal") ||
    haystack.includes("wildlife") ||
    haystack.includes("bird") ||
    haystack.includes("pet") ||
    haystack.includes("rescue")
  ) {
    return "animals";
  }

  if (
    haystack.includes("health") ||
    haystack.includes("hospital") ||
    haystack.includes("doctor") ||
    haystack.includes("nurse") ||
    haystack.includes("medical") ||
    haystack.includes("therapy") ||
    haystack.includes("mental health") ||
    haystack.includes("wellness")
  ) {
    return "health";
  }

  if (
    haystack.includes("kindness") ||
    haystack.includes("generosity") ||
    haystack.includes("donation") ||
    haystack.includes("volunteer") ||
    haystack.includes("helped") ||
    haystack.includes("helping") ||
    haystack.includes("gift") ||
    haystack.includes("support")
  ) {
    return "kindness";
  }

  if (
    haystack.includes("community") ||
    haystack.includes("neighborhood") ||
    haystack.includes("school") ||
    haystack.includes("town") ||
    haystack.includes("city") ||
    haystack.includes("library") ||
    haystack.includes("students") ||
    haystack.includes("families")
  ) {
    return "community";
  }

  if (submissionType === "original_story") {
    return "community";
  }

  return "hope";
}

async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseSlug: string,
  submissionId: string
) {
  let candidate = baseSlug || `reader-submission-${submissionId.slice(0, 8)}`;

  const { data: existing, error } = await supabase
    .from("stories")
    .select("id")
    .eq("slug", candidate)
    .limit(1);

  if (error) {
    throw new Error(`Slug lookup failed: ${error.message}`);
  }

  if (!existing || existing.length === 0) {
    return candidate;
  }

  candidate = `${candidate}-${submissionId.slice(0, 8)}`;

  const { data: secondCheck, error: secondError } = await supabase
    .from("stories")
    .select("id")
    .eq("slug", candidate)
    .limit(1);

  if (secondError) {
    throw new Error(`Secondary slug lookup failed: ${secondError.message}`);
  }

  if (!secondCheck || secondCheck.length === 0) {
    return candidate;
  }

  return `${candidate}-${Date.now().toString().slice(-6)}`;
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

function extractImageCandidatesFromMeta(html: string, articleUrl: string): string[] {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content="([^"]+)"[^>]*>/gi,
    /<meta[^>]+property=["']og:image["'][^>]+content='([^']+)'[^>]*>/gi,
    /<meta[^>]+content="([^"]+)"[^>]+property=["']og:image["'][^>]*>/gi,
    /<meta[^>]+content='([^']+)'[^>]+property=["']og:image["'][^>]*>/gi,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content="([^"]+)"[^>]*>/gi,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content='([^']+)'[^>]*>/gi,
    /<meta[^>]+content="([^"]+)"[^>]+property=["']og:image:secure_url["'][^>]*>/gi,
    /<meta[^>]+content='([^']+)'[^>]+property=["']og:image:secure_url["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content="([^"]+)"[^>]*>/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content='([^']+)'[^>]*>/gi,
    /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:image["'][^>]*>/gi,
    /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:image["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content="([^"]+)"[^>]*>/gi,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content='([^']+)'[^>]*>/gi,
    /<meta[^>]+content="([^"]+)"[^>]+name=["']twitter:image:src["'][^>]*>/gi,
    /<meta[^>]+content='([^']+)'[^>]+name=["']twitter:image:src["'][^>]*>/gi,
    /<meta[^>]+itemprop=["']image["'][^>]+content="([^"]+)"[^>]*>/gi,
    /<meta[^>]+itemprop=["']image["'][^>]+content='([^']+)'[^>]*>/gi,
    /<meta[^>]+content="([^"]+)"[^>]+itemprop=["']image["'][^>]*>/gi,
    /<meta[^>]+content='([^']+)'[^>]+itemprop=["']image["'][^>]*>/gi,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cleaned = cleanImageUrl((match as RegExpMatchArray)[1], articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function extractImageCandidatesFromJsonLd(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];
  const scriptMatches =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const scriptTag of scriptMatches) {
    const jsonText = scriptTag
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    const imageMatches = [
      ...jsonText.matchAll(/"image"\s*:\s*"([^"]+)"/gi),
      ...jsonText.matchAll(/"contentUrl"\s*:\s*"([^"]+)"/gi),
      ...jsonText.matchAll(/"url"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi),
    ];

    for (const match of imageMatches) {
      const maybe = match[1]?.replace(/\\\//g, "/");
      const cleaned = cleanImageUrl(maybe, articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function extractImageCandidatesFromGenericHtml(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];

  const patterns = [
    /<link[^>]+rel=["']image_src["'][^>]+href="([^"]+)"[^>]*>/gi,
    /<link[^>]+rel=["']image_src["'][^>]+href='([^']+)'[^>]*>/gi,
    /<link[^>]+href="([^"]+)"[^>]+rel=["']image_src["'][^>]*>/gi,
    /<link[^>]+href='([^']+)'[^>]+rel=["']image_src["'][^>]*>/gi,
    /<img[^>]+data-lazy-src="([^"]+)"[^>]*>/gi,
    /<img[^>]+data-lazy-src='([^']+)'[^>]*>/gi,
    /<img[^>]+data-src="([^"]+)"[^>]*>/gi,
    /<img[^>]+data-src='([^']+)'[^>]*>/gi,
    /<img[^>]+src="([^"]+)"[^>]*>/gi,
    /<img[^>]+src='([^']+)'[^>]*>/gi,
    /<amp-img[^>]+src="([^"]+)"[^>]*>/gi,
    /<amp-img[^>]+src='([^']+)'[^>]*>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cleaned = cleanImageUrl((match as RegExpMatchArray)[1], articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  for (const match of html.matchAll(/<img[^>]+srcset="([^"]+)"[^>]*>/gi)) {
    const first = match[1]?.split(",")[0]?.trim().split(" ")[0];
    const cleaned = cleanImageUrl(first, articleUrl);
    if (cleaned) candidates.push(cleaned);
  }

  for (const match of html.matchAll(/<img[^>]+srcset='([^']+)'[^>]*>/gi)) {
    const first = match[1]?.split(",")[0]?.trim().split(" ")[0];
    const cleaned = cleanImageUrl(first, articleUrl);
    if (cleaned) candidates.push(cleaned);
  }

  return candidates;
}

function extractImageCandidatesFromScripts(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];

  const patterns = [
    /https?:\/\/[^"'\\\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s>]*)?/gi,
    /"image"\s*:\s*"([^"]+)"/gi,
    /"hero-image"\s*:\s*"([^"]+)"/gi,
    /"promo_image"\s*:\s*"([^"]+)"/gi,
    /"url"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi,
    /"originalUrl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = (match[1] || match[0] || "").replace(/\\\//g, "/");
      const cleaned = cleanImageUrl(raw, articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function pickBestImageCandidate(candidates: string[]): string | null {
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    if (
      /sprite|icon|logo|avatar|1x1|pixel/i.test(candidate) ||
      /\.(svg)(\?|$)/i.test(candidate) ||
      /generic-newsletter-signup/i.test(candidate)
    ) {
      continue;
    }

    return candidate;
  }

  return null;
}

function extractBestImageFromHtml(html: string, articleUrl: string): string | null {
  const meta = extractImageCandidatesFromMeta(html, articleUrl);
  const jsonLd = extractImageCandidatesFromJsonLd(html, articleUrl);
  const generic = extractImageCandidatesFromGenericHtml(html, articleUrl);
  const scripts = extractImageCandidatesFromScripts(html, articleUrl);

  const all = [...meta, ...jsonLd, ...generic, ...scripts];
  return pickBestImageCandidate(all);
}

function extractArticleContentFromHtml(html: string) {
  const articleMatch =
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<body[\s\S]*?<\/body>/i)?.[0] ||
    html;

  return cleanArticleContent(articleMatch);
}

async function extractArticleDataFromUrl(url: string | null) {
  if (!url) {
    return {
      title: "",
      sourceName: "",
      description: "",
      imageUrl: null as string | null,
      content: "",
      summary: "",
    };
  }

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
        title: guessTitleFromUrl(url),
        sourceName: inferPublicationNameFromUrl(url),
        description: "",
        imageUrl: null,
        content: "",
        summary: "",
      };
    }

    const html = await response.text();

    const rawTitle =
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
      ]) || guessTitleFromUrl(url);

    const title = normalizeExtractedTitle(rawTitle);

    const description = extractMetaContent(html, [
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

    const imageUrl = extractBestImageFromHtml(html, url);
    const content = extractArticleContentFromHtml(html);
    const summary = buildSummaryFromContent(content, description);

    return {
      title,
      sourceName,
      description,
      imageUrl,
      content,
      summary,
    };
  } catch (error) {
    console.error("Article extraction failed during publish:", error);
    return {
      title: guessTitleFromUrl(url),
      sourceName: inferPublicationNameFromUrl(url),
      description: "",
      imageUrl: null,
      content: "",
      summary: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: submission, error: submissionError } = await supabase
      .from("reader_submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      console.error("Publish submission lookup error:", submissionError);
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status === "rejected") {
      return NextResponse.json(
        { error: "Rejected submissions cannot be published." },
        { status: 400 }
      );
    }

    if (submission.status === "published" && submission.linked_story_id) {
      return NextResponse.json({
        success: true,
        message: "Submission already published",
        story_id: submission.linked_story_id,
      });
    }

    const { data: existingBySubmission, error: existingBySubmissionError } = await supabase
      .from("stories")
      .select("id, slug")
      .eq("submission_id", submission.id)
      .limit(1);

    if (existingBySubmissionError) {
      console.error("Existing story by submission lookup error:", existingBySubmissionError);
      return NextResponse.json(
        { error: existingBySubmissionError.message },
        { status: 500 }
      );
    }

    if (existingBySubmission && existingBySubmission.length > 0) {
      const existingStory = existingBySubmission[0];

      const { error: relinkError } = await supabase
        .from("reader_submissions")
        .update({
          status: "published",
          linked_story_id: existingStory.id,
          published_at: submission.published_at || new Date().toISOString(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (relinkError) {
        return NextResponse.json({ error: relinkError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Submission was already linked to an existing story.",
        story_id: existingStory.id,
        slug: existingStory.slug,
      });
    }

    if (submission.source_url) {
      const { data: existingBySourceUrl, error: existingBySourceUrlError } = await supabase
        .from("stories")
        .select("id, slug")
        .eq("source_url", submission.source_url)
        .limit(1);

      if (existingBySourceUrlError) {
        console.error("Existing story by source_url lookup error:", existingBySourceUrlError);
        return NextResponse.json(
          { error: existingBySourceUrlError.message },
          { status: 500 }
        );
      }

      if (existingBySourceUrl && existingBySourceUrl.length > 0) {
        const existingStory = existingBySourceUrl[0];

        const { error: updateMatchedError } = await supabase
          .from("reader_submissions")
          .update({
            status: "published",
            linked_story_id: existingStory.id,
            published_at: submission.published_at || new Date().toISOString(),
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (updateMatchedError) {
          return NextResponse.json({ error: updateMatchedError.message }, { status: 500 });
        }

        await supabase.from("reader_submission_events").insert({
          submission_id: id,
          event_type: "linked_to_existing_story",
          actor_user_id: user.id,
          notes: `Matched existing story by source_url (${existingStory.slug || existingStory.id})`,
        });

        return NextResponse.json({
          success: true,
          message: "Matched to an existing story by source URL.",
          story_id: existingStory.id,
          slug: existingStory.slug,
        });
      }
    }

    const extractedArticleData =
      submission.submission_type === "article_link" && submission.source_url
        ? await extractArticleDataFromUrl(submission.source_url)
        : {
            title: "",
            sourceName: "",
            description: "",
            imageUrl: null as string | null,
            content: "",
            summary: "",
          };

    const finalTitle =
      submission.submission_type === "article_link"
        ? extractedArticleData.title || submission.title || "Submitted article"
        : submission.title || "Reader submission";

    const finalSourceName =
      submission.submission_type === "article_link"
        ? extractedArticleData.sourceName ||
          submission.source_name ||
          (submission.source_url ? inferPublicationNameFromUrl(submission.source_url) : null)
        : submission.source_name || null;

    const baseSlug = slugify(finalTitle || "reader-submission");
    const finalSlug = await generateUniqueSlug(supabase, baseSlug, submission.id);

    const finalSummary =
      submission.submission_type === "article_link"
        ? extractedArticleData.summary || extractedArticleData.description || ""
        : submission.summary || "";

    const finalContent =
      submission.submission_type === "article_link"
        ? extractedArticleData.content || ""
        : submission.content || submission.summary || "";

    const finalImageUrl =
      submission.image_url ||
      extractedArticleData.imageUrl ||
      null;

    const categorySlug =
      submission.category_slug ||
      detectCategory(
        submission.submission_type,
        finalTitle,
        finalSummary,
        finalContent,
        finalSourceName
      );

    const publishDate = new Date().toISOString();

    const insertPayload = {
      title: finalTitle,
      slug: finalSlug,
      summary: finalSummary || null,
      content: finalContent || null,
      image_url: finalImageUrl,
      source_url: submission.source_url,
      source_name: finalSourceName,
      category_slug: categorySlug,
      publish_date: publishDate,
      is_reader_submission: true,
      submission_id: submission.id,
      submitted_by_name: submission.author_name,
    };

    const { data: story, error: insertError } = await supabase
      .from("stories")
      .insert(insertPayload)
      .select("id, slug, category_slug")
      .single();

    if (insertError || !story) {
      console.error("Publish story insert error:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Failed to create story row." },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("reader_submissions")
      .update({
        status: "published",
        published_at: publishDate,
        reviewed_by: user.id,
        reviewed_at: publishDate,
        linked_story_id: story.id,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Publish submission update error:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    const categorySource = submission.category_slug
      ? `submitter-selected category ${story.category_slug}`
      : `auto-detected category ${story.category_slug}`;

    const eventNotes =
      submission.submission_type === "original_story"
        ? `Published as an original reader story in ${categorySource}`
        : `Published as an article submission in ${categorySource}`;

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: id,
        event_type: "published_to_stories",
        actor_user_id: user.id,
        notes: eventNotes,
      });

    if (eventError) {
      console.error("Publish event error:", eventError);
    }

    return NextResponse.json({
      success: true,
      story_id: story.id,
      slug: story.slug,
      category_slug: story.category_slug,
    });
  } catch (error) {
    console.error("Publish route error:", error);

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}