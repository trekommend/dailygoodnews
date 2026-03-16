import Parser from "rss-parser";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const logs: string[] = [];

  try {
    // Debug environment variables
    logs.push(`SUPABASE URL exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    logs.push(`SUPABASE KEY exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
    logs.push(`SUPABASE URL value: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

    const parser = new Parser();

    const feeds = [
      "https://www.goodnewsnetwork.org/feed/",
      "https://www.positive.news/feed/",
    ];

    for (const feedUrl of feeds) {
      const feed = await parser.parseURL(feedUrl);

      logs.push(`Feed: ${feed.title}`);
      logs.push(`Items: ${feed.items.length}`);

      // Limit to first 10 items per feed for testing
      for (const item of feed.items.slice(0, 10)) {
        try {
          const { error } = await supabase.from("articles").insert({
            title: item.title ?? "Untitled",
            url: item.link ?? "",
            summary: item.contentSnippet ?? "",
            published_at: item.pubDate ?? new Date().toISOString(),
          });

          if (error) {
            logs.push(`Insert error: ${error.message}`);
          } else {
            logs.push(`Inserted: ${item.title}`);
          }
        } catch (err) {
          logs.push(`Insert error: ${String(err)}`);
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