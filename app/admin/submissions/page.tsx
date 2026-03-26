import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import AdminSubmissionRowActions from "./AdminSubmissionRowActions";

type SubmissionRow = {
  id: string;
  submission_type: "original_story" | "article_link";
  status: "pending" | "approved" | "rejected" | "published";
  title: string;
  author_name: string;
  author_email: string;
  source_name: string | null;
  submitted_at: string;
  moderation_notes: string | null;
  linked_story_id: string | null;
};

type SearchParams = Promise<{
  status?: string;
  flagged?: string;
}>;

function formatSubmissionType(type: SubmissionRow["submission_type"]) {
  return type === "original_story" ? "Original Story" : "Article Link";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusPillStyles(status: SubmissionRow["status"]) {
  switch (status) {
    case "pending":
      return {
        background: "#fef3c7",
        color: "#92400e",
      };
    case "approved":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    case "rejected":
      return {
        background: "#fee2e2",
        color: "#b91c1c",
      };
    case "published":
      return {
        background: "#d1fae5",
        color: "#065f46",
      };
    default:
      return {
        background: "#f3f4f6",
        color: "#374151",
      };
  }
}

function buildFilterHref(status?: string, flagged?: boolean) {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (flagged) {
    params.set("flagged", "1");
  }

  const query = params.toString();
  return query ? `/admin/submissions?${query}` : "/admin/submissions";
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9999,
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
        border: active ? "1px solid #059669" : "1px solid #d1d5db",
        background: active ? "#ecfdf5" : "#ffffff",
        color: active ? "#047857" : "#374151",
      }}
    >
      {label}
    </Link>
  );
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedStatus = params?.status || "all";
  const flaggedOnly = params?.flagged === "1";

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    redirect("/login?error=You do not have admin access");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("reader_submissions")
    .select(
      "id, submission_type, status, title, author_name, author_email, source_name, submitted_at, moderation_notes, linked_story_id"
    )
    .order("submitted_at", { ascending: false });

  if (submissionsError) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            Failed to load submissions.
          </div>
        </div>
      </main>
    );
  }

  const allRows = (submissions || []) as SubmissionRow[];

  const pendingCount = allRows.filter((item) => item.status === "pending").length;
  const approvedCount = allRows.filter((item) => item.status === "approved").length;
  const rejectedCount = allRows.filter((item) => item.status === "rejected").length;
  const publishedCount = allRows.filter((item) => item.status === "published").length;
  const flaggedCount = allRows.filter((item) => !!item.moderation_notes).length;

  let rows = allRows;

  if (selectedStatus !== "all") {
    rows = rows.filter((item) => item.status === selectedStatus);
  }

  if (flaggedOnly) {
    rows = rows.filter((item) => !!item.moderation_notes);
  }

  async function signOut() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
              Daily Good News
            </p>
            <h1 className="text-3xl font-bold text-gray-900">
              Reader Submissions
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review original stories and article links submitted by readers.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="text-sm text-gray-600">
              Signed in as{" "}
              <span className="font-medium text-gray-900">
                {profile.email || user.email}
              </span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-2xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {pendingCount}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Approved</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {approvedCount}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Rejected</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {rejectedCount}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Published</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {publishedCount}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Flagged</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {flaggedCount}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-900">Filters</div>

          <div className="flex flex-wrap gap-3">
            <FilterLink
              label="All"
              href={buildFilterHref("all", false)}
              active={selectedStatus === "all" && !flaggedOnly}
            />
            <FilterLink
              label="Pending"
              href={buildFilterHref("pending", false)}
              active={selectedStatus === "pending" && !flaggedOnly}
            />
            <FilterLink
              label="Approved"
              href={buildFilterHref("approved", false)}
              active={selectedStatus === "approved" && !flaggedOnly}
            />
            <FilterLink
              label="Rejected"
              href={buildFilterHref("rejected", false)}
              active={selectedStatus === "rejected" && !flaggedOnly}
            />
            <FilterLink
              label="Published"
              href={buildFilterHref("published", false)}
              active={selectedStatus === "published" && !flaggedOnly}
            />
            <FilterLink
              label="Flagged"
              href={buildFilterHref("all", true)}
              active={flaggedOnly}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Moderation Queue
            </h2>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-600">
              No submissions match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Title
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Submitter
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Source
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Notes
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Submitted
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      Actions
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((submission) => {
                    const statusStyles = getStatusPillStyles(submission.status);
                    const isFlagged = !!submission.moderation_notes;

                    return (
                      <tr
                        key={submission.id}
                        className="border-t border-gray-100 align-top"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {submission.title}
                          </div>

                          {submission.linked_story_id ? (
                            <div className="mt-2">
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                Published story linked
                              </span>
                            </div>
                          ) : null}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatSubmissionType(submission.submission_type)}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div>{submission.author_name}</div>
                          <div className="text-gray-500">
                            {submission.author_email}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {submission.source_name || "—"}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-col gap-2">
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                width: "fit-content",
                                borderRadius: 9999,
                                padding: "4px 12px",
                                fontWeight: 600,
                                background: statusStyles.background,
                                color: statusStyles.color,
                              }}
                            >
                              {submission.status.charAt(0).toUpperCase() +
                                submission.status.slice(1)}
                            </span>

                            {isFlagged ? (
                              <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                Flagged
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {submission.moderation_notes ? (
                            <div className="max-w-[260px] whitespace-pre-wrap rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {submission.moderation_notes}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(submission.submitted_at)}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <AdminSubmissionRowActions
                            submissionId={submission.id}
                            status={submission.status}
                          />
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <Link
                            href={`/admin/submissions/${submission.id}`}
                            className="font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}