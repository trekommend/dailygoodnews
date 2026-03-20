import Parser from "rss-parser";
import { supabase } from "@/lib/supabase";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: {
    url?: string;
  };
  ["content:encoded"]?: string;
  ["media:content"]?: { $?: { url?: string } };
  ["media:thumbnail"]?: { $?: { url?: string } };
};

type FeedSource = {
  name: string;
  url: string;
  defaultCategory: string;
  weight?: number;
  batchSize?: number;
};

type ImportDecision = {
  accepted: boolean;
  score: number;
  reason: string;
};

const FEED_SOURCES: FeedSource[] = [
  {
    name: "Good News Network",
    url: "https://www.goodnewsnetwork.org/feed/",
    defaultCategory: "hope",
    weight: 3,
    batchSize: 5,
  },
  {
    name: "Positive News",
    url: "https://www.positive.news/feed/",
    defaultCategory: "hope",
    weight: 3,
    batchSize: 5,
  },
  {
    name: "Fox News Health",
    url: "https://moxie.foxnews.com/google-publisher/health.xml",
    defaultCategory: "health",
    weight: 2,
    batchSize: 5,
  },
  {
    name: "Fox News Science",
    url: "https://moxie.foxnews.com/google-publisher/science.xml",
    defaultCategory: "hope",
    weight: 2,
    batchSize: 5,
  },
  {
    name: "Fox News Travel",
    url: "https://moxie.foxnews.com/google-publisher/travel.xml",
    defaultCategory: "community",
    weight: 2,
    batchSize: 3,
  },
  {
    name: "Washington Post Lifestyle",
    url: "https://feeds.washingtonpost.com/rss/lifestyle",
    defaultCategory: "community",
    weight: 2,
    batchSize: 3,
  },
];

const STRONG_POSITIVE_PATTERNS = [
  /scientists?\s+(develop|discover|create|design)/i,
  /(new\s+)?treatment\s+(helps|improves|reduces|boosts)/i,
  /(community|volunteers?|neighbors?|strangers?)\s+(help|support|rebuild|restore|show up|raise)/i,
  /(rescued|saved|recovered|restored|improved)/i,
  /(breakthrough|innovation|milestone|record low)/i,
  /(conservation|wildlife)\s+(effort|success|recovery|protection)/i,
  /(donation|fundraiser|charity|tips)\s+(helps|supports|raises|replaces)/i,
  /(showed up with|raised|donated)\s+\$?\d+/i,
];

const POSITIVE_PATTERNS = [
  /breakthrough/i,
  /recovery/i,
  /rescued?/i,
  /saved?/i,
  /helped?/i,
  /protect(ed|ion)/i,
  /restor(ed|ation)/i,
  /improv(ed|ement)/i,
  /reduc(ed|tion)/i,
  /community/i,
  /volunteer/i,
  /donat(ed|ion)/i,
  /fundraiser/i,
  /innovation/i,
  /clean energy/i,
  /solar/i,
  /wildlife/i,
  /conservation/i,
  /health/i,
  /wellness/i,
  /hope/i,
  /uplift/i,
  /kindness/i,
  /success/i,
  /recycling/i,
  /inspiring/i,
  /uplifting/i,
  /heartwarming/i,
  /support/i,
  /access/i,
  /benefit/i,
  /progress/i,
  /healing/i,
  /celebrates?/i,
  /generosity/i,
  /compassion/i,
];

const STRONG_NEGATIVE_PATTERNS = [
  /murder/i,
  /shooting/i,
  /terror/i,
  /hostage/i,
  /rape/i,
  /abuse/i,
  /bomb/i,
  /\bwar\b/i,
  /deadly/i,
  /massacre/i,
  /unsafe/i,
  /health warnings?/i,
  /urgent warnings?/i,
  /raising concerns?/i,
  /deemed unsafe/i,
  /public warning/i,
  /outbreak/i,
  /travel advisory/i,
  /health alert/i,
];

