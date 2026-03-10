import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

export async function POST(req: Request) {
  const { id, category } = await req.json();

  const { data: article } = await supabase
    .from("imports")
    .select("*")
    .eq("id", id)
    .single();

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 400 });
  }

  const slug = slugify(article.title);

  await supabase.from("stories").insert({
    title: article.title,
    content: article.summary,
    slug,
    category_slug: category,
    publish_date: new Date(),
  });

  await supabase
    .from("imports")
    .update({ imported: true })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
