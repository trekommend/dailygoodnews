"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const allowedCategories = new Set([
  "animals",
  "health",
  "community",
  "kindness",
  "hope",
]);

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "")
    .slice(0, 90);
}

function cleanOptional(value: FormDataEntryValue | null) {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

async function requireAdmin() {
  const authClient = await createClient();

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  return user;
}

async function createUniqueSlug(
  supabase: ReturnType<typeof createAdminClient>,
  title: string
) {
  const baseSlug = slugify(title) || "admin-story";
  let slug = baseSlug;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const { data } = await supabase
      .from("stories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    slug = `${baseSlug}-${attempt + 1}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function createStory(formData: FormData) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const submissionType = String(
    formData.get("submission_type") || "original_story"
  ) as "original_story" | "article_link";

  const title = String(formData.get("title") || "").trim();
  const summary = cleanOptional(formData.get("summary"));
  const content = cleanOptional(formData.get("content"));
  const sourceUrl = cleanOptional(formData.get("source_url"));
  const sourceName = cleanOptional(formData.get("source_name"));
  const imageUrl = cleanOptional(formData.get("image_url"));
  const videoUrl = cleanOptional(formData.get("video_url"));
  const authorName = cleanOptional(formData.get("author_name")) || "Admin";
  const authorEmail =
    cleanOptional(formData.get("author_email")) || user.email || "admin";
  const categoryInput = String(formData.get("category_slug") || "hope")
    .trim()
    .toLowerCase();

  const categorySlug = allowedCategories.has(categoryInput)
    ? categoryInput
    : "hope";

  if (!title) {
    redirect(
      "/admin/stories/new?error=Please%20enter%20a%20title%20before%20publishing."
    );
  }

  if (submissionType === "article_link" && !sourceUrl) {
    redirect(
      "/admin/stories/new?error=Please%20enter%20a%20source%20URL%20for%20article%20links."
    );
  }

  const slug = await createUniqueSlug(supabase, title);
  const publishedAt = new Date().toISOString();

  const { data: insertedStory, error: storyError } = await supabase
    .from("stories")
    .insert({
      title,
      slug,
      summary,
      content,
      image_url: imageUrl,
      video_url: videoUrl,
      source_url: sourceUrl,
      source_name: sourceName,
      category_slug: categorySlug,
      publish_date: publishedAt,
      is_reader_submission: true,
      submitted_by_name: authorName,
      source_type: "admin",
      featured: false,
      story_score: 100,
      positivity_score: 100,
    })
    .select("id, slug")
    .single();

  if (storyError || !insertedStory) {
    console.error("Admin story insert error:", storyError);
    redirect(
      `/admin/stories/new?error=${encodeURIComponent(
        storyError?.message || "Failed to publish story."
      )}`
    );
  }

  const { error: submissionError } = await supabase
    .from("reader_submissions")
    .insert({
      submission_type: submissionType,
      status: "published",
      title,
      slug,
      summary,
      content,
      source_url: sourceUrl,
      source_name: sourceName,
      author_name: authorName,
      author_email: authorEmail,
      image_url: imageUrl,
      video_url: videoUrl,
      category_slug: categorySlug,
      consent_original: submissionType === "original_story",
      consent_publication_rights: submissionType === "article_link",
      consent_terms: true,
      moderation_notes: "Admin-created and auto-published",
      linked_story_id: insertedStory.id,
    });

  if (submissionError) {
    console.error("Admin submission log insert error:", submissionError);
  }

  await supabase.from("reader_submission_events").insert({
    submission_id: insertedStory.id,
    event_type: "admin_published",
    notes: "Admin-created story published directly to stories table",
  });

  redirect(`/stories/${insertedStory.slug}`);
}