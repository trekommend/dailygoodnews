import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : null;

    // Auth check — uses cookie-aware client
    const authClient = await createClient();
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // DB writes — uses service role client
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("reader_submissions")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Reject update error:", updateError);
      return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
    }

    const { error: eventError } = await supabase
      .from("reader_submission_events")
      .insert({
        submission_id: id,
        event_type: "rejected",
        actor_user_id: user.id,
        notes: reason,
      });

    if (eventError) {
      console.error("Reject event error:", eventError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reject route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}