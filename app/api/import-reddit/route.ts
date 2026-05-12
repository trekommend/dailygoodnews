import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const supabase = createAdminClient();

const IMPORTER_VERSION = "reddit-import-v1";

const REDDIT_URL =
  "https://www.reddit.com/r/MadeMeSmile/top.json?t=day&limit=15";

const MIN_SCORE = 5000;
const MIN_COMMENTS = 50;

type RedditPost = {
  id: string;
  title: string;
  selftext?: string;
  permalink: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  upvote_ratio?: number;
  created_utc: number;
  url?: string;
  thumbnail?: string;
  is_video?: boolean;
  over_18?: boolean;
  post_hint?: string;
  media?: any;
  secure_media?: any;
  preview?: any;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

function getVideoUrl(post: RedditPost): string | null {
  try {
    if (
      post.secure_media?.reddit_video?.fallback_url
    ) {
      return post.secure_media.reddit_video.fallback_url;
    }

    if (
      typeof post.url === "string" &&
      (
        post.url.includes("youtube.com") ||
        post.url.includes("youtu.be") ||
        post.url.includes("vimeo.com")
      )
    ) {
      return post.url;
    }

    return null;
  } catch {
    return null;
  }
}

function getImageUrl(post: RedditPost): string | null {
  try {
    const previewImage =
      post.preview?.images?.[0]?.source?.url;

    if (
      previewImage &&
      typeof previewImage === "string"
    ) {
      return previewImage
        .replace(/&amp;/g, "&");
    }

    if (
      post.thumbnail &&
      typeof post.thumbnail === "string" &&
      post.thumbnail.startsWith("http")
    ) {
      return post.thumbnail;
    }

    if (
      post.url &&
      (
        post.url.endsWith(".jpg") ||
        post.url.endsWith(".jpeg") ||
        post.url.endsWith(".png") ||
        post.url.endsWith(".webp")
      )
    ) {
      return post.url;
    }

    return null;
  } catch {
    return null;
  }
}

function shouldImport(post: RedditPost) {
  if (!post.title) {
    return {
      accepted: false,
      reason: "Missing title",
    };
  }

  if (post.over_18) {
    return {
      accepted: false,
      reason: "NSFW",
    };
  }

  if (post.score < MIN_SCORE) {
    return {
      accepted: false,
      reason: `Low score (${post.score})`,
    };
  }

  if (post.num_comments < MIN_COMMENTS) {
    return {
      accepted: false,
      reason: `Low comments (${post.num_comments})`,
    };
  }

  const hasVideo = !!getVideoUrl(post);
  const hasImage = !!getImageUrl(post);

  if (!hasVideo && !hasImage) {
    return {
      accepted: false,
      reason: "No image or video",
    };
  }

  return {
    accepted: true,
    reason: "Accepted",
  };
}

export async function GET() {
  const logs: string[] = [];

  try {
    logs.push(`IMPORTER_VERSION: ${IMPORTER_VERSION}`);

    const response = await fetch(REDDIT_URL, {
      headers: {
        "User-Agent":
          "TheGoodInUsBot/1.0 (+https://www.thegoodinus.net)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          logs: [
            `Reddit fetch failed (${response.status})`,
          ],
        },
        { status: 500 }
      );
    }

    const json = await response.json();

    const posts: RedditPost[] =
      json?.data?.children?.map(
        (child: any) => child.data
      ) || [];

    logs.push(`Fetched ${posts.length} Reddit posts`);

    let saved = 0;
    let skipped = 0;

    for (const post of posts) {
      const decision = shouldImport(post);

      if (!decision.accepted) {
        skipped++;

        logs.push(
          `Skipped "${post.title}" (${decision.reason})`
        );

        continue;
      }

      const permalink = `https://www.reddit.com${post.permalink}`;

      const { data: existing } = await supabase
        .from("stories")
        .select("id")
        .eq("reddit_post_id", post.id)
        .maybeSingle();

      if (existing) {
        skipped++;

        logs.push(
          `Skipped duplicate "${post.title}"`
        );

        continue;
      }

      const imageUrl = getImageUrl(post);
      const videoUrl = getVideoUrl(post);

      const slug =
        `${slugify(post.title)}-${post.id}`;

      const summary =
        post.selftext?.trim()?.slice(0, 400) ||
        `Popular uplifting Reddit post from r/${post.subreddit}.`;

      const publishDate = new Date(
        post.created_utc * 1000
      ).toISOString();

      const insertPayload = {
        title: post.title,
        slug,
        summary,
        content: `
          <p>
            Originally shared on Reddit in r/${post.subreddit}.
          </p>

          <p>
            <a href="${permalink}" target="_blank" rel="noopener noreferrer">
              View original Reddit thread
            </a>
          </p>
        `,
        image_url: imageUrl,
        video_url: videoUrl,
        source_url: permalink,
        source_name: "Reddit / r/MadeMeSmile",
        source_type: "reddit",
        is_reddit_post: true,
        reddit_post_id: post.id,
        reddit_subreddit: post.subreddit,
        reddit_author: post.author,
        reddit_permalink: permalink,
        reddit_score: post.score,
        reddit_comments_count: post.num_comments,
        reddit_upvote_ratio: post.upvote_ratio || null,
        reddit_created_utc: publishDate,
        category_slug: "reddit",
        publish_date: publishDate,
        story_score: post.score,
        positivity_score: 100,
        featured: false,
      };

      const { error } = await supabase
        .from("stories")
        .insert(insertPayload);

      if (error) {
        skipped++;

        logs.push(
          `Insert failed "${post.title}": ${error.message}`
        );

        continue;
      }

      saved++;

      logs.push(`Saved "${post.title}"`);
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
            : "Unknown Reddit importer error",
        ],
      },
      { status: 500 }
    );
  }
}