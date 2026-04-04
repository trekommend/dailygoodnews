"use client";

import { useState } from "react";

type SubmissionActionsProps = {
  submissionId: string;
  status: "pending" | "approved" | "rejected" | "published";
};

async function readApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText);
    } catch {
      return {
        error: "Invalid JSON response from server.",
        rawText,
      };
    }
  }

  return {
    error: "Server returned a non-JSON response.",
    rawText,
  };
}

export default function SubmissionActions({
  submissionId,
  status,
}: SubmissionActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleApprove() {
    try {
      setLoadingAction("approve");
      setMessage("");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/approve`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        console.error("Approve error response:", result);
        setError(
          result?.error ||
            result?.rawText?.slice(0, 300) ||
            "Failed to approve submission."
        );
        setLoadingAction(null);
        return;
      }

      setMessage("Submission approved.");
      window.location.reload();
    } catch (err) {
      console.error("Approve request failed:", err);
      setError("Failed to approve submission.");
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    const reason = window.prompt("Enter a rejection reason (optional):", "");

    try {
      setLoadingAction("reject");
      setMessage("");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        console.error("Reject error response:", result);
        setError(
          result?.error ||
            result?.rawText?.slice(0, 300) ||
            "Failed to reject submission."
        );
        setLoadingAction(null);
        return;
      }

      setMessage("Submission rejected.");
      window.location.reload();
    } catch (err) {
      console.error("Reject request failed:", err);
      setError("Failed to reject submission.");
      setLoadingAction(null);
    }
  }

  async function handlePublish() {
    try {
      setLoadingAction("publish");
      setMessage("");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/publish`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        console.error("Publish error response:", result);
        setError(
          result?.error ||
            result?.rawText?.slice(0, 300) ||
            "Failed to publish submission."
        );
        setLoadingAction(null);
        return;
      }

      setMessage("Submission published to the site.");
      window.location.reload();
    } catch (err) {
      console.error("Publish request failed:", err);
      setError("Failed to publish submission.");
      setLoadingAction(null);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this submission? If it was already published, the linked story will also be deleted."
    );

    if (!confirmed) return;

    try {
      setLoadingAction("delete");
      setMessage("");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/delete`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        console.error("Delete error response:", result);
        setError(
          result?.error ||
            result?.rawText?.slice(0, 300) ||
            "Failed to delete submission."
        );
        setLoadingAction(null);
        return;
      }

      window.location.href = "/admin/submissions";
    } catch (err) {
      console.error("Delete request failed:", err);
      setError("Failed to delete submission.");
      setLoadingAction(null);
    }
  }

  const isPublished = status === "published";

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Actions</h2>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loadingAction !== null || isPublished}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "approve" ? "Approving..." : "Approve"}
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={loadingAction !== null || isPublished}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "reject" ? "Rejecting..." : "Reject"}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={loadingAction !== null || isPublished}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "publish" ? "Publishing..." : "Publish to Site"}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={loadingAction !== null}
          className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "delete" ? "Deleting..." : "Delete"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm whitespace-pre-wrap break-words text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}