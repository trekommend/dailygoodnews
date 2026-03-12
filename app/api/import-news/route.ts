import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const parser = new Parser();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const feeds = [
    {
      url: "https://www.goodnewsnetwork.org/feed/",
      source: "Good News Network",
    },
    {
      url: "https://www.positive.news/feed/",
      source: "Positive News",
    },
  ];

  for (const feedInfo of feeds) {
    const feed = await parser.parseURL(feedInfo.url);

    for (const item of feed.items.slice(0, 10)) {
      await supabase.from("stories").upsert(
        {
          title: item.title,
          content: item.contentSnippet,
          source_name: feedInfo.source,
          source_url: item.link,
        },
        { onConflict: "source_url" }
      );
    }
  }

  return NextResponse.json({ success: true });
}