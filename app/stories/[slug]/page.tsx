import { supabase } from "../../../lib/supabase";

export default async function Story({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return <p>Story not found.</p>;

  return (
    <article style={{ maxWidth: 700, margin: "auto", padding: 40 }}>
      <small>{data.category}</small>

      <h1>{data.title}</h1>

      <p style={{ whiteSpace: "pre-line" }}>{data.content}</p>

      <p style={{ marginTop: 30 }}>
        Source:{" "}
        <a href={data.source_url} target="_blank">
          {data.source_name}
        </a>
      </p>
    </article>
  );
}
