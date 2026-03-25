import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore cookie set issues in route handlers
        }
      },
    },
  });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function detectCategory(
  submissionType: "original_story" | "article_link",
  title: string | null,
  summary: string | null,
  content: string | null,
  sourceName: string | null
) {
  const haystack = [
    title || "",
    summary || "",
    content || "",
    sourceName || "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    haystack.includes("dog") ||
    haystack.includes("cat") ||
    haystack.includes("animal") ||
    haystack.includes("wildlife") ||
    haystack.includes("bird") ||
    haystack.includes("pet") ||
    haystack.includes("rescue")
  ) {
    return "animals";
  }

  if (
    haystack.includes("health") ||
    haystack.includes("hospital") ||
    haystack.includes("doctor") ||
    haystack.includes("nurse") ||
    haystack.includes("medical") ||
    haystack.includes("therapy") ||
    haystack.includes("mental health") ||
    haystack.includes("wellness")
  ) {
    return "health";
  }

  if (
    haystack.includes("kindness") ||
    haystack.includes("generosity") ||
    haystack.includes("donation") ||
    haystack.includes("volunteer") ||
    haystack.includes("helped") ||
    haystack.includes("helping") ||
    haystack.includes("gift") ||
    haystack.includes("support")
  ) {
    return "kindness";
  }

  if (
    haystack.includes("community") ||
    haystack.includes("neighborhood") ||
    haystack.includes("school") ||
    haystack.includes("town") ||
    haystack.includes("city") ||
    haystack.includes("library") ||
    haystack.includes("students") ||
    haystack.includes("families")
  ) {
    return "community";
  }

  if (submissionType === "original_story") {
    return "community";
  }

  return "hope";
}

function buildStoryContent(submission: {
  submission_type: "original_story" | "article_link";
  title: string | null;
  summary: string | null;
  content: string | null;
  source_name: string | null;
  source_url: string | null;
  author_name: string | null;
}) {
  if (submission.submission_type === "original_story") {
    return submission.content || submission.summary || "";
  }

  const summary = submission.summary?.trim() || "";
  const sourceName = submission.source_name?.trim() || "the original publication";
  const sourceUrl = submission.source_url?.trim() || "";
  const title = submission.title?.trim() || "Submitted article";
  const submitter = submission.author_name?.trim() || "A reader";

  const parts = [
    `This story was submitted by ${submitter} as a recommended article for Daily Good News.`,
    summary ? summary : `A positive article titled "${title}" was submitted for review.`,
    `Original source: ${sourceName}.`,
    sourceUrl ? `Read the original article here: ${sourceUrl}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

async function generateUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseSlug: string,
  submissionId: string
) {
  let candidate = baseSlug || `reader-submission-${submissionId.slice(0, 8)}`;

  const { data: existing } = await supabase
    .from("stories")
    .select("id")
    .eq("slug", candidate)
    .limit(1);

  if (!existing || existing.length === 0) {
    return candidate;
  }

  candidate = `${candidate}-${submissionId.slice(0, 8)}`;

  const { data: secondCheck } = await supabase
    .from("stories")
    .select("id")
    .eq("slug", candidate)
    .limit(1);

  if (!secondCheck || secondCheck.length === 0) {
    return candidate;
  }

  return `${candidate}-${Date.now().toString().slice(-6)}`;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: submission, error: submissionError } = await supabase
      .from("reader_submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      console.error("Publish submission lookup error:", submissionError);
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status === "rejected") {
      return NextResponse.json(
        { error: "Rejected submissions cannot be published." },
        { status: 400 }
      );
    }

    if (submission.status === "published" && submission.linked_story_id) {
      return NextResponse.json({
        success: true,
        message: "Submission already published",
        story_id: submission.linked_story_id,
      });
    }

    const { data: existingBySubmission } = await supabase
      .from("stories")
      .select("id, slug")
      .eq("submission_id", submission.id)
      .limit(1);

    if (existingBySubmission && existingBySubmission.length > 0) {
      const existingStory = existingBySubmission[0];

      await supabase
        .from("reader_submissions")
        .update({
          status: "published",
          linked_story_id: existingStory.id,
          published_at: submission.published_at || new Date().toISOString(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        message: "Submission was already linked to an existing story.",
        story_id: existingStory.id,
        slug: existingStory.slug,
      });
    }

    if (submission.source_url) {
      const { data: existingBySourceUrl } = await supabase
        .from("stories")
        .select("id, slug")
        .eq("source_url", submission.source_url)
        .limit(1);

      if (existingBySourceUrl && existingBySourceUrl.length > 0) {
        const existingStory = existingBySourceUrl[0];

        await supabase
          .from("reader_submissions")
          .update({
            status: "published",
            linked_story_id: existingStory.id,
            published_at: submission.published_at || new Date().toISOString(),
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);

        await supabase.from("reader_submission_events").insert({
          submission_id: id,
          event_type: "linked_to_existing_story",
          actor_user_id: user.id,
          notes: `Matched existing story by source_url (${existingStory.slug || existingStory.id})`,
        });

        return NextResponse.json({
          success: true,
          message: "Matched to an existing story by source URL.",
          story_id: existingStory.id,
          slug: existingStory.slug,
        });
      }
    }

    const baseSlug = slugify(submission.title || "reader-submission");
    const finalSlug = await generateUniqueSlug(supabase, baseSlug, submission.id);

    const categorySlug = detectCategory(
      submission.submission_type,
      submission.title,
      submission.summary,
      submission.content,
      submission.source_name
    );

    const storyContent = buildStoryContent({
      submission_type: submission.submission_type,
      title: submission.title,
      summary: submission.summary,
      content: submission.content,
      source_name: submission.source_name,
      source_url: submission.source_url,
      author_name: submission.author_name,
    });

    const publishDate = new Date().toISOString();

    const insertPayload = {
      title: submission.title,
      slug: finalSlug,
      summary: submission.summary,
      content: storyContent,
      image_url: submission.image_url,
      source_url: submission.source_url,
      category_slug: categorySlug,
      publish_date: publishDate,
      is_reader_submission: true,
      submission_id: submission.id,
      submitted_by_name: submission.author_name,
    };

    const { data: story, error: insertError } = await supabase
      .from("stories")
      .insert(insertPayload)
      .select("id, slug, category_slug")
      .single();

    if (insertError || !story) {
      console.error("Publish story insert error:", insertError);
      return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("reader_submissions")
      .update({
        status: "published",
        published_at: publishDate,
        reviewed_by: user.id,
        reviewed_at: publishDate,
        linked_story_id: story.id,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Publish submission update error:", updateError);
      return NextResponse.json(
        { error: "Story created but submission update failed" },
        { status: 500 }
      );
    }

    const eventNotes =
      submission.submission_type === "original_story"
        ? `Published as an original reader story in category ${story.category_slug}`
        : `Published as an article submission in category ${story.category_slug}`;

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: id,
        event_type: "published_to_stories",
        actor_user_id: user.id,
        notes: eventNotes,
      });

    if (eventError) {
      console.error("Publish event error:", eventError);
    }

    return NextResponse.json({
      success: true,
      story_id: story.id,
      slug: story.slug,
      category_slug: story.category_slug,
    });
  } catch (error) {
    console.error("Publish route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}