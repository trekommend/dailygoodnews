"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const allowedCategories = new Set([
  "animals",
  "health",
  "community",
  "kindness",
  "hope",
]);

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getDomainFromUrl(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferPublicationNameFromUrl(url: string) {
  const domain = getDomainFromUrl(url);

  const known: Record<string, string> = {
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
    .replace(
      /\s*[-|–—]\s*(ESPN|Washington Post|Good News Network|Positive News|Good Good Good|Fox News|CNN|BBC|Reuters|AP News|NPR|New York Times|The New York Times|NYTimes\.com|The Guardian)\s*$/i,
      ""
    )
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

function extractJsonLdArticleData(html: string) {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  if (!scripts) {
    return {
      title: "",
      summary: "",
      imageUrl: null as string | null,
    };
  }

  for (const script of scripts) {
    const jsonText = script
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const parsed = JSON.parse(decodeHtmlEntities(jsonText));
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        const graph = Array.isArray(item["@graph"]) ? item["@graph"] : [item];

        for (const node of graph) {
          const type = node["@type"];
          const isArticle =
            type === "NewsArticle" ||
            type === "Article" ||
            (Array.isArray(type) &&
              (type.includes("NewsArticle") || type.includes("Article")));

          if (!isArticle) continue;

          const image =
            typeof node.image === "string"
              ? node.image
              : Array.isArray(node.image)
                ? node.image[0]
                : node.image?.url || null;

          return {
            title: node.headline || node.name || "",
            summary: node.description || "",
            imageUrl: image,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return {
    title: "",
    summary: "",
    imageUrl: null as string | null,
  };
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

  return cleaned;
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
    const jsonLd = extractJsonLdArticleData(html);

    const title =
      normalizeExtractedTitle(jsonLd.title || "") ||
      normalizeExtractedTitle(
        extractMetaContent(html, [
          /<meta[^>]+property=["']og:title["'][^>]+content="([^"]+)"[^>]*>/i,
          /<meta[^>]+property=["']og:title["'][^>]+content='([^']+)'[^>]*>/i,
          /<meta[^>]+content="([^"]+)"[^>]+property=["']og:title["'][^>]*>/i,
          /<meta[^>]+content='([^']+)'[^>]+property=["']og:title["'][^>]*>/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content="([^"]+)"[^>]*>/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content='([^']+)'[^>]*>/i,
          /<title[^>]*>([\s\S]*?)<\/title>/i,
        ])
      ) ||
      guessTitleFromUrl(url);

    const summary =
      decodeHtmlEntities(jsonLd.summary || "") ||
      extractMetaContent(html, [
        /<meta[^>]+property=["']og:description["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+property=["']og:description["'][^>]+content='([^']+)'[^>]*>/i,
        /<meta[^>]+content="([^"]+)"[^>]+property=["']og:description["'][^>]*>/i,
        /<meta[^>]+content='([^']+)'[^>]+property=["']og:description["'][^>]*>/i,
        /<meta[^>]+name=["']description["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+name=["']description["'][^>]+content='([^']+)'[^>]*>/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content='([^']+)'[^>]*>/i,
      ]);

    const sourceName =
      extractMetaContent(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+property=["']og:site_name["'][^>]+content='([^']+)'[^>]*>/i,
        /<meta[^>]+content="([^"]+)"[^>]+property=["']og:site_name["'][^>]*>/i,
        /<meta[^>]+content='([^']+)'[^>]+property=["']og:site_name["'][^>]*>/i,
        /<meta[^>]+name=["']application-name["'][^>]+content="([^"]+)"[^>]*>/i,
        /<meta[^>]+name=["']application-name["'][^>]+content='([^']+)'[^>]*>/i,
      ]) || inferPublicationNameFromUrl(url);

    const imagePatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+property=["']og:image["'][^>]+content='([^']+)'[^>]*>/i,
      /<meta[^>]+content="([^"]+)"[^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+content='([^']+)'[^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content="([^"]+)"[^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content='([^']+)'[^>]*>/i,
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

    if (!imageUrl && jsonLd.imageUrl) {
      imageUrl = cleanImageUrl(jsonLd.imageUrl, url);
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

async function requireAdmin() {
  const authClient = await createClient();

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  return user;
}

async function createUniqueSlug(
  supabase: ReturnType<typeof createAdminClient>,
  title: string
) {
  const baseSlug = slugify(title) || "admin-story";
  let slug = baseSlug;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const { data } = await supabase
      .from("stories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    slug = `${baseSlug}-${attempt + 1}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function createStory(formData: FormData) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const submissionType = String(
    formData.get("submission_type") || "original_story"
  ) as "original_story" | "article_link";

  let title = String(formData.get("title") || "").trim();
  let summary = cleanOptional(formData.get("summary"));
  const content = cleanOptional(formData.get("content"));
  const sourceUrl = cleanOptional(formData.get("source_url"));
  let sourceName = cleanOptional(formData.get("source_name"));
  let imageUrl = cleanOptional(formData.get("image_url"));
  const videoUrl = cleanOptional(formData.get("video_url"));
  const authorName = cleanOptional(formData.get("author_name")) || "Admin";
  const authorEmail =
    cleanOptional(formData.get("author_email")) || user.email || "admin";
  const categoryInput = String(formData.get("category_slug") || "hope")
    .trim()
    .toLowerCase();

  const categorySlug = allowedCategories.has(categoryInput)
    ? categoryInput
    : "hope";

  if (submissionType === "article_link" && !sourceUrl) {
    redirect(
      "/admin/stories/new?error=Please%20enter%20a%20source%20URL%20for%20article%20links."
    );
  }

  if (submissionType === "article_link" && sourceUrl) {
    const { data: existingStory } = await supabase
      .from("stories")
      .select("slug")
      .eq("source_url", sourceUrl)
      .maybeSingle();

    if (existingStory?.slug) {
      redirect(`/stories/${existingStory.slug}`);
    }
  }

  if (submissionType === "article_link" && sourceUrl) {
    const preview = await extractArticlePreview(sourceUrl);

    title = title || preview.title || guessTitleFromUrl(sourceUrl);
    summary = summary || preview.summary || null;
    sourceName =
      sourceName || preview.sourceName || inferPublicationNameFromUrl(sourceUrl);
    imageUrl = imageUrl || preview.imageUrl || null;
  }

  if (!title) {
    redirect(
      "/admin/stories/new?error=Please%20enter%20a%20title%20before%20publishing."
    );
  }

  const slug = await createUniqueSlug(supabase, title);
  const publishedAt = new Date().toISOString();

  const { data: insertedStory, error: storyError } = await supabase
    .from("stories")
    .insert({
      title,
      slug,
      summary,
      content,
      image_url: imageUrl,
      video_url: videoUrl,
      source_url: sourceUrl,
      source_name: sourceName,
      category_slug: categorySlug,
      publish_date: publishedAt,
      is_reader_submission: true,
      submitted_by_name: authorName,
      source_type: "admin",
      featured: false,
      story_score: 100,
      positivity_score: 100,
    })
    .select("id, slug")
    .single();

  if (storyError || !insertedStory) {
    console.error("Admin story insert error:", storyError);
    redirect(
      `/admin/stories/new?error=${encodeURIComponent(
        storyError?.message || "Failed to publish story."
      )}`
    );
  }

  const { data: insertedSubmission, error: submissionError } = await supabase
    .from("reader_submissions")
    .insert({
      submission_type: submissionType,
      status: "published",
      title,
      slug,
      summary,
      content,
      source_url: sourceUrl,
      source_name: sourceName,
      author_name: authorName,
      author_email: authorEmail,
      image_url: imageUrl,
      video_url: videoUrl,
      category_slug: categorySlug,
      consent_original: submissionType === "original_story",
      consent_publication_rights: submissionType === "article_link",
      consent_terms: true,
      moderation_notes: "Admin-created and auto-published",
      linked_story_id: insertedStory.id,
    })
    .select("id")
    .single();

  if (submissionError) {
    console.error("Admin submission log insert error:", submissionError);
  }

  if (insertedSubmission?.id) {
    await supabase.from("reader_submission_events").insert({
      submission_id: insertedSubmission.id,
      event_type: "admin_published",
      notes: "Admin-created story published directly to stories table",
    });
  }

  redirect(`/stories/${insertedStory.slug}`);
}