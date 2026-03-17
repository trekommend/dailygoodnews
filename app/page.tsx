import { supabase } from "../lib/supabase";
import Link from "next/link";

export default async function Home() {
  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) {
    return (
      <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>Error loading articles.</p>
        <pre>{error.message}</pre>
      </main>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <main style={{ maxWidth: 1100, margin: "auto", padding: 40 }}>
        <h1>Daily Good News 🌤️</h1>
        <p>No articles yet.</p>
      </main>
    );
  }

  const featured = articles[0];
  const rest = articles.slice(1);

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
          <small>
            {featured.published_at
              ? new Date(featured.published_at).toLocaleDateString()
              : "Latest"}
          </small>
          <h1 style={{ fontSize: "2.8rem" }}>{featured.title}</h1>
          <p style={{ fontSize: 18, color: "#555" }}>
            {(featured.summary || "").slice(0, 220)}...
          </p>
          <a
            href={featured.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 600 }}
          >
            Read original story →
          </a>
        </div>

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            height: 260,
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          🌤️
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
          {rest.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "white",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
                display: "block",
                textDecoration: "none",
                color: "inherit",
              }}
            >
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

              <div style={{ padding: 18 }}>
                <small>
                  {article.published_at
                    ? new Date(article.published_at).toLocaleDateString()
                    : "Latest"}
                </small>
                <h3>{article.title}</h3>
                <p style={{ color: "#555" }}>
                  {(article.summary || "").slice(0, 120)}...
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}