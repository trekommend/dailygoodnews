import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import type { Metadata } from "next";

function formatDate(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCategoryName(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ----------------------- */
/* 🔎 Category Metadata     */
/* ----------------------- */

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { slug } = params;

  const categoryName = formatCategoryName(slug);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://your-domain.vercel.app";

  return {
    title: `${categoryName} News`,
    description: `Read uplifting ${categoryName.toLowerCase()} stories from Daily Good News. Positive reporting that inspires hope.`,
    alternates: {
      canonical: `${siteUrl}/category/${slug}`,
    },
    openGraph: {
      title: `${categoryName} News | Daily Good News`,
      description: `Read uplifting ${categoryName.toLowerCase()} stories from Daily Good News.`,
      url: `${siteUrl}/category/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${categoryName} News | Daily Good News`,
      description: `Read uplifting ${categoryName.toLowerCase()} stories from Daily Good News.`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/* ----------------------- */
/* 📄 Category Page         */
/* ----------------------- */

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const { data } = await supabase
    .from("stories")
    .select("*")
    .eq("category_slug", slug)
    .not("slug", "is", null)
    .order("publish_date", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1 style={{ textTransform: "capitalize" }}>
        {formatCategoryName(slug)}
      </h1>

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
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
              display: "block",
            }}
          >
            {story.image_url ? (
              <img
                src={story.image_url}
                alt={story.title}
                style={{
                  width: "100%",
                  height: 160,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 160,
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                🌤️
              </div>
            )}

            <div style={{ padding: 18 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#059669",
                  marginBottom: 6,
                }}
              >
                {story.category_slug}
              </div>

              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: 18,
                  lineHeight: 1.3,
                }}
              >
                {story.title}
              </h2>

              <p
                style={{
                  color: "#555",
                  fontSize: 14,
                  margin: "0 0 12px 0",
                }}
              >
                {(story.summary || story.content)?.slice(0, 100)}...
              </p>

              <div
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                {formatDate(story.publish_date)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}