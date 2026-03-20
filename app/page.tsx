import { supabase } from "../lib/supabase";
import Link from "next/link";

type Story = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  image_url: string | null;
  source_name: string;
  publish_date: string;
  category_slug: string;
  story_score: number | null;
};

const TRUSTED_SOURCE_NAMES = ["Good News Network", "Positive News"];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRecentCutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function categoryLabel(category: string) {
  switch (category) {
    case "health":
      return "Health";
    case "community":
      return "Community";
    case "kindness":
      return "Kindness";
    case "animals":
      return "Animals";
    default:
      return "Hope";
  }
}

function categoryColors(category: string) {
  switch (category) {
    case "health":
      return { background: "#dcfce7", color: "#166534" };
    case "community":
      return { background: "#dbeafe", color: "#1d4ed8" };
    case "kindness":
      return { background: "#fce7f3", color: "#be185d" };
    case "animals":
      return { background: "#fef3c7", color: "#b45309" };
    default:
      return { background: "#fef9c3", color: "#a16207" };
  }
}

export default async function HomePage() {
  const recentCutoff = getRecentCutoffIso(2);
  const selectFields =
    "id, title, slug, summary, image_url, source_name, publish_date, category_slug, story_score";

  let featuredStory: Story | null = null;

  const { data: recentTrustedFeatured } = await supabase
    .from("stories")
    .select(selectFields)
    .gte("publish_date", recentCutoff)
    .in("source_name", TRUSTED_SOURCE_NAMES)
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(1);

  featuredStory = recentTrustedFeatured?.[0] ?? null;

  if (!featuredStory) {
    const { data: recentFeatured } = await supabase
      .from("stories")
      .select(selectFields)
      .gte("publish_date", recentCutoff)
      .order("story_score", { ascending: false, nullsFirst: false })
      .order("publish_date", { ascending: false })
      .limit(1);

    featuredStory = recentFeatured?.[0] ?? null;
  }

  if (!featuredStory) {
    const { data: fallbackFeatured } = await supabase
      .from("stories")
      .select(selectFields)
      .order("story_score", { ascending: false, nullsFirst: false })
      .order("publish_date", { ascending: false })
      .limit(1);

    featuredStory = fallbackFeatured?.[0] ?? null;
  }

  const { data: stories, error } = await supabase
    .from("stories")
    .select(selectFields)
    .order("story_score", { ascending: false, nullsFirst: false })
    .order("publish_date", { ascending: false })
    .limit(25);

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, marginBottom: 16 }}>
          Daily Good News
        </h1>
        <p>Could not load stories.</p>
      </main>
    );
  }

  const remainingStories =
    stories?.filter((story: Story) => story.id !== featuredStory?.id) ?? [];

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "32px 16px",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0 }}>
          Daily Good News
        </h1>
        <p style={{ marginTop: 8, color: "#4b5563", maxWidth: 700 }}>
          Uplifting stories from health, science, kindness, community, and hope.
        </p>
      </header>

      {featuredStory && (
        <section style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
              Top good news
            </h2>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Featured story</span>
          </div>

          <Link
            href={`/stories/${featuredStory.slug}`}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <article
              style={{
                overflow: "hidden",
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {featuredStory.image_url ? (
                <img
                  src={featuredStory.image_url}
                  alt={featuredStory.title}
                  style={{
                    display: "block",
                    width: "100%",
                    height: 180,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f3f4f6",
                    color: "#9ca3af",
                  }}
                >
                  No image available
                </div>
              )}

              <div style={{ padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 12,
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      ...categoryColors(featuredStory.category_slug),
                      borderRadius: 999,
                      padding: "6px 12px",
                      fontWeight: 600,
                    }}
                  >
                    {categoryLabel(featuredStory.category_slug)}
                  </span>
                  <span style={{ color: "#9ca3af" }}>•</span>
                  <span style={{ color: "#4b5563" }}>{featuredStory.source_name}</span>
                  <span style={{ color: "#9ca3af" }}>•</span>
                  <span style={{ color: "#4b5563" }}>
                    {formatDate(featuredStory.publish_date)}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    margin: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {featuredStory.title}
                </h3>

                <p
                  style={{
                    marginTop: 12,
                    fontSize: 17,
                    color: "#374151",
                    lineHeight: 1.6,
                  }}
                >
                  {featuredStory.summary}
                </p>
              </div>
            </article>
          </Link>
        </section>
      )}

      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>
            Latest uplifting stories
          </h2>
          <span style={{ fontSize: 14, color: "#6b7280" }}>
            Ranked by positivity and freshness
          </span>
        </div>

        {remainingStories.length === 0 ? (
          <p style={{ color: "#4b5563" }}>No stories found yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 24,
              width: "100%",
            }}
          >
            {remainingStories.map((story: Story) => (
              <Link
                key={story.id}
                href={`/stories/${story.slug}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  minWidth: 0,
                }}
              >
                <article
                  style={{
                    overflow: "hidden",
                    borderRadius: 20,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    minWidth: 0,
                  }}
                >
                  {story.image_url ? (
                    <img
                      src={story.image_url}
                      alt={story.title}
                      style={{
                        display: "block",
                        width: "100%",
                        height: 110,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 110,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f3f4f6",
                        color: "#9ca3af",
                      }}
                    >
                      No image
                    </div>
                  )}

                  <div style={{ padding: 16, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 10,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          ...categoryColors(story.category_slug),
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontWeight: 600,
                        }}
                      >
                        {categoryLabel(story.category_slug)}
                      </span>
                      <span style={{ color: "#9ca3af" }}>•</span>
                      <span style={{ color: "#6b7280" }}>{story.source_name}</span>
                    </div>

                    <h3
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        margin: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      {story.title}
                    </h3>

                    <p
                      style={{
                        marginTop: 10,
                        fontSize: 14,
                        color: "#374151",
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {story.summary}
                    </p>

                    <p style={{ marginTop: 12, fontSize: 14, color: "#6b7280" }}>
                      {formatDate(story.publish_date)}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}