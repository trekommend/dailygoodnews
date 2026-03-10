import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default async function Stories() {
  const { data } = await supabase
    .from("stories")
    .select("*")
    .order("publish_date", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1>More Good News 🌈</h1>

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
              padding: 20,
              borderRadius: 12,
              boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
            }}
          >
            <small>{story.category}</small>
            <h2>{story.title}</h2>
            <p style={{ color: "#555" }}>
              {story.content.slice(0, 100)}...
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
