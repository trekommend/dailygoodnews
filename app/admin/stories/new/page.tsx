import { redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { createStory } from "./actions";

export default async function AdminNewStoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 40 }}>
      <h1 style={{ marginBottom: 20 }}>Add Story</h1>

      <form action={createStory} style={{ display: "grid", gap: 16 }}>
        <input
          name="title"
          placeholder="Title"
          required
          style={{ padding: 10 }}
        />

        <input
          name="source_url"
          placeholder="Source URL (optional)"
          style={{ padding: 10 }}
        />

        <input
          name="source_name"
          placeholder="Source Name (optional)"
          style={{ padding: 10 }}
        />

        <input
          name="image_url"
          placeholder="Image URL (optional)"
          style={{ padding: 10 }}
        />

        <input
          name="category_slug"
          placeholder="Category (e.g. kindness, hope, community)"
          style={{ padding: 10 }}
        />

        <textarea
          name="summary"
          placeholder="Summary"
          rows={4}
          style={{ padding: 10 }}
        />

        <textarea
          name="content"
          placeholder="Full content (optional)"
          rows={8}
          style={{ padding: 10 }}
        />

        <button
          type="submit"
          style={{
            background: "#047857",
            color: "white",
            padding: 12,
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Publish Story
        </button>
      </form>
    </main>
  );
}