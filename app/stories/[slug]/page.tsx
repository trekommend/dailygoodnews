import { supabase } from "@/lib/supabase";
import type { Metadata } from "next";

type StoryPageProps = {
  params: Promise<{ slug: string }>;
};

type Story = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  category_slug: string | null;
  source_url: string;
  source_name: string | null;
  publish_date: string | null;
};

async function getStory(slug: string): Promise<Story | null> {
  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return (data as Story | null) ?? null;
}

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);

  if (!story) {
    return {
      title: "Story not found | Daily Good News",
    };
  }

  const description =
    (story.summary ?? story.content ?? "").replace(/<[^>]*>/g, "").slice(0, 160) ||
    "A positive news story from Daily Good News.";

  return {
    title: `${story.title} | Daily Good News`,
    description,
    openGraph: {
      title: story.title,
      description,
      images: story.image_url ? [story.image_url] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
      images: story.image_url ? [story.image_url] : [],
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStory(slug);

  if (!story) {
    return (
      <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
        <h1>Story not found.</h1>
        <p>We couldn’t find that article.</p>
      </article>
    );
  }

  const bodyText = (story.content ?? story.summary ?? "").replace(/<[^>]*>/g, "");
  const formattedDate = story.publish_date
    ? new Date(story.publish_date).toLocaleDateString()
    : null;

  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <small style={{ textTransform: "capitalize", color: "#64748b" }}>
          {story.category_slug ?? "hope"}
          {formattedDate ? ` • ${formattedDate}` : ""}
        </small>

        <h1 style={{ fontSize: "2.5rem", lineHeight: 1.15, margin: "12px 0 16px" }}>
          {story.title}
        </h1>

        {story.summary ? (
          <p style={{ fontSize: 18, color: "#475569", lineHeight: 1.6 }}>
            {story.summary}
          </p>
        ) : null}
      </div>

      {story.image_url ? (
        <div
          style={{
            marginBottom: 28,
            borderRadius: 20,
            overflow: "hidden",
            background: "#f1f5f9",
          }}
        >
          <img
            src={story.image_url}
            alt={story.title}
            style={{
              width: "100%",
              maxHeight: 420,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.8,
          color: "#0f172a",
          whiteSpace: "pre-line",
        }}
      >
        {bodyText}
      </div>

      <div
        style={{
          marginTop: 36,
          paddingTop: 20,
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <a
          href={story.source_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#0f172a",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Read original source ↗
        </a>
      </div>
    </article>
  );
}