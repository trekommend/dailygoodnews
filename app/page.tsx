import Link from "next/link";
import { supabase } from "../lib/supabase";

type Story = {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  image_url: string | null;
  video_url: string | null;
  category_slug: string | null;
  publish_date: string | null;
  created_at?: string | null;
  featured?: boolean | null;
  story_score?: number | null;
  source_url?: string | null;
};

function formatCategory(category?: string | null) {
  if (!category) return "Hope";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStoryTimestamp(story: Story) {
  return new Date(story.publish_date || story.created_at || 0).getTime();
}

function getAgeHours(story: Story) {
  const timestamp = getStoryTimestamp(story);
  if (!timestamp) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / (1000 * 60 * 60);
}

function getFreshnessScore(story: Story) {
  const ageHours = getAgeHours(story);

  if (ageHours <= 24) return 120;
  if (ageHours <= 48) return 95;
  if (ageHours <= 72) return 75;
  if (ageHours <= 24 * 7) return 35;
  return 0;
}

function getFeaturedRank(story: Story) {
  const score = story.story_score || 0;
  const freshness = getFreshnessScore(story);
  const featuredBoost = story.featured ? 1000 : 0;
  return featuredBoost + score + freshness;
}

function getYouTubeThumbnailUrl(videoUrl?: string | null) {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);

      if (shortsMatch?.[1]) {
        return `https://img.youtube.com/vi/${shortsMatch[1]}/hqdefault.jpg`;
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

function getCardImageUrl(story: Story) {
  return story.image_url || getYouTubeThumbnailUrl(story.video_url);
}

function shortSummary(summary?: string | null, maxLength = 150) {
  if (!summary) return "";

  const cleaned = summary
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;

  const sliced = cleaned.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");

  return `${sliced
    .slice(0, lastSpace > 80 ? lastSpace : maxLength)
    .trim()}...`;
}

function VideoFallbackPreview({
  height,
}: {
  height: number | string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height,
        background: "linear-gradient(135deg, #ecfdf5, #e0f2fe)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 42,
        color: "#047857",
        position: "relative",
      }}
    >
      ▶
      <span
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.8)",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 700,
          padding: "5px 9px",
        }}
      >
        Video
      </span>
    </div>
  );
}

