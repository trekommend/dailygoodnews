import type { MetadataRoute } from "next";
import { supabase } from "../lib/supabase";

type StorySitemapRow = {
  slug: string | null;
  publish_date: string | null;
  created_at?: string | null;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://thegoodinus.net";

const CATEGORY_SLUGS = ["kindness", "community", "animals", "health", "hope"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/stories`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/submit`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/editorial-guidelines`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...CATEGORY_SLUGS.map((slug) => ({
      url: `${SITE_URL}/category/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  const { data: stories, error } = await supabase
    .from("stories")
    .select("slug, publish_date, created_at")
    .not("slug", "is", null)
    .gte("publish_date", cutoff.toISOString())
    .order("publish_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Sitemap stories fetch error:", error);
    return staticPages;
  }

  const storyPages: MetadataRoute.Sitemap = ((stories || []) as StorySitemapRow[])
    .filter((story) => story.slug)
    .map((story) => ({
      url: `${SITE_URL}/stories/${story.slug}`,
      lastModified: story.publish_date || story.created_at || now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticPages, ...storyPages];
}