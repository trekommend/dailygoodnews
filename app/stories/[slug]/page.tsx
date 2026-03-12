import { supabase } from "../../../lib/supabase";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!story) return {};

  return {
    title: story.title,
    description: story.content,
    openGraph: {
      title: story.title,
      description: story.content,
      images: [story.image_url],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.content,
      images: [story.image_url],
    },
  };
}

export default async function Story({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

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