export default async function HomePage() {
  const { data, error } = await supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, video_url, category_slug, publish_date, created_at, featured, story_score, source_url"
    )
    .not("slug", "is", null)
    .order("publish_date", { ascending: false })
    .limit(60);

  if (error) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
        }}
      >
        <h1>The Good in Us</h1>
        <p>We couldn’t load stories right now.</p>
      </main>
    );
  }

  const stories = (data || []) as Story[];

  if (stories.length === 0) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 16px",
        }}
      >
        <h1>The Good in Us</h1>
        <p>No stories published yet.</p>
      </main>
    );
  }

  const recentHeroCandidates = stories.filter(
    (story) => getAgeHours(story) <= 72
  );

  const featuredStory =
    recentHeroCandidates.length > 0
      ? [...recentHeroCandidates].sort(
          (a, b) => getFeaturedRank(b) - getFeaturedRank(a)
        )[0]
      : [...stories].sort(
          (a, b) => getFeaturedRank(b) - getFeaturedRank(a)
        )[0];

  const featuredImageUrl = getCardImageUrl(featuredStory);

  const latestStories = [...stories]
    .filter((story) => story.id !== featuredStory.id)
    .sort((a, b) => {
      const aDate = getStoryTimestamp(a);
      const bDate = getStoryTimestamp(b);

      if (bDate !== aDate) {
        return bDate - aDate;
      }

      return (b.story_score || 0) - (a.story_score || 0);
    })
    .slice(0, 18);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px 16px",
      }}
    >
      <section
        aria-label="Site introduction"
        style={{
          marginBottom: 14,
        }}
      >
        <h1
          style={{
            margin: "0 0 4px 0",
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 800,
          }}
        >
          Positive News That Inspires
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: 680,
            color: "#4b5563",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          The Good in Us shares uplifting stories, inspiring moments, and
          positive news from around the world.
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          marginBottom: "clamp(22px, 5vw, 34px)",
        }}
      >
        {featuredImageUrl ? (
          <div style={{ position: "relative" }}>
            <img
              src={featuredImageUrl}
              alt={featuredStory.title}
              loading="eager"
              fetchPriority="high"
              style={{
                width: "100%",
                height: "clamp(200px, 34vw, 360px)",
                objectFit: "cover",
                display: "block",
              }}
            />

            {featuredStory.video_url ? (
              <span
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 16,
                  borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.82)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "7px 11px",
                }}
              >
                ▶ Video
              </span>
            ) : null}
          </div>
        ) : featuredStory.video_url ? (
          <VideoFallbackPreview
            height="clamp(200px, 34vw, 360px)"
          />
        ) : null}

        <div style={{ padding: 22 }}>
          <div
            style={{
              display: "inline-block",
              marginBottom: 10,
              padding: "6px 10px",
              borderRadius: 999,
              background: "#ecfdf5",
              color: "#047857",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Featured • {formatCategory(featuredStory.category_slug)}
            {featuredStory.video_url ? " • Video" : ""}
          </div>

          <h2
            style={{
              margin: "0 0 10px 0",
              fontSize: "clamp(26px, 5vw, 36px)",
              lineHeight: 1.15,
            }}
          >
            <Link href={`/stories/${featuredStory.slug}`}>
              {featuredStory.title}
            </Link>
          </h2>

          {featuredStory.summary ? (
            <p
              style={{
                margin: "0 0 14px 0",
                color: "#4b5563",
                fontSize: 16,
                lineHeight: 1.55,
              }}
            >
              {shortSummary(featuredStory.summary, 220)}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            <span>{formatDate(featuredStory.publish_date)}</span>

            {featuredStory.source_url ? (
              <a
                href={featuredStory.source_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#047857",
                  fontWeight: 600,
                }}
              >
                Original source
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Latest uplifting stories
            </h2>

            <p
              style={{
                margin: "6px 0 0 0",
                color: "#6b7280",
              }}
            >
              Fresh positive stories appear first.
            </p>
          </div>

          <Link
            href="/stories"
            style={{
              color: "#047857",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            View all stories
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {latestStories.map((story) => {
            const cardImageUrl = getCardImageUrl(story);

            return (
              <article
                key={story.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {cardImageUrl ? (
                  <div style={{ position: "relative" }}>
                    <img
                      src={cardImageUrl}
                      alt={story.title}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    {story.video_url ? (
                      <span
                        style={{
                          position: "absolute",
                          right: 10,
                          bottom: 10,
                          borderRadius: 999,
                          background:
                            "rgba(15, 23, 42, 0.82)",
                          color: "#ffffff",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "5px 9px",
                        }}
                      >
                        ▶ Video
                      </span>
                    ) : null}
                  </div>
                ) : story.video_url ? (
                  <VideoFallbackPreview height={160} />
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

                <div style={{ padding: 16 }}>
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#059669",
                    }}
                  >
                    {formatCategory(story.category_slug)}
                    {story.video_url ? " • Video" : ""}
                  </div>

                  <h3
                    style={{
                      margin: "0 0 9px 0",
                      fontSize: 19,
                      lineHeight: 1.25,
                    }}
                  >
                    <Link href={`/stories/${story.slug}`}>
                      {story.title}
                    </Link>
                  </h3>

                  {story.summary ? (
                    <p
                      style={{
                        margin: "0 0 12px 0",
                        color: "#4b5563",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {shortSummary(story.summary, 135)}
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    <span>
                      {formatDate(story.publish_date)}
                    </span>

                    <Link
                      href={`/stories/${story.slug}`}
                      style={{
                        color: "#047857",
                        fontWeight: 600,
                      }}
                    >
                      {story.video_url
                        ? "Watch / read"
                        : "Read more"}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}