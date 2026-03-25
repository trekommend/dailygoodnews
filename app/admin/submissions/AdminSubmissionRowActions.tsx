"use client";

import { useState } from "react";

type AdminSubmissionRowActionsProps = {
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

export default function AdminSubmissionRowActions({
  submissionId,
  status,
}: AdminSubmissionRowActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isPublished = status === "published";

  async function handleApprove() {
    try {
      setLoadingAction("approve");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/approve`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        setError(
          result?.error ||
            result?.rawText?.slice(0, 200) ||
            "Failed to approve."
        );
        setLoadingAction(null);
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("Quick approve failed:", err);
      setError("Failed to approve.");
      setLoadingAction(null);
    }
  }

  async function handleReject() {
    const reason = window.prompt("Enter a rejection reason (optional):", "");

    try {
      setLoadingAction("reject");
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
        setError(
          result?.error ||
            result?.rawText?.slice(0, 200) ||
            "Failed to reject."
        );
        setLoadingAction(null);
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("Quick reject failed:", err);
      setError("Failed to reject.");
      setLoadingAction(null);
    }
  }

  async function handlePublish() {
    try {
      setLoadingAction("publish");
      setError("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/publish`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        setError(
          result?.error ||
            result?.rawText?.slice(0, 200) ||
            "Failed to publish."
        );
        setLoadingAction(null);
        return;
      }

      window.location.reload();
    } catch (err) {
      console.error("Quick publish failed:", err);
      setError("Failed to publish.");
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-w-[220px]">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={loadingAction !== null || isPublished}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "approve" ? "Approving..." : "Approve"}
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={loadingAction !== null || isPublished}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "reject" ? "Rejecting..." : "Reject"}
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={loadingAction !== null || isPublished}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingAction === "publish" ? "Publishing..." : "Publish"}
        </button>
      </div>

      {error ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap break-words">
          {error}
        </div>
      ) : null}
    </div>
  );
}