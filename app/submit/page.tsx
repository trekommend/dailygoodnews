"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Submit() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;

    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const story = (form.elements.namedItem("story") as HTMLTextAreaElement).value;

    const { error } = await supabase.from("submissions").insert({
      name,
      email,
      story,
    });

    if (!error) setSent(true);

    setLoading(false);
  }

  if (sent) {
    return (
      <main style={{ maxWidth: 600, margin: "auto", padding: 40 }}>
        <h1>Thank you 💛</h1>
        <p>Your story has been submitted for review.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: "auto", padding: 40 }}>
      <h1>Submit a Happy Story</h1>

      <form onSubmit={handleSubmit}>
        <input
          name="name"
          placeholder="Your name"
          required
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        />

        <input
          name="email"
          placeholder="Email"
          type="email"
          required
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        />

        <textarea
          name="story"
          placeholder="Tell us the story..."
          required
          style={{ width: "100%", height: 160, padding: 8 }}
        />

        <br /><br />

        <button disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </main>
  );
}
