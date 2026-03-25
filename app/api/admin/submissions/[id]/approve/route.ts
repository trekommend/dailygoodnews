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
          // Ignore in route handlers if cookies can't be set here
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

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("reader_submissions")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Approve update error:", updateError);
      return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
    }

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: id,
        event_type: "approved",
        actor_user_id: user.id,
        notes: "Submission approved",
      });

    if (eventError) {
      console.error("Approve event error:", eventError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approve route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}