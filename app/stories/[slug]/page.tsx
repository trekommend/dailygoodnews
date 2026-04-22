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
  is_reader_submission?: boolean | null;
  submitted_by_name?: string | null;
};

async function getStory(slug: string): Promise<Story | null> {
  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return (data as Story | null) ?? null;
}

/* =========================
   METADATA
========================= */

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!story) {
    return {
      title: "Story not found | Daily Good News",
      robots: { index: false, follow: false },
    };
  }

  const cleanText = (story.summary ?? story.content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const description =
    cleanText.slice(0, 160) ||
    "A positive news story from Daily Good News.";

  const canonicalUrl = `${siteUrl}/stories/${story.slug}`;

  const ogImage = story.image_url
    ? story.image_url
    : `${siteUrl}/og-image.jpg`;

  return {
    title: `${story.title} | Daily Good News`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: story.title,
      description,
      siteName: "Daily Good News",
      images: [{ url: ogImage }],
      publishedTime: story.publish_date ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description,
      images: [ogImage],
    },
  };
}

/* =========================
   PAGE
========================= */

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStory(slug);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (!story) {
    return (
      <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
        <h1>Story not found.</h1>
      </article>
    );
  }

  const canonicalUrl = `${siteUrl}/stories/${story.slug}`;
  const imageUrl = story.image_url
    ? story.image_url
    : `${siteUrl}/og-image.jpg`;

  const authorName =
    story.is_reader_submission && story.submitted_by_name
      ? story.submitted_by_name
      : "Daily Good News";

  /* =========================
     STRUCTURED DATA
  ========================= */

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    image: [imageUrl],
    datePublished: story.publish_date,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "Daily Good News",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/og-image.jpg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <h1>{story.title}</h1>

      {story.image_url && (
        <img
          src={story.image_url}
          alt={story.title}
          style={{
            width: "100%",
            maxHeight: 420,
            objectFit: "cover",
            borderRadius: 20,
            margin: "20px 0",
          }}
        />
      )}

      <div
        style={{
          fontSize: 18,
          lineHeight: 1.8,
          color: "#0f172a",
        }}
        dangerouslySetInnerHTML={{
          __html: story.content ?? "",
        }}
      />
    </article>
  );
}