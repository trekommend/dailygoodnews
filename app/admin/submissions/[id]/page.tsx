import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import SubmissionActions from "./SubmissionActions";

type SubmissionDetail = {
  id: string;
  submission_type: "original_story" | "article_link";
  status: "pending" | "approved" | "rejected" | "published";
  title: string;
  slug: string | null;
  summary: string | null;
  content: string | null;
  source_url: string | null;
  source_name: string | null;
  author_name: string;
  author_email: string;
  author_bio: string | null;
  location_text: string | null;
  image_url: string | null;
  video_url: string | null;
  category_slug: string | null;
  moderation_notes: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  published_at: string | null;
};

type EventRow = {
  id: number;
  event_type: string;
  notes: string | null;
  created_at: string;
};

function formatSubmissionType(type: SubmissionDetail["submission_type"]) {
  return type === "original_story" ? "Original Story" : "Article Link";
}

function formatStatus(status: SubmissionDetail["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "published":
      return "Published";
    default:
      return status;
  }
}

function formatCategory(value: string | null) {
  if (!value) return "—";

  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getVideoEmbedUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const videoId = url.searchParams.get("v");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];

      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

type SubmissionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login?error=You do not have admin access");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("reader_submissions")
    .select(`
      id,
      submission_type,
      status,
      title,
      slug,
      summary,
      content,
      source_url,
      source_name,
      author_name,
      author_email,
      author_bio,
      location_text,
      image_url,
      video_url,
      category_slug,
      moderation_notes,
      rejection_reason,
      submitted_at,
      reviewed_at,
      published_at
    `)
    .eq("id", id)
    .single();

  if (submissionError || !submission) {
    notFound();
  }

  const { data: events } = await supabase
    .from("reader_submission_events")
    .select("id, event_type, notes, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: false });

  const item = submission as SubmissionDetail;
  const history = (events || []) as EventRow[];
  const videoEmbedUrl = getVideoEmbedUrl(item.video_url);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/admin/submissions"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            ← Back to submissions
          </Link>
        </div>

        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
              {formatSubmissionType(item.submission_type)}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {formatStatus(item.status)}
            </span>
            {item.category_slug ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                {formatCategory(item.category_slug)}
              </span>
            ) : null}
            {item.video_url ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                Video included
              </span>
            ) : null}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{item.title}</h1>

          <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <span className="font-semibold text-gray-900">Submitted by:</span>{" "}
              {item.author_name}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Email:</span>{" "}
              {item.author_email}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Submitted:</span>{" "}
              {formatDate(item.submitted_at)}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Reviewed:</span>{" "}
              {formatDate(item.reviewed_at)}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Published:</span>{" "}
              {formatDate(item.published_at)}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Slug:</span>{" "}
              {item.slug || "—"}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Category:</span>{" "}
              {formatCategory(item.category_slug)}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Location:</span>{" "}
              {item.location_text || "—"}
            </div>
            <div>
              <span className="font-semibold text-gray-900">Publication:</span>{" "}
              {item.source_name || "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Summary
              </h2>
              <div className="whitespace-pre-wrap text-gray-700">
                {item.summary || "No summary provided."}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Full Content
              </h2>
              <div className="whitespace-pre-wrap leading-7 text-gray-700">
                {item.content || "No full content provided."}
              </div>
            </section>

            {item.source_url ? (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-xl font-semibold text-gray-900">
                  Source URL
                </h2>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-emerald-700 hover:text-emerald-800"
                >
                  {item.source_url}
                </a>
              </section>
            ) : null}

            {item.video_url ? (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-xl font-semibold text-gray-900">
                  Video
                </h2>

                {videoEmbedUrl ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-gray-200 bg-black">
                    <iframe
                      src={videoEmbedUrl}
                      title={`Video preview for ${item.title}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    This video URL could not be previewed, but it is still saved.
                  </p>
                )}

                <a
                  href={item.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block break-all text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Open video URL
                </a>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <SubmissionActions
              submissionId={item.id}
              status={item.status}
            />

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Submitter Info
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <span className="font-semibold text-gray-900">Name:</span>{" "}
                  {item.author_name}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Email:</span>{" "}
                  {item.author_email}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">Bio:</span>{" "}
                  {item.author_bio || "—"}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Image
              </h2>
              {item.image_url ? (
                <div className="space-y-3">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full rounded-2xl border border-gray-200 object-cover"
                  />
                  <a
                    href={item.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Open image URL
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No image provided.</p>
              )}
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Review Notes
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <span className="font-semibold text-gray-900">
                    Moderation notes:
                  </span>{" "}
                  {item.moderation_notes || "—"}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">
                    Rejection reason:
                  </span>{" "}
                  {item.rejection_reason || "—"}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Event History
              </h2>

              {history.length === 0 ? (
                <p className="text-sm text-gray-600">No event history yet.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((event) => (
                    <div
                      key={event.id}
                      className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {event.event_type}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatDate(event.created_at)}
                      </div>
                      <div className="mt-2 text-sm text-gray-700">
                        {event.notes || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}