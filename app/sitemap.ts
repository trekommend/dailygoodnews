import type { MetadataRoute } from "next";
import { supabase } from "../lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.vercel.app";

  const { data: stories } = await supabase
    .from("stories")
    .select("slug, publish_date")
    .not("slug", "is", null);

  const storyUrls =
    stories?.map((story) => ({
      url: `${siteUrl}/stories/${story.slug}`,
      lastModified: story.publish_date || new Date().toISOString(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })) ?? [];

  return [
    {
      url: siteUrl,
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/stories`,
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...storyUrls,
  ];
}