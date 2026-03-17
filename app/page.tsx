import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Story = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  category_slug: string | null;
  featured: boolean | null;
  source_url: string;
  publish_date: string | null;
};

export default async function Home() {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .order("publish_date", { ascending: false })
    .limit(20);

  const stories = (data ?? []) as Story[];

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>Error loading stories.</p>
        <pre>{error.message}</pre>
      </main>
    );
  }

  if (stories.length === 0) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>No stories yet.</p>
      </main>
    );
  }

  const featured = stories.find((story) => story.featured) ?? stories[0];
  const rest = stories.filter((story) => story.id !== featured.id);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 40 }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 30,
          marginBottom: 50,
          alignItems: "stretch",
        }}
      >
        <div>
          <small style={{ textTransform: "capitalize", color: "#64748b" }}>
            {featured.category_slug ?? "hope"}
          </small>

          <h1 style={{ fontSize: "2.8rem", lineHeight: 1.1, margin: "12px 0 16px" }}>
            {featured.title}
          </h1>

          <p style={{ fontSize: 18, color: "#555", lineHeight: 1.6 }}>
            {(featured.summary ?? featured.content ?? "").slice(0, 220)}...
          </p>

          <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link
              href={`/stories/${featured.slug}`}
              style={{
                fontWeight: 600,
                textDecoration: "none",
                color: "#0f172a",
              }}
            >
              Read full story →
            </Link>

            <a
              href={featured.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#475569",
                textDecoration: "none",
              }}
            >
              View original source ↗
            </a>
          </div>
        </div>

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 320,
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {featured.image_url ? (
            <img
              src={featured.image_url}
              alt={featured.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 52,
                color: "#94a3b8",
              }}
            >
              🌤️
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: 20 }}>Latest Stories</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          {rest.map((story) => (
            <Link
              key={story.id}
              href={`/stories/${story.slug}`}
              style={{
                background: "white",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
                display: "block",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {story.image_url ? (
                <img
                  src={story.image_url}
                  alt={story.title}
                  style={{
                    width: "100%",
                    height: 180,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 180,
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 32,
                    color: "#94a3b8",
                  }}
                >
                  🌤️
                </div>
              )}

              <div style={{ padding: 18 }}>
                <small
                  style={{
                    textTransform: "capitalize",
                    color: "#64748b",
                  }}
                >
                  {story.category_slug ?? "hope"}
                </small>

                <h3 style={{ margin: "10px 0", lineHeight: 1.3 }}>{story.title}</h3>

                <p style={{ color: "#555", lineHeight: 1.5 }}>
                  {(story.summary ?? story.content ?? "").slice(0, 120)}...
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 60 }}>
        <h2>Browse by Category</h2>
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {["kindness", "community", "animals", "health", "hope"].map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat}`}
              style={{
                padding: "10px 16px",
                background: "#f1f5f9",
                borderRadius: 999,
                fontSize: 14,
                textTransform: "capitalize",
                color: "#0f172a",
                textDecoration: "none",
              }}
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}