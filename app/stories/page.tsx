import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Story = {
  id: number;
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
      <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>Error loading stories.</p>
        <pre>{error.message}</pre>
      </main>
    );
  }

  if (stories.length === 0) {
    return (
      <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>No stories yet.</p>
      </main>
    );
  }

  const featured: Story = stories.find((s) => s.featured) ?? stories[0];
  const rest = stories.filter((s) => s.id !== featured.id);

  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 30,
          marginBottom: 50,
        }}
      >
        <div>
          <small>{featured.category_slug ?? "hope"}</small>
          <h1 style={{ fontSize: "2.8rem" }}>{featured.title}</h1>
          <p style={{ fontSize: 18, color: "#555" }}>
            {(featured.summary ?? featured.content ?? "").slice(0, 220)}...
          </p>
          <Link href={`/stories/${featured.slug}`} style={{ fontWeight: 600 }}>
            Read full story →
          </Link>
        </div>

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            height: 260,
            background: "#f1f5f9",
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
              }}
            />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
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
                    height: 160,
                    objectFit: "cover",
                  }}
                />
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
                <small>{story.category_slug ?? "hope"}</small>
                <h3>{story.title}</h3>
                <p style={{ color: "#555" }}>
                  {(story.summary ?? story.content ?? "").slice(0, 120)}...
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}