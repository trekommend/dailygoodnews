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

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/&#8242;/g, "'")
    .replace(/&#8243;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function removeTrailingSourceBoilerplate(text: string) {
  if (!text) return "";

  return text
    .replace(/\bThe post .*? appeared first on .*?\.?$/gi, "")
    .replace(/\bOriginally published on .*?\.?$/gi, "")
    .replace(/\bThis article originally appeared on .*?\.?$/gi, "")
    .replace(/\bAppeared first on .*?\.?$/gi, "")
    .replace(/\bSource: .*?$/gi, "")
    .replace(/\bCourtesy of .*?$/gi, "")
    .replace(/\bvia .*?$/gi, "")
    .trim();
}

function cleanStoryText(text: string) {
  return removeTrailingSourceBoilerplate(
    decodeHtmlEntities(stripHtml(text))
      .replace(/\[\u2026\]|\[\.\.\.\]/g, "")
      .replace(/Continue reading.*$/gi, "")
      .replace(/Read more.*$/gi, "")
      .replace(/Copyright \d{4}.*$/gi, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}|\r\n\r\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
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

  const cleanText = cleanStoryText(story.summary ?? story.content ?? "");
  const description =
    truncateForMeta(cleanText) ||
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
      images: [
        {
          url: ogImage,
        },
      ],
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

  if (!story) {
    return (
      <article style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
        <h1>Story not found.</h1>
        <p>We couldn’t find that article.</p>
      </article>
    );
  }

  const summaryText = cleanStoryText(story.summary ?? "");
  const contentText = cleanStoryText(story.content ?? "");
  const summaryParagraphs = splitParagraphs(summaryText);
  const contentParagraphs = splitParagraphs(contentText);
  const formattedDate = formatReadableDate(story.publish_date);

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

        {summaryParagraphs.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {summaryParagraphs.map((paragraph, index) => (
              <p
                key={`summary-${index}`}
                style={{
                  fontSize: 18,
                  color: "#475569",
                  lineHeight: 1.75,
                  margin:
                    index === summaryParagraphs.length - 1
                      ? "0"
                      : "0 0 16px",
                }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>

      {story.image_url && (
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
      )}

      {contentParagraphs.length > 0 && (
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.8,
            color: "#0f172a",
          }}
        >
          {contentParagraphs.map((paragraph, index) => (
            <p
              key={`content-${index}`}
              style={{
                margin:
                  index === contentParagraphs.length - 1
                    ? "0"
                    : "0 0 20px",
              }}
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}

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
        {story.source_url && story.source_name && (
          <div
            style={{
              marginBottom:
                story.is_reader_submission && story.submitted_by_name
                  ? 8
                  : 0,
            }}
          >
            Originally published on{" "}
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
        )}

        {story.is_reader_submission && story.submitted_by_name && (
          <div>
            Submitted by{" "}
            <span style={{ fontWeight: 600 }}>
              {story.submitted_by_name}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}