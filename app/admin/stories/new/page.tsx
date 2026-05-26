import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { createStory, previewArticle } from "./actions";

type SearchParams = Promise<{
  error?: string;
}>;

const CATEGORY_OPTIONS = [
  { value: "hope", label: "Hope" },
  { value: "kindness", label: "Kindness" },
  { value: "community", label: "Community" },
  { value: "animals", label: "Animals" },
  { value: "health", label: "Health" },
];

export default async function AdminNewStoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const errorMessage = params?.error;

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

  return (
    <main
      style={{
        width: "100%",
        maxWidth: "1200px",
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
          Admin Publishing
        </p>

        <h1
          style={{
            margin: "8px 0 0",
            fontSize: "2.4rem",
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Add Story
        </h1>

        <p
          style={{
            marginTop: 12,
            maxWidth: 850,
            fontSize: 16,
            color: "#4b5563",
          }}
        >
          Paste an article URL first. We’ll try to automatically extract the
          title, summary, source, and image. If the site blocks extraction, you
          can fill in the fields manually before publishing.
        </p>

        <div style={{ marginTop: 16 }}>
          <Link
            href="/admin/submissions"
            style={{
              color: "#047857",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← Back to submissions
          </Link>
        </div>
      </section>

      {errorMessage ? (
        <div
          style={{
            marginBottom: 24,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            borderRadius: 18,
            padding: 18,
            color: "#b91c1c",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <form action={createStory}>
          <section style={{ marginBottom: 36 }}>
            <h2
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 24,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Story type
            </h2>

            <div style={{ display: "grid", gap: 12 }}>
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
                  defaultChecked
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
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
                    Publish an original story directly to the site.
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
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    I’m adding an article
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 14,
                      color: "#4b5563",
                    }}
                  >
                    Paste the article URL, preview extracted metadata, then
                    publish with attribution.
                  </div>
                </div>
              </label>
            </div>
          </section>

          <section style={{ marginBottom: 36 }}>
            <h2
              style={{
                marginTop: 0,
                marginBottom: 20,
                fontSize: 24,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              Story details
            </h2>

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
                  Title (optional for article links)
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Optional for article links — we’ll try to extract this automatically"
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
                  htmlFor="summary"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Summary (auto-filled when available)
                </label>
                <textarea
                  id="summary"
                  name="summary"
                  rows={5}
                  placeholder="Optional for article links — we’ll try to extract this automatically"
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="content"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Full content
                </label>
                <textarea
                  id="content"
                  name="content"
                  rows={8}
                  placeholder="Optional full story text. For article links, you can leave this blank and use the source URL."
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                    resize: "vertical",
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
                  htmlFor="image_url"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Image URL (auto-filled when available)
                </label>
                <input
                  id="image_url"
                  name="image_url"
                  type="url"
                  placeholder="Optional for article links — we’ll try to extract this automatically"
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
                  htmlFor="video_url"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Video URL
                </label>
                <input
                  id="video_url"
                  name="video_url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>
            </div>
          </section>

          <section
            style={{
              marginBottom: 36,
              paddingTop: 32,
              borderTop: "1px solid #f3f4f6",
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
              Source and author
            </h2>

            <div style={{ display: "grid", gap: 24 }}>
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
                  Source URL
                </label>
                <input
                  id="source_url"
                  name="source_url"
                  type="url"
                  placeholder="Required for article links"
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
                  placeholder="Optional for article links — we’ll try to extract this automatically"
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
                  Admin email
                </label>
                <input
                  id="author_email"
                  name="author_email"
                  type="email"
                  defaultValue={profile.email || user.email || ""}
                  style={{
                    width: "100%",
                    border: "1px solid #d1d5db",
                    borderRadius: 16,
                    padding: "14px 16px",
                    fontSize: 15,
                  }}
                />
              </div>
            </div>
          </section>

          <div style={{ paddingTop: 24, borderTop: "1px solid #f3f4f6" }}>
            <button
              type="submit"
              formAction={previewArticle}
              style={{
                marginRight: 12,
                border: "1px solid #d1d5db",
                borderRadius: 16,
                background: "#ffffff",
                color: "#111827",
                fontWeight: 600,
                fontSize: 14,
                padding: "14px 24px",
                cursor: "pointer",
              }}
            >
              Preview Article
            </button>

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
              Publish Story
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}