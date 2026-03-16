const Parser = require("rss-parser");
const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
const { HfInference } = require("@huggingface/inference");

const parser = new Parser();

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getHF() {
  return new HfInference(process.env.HF_API_KEY);
}

function getCategory(title = "") {
  const t = title.toLowerCase();

  if (/animal|dog|cat|wildlife|species|zoo|leopard|tiger|bird/.test(t)) {
    return "animals";
  }
  if (/health|medical|hospital|treatment|cure|diabetes|tumor/.test(t)) {
    return "health";
  }
  if (/community|neighborhood|town|volunteer/.test(t)) {
    return "community";
  }
  if (/teacher|school|student|kindness|helped|donated|raised/.test(t)) {
    return "kindness";
  }

  return "hope";
}

function slugify(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function scrapeImage(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(data);

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (ogImage) return ogImage;

    const firstArticleImg = $("article img").first().attr("src");
    if (firstArticleImg) return firstArticleImg;

    const firstImg = $("img").first().attr("src");
    return firstImg || null;
  } catch {
    return null;
  }
}

async function generateSummary(title, text) {
  try {
    const hf = getHF();
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
  } catch {
    return text || "";
  }
}

async function runImporter() {
  const supabase = getSupabase();

  const feeds = [
    {
      url: "https://www.goodnewsnetwork.org/feed/",
      source: "Good News Network",
    },
    {
      url: "https://www.positive.news/feed/",
      source: "Positive News",
    },
  ];

  await supabase
    .from("stories")
    .update({ featured: false })
    .neq("featured", null);

  let featuredAssigned = false;
  const logs = [];

  for (const feedInfo of feeds) {
    const feed = await parser.parseURL(feedInfo.url);
    logs.push(`Feed: ${feedInfo.source}`);
    logs.push(`Items: ${feed.items.length}`);

    let index = 0;

    for (const item of feed.items.slice(0, 10)) {
      const title = item.title || "Untitled story";
      const slug = slugify(title);
      const category_slug = getCategory(title);

      const { data: existing } = await supabase
        .from("stories")
        .select("id")
        .eq("source_url", item.link)
        .maybeSingle();

      if (existing) {
        logs.push(`Skipping duplicate: ${title}`);
        continue;
      }

      const baseTime = new Date();
      const publish_date = new Date(baseTime.getTime() + index * 30 * 60 * 1000);

      let image_url =
        item.enclosure?.url ||
        item["media:content"]?.url ||
        item["media:thumbnail"]?.url ||
        null;

      if (!image_url && item["content:encoded"]) {
        const match = item["content:encoded"].match(/<img[^>]+src="([^">]+)"/);
        if (match) image_url = match[1];
      }

      if (!image_url && item.content) {
        const match = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (match) image_url = match[1];
      }

      if (!image_url && item.link) {
        image_url = await scrapeImage(item.link);
      }

      const rawText = item.contentSnippet || item.content || "";
      const summary = await generateSummary(title, rawText);

      let featured = false;
      if (!featuredAssigned) {
        featured = true;
        featuredAssigned = true;
      }

      const { error } = await supabase.from("stories").upsert(
        {
          title,
          content: rawText,
          summary,
          slug,
          category_slug,
          source_name: feedInfo.source,
          source_url: item.link,
          publish_date,
          image_url,
          featured,
        },
        { onConflict: "source_url" }
      );

      if (error) {
        logs.push(`Insert error: ${error.message}`);
      } else {
        logs.push(`Added: ${title}`);
      }

      index++;
    }
  }

  return logs;
}

module.exports = { runImporter };