const NEGATIVE_PATTERNS = [
  /killed?/i,
  /crash/i,
  /scandal/i,
  /fraud/i,
  /arrest/i,
  /lawsuit/i,
  /indict/i,
  /outrage/i,
  /attack/i,
  /disaster/i,
  /explosion/i,
  /partisan/i,
  /election/i,
  /trump/i,
  /biden/i,
  /conflict/i,
  /crime/i,
  /violent/i,
  /devastat(ed|ing)/i,
  /fear/i,
  /panic/i,
  /crowds?/i,
  /chaos/i,
  /emergency/i,
  /evacuation/i,
  /stolen/i,
  /explode|exploded/i,
  /concerns?/i,
  /warning/i,
  /unsafe conditions?/i,
  /risk/i,
  /danger/i,
  /hazard/i,
  /surging/i,
  /advisory/i,
  /alert/i,
];

const SOFT_BLOCK_PATTERNS = [
  /unsafe/i,
  /health warnings?/i,
  /urgent warnings?/i,
  /raising concerns?/i,
  /deemed unsafe/i,
  /public warning/i,
  /surging.*concerns?/i,
  /doctors?\s+are\s+raising\s+concerns?/i,
  /officials?\s+issue\s+urgent/i,
  /travel advisory/i,
  /health alert/i,
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function makeUniqueSlug(title: string, sourceUrl: string) {
  const base = slugify(title);
  const suffix = sourceUrl
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(-8);

  return `${base}-${suffix}`;
}

function absoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function cleanImageUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return null;
  const cleaned = absoluteUrl(url.trim(), baseUrl);
  if (!/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, "...")
    .replace(/&#8242;/g, "'")
    .replace(/&#8243;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

function cleanStoryText(text: string) {
  return decodeHtmlEntities(stripHtml(text))
    .replace(/\[\u2026\]|\[\.\.\.\]/g, "")
    .replace(/The post .*? appeared first on .*?\.?/gi, "")
    .replace(/Continue reading.*$/gi, "")
    .replace(/Read more.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function chooseBestContent(summary: string, rawContent: string) {
  const cleanedSummary = cleanStoryText(summary);
  const cleanedContent = cleanStoryText(rawContent);

  if (!cleanedContent) {
    return {
      summary: cleanedSummary,
      content: cleanedSummary,
    };
  }

  const normalizedSummary = normalizeForComparison(cleanedSummary);
  const normalizedContent = normalizeForComparison(cleanedContent);

  const contentIsMostlySame =
    !!normalizedSummary &&
    (normalizedContent === normalizedSummary ||
      normalizedContent.startsWith(normalizedSummary) ||
      normalizedSummary.startsWith(normalizedContent));

  if (contentIsMostlySame) {
    return {
      summary: cleanedSummary,
      content: cleanedSummary,
    };
  }

  return {
    summary: cleanedSummary,
    content: cleanedContent,
  };
}

function guessCategory(title: string, summary: string, fallback = "hope") {
  const titleText = title.toLowerCase();
  const text = `${title} ${summary}`.toLowerCase();

  if (/animal|bird|dog|cat|wildlife|species|zoo/.test(titleText)) return "animals";
  if (/health|hospital|medical|therapy|wellness|patient/.test(titleText)) return "health";
  if (/community|school|volunteer|neighbors|family|town|city|teacher/.test(titleText)) return "community";
  if (/kindness|charity|helped|donated|gift|fundraiser|support/.test(titleText)) return "kindness";

  if (/animal|bird|dog|cat|wildlife|species|zoo/.test(text)) return "animals";
  if (/health|hospital|medical|therapy|wellness|mental health|patient/.test(text)) return "health";
  if (/community|school|volunteer|neighbors|family|town|city|teacher/.test(text)) return "community";
  if (/kindness|charity|helped|donated|gift|fundraiser|support/.test(text)) return "kindness";

  return fallback;
}

function scoreText(text: string) {
  let score = 0;

  for (const pattern of STRONG_POSITIVE_PATTERNS) {
    if (pattern.test(text)) score += 4;
  }

  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(text)) score += 1;
  }

  for (const pattern of STRONG_NEGATIVE_PATTERNS) {
    if (pattern.test(text)) score -= 6;
  }

  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(text)) score -= 2;
  }

  return score;
}

function decideImportStory(
  title: string,
  summary: string,
  content: string,
  sourceWeight = 1
): ImportDecision {
  const titleText = title || "";
  const summaryText = summary || "";
  const contentText = content || "";

  const combinedHeadline = `${titleText} ${summaryText}`.trim();

  if (SOFT_BLOCK_PATTERNS.some((pattern) => pattern.test(combinedHeadline))) {
    return {
      accepted: false,
      score: -5,
      reason: "rejected by warning/concern blocker",
    };
  }

  const headlineScore = scoreText(combinedHeadline);
  const weightedHeadlineScore = headlineScore + sourceWeight;

  if (weightedHeadlineScore >= 2) {
    return {
      accepted: true,
      score: weightedHeadlineScore,
      reason: "accepted from title/summary",
    };
  }

  if (weightedHeadlineScore <= -3) {
    return {
      accepted: false,
      score: weightedHeadlineScore,
      reason: "rejected from title/summary",
    };
  }

  const shortenedContent = contentText.slice(0, 1200);

  if (SOFT_BLOCK_PATTERNS.some((pattern) => pattern.test(shortenedContent))) {
    return {
      accepted: false,
      score: -5,
      reason: "rejected by warning/concern blocker in content",
    };
  }

  const contentScore = scoreText(shortenedContent);

  const finalScore =
    sourceWeight +
    headlineScore * 2 +
    Math.round(contentScore * 0.5);

  const hasStrongPositive = STRONG_POSITIVE_PATTERNS.some((pattern) =>
    pattern.test(combinedHeadline)
  );

  if (finalScore === 2 && !hasStrongPositive) {
    return {
      accepted: false,
      score: finalScore,
      reason: "rejected as neutral (no strong positive signal)",
    };
  }

  return {
    accepted: finalScore >= 2,
    score: finalScore,
    reason: finalScore >= 2 ? "accepted after content check" : "rejected after content check",
  };
}

function extractImageFromFeed(item: FeedItem, sourceUrl: string): string | null {
  return (
    cleanImageUrl(item.enclosure?.url, sourceUrl) ||
    cleanImageUrl(item["media:content"]?.$?.url, sourceUrl) ||
    cleanImageUrl(item["media:thumbnail"]?.$?.url, sourceUrl) ||
    cleanImageUrl(item.content?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], sourceUrl) ||
    cleanImageUrl(item["content:encoded"]?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], sourceUrl) ||
    null
  );
}

