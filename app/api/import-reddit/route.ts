import Parser from "rss-parser";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const supabase = createAdminClient();

const IMPORTER_VERSION = "reddit-rss-import-v1";

const SUBREDDIT = "MadeMeSmile";
const REDDIT_RSS_URL = `https://www.reddit.com/r/${SUBREDDIT}/top/.rss?t=day`;

const MIN_IMPORT_COUNT = 1;
const MAX_ITEMS_TO_CHECK = 15;

type RedditFeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  id?: string;
};

function slugify(text: string) {
  const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "these",
    "this",
    "to",
    "was",
    "were",
    "with",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP_WORDS.has(word));

  const shortened: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const additionalLength = word.length + (shortened.length ? 1 : 0);

    if (currentLength + additionalLength > 70) {
      break;
    }

    shortened.push(word);
    currentLength += additionalLength;
  }

  return shortened.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function extractRedditPostId(link: string) {
  const match = link.match(/\/comments\/([a-z0-9]+)\//i);
  return match?.[1] || null;
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

function stripHtml(html = "") {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstImage(content = "") {
  const imageMatch =
    content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ||
    content.match(/href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i)?.[1];

  if (!imageMatch) return null;

  const cleaned = decodeHtmlEntities(imageMatch.trim());

  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (/avatar|icon|logo|sprite|1x1|pixel/i.test(cleaned)) return null;

  return cleaned;
}

function extractVideoUrl(content = "", link = "") {
  const decodedContent = decodeHtmlEntities(content);

  const directVideo =
    decodedContent.match(/https?:\/\/v\.redd\.it\/[a-z0-9]+/i)?.[0] ||
    decodedContent.match(/https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/i)?.[0];

  if (directVideo) return directVideo;

  const externalVideo =
    decodedContent.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^"'\s<>]+/i)?.[0] ||
    decodedContent.match(/https?:\/\/youtu\.be\/[^"'\s<>]+/i)?.[0] ||
    decodedContent.match(/https?:\/\/(?:www\.)?vimeo\.com\/[^"'\s<>]+/i)?.[0];

  if (externalVideo) return externalVideo;

  if (/\/comments\//i.test(link)) return null;

  return null;
}

function containsBlockedTopic(title: string, content: string) {
  const text = `${title} ${content}`.toLowerCase();

  const blockedPatterns = [
    /\bpolitics?\b/i,
    /\belection\b/i,
    /\btrump\b/i,
    /\bbiden\b/i,
    /\bwar\b/i,
    /\bshooting\b/i,
    /\bmurder\b/i,
    /\babuse\b/i,
    /\bnsfw\b/i,
    /\baita\b/i,
  ];

  return blockedPatterns.some((pattern) => pattern.test(text));
}

function buildSummary(title: string, content: string) {
  const cleaned = stripHtml(content);

  if (cleaned && cleaned.length > 40) {
    return cleaned.slice(0, 350).trim();
  }

  return `Popular uplifting Reddit post from r/${SUBREDDIT}: ${title}`;
}

export async function GET() {
  const logs: string[] = [];

  try {
    logs.push(`IMPORTER_VERSION: ${IMPORTER_VERSION}`);
    logs.push(`Source: r/${SUBREDDIT} RSS`);

    const parser = new Parser<Record<string, never>, RedditFeedItem>({
      headers: {
        "User-Agent": "TheGoodInUsBot/1.0 (+https://www.thegoodinus.net)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    const feed = await parser.parseURL(REDDIT_RSS_URL);
    const items = (feed.items || []).slice(0, MAX_ITEMS_TO_CHECK);

    logs.push(`Fetched ${feed.items.length} RSS items`);
    logs.push(`Checking ${items.length} items`);

    let saved = 0;
    let skipped = 0;

    for (const item of items) {
      const title = item.title?.trim() || "Untitled Reddit post";
      const link = item.link?.trim() || "";

      if (!link) {
        skipped += 1;
        logs.push(`Skipped "${title}" (missing link)`);
        continue;
      }

      const redditPostId = extractRedditPostId(link);

      if (!redditPostId) {
        skipped += 1;
        logs.push(`Skipped "${title}" (missing Reddit post id)`);
        continue;
      }

      const rawContent = item.content || item.contentSnippet || "";

      if (containsBlockedTopic(title, rawContent)) {
        skipped += 1;
        logs.push(`Skipped "${title}" (blocked topic)`);
        continue;
      }

      const imageUrl = extractFirstImage(rawContent);
      const videoUrl = extractVideoUrl(rawContent, link);

      if (!imageUrl && !videoUrl) {
        skipped += 1;
        logs.push(`Skipped "${title}" (no image or video found in RSS)`);
        continue;
      }

      const { data: existing } = await supabase
        .from("stories")
        .select("id")
        .eq("reddit_post_id", redditPostId)
        .maybeSingle();

      if (existing) {
        skipped += 1;
        logs.push(`Skipped duplicate "${title}"`);
        continue;
      }

      const publishDate = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString();

      const summary = buildSummary(title, rawContent);
      const slug = `${slugify(title)}-${redditPostId}`;

      const insertPayload = {
        title,
        slug,
        summary,
        content: `
          <p>
            Originally shared on Reddit in r/${SUBREDDIT}.
          </p>

          <p>
            <a href="${link}" target="_blank" rel="noopener noreferrer">
              View original Reddit thread
            </a>
          </p>
        `,
        image_url: imageUrl,
        video_url: videoUrl,
        source_url: link,
        source_name: `Reddit / r/${SUBREDDIT}`,
        source_type: "reddit",
        is_reddit_post: true,
        reddit_post_id: redditPostId,
        reddit_subreddit: SUBREDDIT,
        reddit_author: null,
        reddit_permalink: link,
        reddit_score: null,
        reddit_comments_count: null,
        reddit_upvote_ratio: null,
        reddit_created_utc: publishDate,
        category_slug: "reddit",
        publish_date: publishDate,
        story_score: 100,
        positivity_score: 100,
        featured: false,
      };

      const { error } = await supabase.from("stories").insert(insertPayload);

      if (error) {
        skipped += 1;
        logs.push(`Insert failed "${title}": ${error.message}`);
        continue;
      }

      saved += 1;
      logs.push(`Saved "${title}"`);

      if (saved >= MIN_IMPORT_COUNT) {
        // Keep RSS import conservative for now.
        // Remove this break later if you want more Reddit posts per run.
        break;
      }
    }

    logs.push(`Saved: ${saved}`);
    logs.push(`Skipped: ${skipped}`);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        logs: [
          error instanceof Error
            ? error.message
            : "Unknown Reddit RSS importer error",
        ],
      },
      { status: 500 }
    );
  }
}