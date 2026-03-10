import { supabase } from "../../../lib/supabase";
import Link from "next/link";

export default async function Category({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("category_slug", slug)
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
              padding: 20,
              borderRadius: 12,
              boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              cursor: "pointer",
            }}
          >
            <small>{story.category}</small>
            <h2>{story.title}</h2>
            <p>{story.content.slice(0, 100)}...</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
