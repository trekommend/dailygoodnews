"use client";

import { FormEvent, useState } from "react";

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
  website: string;
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p style={{ marginTop: 8, fontSize: 14, color: "#dc2626" }}>{message}</p>
  );
}

export default function SubmitPage() {
  const [submissionType, setSubmissionType] =
    useState<SubmissionType>("original_story");
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const titleCount = form.title.trim().length;
  const summaryCount = form.summary.length;
  const contentCount = form.content.length;

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

  function resetFormForMode(type: SubmissionType) {
    setSubmissionType(type);
    setGeneralError("");
    setSuccessMessage("");
    setFieldErrors({});
    setForm((prev) => ({
      ...initialFormState,
      author_name: prev.author_name,
      author_email: prev.author_email,
      author_bio: prev.author_bio,
      location_text: prev.location_text,
    }));
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

      setForm((prev) => ({
        ...initialFormState,
        author_name: prev.author_name,
        author_email: prev.author_email,
        author_bio: prev.author_bio,
        location_text: prev.location_text,
      }));

      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Submission failed:", error);
      setGeneralError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "40px 24px",
        lineHeight: 1.6,
      }}
    >
      <section
        style={{
          marginBottom: 24,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Submit a Story
        </h1>

        <p
          style={{
            marginTop: 12,
            maxWidth: 900,
            fontSize: 16,
            color: "#4b5563",
          }}
        >
          Share an original uplifting story or submit a positive article from a
          real publication for editorial review.
        </p>
      </section>

      {successMessage ? (
        <div
          style={{
            marginBottom: 24,
            border: "1px solid #a7f3d0",
            background: "#ecfdf5",
            borderRadius: 24,
            padding: 24,
            color: "#065f46",
          }}
        >
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Submission received
          </p>
          <p style={{ marginTop: 6, fontSize: 14 }}>{successMessage}</p>
        </div>
      ) : null}

      <section
        style={{
          marginBottom: 24,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Choose your submission type
        </h2>

        <p style={{ marginTop: 8, fontSize: 14, color: "#4b5563" }}>
          Pick the option that best matches what you want to send.
        </p>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="submission_type"
              value="original_story"
              checked={submissionType === "original_story"}
              onChange={() => resetFormForMode("original_story")}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  margin: 0,
                }}
              >
                I wrote this story
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: "#4b5563",
                }}
              >
                Share an original story in your own words.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 14,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="submission_type"
              value="article_link"
              checked={submissionType === "article_link"}
              onChange={() => resetFormForMode("article_link")}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111827",
                  margin: 0,
                }}
              >
                I’m submitting an article
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  color: "#4b5563",
                }}
              >
                Share a link to a positive article from a real publication.
              </div>
            </div>
          </label>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#059669",
            }}
          >
            {submissionType === "original_story"
              ? "Original Story Submission"
              : "Article Submission"}
          </p>

          <h2
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 32,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            {submissionType === "original_story"
              ? "Tell us your story"
              : "Share an article link"}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
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

          <section style={{ marginBottom: 40 }}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Story details
            </h3>

            <div
              style={{
                display: "grid",
                gap: 24,
              }}
            >
              <div>
                <div
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <label
                    htmlFor="title"
                    style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}
                  >
                    Title
                  </label>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {titleCount}/200
                  </span>
                </div>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder={
                    submissionType === "original_story"
                      ? "Example: Our neighborhood turned an empty lot into a community garden"
                      : "Example: A city library erased late fees and tripled membership"
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.title} />
              </div>

              <div>
                <div
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <label
                    htmlFor="summary"
                    style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}
                  >
                    Short description
                  </label>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>
                    {summaryCount}/500
                  </span>
                </div>
                <textarea
                  id="summary"
                  rows={4}
                  value={form.summary}
                  onChange={(e) => updateField("summary", e.target.value)}
                  placeholder={
                    submissionType === "original_story"
                      ? "Give a short summary of your story."
                      : "Briefly explain why this article fits Daily Good News."
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    resize: "vertical",
                  }}
                />
                <FieldError message={fieldErrors.summary} />
              </div>

              {submissionType === "original_story" ? (
                <div>
                  <div
                    style={{
                      marginBottom: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <label
                      htmlFor="content"
                      style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}
                    >
                      Full story
                    </label>
                    <span
                      style={{
                        fontSize: 12,
                        color: contentCount < 100 ? "#d97706" : "#9ca3af",
                      }}
                    >
                      {contentCount} characters
                    </span>
                  </div>
                  <textarea
                    id="content"
                    rows={14}
                    value={form.content}
                    onChange={(e) => updateField("content", e.target.value)}
                    placeholder="Write your full story here. Include what happened, who was involved, and why it mattered."
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 16,
                      padding: "14px 16px",
                      fontSize: 15,
                      resize: "vertical",
                    }}
                  />
                  <p style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    Aim for at least 100 characters.
                  </p>
                  <FieldError message={fieldErrors.content} />
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 24,
                  }}
                >
                  <div>
                    <label
                      htmlFor="source_url"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      Article URL
                    </label>
                    <input
                      id="source_url"
                      type="url"
                      value={form.source_url}
                      onChange={(e) => updateField("source_url", e.target.value)}
                      placeholder="https://example.com/story"
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: 16,
                        padding: "14px 16px",
                        fontSize: 15,
                      }}
                    />
                    <FieldError message={fieldErrors.source_url} />
                  </div>

                  <div>
                    <label
                      htmlFor="source_name"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      Publication name
                    </label>
                    <input
                      id="source_name"
                      type="text"
                      value={form.source_name}
                      onChange={(e) => updateField("source_name", e.target.value)}
                      placeholder="Example: Positive News"
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: 16,
                        padding: "14px 16px",
                        fontSize: 15,
                      }}
                    />
                    <FieldError message={fieldErrors.source_name} />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="image_url"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Image URL (optional)
                </label>
                <input
                  id="image_url"
                  type="url"
                  value={form.image_url}
                  onChange={(e) => updateField("image_url", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.image_url} />
              </div>
            </div>
          </section>

          <section
            style={{
              marginBottom: 40,
              paddingTop: 32,
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              About you
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
              }}
            >
              <div>
                <label
                  htmlFor="author_name"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Your name
                </label>
                <input
                  id="author_name"
                  type="text"
                  value={form.author_name}
                  onChange={(e) => updateField("author_name", e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.author_name} />
              </div>

              <div>
                <label
                  htmlFor="author_email"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Your email
                </label>
                <input
                  id="author_email"
                  type="email"
                  value={form.author_email}
                  onChange={(e) => updateField("author_email", e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.author_email} />
              </div>

              <div>
                <label
                  htmlFor="author_bio"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Short bio (optional)
                </label>
                <input
                  id="author_bio"
                  type="text"
                  value={form.author_bio}
                  onChange={(e) => updateField("author_bio", e.target.value)}
                  placeholder="Example: Teacher, volunteer, student, parent..."
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.author_bio} />
              </div>

              <div>
                <label
                  htmlFor="location_text"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Location (optional)
                </label>
                <input
                  id="location_text"
                  type="text"
                  value={form.location_text}
                  onChange={(e) => updateField("location_text", e.target.value)}
                  placeholder="City, State or Country"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
                <FieldError message={fieldErrors.location_text} />
              </div>
            </div>
          </section>

          <section
            style={{
              marginBottom: 32,
              paddingTop: 32,
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Permissions and review
            </h3>

            <div style={{ display: "grid", gap: 16 }}>
              {submissionType === "original_story" ? (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.consent_original}
                    onChange={(e) =>
                      updateField("consent_original", e.target.checked)
                    }
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ fontSize: 14, color: "#374151" }}>
                    I confirm that this is my original story, or that I have the
                    right to submit it.
                  </span>
                </label>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.consent_publication_rights}
                    onChange={(e) =>
                      updateField("consent_publication_rights", e.target.checked)
                    }
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ fontSize: 14, color: "#374151" }}>
                    I understand that this article belongs to the original
                    publication and that I am only submitting the link for
                    editorial review.
                  </span>
                </label>
              )}

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.consent_terms}
                  onChange={(e) => updateField("consent_terms", e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span style={{ fontSize: 14, color: "#374151" }}>
                  I agree to the submission terms and understand that submission
                  does not guarantee publication.
                </span>
              </label>
            </div>

            <FieldError
              message={
                fieldErrors.consent_original ||
                fieldErrors.consent_publication_rights ||
                fieldErrors.consent_terms
              }
            />
          </section>

          {generalError ? (
            <div
              style={{
                marginBottom: 24,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                borderRadius: 16,
                padding: 16,
                fontSize: 14,
                color: "#b91c1c",
              }}
            >
              {generalError}
            </div>
          ) : null}

          <div style={{ paddingTop: 24, borderTop: "1px solid #f3f4f6" }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                border: "none",
                borderRadius: 16,
                background: isSubmitting ? "#86efac" : "#059669",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 14,
                padding: "14px 24px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}