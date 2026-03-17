import Parser from "rss-parser";
import { supabase } from "@/lib/supabase";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: {
    url?: string;
  };
  ["content:encoded"]?: string;
  ["media:content"]?: { $?: { url?: string } };
  ["media:thumbnail"]?: { $?: { url?: string } };
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function makeUniqueSlug(title: string, sourceUrl: string) {
  const base = slugify(title);
  const suffix = sourceUrl
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);

  return `${base}-${suffix}`;
}

function guessCategory(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();

  if (/animal|bird|dog|cat|wildlife|species|zoo/.test(text)) return "animals";
  if (/health|hospital|medical|therapy|wellness/.test(text)) return "health";
  if (/community|school|volunteer|neighbors|family/.test(text)) return "community";
  if (/kindness|charity|helped|donated|gift/.test(text)) return "kindness";

  return "hope";
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
  const cleaned = absoluteUrl(url.trim(), baseUrl);
  if (!/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
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
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

function cleanStoryText(text: string) {
  return decodeHtmlEntities(stripHtml(text))
    .replace(/\[\u2026\]|\[\.\.\.\]/g, "")
    .replace(/The post .*? appeared first on .*?\.?/gi, "")
    .replace(/Continue reading.*$/gi, "")
    .replace(/Read more.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function chooseBestContent(summary: string, rawContent: string) {
  const cleanedSummary = cleanStoryText(summary);
  const cleanedContent = cleanStoryText(rawContent);

  if (!cleanedContent) {
    return {
      summary: cleanedSummary,
      content: cleanedSummary,
    };
  }

  const normalizedSummary = normalizeForComparison(cleanedSummary);
  const normalizedContent = normalizeForComparison(cleanedContent);

  const contentIsMostlySame =
    !!normalizedSummary &&
    (normalizedContent === normalizedSummary ||
      normalizedContent.startsWith(normalizedSummary) ||
      normalizedSummary.startsWith(normalizedContent));

  if (contentIsMostlySame) {
    return {
      summary: cleanedSummary,
      content: cleanedSummary,
    };
  }

  return {
    summary: cleanedSummary,
    content: cleanedContent,
  };
}

function extractImageFromFeed(item: FeedItem, sourceUrl: string): string | null {
  return (
    cleanImageUrl(item.enclosure?.url, sourceUrl) ||
    cleanImageUrl(item["media:content"]?.$?.url, sourceUrl) ||
    cleanImageUrl(item["media:thumbnail"]?.$?.url, sourceUrl) ||
    cleanImageUrl(item.content?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], sourceUrl) ||
    cleanImageUrl(item["content:encoded"]?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], sourceUrl) ||
    null
  );
}

function extractBestImageFromHtml(html: string, articleUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i,
    /<img[^>]+data-lazy-src=["']([^"']+)["']/i,
    /<img[^>]+data-src=["']([^"']+)["']/i,
    /<img[^>]+srcset=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (!match) continue;

    let candidate = match;

    if (pattern.source.includes("srcset")) {
      candidate = match.split(",")[0]?.trim().split(" ")[0] ?? "";
    }

    const cleaned = cleanImageUrl(candidate, articleUrl);
    if (cleaned) return cleaned;
  }

  return null;
}

async function extractImageFromArticlePage(articleUrl: string): Promise<string | null> {
  try {
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari DailyGoodNewsBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractBestImageFromHtml(html, articleUrl);
  } catch {
    return null;
  }
}

export async function GET() {
  const logs: string[] = [];

  try {
    const parser = new Parser<any, FeedItem>({
      customFields: {
        item: [
          ["media:content", "media:content"],
          ["media:thumbnail", "media:thumbnail"],
          ["content:encoded", "content:encoded"],
        ],
      },
    });

    const feeds = [
      "https://www.goodnewsnetwork.org/feed/",
      "https://www.positive.news/feed/",
    ];

    let savedCount = 0;
    let feedImageCount = 0;
    let pageImageCount = 0;
    let existingImageCount = 0;
    let noImageCount = 0;
    let errorCount = 0;

    for (const feedUrl of feeds) {
      const feed = await parser.parseURL(feedUrl);
      logs.push(`Feed: ${feed.title} (${feed.items.length} items)`);

      for (const item of feed.items.slice(0, 10)) {
        try {
          const title = item.title ?? "Untitled";
          const rawSummary = item.contentSnippet ?? "";
          const rawContent = item["content:encoded"] ?? item.content ?? rawSummary;
          const sourceUrl = item.link ?? "";
          const publishDate = item.pubDate ?? new Date().toISOString();

          if (!sourceUrl) continue;

          const { summary, content } = chooseBestContent(rawSummary, rawContent);
          const slug = makeUniqueSlug(title, sourceUrl);
          const categorySlug = guessCategory(title, summary);

          const { data: existingRow } = await supabase
            .from("stories")
            .select("image_url")
            .eq("source_url", sourceUrl)
            .maybeSingle();

          let imageUrl = extractImageFromFeed(item, sourceUrl);
          let imageSource: "feed" | "page" | "existing" | "none" = imageUrl ? "feed" : "none";

          if (!imageUrl) {
            const scrapedImage = await extractImageFromArticlePage(sourceUrl);
            if (scrapedImage) {
              imageUrl = scrapedImage;
              imageSource = "page";
            }
          }

          if (!imageUrl && existingRow?.image_url) {
            imageUrl = existingRow.image_url;
            imageSource = "existing";
          }

          const story = {
            title,
            slug,
            summary,
            content,
            image_url: imageUrl,
            category_slug: categorySlug,
            featured: false,
            source_url: sourceUrl,
            publish_date: publishDate,
          };

          const { error } = await supabase
            .from("stories")
            .upsert(story, { onConflict: "source_url" });

          if (error) {
            errorCount += 1;
            logs.push(`Error saving "${title}": ${error.message}`);
            continue;
          }

          savedCount += 1;

          if (imageSource === "feed") feedImageCount += 1;
          else if (imageSource === "page") pageImageCount += 1;
          else if (imageSource === "existing") existingImageCount += 1;
          else noImageCount += 1;
        } catch (err) {
          errorCount += 1;
          logs.push(`Error saving item: ${String(err)}`);
        }
      }
    }

    logs.push(`Saved: ${savedCount}`);
    logs.push(`Images from feed: ${feedImageCount}`);
    logs.push(`Images from page: ${pageImageCount}`);
    logs.push(`Images kept from existing rows: ${existingImageCount}`);
    logs.push(`No image found: ${noImageCount}`);
    logs.push(`Errors: ${errorCount}`);

    return Response.json({ success: true, logs });
  } catch (err) {
    logs.push(`Route error: ${String(err)}`);
    return Response.json({ success: false, logs });
  }
}