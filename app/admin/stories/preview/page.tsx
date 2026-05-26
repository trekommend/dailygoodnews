import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { createStory } from "../new/actions";
import { extractArticlePreview } from "../new/actions";

type PreviewPageProps = {
  searchParams: Promise<{
    url?: string;
  }>;
};

const CATEGORY_OPTIONS = [
  { value: "hope", label: "Hope" },
  { value: "kindness", label: "Kindness" },
  { value: "community", label: "Community" },
  { value: "animals", label: "Animals" },
  { value: "health", label: "Health" },
];

export default async function AdminStoryPreviewPage({
  searchParams,
}: PreviewPageProps) {
  const params = await searchParams;
  const sourceUrl = params?.url || "";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  if (!sourceUrl) {
    redirect(
      "/admin/stories/new?error=Please%20enter%20a%20source%20URL%20before%20previewing."
    );
  }

  const preview = await extractArticlePreview(sourceUrl);

  const missingTitle = !preview.title;
  const missingSummary = !preview.summary;
  const missingImage = !preview.imageUrl;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1100px",
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
          Admin Preview
        </p>

        <h1
          style={{
            margin: "8px 0 0",
            fontSize: "2.4rem",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Preview Article Metadata
        </h1>

        <p
          style={{
            marginTop: 12,
            maxWidth: 850,
            fontSize: 16,
            color: "#4b5563",
          }}
        >
          Review what we could extract before publishing. If anything is missing,
          you can fill it in manually below.
        </p>

        <div style={{ marginTop: 16 }}>
          <Link
            href="/admin/stories/new"
            style={{
              color: "#047857",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← Back to Add Story
          </Link>
        </div>
      </section>

      {(missingTitle || missingSummary || missingImage) ? (
        <div
          style={{
            marginBottom: 24,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            borderRadius: 18,
            padding: 18,
            color: "#92400e",
            fontSize: 14,
          }}
        >
          <strong>Some metadata could not be extracted.</strong>
          <div style={{ marginTop: 6 }}>
            This can happen when a publication blocks automated metadata access.
            Fill in the missing fields manually before publishing.
          </div>
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 24,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {preview.imageUrl ? (
            <img
              src={preview.imageUrl}
              alt={preview.title || "Article preview image"}
              style={{
                width: "100%",
                maxHeight: 420,
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 220,
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              No image extracted
            </div>
          )}

          <div style={{ padding: 24 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#059669",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {preview.sourceName || "Unknown source"}
            </p>

            <h2
              style={{
                margin: "10px 0",
                fontSize: 30,
                lineHeight: 1.15,
                color: "#111827",
              }}
            >
              {preview.title || "No title extracted"}
            </h2>

            <p
              style={{
                margin: 0,
                color: "#4b5563",
                fontSize: 16,
                lineHeight: 1.7,
              }}
            >
              {preview.summary || "No summary extracted."}
            </p>

            <p
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#6b7280",
                wordBreak: "break-word",
              }}
            >
              {sourceUrl}
            </p>
          </div>
        </div>

        <section
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: 20,
              fontSize: 24,
              fontWeight: 800,
              color: "#111827",
            }}
          >
            Edit before publishing
          </h2>

          <form action={createStory}>
            <input type="hidden" name="submission_type" value="article_link" />
            <input type="hidden" name="source_url" value={sourceUrl} />

            <div style={{ display: "grid", gap: 24 }}>
              <div>
                <label
                  htmlFor="title"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  defaultValue={preview.title || ""}
                  placeholder="Enter title"
                  style={{
                    width: "100%",
                    border: missingTitle
                      ? "1px solid #f59e0b"
                      : "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="summary"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Summary
                </label>
                <textarea
                  id="summary"
                  name="summary"
                  rows={5}
                  defaultValue={preview.summary || ""}
                  placeholder="Enter summary"
                  style={{
                    width: "100%",
                    border: missingSummary
                      ? "1px solid #f59e0b"
                      : "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    resize: "vertical",
                  }}
                />
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
                  Source name
                </label>
                <input
                  id="source_name"
                  name="source_name"
                  type="text"
                  defaultValue={preview.sourceName || ""}
                  placeholder="Example: NPR"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>

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
                  Image URL
                </label>
                <input
                  id="image_url"
                  name="image_url"
                  type="url"
                  defaultValue={preview.imageUrl || ""}
                  placeholder="https://example.com/image.jpg"
                  style={{
                    width: "100%",
                    border: missingImage
                      ? "1px solid #f59e0b"
                      : "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="category_slug"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Category
                </label>
                <select
                  id="category_slug"
                  name="category_slug"
                  defaultValue="hope"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    background: "#fff",
                  }}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

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
                  Display name
                </label>
                <input
                  id="author_name"
                  name="author_name"
                  type="text"
                  defaultValue="Admin"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>

              <input
                type="hidden"
                name="author_email"
                value={profile.email || user.email || ""}
              />

              <button
                type="submit"
                style={{
                  border: "none",
                  borderRadius: 16,
                  background: "#059669",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "14px 24px",
                  cursor: "pointer",
                }}
              >
                Publish This Story
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}