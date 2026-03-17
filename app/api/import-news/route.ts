import Parser from "rss-parser";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const logs: string[] = [];

  try {
    const parser = new Parser();

    const feeds = [
      "https://www.goodnewsnetwork.org/feed/",
      "https://www.positive.news/feed/",
    ];

    for (const feedUrl of feeds) {
      const feed = await parser.parseURL(feedUrl);

      logs.push(`Feed: ${feed.title}`);
      logs.push(`Items: ${feed.items.length}`);

      for (const item of feed.items.slice(0, 10)) {
        try {
          const article = {
            title: item.title ?? "Untitled",
            url: item.link ?? "",
            summary: item.contentSnippet ?? "",
            published_at: item.pubDate ?? new Date().toISOString(),
          };

          const { error } = await supabase
            .from("articles")
            .upsert(article, { onConflict: "url" });

          if (error) {
            logs.push(`Upsert error: ${error.message}`);
          } else {
            logs.push(`Inserted/updated: ${article.title}`);
          }
        } catch (err) {
          logs.push(`Upsert error: ${String(err)}`);
        }
      }
    }

    return Response.json({
      success: true,
      logs,
    });
  } catch (err) {
    logs.push(`Route error: ${String(err)}`);

    return Response.json({
      success: false,
      logs,
    });
  }
}