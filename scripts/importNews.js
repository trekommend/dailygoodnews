const Parser = require("rss-parser");
const axios = require("axios");
const cheerio = require("cheerio");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const parser = new Parser();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Category detection
function getCategory(title = "") {
  const t = title.toLowerCase();

  if (t.includes("animal") || t.includes("dog") || t.includes("cat"))
    return "animals";
  if (t.includes("health") || t.includes("medical"))
    return "health";
  if (t.includes("community") || t.includes("neighborhood"))
    return "community";
  if (t.includes("school") || t.includes("teacher"))
    return "kindness";

  return "hope";
}

// slug generator
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// scrape image from article page
async function scrapeImage(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(data);

    const og =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (og) return og;

    const firstImg = $("article img").first().attr("src");

    return firstImg || null;
  } catch (err) {
    return null;
  }
}

async function run() {
  await supabase
  .from("stories")
  .update({ featured: false })
  .neq("featured", null);
  let featuredAssigned = false;
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

  for (const feedInfo of feeds) {
    const feed = await parser.parseURL(feedInfo.url);

    console.log("Feed:", feedInfo.source);
    console.log("Items:", feed.items.length);

    let index = 0;

    for (const item of feed.items.slice(0, 20)) {
      const slug = slugify(item.title);
      const category_slug = getCategory(item.title);
      let featured = false;

if (!featuredAssigned) {
  featured = true;
  featuredAssigned = true;
}
      const baseTime = new Date();
      const publish_date = new Date(baseTime.getTime() + index * 1800000);

      // check duplicates first
      const { data: existing } = await supabase
        .from("stories")
        .select("id")
        .eq("source_url", item.link)
        .maybeSingle();

      if (existing) {
        console.log("Skipping duplicate:", item.title);
        continue;
      }

      // detect image
      let image_url =
        item.enclosure?.url ||
        item["media:content"]?.url ||
        item["media:thumbnail"]?.url ||
        null;

      if (!image_url) {
        image_url = await scrapeImage(item.link);
      }

      console.log("Image:", image_url);

      const { error } = await supabase.from("stories").insert({
        title: item.title,
        content: item.contentSnippet,
        slug,
        category_slug,
        source_name: feedInfo.source,
        source_url: item.link,
        publish_date,
        image_url,
        featured,
      });

      if (error) {
        console.log("Insert error:", error.message);
      } else {
        console.log("Added:", item.title);
      }

      index++;
    }
  }

  console.log("Done publishing.");
}

run();