import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const submissionSchema = z
  .object({
    submission_type: z.enum(["original_story", "article_link"]),
    title: z.string().trim().min(3, "Please enter a title.").max(200),
    summary: z.string().trim().max(500, "Summary must be 500 characters or less.").optional().or(z.literal("")),
    content: z.string().trim().optional().or(z.literal("")),
    source_url: z.string().trim().url("Please enter a valid article URL.").optional().or(z.literal("")),
    source_name: z.string().trim().max(150, "Publication name is too long.").optional().or(z.literal("")),
    author_name: z.string().trim().min(2, "Please enter your name.").max(120),
    author_email: z.string().trim().email("Please enter a valid email address."),
    author_bio: z.string().trim().max(300, "Bio must be 300 characters or less.").optional().or(z.literal("")),
    location_text: z.string().trim().max(120, "Location must be 120 characters or less.").optional().or(z.literal("")),
    image_url: z.string().trim().url("Please enter a valid image URL.").optional().or(z.literal("")),
    consent_original: z.boolean().optional(),
    consent_publication_rights: z.boolean().optional(),
    consent_terms: z.boolean(),
    website: z.string().optional(), // honeypot
  })
  .superRefine((data, ctx) => {
    if (!data.consent_terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent_terms"],
        message: "You must agree to the submission terms.",
      });
    }

    if (data.submission_type === "original_story") {
      if (!data.content || data.content.trim().length < 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "Please provide the full story with at least 100 characters.",
        });
      }

      if (!data.consent_original) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["consent_original"],
          message: "Please confirm this is your original story.",
        });
      }
    }

    if (data.submission_type === "article_link") {
      if (!data.source_url || data.source_url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_url"],
          message: "Please provide the article URL.",
        });
      }

      if (!data.source_name || data.source_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_name"],
          message: "Please provide the publication name.",
        });
      }

      if (!data.consent_publication_rights) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["consent_publication_rights"],
          message: "Please confirm you are only submitting the article link.",
        });
      }
    }
  });

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables for submissions route.");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = submissionSchema.parse(body);

    // Simple honeypot anti-spam
    if (parsed.website && parsed.website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Duplicate article URL check
    if (parsed.submission_type === "article_link" && parsed.source_url) {
      const { data: existingSubmission, error: duplicateError } = await supabase
        .from("reader_submissions")
        .select("id")
        .eq("source_url", parsed.source_url.trim())
        .limit(1);

      if (duplicateError) {
        console.error("Duplicate submission lookup error:", duplicateError);
        return NextResponse.json(
          { error: "Failed to validate article submission." },
          { status: 500 }
        );
      }

      if (existingSubmission && existingSubmission.length > 0) {
        return NextResponse.json(
          { error: "This article has already been submitted." },
          { status: 409 }
        );
      }

      const { data: existingStory, error: existingStoryError } = await supabase
        .from("stories")
        .select("id")
        .eq("source_url", parsed.source_url.trim())
        .limit(1);

      if (existingStoryError) {
        console.error("Existing story lookup error:", existingStoryError);
        return NextResponse.json(
          { error: "Failed to validate article submission." },
          { status: 500 }
        );
      }

      if (existingStory && existingStory.length > 0) {
        return NextResponse.json(
          { error: "This article already exists in Daily Good News." },
          { status: 409 }
        );
      }
    }

    const cleanTitle = parsed.title.trim();
    const cleanSummary = parsed.summary?.trim() || null;
    const cleanContent = parsed.content?.trim() || null;
    const cleanSourceUrl = parsed.source_url?.trim() || null;
    const cleanSourceName = parsed.source_name?.trim() || null;
    const cleanAuthorName = parsed.author_name.trim();
    const cleanAuthorEmail = parsed.author_email.trim().toLowerCase();
    const cleanAuthorBio = parsed.author_bio?.trim() || null;
    const cleanLocationText = parsed.location_text?.trim() || null;
    const cleanImageUrl = parsed.image_url?.trim() || null;

    const slug = slugify(cleanTitle);

    const insertPayload = {
      submission_type: parsed.submission_type,
      status: "pending",
      title: cleanTitle,
      slug: slug || null,
      summary: cleanSummary,
      content: cleanContent,
      source_url: cleanSourceUrl,
      source_name: cleanSourceName,
      author_name: cleanAuthorName,
      author_email: cleanAuthorEmail,
      author_bio: cleanAuthorBio,
      location_text: cleanLocationText,
      image_url: cleanImageUrl,
      consent_original: !!parsed.consent_original,
      consent_publication_rights: !!parsed.consent_publication_rights,
      consent_terms: parsed.consent_terms,
    };

    const { data: insertedSubmission, error: insertError } = await supabase
      .from("reader_submissions")
      .insert(insertPayload)
      .select("id, submission_type, status, submitted_at")
      .single();

    if (insertError) {
      console.error("Submission insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save your submission." },
        { status: 500 }
      );
    }

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: insertedSubmission.id,
        event_type: "created",
        notes:
          parsed.submission_type === "original_story"
            ? "Original story submission created"
            : "Article link submission created",
      });

    if (eventError) {
      console.error("Submission event insert error:", eventError);
    }

    return NextResponse.json({
      success: true,
      submission: insertedSubmission,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields and try again.",
          issues: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Unexpected submission route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}