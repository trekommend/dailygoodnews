import Link from "next/link";
import { supabase } from "../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;``

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
  is_reddit_post?: boolean | null;
  is_reader_submission?: boolean | null;
  reddit_subreddit?: string | null;
};

function formatCategory(category?: string | null) {
  if (!category) return "Hope";

  if (category === "reddit" || category === "user-stories") {
    return "User Stories";
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStoryTimestamp(story: Story) {
  return new Date(
    story.publish_date || story.created_at || 0
  ).getTime();
}

function getAgeHours(story: Story) {
  const timestamp = getStoryTimestamp(story);

  if (!timestamp) {
    return Number.POSITIVE_INFINITY;
  }

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
    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }

      const shortsMatch = url.pathname.match(
        /^\/shorts\/([^/?#]+)/
      );

      if (shortsMatch?.[1]) {
        return `https://img.youtube.com/vi/${shortsMatch[1]}/hqdefault.jpg`;
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname
        .split("/")
        .filter(Boolean)[0];

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
  if (story.is_reddit_post && story.video_url) {
    return null;
  }

  return (
    story.image_url ||
    getYouTubeThumbnailUrl(story.video_url)
  );
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#32;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/&#8230;/gi, "...")
    .replace(/&#038;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function shortSummary(
  summary?: string | null,
  maxLength = 150
) {
  if (!summary) return "";

  const cleaned = decodeHtmlEntities(summary)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");

  return `${sliced
    .slice(
      0,
      lastSpace > 80 ? lastSpace : maxLength
    )
    .trim()}...`;
}

function cleanRedditSummary(summary?: string | null) {
  if (!summary) return "";

  return decodeHtmlEntities(summary)
    .replace(/<[^>]*>/g, " ")
    .replace(
      /submitted\s+by\s+\/?u\/[^\s\[]+/gi,
      ""
    )
    .replace(
      /submitted\s+by\s+[^\s\[]+/gi,
      ""
    )
    .replace(/\[link\]/gi, "")
    .replace(/\[comments\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCardSummary(story: Story) {
  if (story.is_reddit_post) {
    const cleaned = cleanRedditSummary(story.summary);

    if (cleaned) {
      return shortSummary(cleaned, 135);
    }

    return story.video_url
      ? "Watch this feel-good Reddit video on the original thread."
      : "A feel-good story shared from Reddit.";
  }

  return shortSummary(story.summary, 135);
}

function getCommunityLabel(story: Story) {
  if (story.is_reader_submission) {
    return "Community Story";
  }

  if (
    story.is_reddit_post &&
    story.reddit_subreddit
  ) {
    return `r/${story.reddit_subreddit}`;
  }

  return "User Story";
}

function getCommunitySummary(story: Story) {
  if (story.is_reddit_post) {
    return story.video_url
      ? "Watch this feel-good Reddit video on the original thread."
      : "A feel-good story shared from Reddit.";
  }

  return shortSummary(story.summary, 135);
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
        background:
          "linear-gradient(135deg, #ecfdf5, #e0f2fe)",
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

function UserStoryFallbackPreview({
  height,
  isVideo,
}: {
  height: number | string;
  isVideo: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height,
        background:
          "linear-gradient(135deg, #fff7ed, #ffedd5)",
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
          width: 54,
          height: 54,
          borderRadius: "999px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 900,
          boxShadow:
            "0 8px 18px rgba(154, 52, 18, 0.14)",
        }}
      >
        {isVideo ? "▶" : "💬"}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {isVideo ? "User Video" : "User Story"}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { data, error } = await supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, video_url, category_slug, publish_date, created_at, featured, story_score, source_url, is_reddit_post, is_reader_submission, reddit_subreddit"
    )
    .not("slug", "is", null)
    .order("publish_date", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(60);

  const { data: userStoriesData } = await supabase
    .from("stories")
    .select(
      "id, title, slug, summary, image_url, video_url, category_slug, publish_date, created_at, featured, story_score, source_url, is_reddit_post, is_reader_submission, reddit_subreddit"
    )
    .not("slug", "is", null)
    .or(
      "category_slug.eq.reddit,is_reader_submission.eq.true"
    )
    .order("publish_date", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(2);

  const userStories =
    (userStoriesData || []) as Story[];

  if (error) {
    console.error(
      "Homepage stories fetch error:",
      error
    );

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
          (a, b) =>
            getFeaturedRank(b) -
            getFeaturedRank(a)
        )[0]
      : [...stories].sort(
          (a, b) =>
            getFeaturedRank(b) -
            getFeaturedRank(a)
        )[0];

  const featuredImageUrl =
    getCardImageUrl(featuredStory);

  const latestStories = [...stories]
    .filter(
      (story) =>
        story.id !== featuredStory.id
    )
    .sort((a, b) => {
      const aDate = getStoryTimestamp(a);
      const bDate = getStoryTimestamp(b);

      if (bDate !== aDate) {
        return bDate - aDate;
      }

      return (
        (b.story_score || 0) -
        (a.story_score || 0)
      );
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
          The Good in Us shares uplifting stories,
          inspiring moments, and positive news from
          around the world.
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04)",
          marginBottom:
            "clamp(22px, 5vw, 34px)",
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
                height:
                  "clamp(200px, 34vw, 360px)",
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
                  background:
                    "rgba(15, 23, 42, 0.82)",
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
            Featured •{" "}
            {formatCategory(
              featuredStory.category_slug
            )}
            {featuredStory.video_url
              ? " • Video"
              : ""}
          </div>

          <h2
            style={{
              margin: "0 0 10px 0",
              fontSize:
                "clamp(26px, 5vw, 36px)",
              lineHeight: 1.15,
            }}
          >
            <Link
              href={`/stories/${featuredStory.slug}`}
            >
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
              {featuredStory.is_reddit_post
                ? getCardSummary(featuredStory)
                : shortSummary(
                    featuredStory.summary,
                    220
                  )}
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
            <span>
              {formatDate(
                featuredStory.publish_date
              )}
            </span>

            {featuredStory.source_url ? (
              <a
                href={
                  featuredStory.source_url
                }
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
            const cardImageUrl =
              getCardImageUrl(story);

            const cardSummary =
              getCardSummary(story);

            return (
              <article
                key={story.id}
                style={{
                  background: "#ffffff",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {cardImageUrl ? (
                  <div
                    style={{
                      position: "relative",
                    }}
                  >
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
                          position:
                            "absolute",
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
                  <VideoFallbackPreview
                    height={160}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 160,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "center",
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
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.08em",
                      color: "#059669",
                    }}
                  >
                    {formatCategory(
                      story.category_slug
                    )}
                    {story.video_url
                      ? " • Video"
                      : ""}
                  </div>

                  <h3
                    style={{
                      margin:
                        "0 0 9px 0",
                      fontSize: 19,
                      lineHeight: 1.25,
                    }}
                  >
                    <Link
                      href={`/stories/${story.slug}`}
                    >
                      {story.title}
                    </Link>
                  </h3>

                  {cardSummary ? (
                    <p
                      style={{
                        margin:
                          "0 0 12px 0",
                        color: "#4b5563",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {cardSummary}
                    </p>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    <span>
                      {formatDate(
                        story.publish_date
                      )}
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

      {userStories.length > 0 ? (
        <section style={{ marginTop: 42 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent:
                "space-between",
              gap: 16,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                From the community
              </h2>

              <p
                style={{
                  margin: "6px 0 0 0",
                  color: "#6b7280",
                }}
              >
                Uplifting stories from users
                across the internet.
              </p>
            </div>

            <Link
              href="/category/user-stories"
              style={{
                color: "#047857",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              View User Stories
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
            {userStories.map((story) => {
              const cardImageUrl =
                getCardImageUrl(story);

              const isVideo = Boolean(
                story.video_url
              );

              return (
                <article
                  key={story.id}
                  style={{
                    background: "#ffffff",
                    border:
                      "1px solid #ffedd5",
                    borderRadius: 20,
                    overflow: "hidden",
                    boxShadow:
                      "0 6px 18px rgba(15, 23, 42, 0.06)",
                  }}
                >
                  {cardImageUrl ? (
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
                  ) : (
                    <UserStoryFallbackPreview
                      height={160}
                      isVideo={isVideo}
                    />
                  )}

                  <div style={{ padding: 16 }}>
                    <div
                      style={{
                        marginBottom: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.08em",
                        color: "#ea580c",
                      }}
                    >
                      {getCommunityLabel(
                        story
                      )}
                      {story.video_url
                        ? " • Video"
                        : ""}
                    </div>

                    <h3
                      style={{
                        margin:
                          "0 0 9px 0",
                        fontSize: 19,
                        lineHeight: 1.25,
                      }}
                    >
                      <Link
                        href={`/stories/${story.slug}`}
                      >
                        {story.title}
                      </Link>
                    </h3>

                    <p
                      style={{
                        margin:
                          "0 0 12px 0",
                        color: "#4b5563",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {getCommunitySummary(
                        story
                      )}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        fontSize: 13,
                        color: "#6b7280",
                      }}
                    >
                      <span>
                        {formatDate(
                          story.publish_date
                        )}
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
      ) : null}
    </main>
  );
}