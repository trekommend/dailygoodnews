"use client";

import { useState } from "react";

type AdminSubmissionRowActionsProps = {
  submissionId: string;
  status: "pending" | "approved" | "rejected" | "published";
  linkedStoryId?: string | null;
  blueskyPostedAt?: string | null;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  details?: string;
  rawText?: string;
  blueskyPostUri?: string | null;
  postedAt?: string | null;
};

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawText) as ApiResponse;
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

function getErrorMessage(
  result: ApiResponse,
  fallbackMessage: string
): string {
  if (result.details) {
    return `${result.error || fallbackMessage}: ${result.details}`;
  }

  return (
    result.error ||
    result.rawText?.slice(0, 200) ||
    fallbackMessage
  );
}

export default function AdminSubmissionRowActions({
  submissionId,
  status,
  linkedStoryId,
  blueskyPostedAt,
}: AdminSubmissionRowActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [postedToBluesky, setPostedToBluesky] = useState(
    Boolean(blueskyPostedAt)
  );

  const isPublished = status === "published";
  const canPostToBluesky = isPublished && Boolean(linkedStoryId);

  async function handleApprove() {
    try {
      setLoadingAction("approve");
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/approve`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        setError(getErrorMessage(result, "Failed to approve."));
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

    if (reason === null) {
      return;
    }

    try {
      setLoadingAction("reject");
      setError("");
      setSuccess("");

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
        setError(getErrorMessage(result, "Failed to reject."));
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
      setSuccess("");

      const response = await fetch(
        `/api/admin/submissions/${submissionId}/publish`,
        {
          method: "POST",
        }
      );

      const result = await readApiResponse(response);

      if (!response.ok) {
        setError(getErrorMessage(result, "Failed to publish."));
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

  async function handlePostToBluesky() {
    if (!linkedStoryId) {
      setError("This submission is not linked to a published story.");
      return;
    }

    try {
      setLoadingAction("bluesky");
      setError("");
      setSuccess("");

      const response = await fetch("/api/social/bluesky", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storyId: linkedStoryId,
        }),
      });

      const result = await readApiResponse(response);

      if (response.status === 409) {
        setPostedToBluesky(true);
        setSuccess("This story was already posted to Bluesky.");
        setLoadingAction(null);
        return;
      }

      if (!response.ok) {
        setError(
          getErrorMessage(result, "Failed to post the story to Bluesky.")
        );
        setLoadingAction(null);
        return;
      }

      setPostedToBluesky(true);
      setSuccess("Story posted to Bluesky successfully.");
      setLoadingAction(null);
    } catch (err) {
      console.error("Bluesky posting failed:", err);
      setError("Failed to post the story to Bluesky.");
      setLoadingAction(null);
    }
  }

  return (
    <div className="min-w-[240px]">
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

        {canPostToBluesky ? (
          <button
            type="button"
            onClick={handlePostToBluesky}
            disabled={loadingAction !== null || postedToBluesky}
            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingAction === "bluesky"
              ? "Posting..."
              : postedToBluesky
                ? "Posted to Bluesky"
                : "Post to Bluesky"}
          </button>
        ) : null}
      </div>

      {isPublished && !linkedStoryId ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This published submission is not linked to a story, so it cannot be
          posted to Bluesky.
        </div>
      ) : null}

      {success ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 whitespace-pre-wrap break-words">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap break-words">
          {error}
        </div>
      ) : null}
    </div>
  );
}