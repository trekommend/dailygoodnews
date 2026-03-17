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

    logs.push(`SUPABASE URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    logs.push("Target table: stories");

    for (const feedUrl of feeds) {
      const feed = await parser.parseURL(feedUrl);

      logs.push(`Feed: ${feed.title}`);
      logs.push(`Items: ${feed.items.length}`);

      for (const item of feed.items.slice(0, 10)) {
        try {
          const title = item.title ?? "Untitled";
          const summary = item.contentSnippet ?? "";
          const content = item["content:encoded"] ?? item.content ?? summary;
          const sourceUrl = item.link ?? "";
          const publishDate = item.pubDate ?? new Date().toISOString();

          if (!sourceUrl) {
            logs.push(`Skipped row with missing source URL: ${title}`);
            continue;
          }

          const slug = makeUniqueSlug(title, sourceUrl);
          const categorySlug = guessCategory(title, summary);

          const { data: existingRow, error: existingError } = await supabase
            .from("stories")
            .select("id, image_url")
            .eq("source_url", sourceUrl)
            .maybeSingle();

          if (existingError) {
            logs.push(`Existing lookup error: ${existingError.message}`);
          }

          let imageUrl = extractImageFromFeed(item, sourceUrl);
          let imageSource = imageUrl ? "feed" : "none";

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

          const { data, error } = await supabase
            .from("stories")
            .upsert(story, { onConflict: "source_url" })
            .select("id, title, source_url, publish_date, image_url")
            .single();

          if (error) {
            logs.push(`Upsert error: ${error.message}`);
          } else {
            logs.push(
              `Saved row: ${data.title} | publish_date: ${data.publish_date} | image: ${data.image_url ? imageSource : "no"}`
            );
          }
        } catch (err) {
          logs.push(`Upsert error: ${String(err)}`);
        }
      }
    }

    const { count, error: countError } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true });

    if (countError) {
      logs.push(`Count error: ${countError.message}`);
    } else {
      logs.push(`Stories row count: ${count}`);
    }

    return Response.json({ success: true, logs });
  } catch (err) {
    logs.push(`Route error: ${String(err)}`);
    return Response.json({ success: false, logs });
  }
}