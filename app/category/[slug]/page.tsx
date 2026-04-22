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

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;

  if (!slug) {
    return (
      <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
        <h1>Category not found</h1>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("category_slug", slug)
    .not("slug", "is", null)
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("Category fetch error:", error);
  }

  const stories = (data as Story[]) ?? [];

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1 style={{ textTransform: "capitalize" }}>{slug}</h1>

      {stories.length === 0 ? (
        <p style={{ marginTop: 20, color: "#6b7280" }}>
          No stories found in this category yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 20,
            marginTop: 30,
          }}
        >
          {stories.map((story) => (
            <Link
              key={story.id}
              href={`/stories/${story.slug}`}
              style={{
                background: "white",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                display: "block",
                textDecoration: "none",
                color: "inherit",
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
                  {story.category_slug}
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
                  }}
                >
                  {(story.summary || story.content || "")
                    .replace(/<[^>]*>/g, "")
                    .slice(0, 100)}
                  ...
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
          ))}
        </div>
      )}
    </main>
  );
}