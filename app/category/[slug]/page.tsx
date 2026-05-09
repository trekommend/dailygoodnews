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
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  const categoryName = formatCategoryName(slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thegoodinus.net";

  const description = `Read uplifting ${categoryName.toLowerCase()} stories from The Good in Us. Positive reporting that inspires hope.`;

  return {
    title: `${categoryName} News | The Good in Us`,
    description,
    alternates: {
      canonical: `${siteUrl}/category/${slug}`,
    },
    openGraph: {
      title: `${categoryName} News | The Good in Us`,
      description,
      url: `${siteUrl}/category/${slug}`,
      siteName: "The Good in Us",
      type: "website",
      images: [{ url: `${siteUrl}/og-image.jpg` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${categoryName} News | The Good in Us`,
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

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("category_slug", slug)
    .not("slug", "is", null)
    .order("publish_date", { ascending: false });

  const stories = (data || []) as StoryCard[];

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1 style={{ marginBottom: 8 }}>{categoryName} News</h1>

      <p
        style={{
          marginTop: 0,
          maxWidth: 720,
          color: "#475569",
          fontSize: 17,
          lineHeight: 1.7,
        }}
      >
        Discover uplifting {categoryName.toLowerCase()} stories from around the
        world. The Good in Us highlights positive news, hopeful moments, and
        meaningful progress.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        {stories.map((story) => {
          const videoThumbnail = getVideoThumbnail(story.video_url);
          const displayImage = videoThumbnail || story.image_url;
          const excerpt = stripHtml(story.summary || story.content || "").slice(0, 120);

          return (
            <Link
              key={story.id}
              href={`/stories/${story.slug}`}
              style={{
                background: "white",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                display: "block",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {displayImage ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={displayImage}
                    alt={story.title}
                    style={{
                      width: "100%",
                      height: 160,
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
                    height: 160,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                  }}
                >
                  🌤️
                </div>
              )}

              <div style={{ padding: 18 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#059669",
                    marginBottom: 6,
                  }}
                >
                  {formatCategoryName(story.category_slug)}
                  {story.video_url ? " • Video" : ""}
                </div>

                <h2
                  style={{
                    margin: "0 0 8px 0",
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
                    margin: "0 0 12px 0",
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