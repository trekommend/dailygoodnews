import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import type { Metadata } from "next";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

type StoryCard = {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  video_url?: string | null;
  category_slug: string | null;
  publish_date: string | null;
  is_reddit_post?: boolean | null;
  reddit_subreddit?: string | null;
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCategoryName(slug?: string | null) {
  if (!slug) return "Hope";

  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function stripHtml(text: string) {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getVideoThumbnail(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const videoId =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/shorts\/([^/?#]+)/)?.[1] ||
        url.pathname.match(/^\/embed\/([^/?#]+)/)?.[1];

      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    return null;
  } catch {
    return null;
  }
}

function getCardLabel(story: StoryCard) {
  if (story.is_reddit_post) {
    return story.reddit_subreddit ? `r/${story.reddit_subreddit}` : "Reddit";
  }

  return formatCategoryName(story.category_slug);
}

function getExcerpt(story: StoryCard) {
  if (story.is_reddit_post) {
    return story.video_url
      ? "Watch this feel-good Reddit video on the original thread."
      : "A feel-good Reddit post curated from r/MadeMeSmile.";
  }

  return stripHtml(story.summary || story.content || "").slice(0, 120);
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const categoryName = formatCategoryName(slug);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.thegoodinus.net";

  const description =
    slug === "reddit"
      ? "Uplifting posts from Reddit communities, curated by The Good in Us."
      : `Read uplifting ${categoryName.toLowerCase()} stories from The Good in Us. Positive reporting that inspires hope.`;

  return {
    title:
      slug === "reddit"
        ? "User Stories | The Good in Us"
        : `${categoryName} News | The Good in Us`,
    description,
    alternates: {
      canonical: `${siteUrl}/category/${slug}`,
    },
    openGraph: {
      title:
        slug === "reddit"
          ? "Reddit Good News | The Good in Us"
          : `${categoryName} News | The Good in Us`,
      description,
      url: `${siteUrl}/category/${slug}`,
      siteName: "The Good in Us",
      type: "website",
      images: [{ url: `${siteUrl}/og-image.jpg` }],
    },
    twitter: {
      card: "summary_large_image",
      title:
        slug === "reddit"
          ? "Reddit Good News | The Good in Us"
          : `${categoryName} News | The Good in Us`,
      description,
      images: [`${siteUrl}/og-image.jpg`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const categoryName = formatCategoryName(slug);
  const isRedditCategory = slug === "reddit";

  let query = supabase
  .from("stories")
  .select("*")
  .not("slug", "is", null)
  .order("publish_date", { ascending: false });

if (isRedditCategory) {
  query = query.or("category_slug.eq.reddit,is_reader_submission.eq.true");
} else {
  query = query.eq("category_slug", slug);
}

const { data } = await query;

  const stories = (data || []) as StoryCard[];

  return (
    <main
  style={{
    maxWidth: 980,
    margin: "auto",
    padding: "18px 40px 40px",
  }}
>
      <h1 style={{ marginBottom: 4 }}>
  {isRedditCategory ? "User Stories" : `${categoryName} News`}
</h1>

      <p
  style={{
    marginTop: 2,
    maxWidth: 720,
    color: "#475569",
    fontSize: 17,
    lineHeight: 1.7,
  }}
>
  {isRedditCategory
    ? "Uplifting stories from users across the internet."
    : `Discover uplifting ${categoryName.toLowerCase()} stories from around the world. The Good in Us highlights positive news, hopeful moments, and meaningful progress.`}
</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 22,
          marginTop: 30,
        }}
      >
        {stories.map((story) => {
          const isRedditVideo = Boolean(story.is_reddit_post && story.video_url);
          const videoThumbnail = isRedditVideo
            ? null
            : getVideoThumbnail(story.video_url);
          const displayImage = isRedditVideo
            ? null
            : videoThumbnail || story.image_url;
          const isVideoOnly = Boolean(story.video_url && !displayImage);
          const excerpt = getExcerpt(story);

          const baseShadow = story.is_reddit_post
            ? "0 10px 24px rgba(15, 23, 42, 0.08)"
            : "0 4px 10px rgba(0,0,0,0.05)";

          return (
            <Link
              key={story.id}
              href={`/stories/${story.slug}`}
              style={{
                background: "white",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: baseShadow,
                display: "flex",
                flexDirection: "column",
                minHeight: 390,
                color: "inherit",
                textDecoration: "none",
                border: story.is_reddit_post ? "1px solid #ffedd5" : "none",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
              }}
            >
              {displayImage ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={displayImage}
                    alt={story.title}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: 180,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />

                  {story.video_url ? (
                    <div
                      aria-label="Video story"
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(15, 23, 42, 0.18)",
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "999px",
                          background: "rgba(255, 255, 255, 0.92)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#0f172a",
                          fontSize: 22,
                          fontWeight: 800,
                          paddingLeft: 3,
                        }}
                      >
                        ▶
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 180,
                    background: story.is_reddit_post
                      ? "linear-gradient(135deg, #fff7ed, #ffedd5)"
                      : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 10,
                    color: "#9a3412",
                    textAlign: "center",
                    padding: 18,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "999px",
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 900,
                      boxShadow: "0 8px 18px rgba(154, 52, 18, 0.14)",
                    }}
                  >
                    {isVideoOnly ? "▶" : story.is_reddit_post ? "💬" : "🌤️"}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {isVideoOnly ? "Reddit Video" : "Reddit Post"}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: story.is_reddit_post ? "#ea580c" : "#059669",
                    marginBottom: 8,
                  }}
                >
                  {getCardLabel(story)}
                  {story.video_url ? " • Video" : ""}
                </div>

                <h2
                  style={{
                    margin: "0 0 10px 0",
                    fontSize: 18,
                    lineHeight: 1.3,
                  }}
                >
                  {story.title}
                </h2>

                <p
                  style={{
                    color: "#555",
                    fontSize: 14,
                    margin: "0 0 16px 0",
                    lineHeight: 1.5,
                  }}
                >
                  {excerpt}
                  {excerpt ? "..." : ""}
                </p>

                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginTop: "auto",
                  }}
                >
                  {formatDate(story.publish_date)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}