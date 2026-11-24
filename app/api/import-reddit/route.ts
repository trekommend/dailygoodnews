
import Parser from "rss-parser";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const IMPORTER_VERSION = "reddit-rss-import-v4-resilient";

const SUBREDDIT = "MadeMeSmile";

const REDDIT_RSS_URLS = [
  `https://www.reddit.com/r/${SUBREDDIT}/top/.rss?t=day`,
  `https://www.reddit.com/r/${SUBREDDIT}/.rss`,
];

const MAX_IMPORT_COUNT = 5;
const MAX_ITEMS_TO_CHECK = 25;
const RSS_TIMEOUT_MS = 10000;

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
    const additionalLength =
      word.length + (shortened.length ? 1 : 0);

    if (currentLength + additionalLength > 70) {
      break;
    }

    shortened.push(word);
    currentLength += additionalLength;
  }

  return shortened
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractRedditPostId(link: string) {
  const match = link.match(
    /\/comments\/([a-z0-9]+)(?:\/|$)/i
  );

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

function cleanUrl(
  value: string | null | undefined
) {
  if (!value) return null;

  const cleaned = decodeHtmlEntities(value.trim());

  if (!/^https?:\/\//i.test(cleaned)) {
    return null;
  }

  if (/avatar|icon|logo|sprite|1x1|pixel/i.test(cleaned)) {
    return null;
  }

  try {
    const url = new URL(cleaned);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function extractFirstImage(content = "") {
  const decoded = decodeHtmlEntities(content);

  const candidates = [
    decoded.match(
      /https?:\/\/i\.redd\.it\/[^"'\s<>]+/i
    )?.[0],

    decoded.match(
      /https?:\/\/preview\.redd\.it\/[^"'\s<>]+/i
    )?.[0],

    decoded.match(
      /href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i
    )?.[1],

    decoded.match(
      /https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/i
    )?.[0],

    decoded.match(
      /<img[^>]+src=["']([^"']+)["']/i
    )?.[1],
  ];

  for (const candidate of candidates) {
    const cleaned = cleanUrl(candidate);

    if (!cleaned) continue;

    // Preserve Reddit preview URLs and their query
    // parameters, which may be required for the image.
    return cleaned;
  }

  return null;
}

function extractVideoUrl(content = "") {
  const decoded = decodeHtmlEntities(content);

  const candidates = [
    decoded.match(
      /https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/i
    )?.[0],

    decoded.match(
      /https?:\/\/v\.redd\.it\/[a-z0-9]+/i
    )?.[0],

    decoded.match(
      /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[^"'\s<>]+/i
    )?.[0],

    decoded.match(
      /https?:\/\/youtu\.be\/[^"'\s<>]+/i
    )?.[0],

    decoded.match(
      /https?:\/\/(?:www\.)?vimeo\.com\/[^"'\s<>]+/i
    )?.[0],
  ];

  for (const candidate of candidates) {
    const cleaned = cleanUrl(candidate);

    if (cleaned) return cleaned;
  }

  return null;
}

function containsBlockedTopic(
  title: string,
  content: string
) {
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

  return blockedPatterns.some((pattern) =>
    pattern.test(text)
  );
}

function buildSummary(
  title: string,
  content: string
) {
  const cleaned = stripHtml(content);

  if (cleaned && cleaned.length > 40) {
    return cleaned.slice(0, 350).trim();
  }

  return `Popular uplifting Reddit post from r/${SUBREDDIT}: ${title}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function getPublishDate(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

/*
 * REDDIT RSS FETCHING
 *
 * Try the top daily feed first.
 * Fall back to the standard subreddit feed.
 * Log each request and failure.
 */

async function fetchRedditFeed(logs: string[]) {
  const parser = new Parser<
    Record<string, never>,
    RedditFeedItem
  >({
    timeout: RSS_TIMEOUT_MS,

    headers: {
      "User-Agent":
        "TheGoodInUsBot/1.0 (+https://www.thegoodinus.net)",

      Accept:
        "application/atom+xml, application/rss+xml, application/xml, text/xml",
    },
  });

  for (const url of REDDIT_RSS_URLS) {
    logs.push(`Trying RSS URL: ${url}`);

    try {
      const feed = await parser.parseURL(url);

      const items = feed.items || [];

      logs.push(
        `RSS request successful: ${url}`
      );

      logs.push(
        `Fetched ${items.length} RSS items`
      );

      return {
        items,
        sourceUrl: url,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      logs.push(
        `RSS request failed: ${url}`
      );

      logs.push(
        `RSS error: ${message}`
      );

      console.error(
        "[Reddit importer] RSS request failed",
        {
          url,
          error: message,
        }
      );

      // Do not try alternate endpoints to circumvent
      // an explicit access restriction or rate limit.
      if (/\b(?:401|403|429)\b/.test(message)) {
        throw new Error(
          `Reddit access restricted: ${message}`
        );
      }
    }
  }

  throw new Error(
    "All Reddit RSS endpoints failed"
  );
}

export async function GET() {
  const logs: string[] = [];

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  try {
    logs.push(
      `IMPORTER_VERSION: ${IMPORTER_VERSION}`
    );

    logs.push(
      `Source: r/${SUBREDDIT} RSS`
    );

    const supabase = createAdminClient();

    const feed = await fetchRedditFeed(logs);

    const items = feed.items.slice(
      0,
      MAX_ITEMS_TO_CHECK
    );

    logs.push(
      `Using RSS feed: ${feed.sourceUrl}`
    );

    logs.push(
      `Checking ${items.length} items`
    );

    for (const item of items) {
      const title =
        item.title?.trim() ||
        "Untitled Reddit post";

      try {
        const link = item.link?.trim() || "";

        if (!link) {
          skipped += 1;

          logs.push(
            `Skipped "${title}" (missing link)`
          );

          continue;
        }

        const redditPostId =
          extractRedditPostId(link);

        if (!redditPostId) {
          skipped += 1;

          logs.push(
            `Skipped "${title}" (missing Reddit post id)`
          );

          continue;
        }

        const rawContent =
          item.content ||
          item.contentSnippet ||
          "";

        if (
          containsBlockedTopic(
            title,
            rawContent
          )
        ) {
          skipped += 1;

          logs.push(
            `Skipped "${title}" (blocked topic)`
          );

          continue;
        }

        const imageUrl =
          extractFirstImage(rawContent);

        let videoUrl =
          extractVideoUrl(rawContent);

        const isRedditHostedVideo =
          /v\.redd\.it/i.test(rawContent);

        if (
          isRedditHostedVideo &&
          !videoUrl
        ) {
          videoUrl = link;
        }

        const hasUsableMedia = Boolean(
          imageUrl || videoUrl
        );

        if (!hasUsableMedia) {
          skipped += 1;

          logs.push(
            `Skipped "${title}" (no usable image or video found in RSS)`
          );

          continue;
        }

        /*
         * DUPLICATE CHECK
         */

        const {
          data: existing,
          error: duplicateError,
        } = await supabase
          .from("stories")
          .select("id")
          .eq("reddit_post_id", redditPostId)
          .maybeSingle();

        if (duplicateError) {
          errors += 1;

          logs.push(
            `Duplicate check failed "${title}": ${duplicateError.message}`
          );

          continue;
        }

        if (existing) {
          skipped += 1;

          logs.push(
            `Skipped duplicate "${title}"`
          );

          continue;
        }

        const publishDate = getPublishDate(
          item.pubDate
        );

        const summary = buildSummary(
          title,
          rawContent
        );

        const baseSlug =
          slugify(title) || "reddit-story";

        const slug =
          `${baseSlug}-${redditPostId}`;

        /*
         * SUPABASE INSERT
         */

        const insertPayload = {
          title,
          slug,
          summary,
          content: null,

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

        const { error } = await supabase
          .from("stories")
          .insert(insertPayload);

        if (error) {
          errors += 1;

          logs.push(
            `Insert failed "${title}": ${error.message}`
          );

          continue;
        }

        saved += 1;

        logs.push(
          `Saved "${title}"`
        );

        if (saved >= MAX_IMPORT_COUNT) {
          logs.push(
            `Reached maximum import count: ${MAX_IMPORT_COUNT}`
          );

          break;
        }
      } catch (error) {
        errors += 1;

        logs.push(
          `Item failed "${title}": ${getErrorMessage(error)}`
        );

        continue;
      }
    }

    logs.push(`Saved: ${saved}`);
    logs.push(`Skipped: ${skipped}`);
    logs.push(`Errors: ${errors}`);

    const success = errors === 0;

    console.log(
      "[Reddit importer] Completed",
      {
        version: IMPORTER_VERSION,
        success,
        saved,
        skipped,
        errors,
      }
    );

    return NextResponse.json(
      {
        success,
        version: IMPORTER_VERSION,
        subreddit: SUBREDDIT,
        feedUrl: feed.sourceUrl,
        saved,
        skipped,
        errors,
        logs,
      },
      {
        status: success ? 200 : 500,
      }
    );
  } catch (error) {
    const message = getErrorMessage(error);

    logs.push(
      `IMPORTER FAILED: ${message}`
    );

    console.error(
      "[Reddit importer] Failed",
      {
        version: IMPORTER_VERSION,
        error: message,
        logs,
      }
    );

    return NextResponse.json(
      {
        success: false,
        version: IMPORTER_VERSION,
        subreddit: SUBREDDIT,
        saved,
        skipped,
        errors: errors + 1,
        error: message,
        logs,
      },
      {
        status: 500,
      }
    );
  }
}
