import { supabase } from "../lib/supabase";
import Link from "next/link";

export default async function Home() {
  const { data: stories } = await supabase
  .from("stories")
  .select("*")
  .not("slug", "is", null)
  .order("publish_date", { ascending: false })
  .limit(20);

  if (!stories || stories.length === 0) {
    return (
      <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>No stories yet.</p>
      </main>
    );
  }

  const featured = stories.find((s) => s.featured) || stories[0];
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
          <small>{featured.category_slug}</small>
          <h1 style={{ fontSize: "2.8rem" }}>{featured.title}</h1>
          <p style={{ fontSize: 18, color: "#555" }}>
            {(featured.summary || featured.content)?.slice(0, 220)}...
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
                <small>{story.category_slug}</small>
                <h3>{story.title}</h3>
                <p style={{ color: "#555" }}>
                  {(story.summary || story.content)?.slice(0, 120)}...
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