function extractBestImageFromHtml(html: string, articleUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i,
    /<img[^>]+data-lazy-src=["']([^"']+)["']/i,
    /<img[^>]+data-src=["']([^"']+)["']/i,
    /<img[^>]+srcset=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (!match) continue;

    let candidate = match;

    if (pattern.source.includes("srcset")) {
      candidate = match.split(",")[0]?.trim().split(" ")[0] ?? "";
    }

    const cleaned = cleanImageUrl(candidate, articleUrl);
    if (cleaned) return cleaned;
  }

  return null;
}

async function extractImageFromArticlePage(articleUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari DailyGoodNewsBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractBestImageFromHtml(html, articleUrl);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const logs: string[] = [];

  try {
    logs.push("IMPORTER_VERSION: scored-filter-v5-warning-blocker");
    logs.push(`Configured sources: ${FEED_SOURCES.map((s) => s.name).join(", ")}`);

    const parser = new Parser<any, FeedItem>({
      customFields: {
        item: [
          ["media:content", "media:content"],
          ["media:thumbnail", "media:thumbnail"],
          ["content:encoded", "content:encoded"],
        ],
      },
    });

    let savedCount = 0;
    let skippedCount = 0;
    let feedImageCount = 0;
    let pageImageCount = 0;
    let existingImageCount = 0;
    let noImageCount = 0;
    let errorCount = 0;

    for (const source of FEED_SOURCES) {
      let sourceSaved = 0;
      let sourceSkipped = 0;
      let sourceErrors = 0;

      try {
        const feed = await parser.parseURL(source.url);
        logs.push(`Feed: ${source.name} (${feed.items.length} items)`);

        const batchSize = source.batchSize ?? 5;
        const batchItems = feed.items.slice(0, batchSize);

        logs.push(`Batch size for ${source.name}: ${batchItems.length}`);

        for (const item of batchItems) {
          try {
            const title = item.title ?? "Untitled";
            const rawSummary = item.contentSnippet ?? "";
            const rawContent = item["content:encoded"] ?? item.content ?? rawSummary;
            const sourceUrl = item.link ?? "";
            const publishDate = item.pubDate ?? new Date().toISOString();

            if (!sourceUrl) continue;

            const { summary, content } = chooseBestContent(rawSummary, rawContent);

            const decision = decideImportStory(
              title,
              summary,
              content,
              source.weight ?? 1
            );

            if (!decision.accepted) {
              skippedCount += 1;
              sourceSkipped += 1;
              logs.push(
                `Skipped "${title}" from ${source.name} (${decision.reason}, score=${decision.score})`
              );
              continue;
            }

            const slug = makeUniqueSlug(title, sourceUrl);
            const categorySlug = guessCategory(title, summary, source.defaultCategory);

            const { data: existingRow } = await supabase
              .from("stories")
              .select("image_url")
              .eq("source_url", sourceUrl)
              .maybeSingle();

            let imageUrl = extractImageFromFeed(item, sourceUrl);
            let imageSource: "feed" | "page" | "existing" | "none" = imageUrl ? "feed" : "none";

            if (!imageUrl) {
              const scrapedImage = await extractImageFromArticlePage(sourceUrl);
              if (scrapedImage) {
                imageUrl = scrapedImage;
                imageSource = "page";
              }
            }

            if (!imageUrl && existingRow?.image_url) {
              imageUrl = existingRow.image_url;
              imageSource = "existing";
            }

            const storyScore =
              decision.score +
              (imageUrl ? 2 : 0) +
              (source.weight ?? 1);

            const story = {
              title,
              slug,
              summary,
              content,
              image_url: imageUrl,
              category_slug: categorySlug,
              featured: false,
              source_name: source.name,
              source_url: sourceUrl,
              publish_date: publishDate,
              positivity_score: decision.score,
              story_score: storyScore,
            };

            const { error } = await supabase
              .from("stories")
              .upsert(story, { onConflict: "source_url" });

            if (error) {
              errorCount += 1;
              sourceErrors += 1;
              logs.push(`Error saving "${title}": ${error.message}`);
              continue;
            }

            savedCount += 1;
            sourceSaved += 1;

            if (imageSource === "feed") feedImageCount += 1;
            else if (imageSource === "page") pageImageCount += 1;
            else if (imageSource === "existing") existingImageCount += 1;
            else noImageCount += 1;
          } catch (err) {
            errorCount += 1;
            sourceErrors += 1;
            logs.push(`Error saving item from ${source.name}: ${String(err)}`);
          }
        }

        logs.push(
          `${source.name} → saved: ${sourceSaved}, skipped: ${sourceSkipped}, errors: ${sourceErrors}`
        );
      } catch (err) {
        errorCount += 1;
        logs.push(`Error reading feed ${source.name}: ${String(err)}`);
      }
    }

    logs.push(`Saved: ${savedCount}`);
    logs.push(`Skipped by positivity filter: ${skippedCount}`);
    logs.push(`Images from feed: ${feedImageCount}`);
    logs.push(`Images from page: ${pageImageCount}`);
    logs.push(`Images kept from existing rows: ${existingImageCount}`);
    logs.push(`No image found: ${noImageCount}`);
    logs.push(`Errors: ${errorCount}`);

    return Response.json({ success: true, logs });
  } catch (err) {
    logs.push(`Route error: ${String(err)}`);
    return Response.json({ success: false, logs });
  }
}