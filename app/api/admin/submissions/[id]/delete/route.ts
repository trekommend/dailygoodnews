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
      .select("id, linked_story_id, status")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.linked_story_id) {
      const { error: storyDeleteError } = await supabase
        .from("stories")
        .delete()
        .eq("id", submission.linked_story_id);

      if (storyDeleteError) {
        console.error("Delete linked story error:", storyDeleteError);
        return NextResponse.json(
          { error: `Failed to delete linked story: ${storyDeleteError.message}` },
          { status: 500 }
        );
      }
    }

    const { error: eventsDeleteError } = await supabase
      .from("reader_submission_events")
      .delete()
      .eq("submission_id", id);

    if (eventsDeleteError) {
      console.error("Delete submission events error:", eventsDeleteError);
      return NextResponse.json(
        { error: `Failed to delete submission events: ${eventsDeleteError.message}` },
        { status: 500 }
      );
    }

    const { error: submissionDeleteError } = await supabase
      .from("reader_submissions")
      .delete()
      .eq("id", id);

    if (submissionDeleteError) {
      console.error("Delete submission error:", submissionDeleteError);
      return NextResponse.json(
        { error: `Failed to delete submission: ${submissionDeleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete submission route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}