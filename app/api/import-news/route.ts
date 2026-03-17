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

function extractImage(item: FeedItem): string | null {
  return (
    item.enclosure?.url ||
    item["media:content"]?.$?.url ||
    item["media:thumbnail"]?.$?.url ||
    item.content?.match(/<img[^>]+src="([^"]+)"/)?.[1] ||
    item["content:encoded"]?.match(/<img[^>]+src="([^"]+)"/)?.[1] ||
    null
  );
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
          const imageUrl = extractImage(item);
          const slug = makeUniqueSlug(title, sourceUrl);
          const categorySlug = guessCategory(title, summary);

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
              `Saved row: ${data.title} | publish_date: ${data.publish_date} | image: ${data.image_url ? "yes" : "no"}`
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