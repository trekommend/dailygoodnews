import { supabase } from "@/lib/supabase";
import Link from "next/link";
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
  video_url?: string | null;
  category_slug: string | null;
  source_url: string;
  source_name: string | null;
  publish_date: string | null;
  is_reader_submission?: boolean | null;
  submitted_by_name?: string | null;
  is_reddit_post?: boolean | null;
  reddit_subreddit?: string | null;
};

type RelatedStory = {
  id: string;
  title: string;
  slug: string;
};

async function getStory(slug: string): Promise<Story | null> {
  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return (data as Story | null) ?? null;
}

function cleanTextForMeta(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateForMeta(text: string, maxLength = 160) {
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? ")
  );

  if (lastSentenceEnd > 80) {
    return `${sliced.slice(0, lastSentenceEnd + 1).trim()}...`;
  }

  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace > 80) {
    return `${sliced.slice(0, lastSpace).trim()}...`;
  }

  return `${sliced.trim()}...`;
}

function formatReadableDate(dateString: string | null) {
  if (!dateString) return null;

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCategoryName(slug: string | null) {
  if (!slug) return "Hope";

  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getVideoEmbedUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);

      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];

      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getDirectVideoUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (/\.mp4($|\?)/i.test(url.href)) {
      return url.href;
    }

    return null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://thegoodinus.net";

  if (!story) {
    return {
      title: "Story not found | The Good in Us",
      robots: { index: false, follow: false },
    };
  }

  const cleanText = cleanTextForMeta(story.summary ?? story.content ?? "");

  const description =
    truncateForMeta(cleanText) ||
    "A positive news story from The Good in Us.";

  const canonicalUrl = `${siteUrl}/stories/${story.slug}`;

  const ogImage = story.image_url
    ? story.image_url
    : `${siteUrl}/og-image.jpg`;

  return {
    title: `${story.title} – Positive News | The Good in Us`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: story.title,
      description,
      siteName: "The Good in Us",
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

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStory(slug);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://thegoodinus.net";

  if (!story) {
    return (
      <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
        <h1>Story not found.</h1>
        <p>We couldn’t find that article.</p>
      </article>
    );
  }

  const canonicalUrl = `${siteUrl}/stories/${story.slug}`;

  const imageUrl = story.image_url
    ? story.image_url
    : `${siteUrl}/og-image.jpg`;

  const formattedDate = formatReadableDate(story.publish_date);

  const categoryName = formatCategoryName(story.category_slug);

  const videoEmbedUrl = getVideoEmbedUrl(story.video_url);

  const directVideoUrl = getDirectVideoUrl(story.video_url);

  const authorName =
    story.is_reader_submission && story.submitted_by_name
      ? story.submitted_by_name
      : "The Good in Us";

  const cleanSummary = cleanTextForMeta(story.summary ?? "");

  const cleanContent = cleanTextForMeta(story.content ?? "");

  const description =
    truncateForMeta(cleanSummary || cleanContent) ||
    "A positive news story from The Good in Us.";

  const { data: relatedStories } = await supabase
    .from("stories")
    .select("id, title, slug")
    .not("slug", "is", null)
    .neq("slug", story.slug)
    .order("publish_date", { ascending: false })
    .limit(4);

  const related = (relatedStories || []) as RelatedStory[];

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description,
    image: [imageUrl],
    datePublished: story.publish_date,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "The Good in Us",
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

  const videoStructuredData = story.video_url
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: story.title,
        description,
        thumbnailUrl: [imageUrl],
        uploadDate: story.publish_date,
        contentUrl: story.video_url,
        embedUrl: videoEmbedUrl || directVideoUrl || story.video_url,
        publisher: {
          "@type": "Organization",
          name: "The Good in Us",
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/og-image.jpg`,
          },
        },
      }
    : null;

  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData),
        }}
      />

      {videoStructuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoStructuredData),
          }}
        />
      ) : null}

      <div style={{ marginBottom: 24 }}>
        <small style={{ textTransform: "capitalize", color: "#64748b" }}>
          {categoryName}
          {formattedDate ? ` • ${formattedDate}` : ""}
        </small>

        <h1
          style={{
            fontSize: "2.5rem",
            lineHeight: 1.15,
            margin: "12px 0 16px",
          }}
        >
          {story.title}
        </h1>

{story.source_name && !story.is_reddit_post ? (
          <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0 }}>
            Originally published on {story.source_name}
          </p>
        ) : null}
      </div>

      {directVideoUrl ? (
        <video
          src={directVideoUrl}
          controls
          playsInline
          poster={story.image_url || undefined}
          style={{
            width: "100%",
            maxHeight: 520,
            borderRadius: 20,
            background: "#000",
            margin: story.is_reddit_post ? "20px 0 12px" : "20px 0 28px",
          }}
        />
      ) : videoEmbedUrl ? (
        <div
          style={{
            aspectRatio: "16 / 9",
            width: "100%",
            overflow: "hidden",
            borderRadius: 20,
            background: "#000",
            margin: story.is_reddit_post ? "20px 0 12px" : "20px 0 28px",
          }}
        >
          <iframe
            src={videoEmbedUrl}
            title={`Video preview for ${story.title}`}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : story.image_url ? (
        <img
          src={story.image_url}
          alt={story.title}
          style={{
            width: "100%",
            maxHeight: 420,
            objectFit: "cover",
            borderRadius: 20,
            margin: story.is_reddit_post ? "20px 0 12px" : "20px 0 28px",
          }}
        />
      ) : null}

      {story.summary && !story.is_reddit_post ? (
  <p
    style={{
      fontSize: 18,
      lineHeight: 1.8,
      color: "#475569",
    }}
  >
    {cleanTextForMeta(story.summary)}
  </p>
) : null}

{story.content && !story.is_reddit_post ? (
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.8,
            color: "#0f172a",
          }}
          dangerouslySetInnerHTML={{
            __html: story.content,
          }}
        />
      ) : null}

      <div
        style={{
          marginTop: 36,
          paddingTop: 20,
          borderTop: "1px solid #e2e8f0",
          color: "#475569",
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
{story.source_url && story.source_name && !story.is_reddit_post ? (
          <div
            style={{
              marginBottom:
                story.is_reader_submission && story.submitted_by_name ? 8 : 0,
            }}
          >
            {story.is_reddit_post ? "Originally shared on " : "Originally published on "}
            <a
              href={story.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#0f172a",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              {story.source_name}
            </a>
            .
          </div>
        ) : null}

        {story.is_reader_submission && story.submitted_by_name ? (
          <div>
            Submitted by{" "}
            <span style={{ fontWeight: 600 }}>{story.submitted_by_name}</span>
          </div>
        ) : null}
      </div>

      {story.is_reddit_post && story.source_url ? (
        <div style={{ marginTop: 24 }}>
          <a
            href={story.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 16px",
              background: "#111827",
              color: "#ffffff",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            View discussion on Reddit
          </a>
        </div>
      ) : null}

      {related.length > 0 ? (
        <section
          style={{
            marginTop: 44,
            paddingTop: 28,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <h2 style={{ fontSize: 24, marginBottom: 16 }}>More good news</h2>

          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            {related.map((relatedStory) => (
              <li key={relatedStory.id}>
                <Link
                  href={`/stories/${relatedStory.slug}`}
                  style={{
                    color: "#0f172a",
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  {relatedStory.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}