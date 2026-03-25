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
};

function formatSubmissionType(type: SubmissionRow["submission_type"]) {
  return type === "original_story" ? "Original Story" : "Article Link";
}

function formatStatus(status: SubmissionRow["status"]) {
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

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminSubmissionsPage() {
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
      "id, submission_type, status, title, author_name, author_email, source_name, submitted_at"
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

  const rows = (submissions || []) as SubmissionRow[];

  const pendingCount = rows.filter((item) => item.status === "pending").length;
  const approvedCount = rows.filter((item) => item.status === "approved").length;
  const rejectedCount = rows.filter((item) => item.status === "rejected").length;
  const publishedCount = rows.filter((item) => item.status === "published").length;

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

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Moderation Queue
            </h2>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-600">
              No submissions yet.
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
                  {rows.map((submission) => (
                    <tr
                      key={submission.id}
                      className="border-t border-gray-100 align-top"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {submission.title}
                        </div>
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
                        <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
                          {formatStatus(submission.status)}
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}