import { NextResponse } from "next/server";
import { BskyAgent, RichText } from "@atproto/api";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoryRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  image_url: string | null;
  category_slug: string | null;
  publish_date: string | null;
  bluesky_posted_at: string | null;
  bluesky_post_uri: string | null;
};

type RequestBody = {
  storyId?: string;
  slug?: string;
  force?: boolean;
};

const MAX_POST_LENGTH = 300;
const MAX_EXTERNAL_TITLE_LENGTH = 300;
const MAX_EXTERNAL_DESCRIPTION_LENGTH = 300;
const MAX_IMAGE_BYTES = 1_000_000;

function cleanText(value: string | null | undefined) {
  return (value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return characters.slice(0, Math.max(0, maxLength)).join("");
  }

  const shortened = characters.slice(0, maxLength - 1).join("");
  const lastSpace = shortened.lastIndexOf(" ");

  const trimmed =
    lastSpace > Math.floor(maxLength * 0.55)
      ? shortened.slice(0, lastSpace)
      : shortened;

  return `${trimmed.trim()}…`;
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function formatCategoryHashtag(categorySlug: string | null) {
  switch (categorySlug) {
    case "animals":
      return "#Animals";
    case "health":
      return "#Health";
    case "community":
      return "#Community";
    case "kindness":
      return "#Kindness";
    case "hope":
      return "#Hope";
    case "reddit":
    case "user-stories":
      return "#CommunityStories";
    default:
      return "#GoodNews";
  }
}

function buildPostText(story: StoryRow, storyUrl: string) {
  const categoryHashtag = formatCategoryHashtag(story.category_slug);

  const suffix = `\n\n${storyUrl}\n\n#GoodNews ${categoryHashtag}`;
  const suffixLength = Array.from(suffix).length;
  const availableTitleLength = Math.max(
    40,
    MAX_POST_LENGTH - suffixLength
  );

  const title = truncateText(
    cleanText(story.title),
    availableTitleLength
  );

  return `${title}${suffix}`;
}

function getSafeImageContentType(response: Response, imageUrl: string) {
  const responseType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (
    responseType === "image/jpeg" ||
    responseType === "image/png" ||
    responseType === "image/webp"
  ) {
    return responseType;
  }

  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";

  return "image/jpeg";
}

async function requireAdmin() {
  const authClient = await createClient();

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { success: false, error: "You must be signed in." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { success: false, error: "Admin access is required." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true as const,
    user,
  };
}

async function uploadExternalThumbnail(
  agent: BskyAgent,
  imageUrl: string | null
) {
  if (!imageUrl) {
    return null;
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; TheGoodInUsBlueskyBot/1.0)",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(
        `[Bluesky] Image fetch failed: ${response.status} ${imageUrl}`
      );
      return null;
    }

    const declaredLength = Number(
      response.headers.get("content-length") || "0"
    );

    if (declaredLength > MAX_IMAGE_BYTES) {
      console.warn(
        `[Bluesky] Image is too large: ${declaredLength} bytes`
      );
      return null;
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      console.warn("[Bluesky] Image response was empty.");
      return null;
    }

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(
        `[Bluesky] Image exceeds upload limit: ${buffer.byteLength} bytes`
      );
      return null;
    }

    const encoding = getSafeImageContentType(response, imageUrl);

    const uploaded = await agent.uploadBlob(new Uint8Array(buffer), {
      encoding,
    });

    return uploaded.data.blob;
  } catch (error) {
    console.warn("[Bluesky] Thumbnail upload skipped:", error);
    return null;
  }
}

export async function POST(request: Request) {
  const authorization = await requireAdmin();

  if (!authorization.authorized) {
    return authorization.response;
  }

  const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
  const appPassword = process.env.BLUESKY_APP_PASSWORD?.trim();
  const siteUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.thegoodinus.net"
  );

  if (!identifier || !appPassword) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD.",
      },
      { status: 500 }
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be valid JSON.",
      },
      { status: 400 }
    );
  }

  const storyId = body.storyId?.trim();
  const slug = body.slug?.trim();
  const force = body.force === true;

  if (!storyId && !slug) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide either storyId or slug.",
      },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let storyQuery = supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, category_slug, publish_date, bluesky_posted_at, bluesky_post_uri"
    );

  if (storyId) {
    storyQuery = storyQuery.eq("id", storyId);
  } else {
    storyQuery = storyQuery.eq("slug", slug as string);
  }

  const { data: storyData, error: storyError } =
    await storyQuery.maybeSingle();

  if (storyError) {
    console.error("[Bluesky] Story lookup error:", storyError);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load the story.",
        details: storyError.message,
      },
      { status: 500 }
    );
  }

  if (!storyData) {
    return NextResponse.json(
      {
        success: false,
        error: "Story not found.",
      },
      { status: 404 }
    );
  }

  const story = storyData as StoryRow;

  if (story.bluesky_posted_at && !force) {
    return NextResponse.json(
      {
        success: false,
        error: "This story has already been posted to Bluesky.",
        blueskyPostUri: story.bluesky_post_uri,
        postedAt: story.bluesky_posted_at,
        hint: "Send force: true only if you intentionally want to post it again.",
      },
      { status: 409 }
    );
  }

  const storyUrl = `${siteUrl}/stories/${encodeURIComponent(
    story.slug
  )}`;

  const postText = buildPostText(story, storyUrl);

  try {
    const agent = new BskyAgent({
      service: "https://bsky.social",
    });

    await agent.login({
      identifier,
      password: appPassword,
    });

    const richText = new RichText({
      text: postText,
    });

    await richText.detectFacets(agent);

    const thumbnail = await uploadExternalThumbnail(
      agent,
      story.image_url
    );

    const externalEmbed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: storyUrl,
        title: truncateText(
          cleanText(story.title),
          MAX_EXTERNAL_TITLE_LENGTH
        ),
        description: truncateText(
          cleanText(story.summary) ||
            "Read this uplifting story from The Good in Us.",
          MAX_EXTERNAL_DESCRIPTION_LENGTH
        ),
        ...(thumbnail ? { thumb: thumbnail } : {}),
      },
    };

    const postResult = await agent.post({
      text: richText.text,
      facets: richText.facets,
      embed: externalEmbed,
      langs: ["en-US"],
      createdAt: new Date().toISOString(),
    });

    const postedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("stories")
      .update({
        bluesky_posted_at: postedAt,
        bluesky_post_uri: postResult.uri,
      })
      .eq("id", story.id);

    if (updateError) {
      console.error(
        "[Bluesky] Post succeeded, but tracking update failed:",
        updateError
      );

      return NextResponse.json(
        {
          success: true,
          warning:
            "The Bluesky post was created, but its tracking fields were not saved.",
          storyId: story.id,
          storySlug: story.slug,
          storyUrl,
          blueskyPostUri: postResult.uri,
          blueskyPostCid: postResult.cid,
          text: postText,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        storyId: story.id,
        storySlug: story.slug,
        storyUrl,
        blueskyPostUri: postResult.uri,
        blueskyPostCid: postResult.cid,
        postedAt,
        text: postText,
        imageAttached: Boolean(thumbnail),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Bluesky] Posting error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown Bluesky posting error.";

    return NextResponse.json(
      {
        success: false,
        error: "Failed to publish the story to Bluesky.",
        details: message,
      },
      { status: 500 }
    );
  }
}