import { supabase } from "../../../lib/supabase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();

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
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug).trim();

  console.log("Slug from URL:", slug);

  let { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  // Fallback in case of case/encoding weirdness
  if (!data) {
    const fallback = await supabase
      .from("stories")
      .select("*")
      .ilike("slug", slug)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;
  }

  console.log("Story query error:", error);
  console.log("Story found:", data ? data.slug : null);

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