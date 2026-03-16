const { createClient } = require("@supabase/supabase-js");
const { HfInference } = require("@huggingface/inference");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const hf = new HfInference(process.env.HF_API_KEY);

async function generateSummary(title, text) {
  try {
    const input = `${title}. ${text || ""}`.trim();

    if (!input) return "";

    const result = await hf.summarization({
      model: "facebook/bart-large-cnn",
      inputs: input,
      parameters: {
        max_length: 60,
        min_length: 20,
      },
    });

    return result.summary_text || text || "";
  } catch (err) {
    console.log("HF summary error:", err.message);
    return text || "";
  }
}

async function run() {
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, content, summary")
    .or("summary.is.null,summary.eq.")
    .order("publish_date", { ascending: false })
    .limit(100);

  if (error) {
    console.log("Fetch error:", error.message);
    return;
  }

  if (!stories || stories.length === 0) {
    console.log("No stories need backfilling.");
    return;
  }

  console.log(`Found ${stories.length} stories to backfill.`);

  for (const story of stories) {
    const summary = await generateSummary(story.title, story.content || "");

    const { error: updateError } = await supabase
      .from("stories")
      .update({ summary })
      .eq("id", story.id);

    if (updateError) {
      console.log(`Update error for "${story.title}":`, updateError.message);
    } else {
      console.log(`Backfilled: ${story.title}`);
    }
  }

  console.log("Done backfilling summaries.");
}

run();