"use client";

import { useEffect, useState } from "react";

type Category = {
  name: string;
  slug: string;
};

export default function AdminImports() {
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/get-imports")
      .then((res) => res.json())
      .then(setArticles);

    fetch("/api/get-categories")
      .then((res) => res.json())
      .then(setCategories);
  }, []);

  async function publish(id: string) {
    const category = selected[id];

    if (!category) {
      alert("Please select a category");
      return;
    }

    await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, category }),
    });

    alert("Published!");
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 40 }}>
      <h1>Imported Articles</h1>

      {articles.map((item) => (
        <div
          key={item.id}
          style={{
            background: "white",
            padding: 20,
            marginBottom: 20,
            borderRadius: 12,
            boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
          }}
        >
          <h2>{item.title}</h2>
          <p>{item.summary}</p>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <select
              value={selected[item.id] || ""}
              onChange={(e) =>
                setSelected({ ...selected, [item.id]: e.target.value })
              }
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            <button onClick={() => publish(item.id)}>Publish</button>
          </div>
        </div>
      ))}
    </main>
  );
}
