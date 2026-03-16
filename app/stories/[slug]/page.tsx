import { supabase } from "../../../lib/supabase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: story } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!story) return {};

  return {
    title: story.title,
    description: story.content,
    openGraph: {
      title: story.title,
      description: story.content,
      images: [`/stories/${slug}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.content,
      images: [`/stories/${slug}/opengraph-image`],
    },
  };
}

export default async function Story({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  console.log("story slug:", slug);
  console.log("story query error:", error);
  console.log("story found:", data?.slug);

  if (!data) {
    return (
      <article style={{ maxWidth: 700, margin: "auto", padding: 40 }}>
        <h1>Story not found.</h1>
        <p>Requested slug: {slug}</p>
      </article>
    );
  }

  return (
    <article style={{ maxWidth: 700, margin: "auto", padding: 40 }}>
      <small>{data.category_slug}</small>
      <h1>{data.title}</h1>
      <p style={{ whiteSpace: "pre-line" }}>{data.content}</p>

      <p style={{ marginTop: 30 }}>
        Source:{" "}
        <a href={data.source_url} target="_blank" rel="noopener noreferrer">
          {data.source_name}
        </a>
      </p>
    </article>
  );
}