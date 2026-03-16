import { supabase } from "../../../lib/supabase";
import Link from "next/link";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data } = await supabase
  .from("stories")
  .select("*")
  .eq("category_slug", slug)
  .not("slug", "is", null)
  .order("publish_date", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1 style={{ textTransform: "capitalize" }}>{slug}</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          marginTop: 30,
        }}
      >
        {data?.map((story) => (
          <Link
            key={story.id}
            href={`/stories/${story.slug}`}
            style={{
              background: "white",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
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
              <h2>{story.title}</h2>
              <p style={{ color: "#555" }}>
                {(story.summary || story.content)?.slice(0, 100)}...
              </p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}