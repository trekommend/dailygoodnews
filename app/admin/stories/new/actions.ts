"use server";

import { createAdminClient } from "../../../../lib/supabase/admin";
import { redirect } from "next/navigation";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export async function createStory(formData: FormData) {
  const supabase = createAdminClient();

  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const image_url = String(formData.get("image_url") || "").trim();
  const source_url = String(formData.get("source_url") || "").trim();
  const source_name = String(formData.get("source_name") || "").trim();
  const category_slug =
    String(formData.get("category_slug") || "hope").trim();

  if (!title) {
    throw new Error("Title is required");
  }

  const slug = generateSlug(title);

  await supabase.from("stories").insert({
    title,
    slug,
    summary,
    content,
    image_url,
    source_url,
    source_name,
    category_slug,
    publish_date: new Date().toISOString(),

    // 🔥 key flags
    is_reader_submission: true,
    source_type: "admin",

    featured: false,
  });

  redirect("/admin/submissions");
}