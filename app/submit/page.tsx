"use client";

import { FormEvent, useMemo, useState } from "react";

type SubmissionType = "original_story" | "article_link";

type FormState = {
  title: string;
  summary: string;
  content: string;
  source_url: string;
  source_name: string;
  author_name: string;
  author_email: string;
  author_bio: string;
  location_text: string;
  image_url: string;
  consent_original: boolean;
  consent_publication_rights: boolean;
  consent_terms: boolean;
  website: string; // honeypot
};

type ValidationIssue = {
  path?: string[];
  message?: string;
};

const initialFormState: FormState = {
  title: "",
  summary: "",
  content: "",
  source_url: "",
  source_name: "",
  author_name: "",
  author_email: "",
  author_bio: "",
  location_text: "",
  image_url: "",
  consent_original: false,
  consent_publication_rights: false,
  consent_terms: false,
  website: "",
};

export default function SubmitPage() {
  const [submissionType, setSubmissionType] =
    useState<SubmissionType>("original_story");
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const heading = useMemo(() => {
    return submissionType === "original_story"
      ? "Share Your Good News Story"
      : "Submit a Great Article";
  }, [submissionType]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setGeneralError("");
    setSuccessMessage("");
  }

  function normalizeIssues(issues: ValidationIssue[]) {
    const nextErrors: Record<string, string> = {};

    for (const issue of issues) {
      const key = issue.path?.[0];
      if (key && issue.message) {
        nextErrors[key] = issue.message;
      }
    }

    setFieldErrors(nextErrors);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setIsSubmitting(true);
    setSuccessMessage("");
    setGeneralError("");
    setFieldErrors({});

    try {
      const payload = {
        submission_type: submissionType,
        ...form,
      };

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        if (json?.issues && Array.isArray(json.issues)) {
          normalizeIssues(json.issues);
        }

        setGeneralError(json?.error || "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        submissionType === "original_story"
          ? "Thanks for sharing your story. It has been submitted for review."
          : "Thanks for submitting this article. It has been sent for review."
      );

      setForm(initialFormState);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Submission failed:", error);
      setGeneralError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Daily Good News
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Submit a Story
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-gray-600">
            Share your own uplifting story or send us a positive article from a
            real publication. Every submission is reviewed before anything is
            published.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setSubmissionType("original_story");
              setGeneralError("");
              setSuccessMessage("");
              setFieldErrors({});
            }}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              submissionType === "original_story"
                ? "border-emerald-600 bg-emerald-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-lg font-semibold text-gray-900">
              Write Your Story
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Share an original good news story you wrote yourself.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubmissionType("article_link");
              setGeneralError("");
              setSuccessMessage("");
              setFieldErrors({});
            }}
            className={`rounded-2xl border px-5 py-4 text-left transition ${
              submissionType === "article_link"
                ? "border-emerald-600 bg-emerald-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="text-lg font-semibold text-gray-900">
              Submit an Article
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Send us a link to a positive article from a real publication.
            </p>
          </button>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {submissionType === "original_story"
                ? "Have you experienced or witnessed something uplifting? Tell us the full story and we may feature it."
                : "Found a great article that deserves more attention? Send us the link and tell us why it fits Daily Good News."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div style={{ display: "none" }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                autoComplete="off"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Title
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none ring-0 transition focus:border-emerald-600"
                placeholder={
                  submissionType === "original_story"
                    ? "Example: Our neighborhood turned an empty lot into a community garden"
                    : "Example: A city library erased late fees and tripled membership"
                }
              />
              {fieldErrors.title && (
                <p className="mt-2 text-sm text-red-600">{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="summary"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Short summary
              </label>
              <textarea
                id="summary"
                rows={3}
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                placeholder="Give a short summary of the story."
              />
              {fieldErrors.summary && (
                <p className="mt-2 text-sm text-red-600">
                  {fieldErrors.summary}
                </p>
              )}
            </div>

            {submissionType === "original_story" ? (
              <div>
                <label
                  htmlFor="content"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Full story
                </label>
                <textarea
                  id="content"
                  rows={10}
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                  placeholder="Write your full story here."
                />
                {fieldErrors.content && (
                  <p className="mt-2 text-sm text-red-600">
                    {fieldErrors.content}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="source_url"
                    className="mb-2 block text-sm font-medium text-gray-900"
                  >
                    Article URL
                  </label>
                  <input
                    id="source_url"
                    type="url"
                    value={form.source_url}
                    onChange={(e) => updateField("source_url", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                    placeholder="https://example.com/story"
                  />
                  {fieldErrors.source_url && (
                    <p className="mt-2 text-sm text-red-600">
                      {fieldErrors.source_url}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="source_name"
                    className="mb-2 block text-sm font-medium text-gray-900"
                  >
                    Publication name
                  </label>
                  <input
                    id="source_name"
                    type="text"
                    value={form.source_name}
                    onChange={(e) => updateField("source_name", e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                    placeholder="Example: Positive News"
                  />
                  {fieldErrors.source_name && (
                    <p className="mt-2 text-sm text-red-600">
                      {fieldErrors.source_name}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="author_name"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Your name
                </label>
                <input
                  id="author_name"
                  type="text"
                  value={form.author_name}
                  onChange={(e) => updateField("author_name", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                  placeholder="Your name"
                />
                {fieldErrors.author_name && (
                  <p className="mt-2 text-sm text-red-600">
                    {fieldErrors.author_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="author_email"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Your email
                </label>
                <input
                  id="author_email"
                  type="email"
                  value={form.author_email}
                  onChange={(e) => updateField("author_email", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                  placeholder="you@example.com"
                />
                {fieldErrors.author_email && (
                  <p className="mt-2 text-sm text-red-600">
                    {fieldErrors.author_email}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="author_bio"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Short bio (optional)
              </label>
              <input
                id="author_bio"
                type="text"
                value={form.author_bio}
                onChange={(e) => updateField("author_bio", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                placeholder="Example: Teacher, volunteer, parent, student, etc."
              />
              {fieldErrors.author_bio && (
                <p className="mt-2 text-sm text-red-600">
                  {fieldErrors.author_bio}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="location_text"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Location (optional)
                </label>
                <input
                  id="location_text"
                  type="text"
                  value={form.location_text}
                  onChange={(e) => updateField("location_text", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                  placeholder="City, State or Country"
                />
                {fieldErrors.location_text && (
                  <p className="mt-2 text-sm text-red-600">
                    {fieldErrors.location_text}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="image_url"
                  className="mb-2 block text-sm font-medium text-gray-900"
                >
                  Image URL (optional)
                </label>
                <input
                  id="image_url"
                  type="url"
                  value={form.image_url}
                  onChange={(e) => updateField("image_url", e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-emerald-600"
                  placeholder="https://example.com/image.jpg"
                />
                {fieldErrors.image_url && (
                  <p className="mt-2 text-sm text-red-600">
                    {fieldErrors.image_url}
                  </p>
                )}
              </div>
            </div>

            {submissionType === "original_story" && (
              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={form.consent_original}
                  onChange={(e) =>
                    updateField("consent_original", e.target.checked)
                  }
                  className="mt-1"
                />
                <span className="text-sm leading-6 text-gray-700">
                  I confirm that this is my original story, or that I have the
                  right to submit it.
                </span>
              </label>
            )}

            {submissionType === "article_link" && (
              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={form.consent_publication_rights}
                  onChange={(e) =>
                    updateField(
                      "consent_publication_rights",
                      e.target.checked
                    )
                  }
                  className="mt-1"
                />
                <span className="text-sm leading-6 text-gray-700">
                  I understand that this article belongs to the original
                  publication and that I am only submitting the link for
                  editorial review.
                </span>
              </label>
            )}

            <label className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={form.consent_terms}
                onChange={(e) => updateField("consent_terms", e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm leading-6 text-gray-700">
                I agree to the submission terms and understand that submission
                does not guarantee publication.
              </span>
            </label>

            {generalError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {generalError}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}