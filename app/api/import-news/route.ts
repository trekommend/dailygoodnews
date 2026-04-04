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
  trusted?: boolean;
};

type ImportDecision = {
  accepted: boolean;
  score: number;
  reason: string;
};

const IMPORTER_VERSION = "scored-filter-v17-wapo-filter-image-summary-merged";

const FEED_SOURCES: FeedSource[] = [
  {
    name: "Good News Network",
    url: "https://www.goodnewsnetwork.org/feed/",
    defaultCategory: "hope",
    weight: 3,
    batchSize: 5,
    trusted: true,
  },
  {
    name: "Positive News",
    url: "https://www.positive.news/feed/",
    defaultCategory: "hope",
    weight: 3,
    batchSize: 5,
    trusted: true,
  },
  {
    name: "Good Good Good",
    url: "https://www.goodgoodgood.co/articles/rss.xml",
    defaultCategory: "hope",
    weight: 3,
    batchSize: 3,
    trusted: true,
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
  /(first-ever|successful)\s+(surgery|treatment|procedure)/i,
  /critically-endangered/i,
  /gave birth/i,
  /veterinarians?\s+(perform|save|help)/i,
  /saved?\s+(animal|monkey|ape|species|wildlife)/i,
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
  /advisory/i,
  /alert/i,
  /cancel(l?ed|lation|s)?/i,
  /disappointment/i,
  /disrupted?/i,
  /delay(ed|s)?/i,
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
  /cancels? planned sailings/i,
  /canceled sailings/i,
  /upending vacations?/i,
  /definitely a disappointment/i,
  /travel disruption/i,
  /flight delays?/i,
  /long lines?/i,
  /miserably long/i,
  /vacation(s)? disrupted/i,
  /cruise line cancels?/i,
];

const ADVICE_COLUMN_PATTERNS = [
  /^asking eric\b/i,
  /^miss manners\b/i,
  /^dear abby\b/i,
  /^carolyn hax\b/i,
  /^ask sahaj\b/i,
  /^advice\b/i,
  /\bam i enabling\b/i,
  /\bmy boss'?s alcoholism\b/i,
  /\btable manners\b/i,
  /\betiquette\b/i,
  /\bdear (abby|prudence)\b/i,
  /\bask(ed|ing)?\s+(eric|amy|abby|sahaj)\b/i,
  /\brelationship advice\b/i,
  /\bworkplace advice\b/i,
  /\bmanners\b/i,
  /\blamenting the loss\b/i,
];

const WAPO_LIFESTYLE_BLOCK_PATTERNS = [
  /^asking eric\b/i,
  /^miss manners\b/i,
  /^carolyn hax\b/i,
  /^date lab\b/i,
  /^solo-ish\b/i,
  /^voraciously\b/i,
  /^advice\b/i,
  /\badvice column\b/i,
  /\betiquette\b/i,
  /\bmanners\b/i,
  /\bshould i\b/i,
  /\bam i wrong\b/i,
  /\bam i enabling\b/i,
  /\bmy husband\b/i,
  /\bmy wife\b/i,
  /\bmy partner\b/i,
  /\bmy boyfriend\b/i,
  /\bmy girlfriend\b/i,
  /\bmy boss\b/i,
  /\balcoholism\b/i,
  /\bannoying\b/i,
  /\brude\b/i,
  /\bawkward\b/i,
  /\bfamily drama\b/i,
  /\bin-laws?\b/i,
  /\bargument\b/i,
  /\bfeud\b/i,
  /\bcomplain(s|ing)?\b/i,
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
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanImageUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return null;

  const raw = decodeHtmlEntities(url.trim());

  if (
    !raw ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    /sprite|icon|logo|avatar|1x1|pixel/i.test(raw)
  ) {
    return null;
  }

  const cleaned = absoluteUrl(raw, baseUrl);

  if (!/^https?:\/\//i.test(cleaned)) return null;
  if (/\.svg(\?|$)/i.test(cleaned)) return null;
  if (/sprite|icon|logo|avatar|1x1|pixel/i.test(cleaned)) return null;
  if (/generic-newsletter-signup/i.test(cleaned)) return null;

  return cleaned;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

function normalizeWhitespace(text: string = "") {
  return text.replace(/\s+/g, " ").trim();
}

function removeTrailingSourceBoilerplate(text: string) {
  if (!text) return "";

  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  const trailingPatterns = [
    /\bThe post .*? appeared first on .*?\.?$/gi,
    /\bAppeared first on .*?\.?$/gi,
    /\bOriginally published on .*?\.?$/gi,
    /\bThis article originally appeared on .*?\.?$/gi,
    /\bRead the full article at .*?\.?$/gi,
    /\bRead more at .*?\.?$/gi,
    /\bRead more from .*?\.?$/gi,
    /\bMore from .*?\.?$/gi,
    /\bEarlier,?\s+GNN\s+Good\s+News\s+Network\.?$/gi,
    /\bGNN\s+Good\s+News\s+Network\.?$/gi,
    /\bGood\s+News\s+Network\.?$/gi,
    /\bPositive\s+News\.?$/gi,
    /\bGood\s+Good\s+Good\.?$/gi,
    /\bFox\s+News\.?$/gi,
    /\bWashington\s+Post\.?$/gi,
    /\bSource: .*?$/gi,
    /\bCourtesy of .*?$/gi,
    /\bvia .*?$/gi,
    /\b(of|from|on|via|at|by)\s+(GNN\s+)?(Good News Network|Positive News|Good Good Good|Fox News|Washington Post)\.?$/gi,
    /\b(first on|published on|appeared on)\s+(GNN\s+)?(Good News Network|Positive News|Good Good Good|Fox News|Washington Post)\.?$/gi,
    /\b(Earlier|Earlier,)\s+(GNN\s+)?(Good News Network|Positive News|Good Good Good|Fox News|Washington Post)\.?$/gi,
  ];

  let changed = true;

  while (changed) {
    changed = false;
    const before = cleaned;

    for (const pattern of trailingPatterns) {
      cleaned = cleaned.replace(pattern, "").trim();
    }

    cleaned = cleaned
      .replace(/\b(Earlier|Earlier,)\s*$/gi, "")
      .replace(/\b(GNN)\s*$/gi, "")
      .replace(/\b(of|from|on|via|at|by|for|with)\s*$/gi, "")
      .replace(/[,:;–—-]\s*$/g, "")
      .replace(/\s+\./g, ".")
      .trim();

    if (cleaned !== before) {
      changed = true;
    }
  }

  return cleaned;
}

function isLikelyPublisherFragment(text: string) {
  const t = normalizeWhitespace(text).toLowerCase();
  if (!t) return false;

  const publisherPatterns = [
    /\bgood news network\b/,
    /\bgnn good news network\b/,
    /\bpositive news\b/,
    /\bgood good good\b/,
    /\bfox news\b/,
    /\bwashington post\b/,
  ];

  const hasPublisher = publisherPatterns.some((pattern) => pattern.test(t));
  const shortEnough = t.length <= 80;
  const boilerplateWords = /\b(earlier|source|published|appeared|originally|via|courtesy)\b/.test(t);

  return hasPublisher && (shortEnough || boilerplateWords);
}

function cleanStoryText(text: string) {
  const cleaned = decodeHtmlEntities(stripHtml(text))
    .replace(/\[\u2026\]|\[\.\.\.\]/g, "")
    .replace(/The post .*? appeared first on .*?\.?/gi, "")
    .replace(/Continue reading.*$/gi, "")
    .replace(/Read more.*$/gi, "")
    .replace(/Originally published on .*?\.?/gi, "")
    .replace(/This article originally appeared on .*?\.?/gi, "")
    .replace(/Copyright \d{4}.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned
    .split(/\n{2,}|\r\n\r\n+/)
    .map((p) => removeTrailingSourceBoilerplate(p))
    .filter(Boolean);

  while (paragraphs.length > 0 && isLikelyPublisherFragment(paragraphs[paragraphs.length - 1])) {
    paragraphs.pop();
  }

  return paragraphs.join("\n\n").trim();
}

function splitIntoParagraphs(text: string = "") {
  return text
    .split(/\n{2,}|\r\n\r\n+/)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);
}

function isJunkParagraph(paragraph: string = "") {
  const p = paragraph.trim().toLowerCase();

  if (!p) return true;
  if (p.length < 40) return true;
  if (isLikelyPublisherFragment(p)) return true;

  const junkPatterns = [
    /^(photo|image|credit|caption)\b/,
    /^(read more|see also|related:?)\b/,
    /^(sign up|signup|subscribe)\b/,
    /newsletter/,
    /follow us on/,
    /click here/,
    /advertisement/,
    /advertising disclosure/,
    /affiliate/,
    /all rights reserved/,
    /^copyright\b/,
    /^published\b/,
    /^updated\b/,
    /^share this\b/,
    /^watch:?\b/,
    /^listen:?\b/,
    /^more from\b/,
    /^source:?\b/,
    /^editor'?s note\b/,
    /^earlier,?\s+gnn\b/,
  ];

  if (junkPatterns.some((pattern) => pattern.test(p))) {
    return true;
  }

  const wordCount = p.split(/\s+/).length;
  if (wordCount < 8) return true;

  return false;
}

function cleanArticleContent(rawContent: string = "") {
  if (!rawContent) return "";

  const cleaned = cleanStoryText(rawContent);
  if (!cleaned) return "";

  const paragraphs = splitIntoParagraphs(cleaned)
    .map(removeTrailingSourceBoilerplate)
    .filter((p) => !isJunkParagraph(p));

  while (paragraphs.length > 0 && isLikelyPublisherFragment(paragraphs[paragraphs.length - 1])) {
    paragraphs.pop();
  }

  return paragraphs.join("\n\n").trim();
}

function truncateNicely(text: string, maxLength: number) {
  const cleaned = removeTrailingSourceBoilerplate(normalizeWhitespace(text));

  if (cleaned.length <= maxLength) {
    return removeTrailingSourceBoilerplate(cleaned);
  }

  const sliced = cleaned.slice(0, maxLength);

  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? ")
  );

  let truncated = "";

  if (lastSentenceEnd > 120) {
    truncated = sliced.slice(0, lastSentenceEnd + 1).trim();
  } else {
    const lastSpace = sliced.lastIndexOf(" ");
    if (lastSpace > 120) {
      truncated = sliced.slice(0, lastSpace).trim();
    } else {
      truncated = sliced.trim();
    }
  }

  truncated = removeTrailingSourceBoilerplate(truncated)
    .replace(/\b(Earlier|Earlier,)\s*$/gi, "")
    .replace(/\b(GNN)\s*$/gi, "")
    .replace(/\b(of|from|on|via|at|by|for|with)\s*$/gi, "")
    .replace(/[,:;–—-]\s*$/g, "")
    .trim();

  return `${truncated}...`;
}

function buildSummaryFromContent(cleanedContent: string, fallbackSummary: string = "") {
  const paragraphs = splitIntoParagraphs(cleanedContent)
    .map(removeTrailingSourceBoilerplate)
    .filter((p) => !isJunkParagraph(p));

  if (paragraphs.length === 0) {
    return truncateNicely(cleanStoryText(fallbackSummary || ""), 500);
  }

  const selected: string[] = [];
  let totalChars = 0;

  for (const paragraph of paragraphs) {
    if (selected.length >= 3) break;
    if (isLikelyPublisherFragment(paragraph)) continue;

    selected.push(paragraph);
    totalChars += paragraph.length;

    if (selected.length >= 2 && totalChars >= 350) {
      break;
    }
  }

  const summary = selected.join("\n\n").trim();

  if (!summary) {
    return truncateNicely(cleanStoryText(fallbackSummary || ""), 500);
  }

  return truncateNicely(summary, 900);
}

function normalizeForComparison(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function chooseBestContent(summary: string, rawContent: string) {
  const cleanedSummary = cleanStoryText(summary);
  const cleanedRawContent = cleanStoryText(rawContent);
  const cleanedContent = cleanArticleContent(rawContent);

  if (!cleanedRawContent && !cleanedSummary) {
    return {
      summary: "",
      content: "",
    };
  }

  if (!cleanedRawContent) {
    return {
      summary: truncateNicely(cleanedSummary, 500),
      content: cleanedSummary,
    };
  }

  const normalizedSummary = normalizeForComparison(cleanedSummary);
  const normalizedContent = normalizeForComparison(cleanedRawContent);

  const contentIsMostlySame =
    !!normalizedSummary &&
    (normalizedContent === normalizedSummary ||
      normalizedContent.startsWith(normalizedSummary) ||
      normalizedSummary.startsWith(normalizedContent));

  const contentToUse = cleanedContent || cleanedRawContent;

  if (contentIsMostlySame) {
    const summaryFromContent = buildSummaryFromContent(contentToUse, cleanedSummary);

    return {
      summary: summaryFromContent || truncateNicely(cleanedSummary, 500),
      content: contentToUse,
    };
  }

  return {
    summary: buildSummaryFromContent(contentToUse, cleanedSummary),
    content: contentToUse,
  };
}

function guessCategory(title: string, summary: string, fallback = "hope") {
  const titleText = title.toLowerCase();
  const text = `${title} ${summary}`.toLowerCase();

  const animalPattern =
    /\b(animal|animals|dog|dogs|cat|cats|bird|birds|wildlife|species|zoo|monkey|ape|elephant|whale|dolphin|turtle|penguin|rescue animal|endangered)\b/;

  const healthPattern =
    /\b(health|hospital|medical|therapy|wellness|mental health|patient|treatment|doctor|doctors|surgery|medicine)\b/;

  const communityPattern =
    /\b(community|school|volunteer|neighbors|family|town|city|teacher|teachers|students|local group)\b/;

  const kindnessPattern =
    /\b(kindness|charity|helped|donated|donation|gift|fundraiser|support|generosity|compassion)\b/;

  if (animalPattern.test(titleText)) return "animals";
  if (healthPattern.test(titleText)) return "health";
  if (communityPattern.test(titleText)) return "community";
  if (kindnessPattern.test(titleText)) return "kindness";

  if (animalPattern.test(text)) return "animals";
  if (healthPattern.test(text)) return "health";
  if (communityPattern.test(text)) return "community";
  if (kindnessPattern.test(text)) return "kindness";

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

function isBlockedAdviceColumn(title: string, summary: string, content: string) {
  const combined = `${title} ${summary} ${content}`.slice(0, 1500);
  return ADVICE_COLUMN_PATTERNS.some((pattern) => pattern.test(combined));
}

function isBlockedWashingtonPostLifestyleStory(
  sourceName: string,
  title: string,
  summary: string,
  content: string
) {
  if (sourceName !== "Washington Post Lifestyle") return false;

  const combined = `${title} ${summary} ${content}`.slice(0, 2000);
  return WAPO_LIFESTYLE_BLOCK_PATTERNS.some((pattern) => pattern.test(combined));
}

function decideImportStory(
  title: string,
  summary: string,
  content: string,
  sourceWeight = 1,
  trustedSource = false,
  sourceName = ""
): ImportDecision {
  const titleText = title || "";
  const summaryText = summary || "";
  const contentText = content || "";

  const combinedHeadline = `${titleText} ${summaryText}`.trim();

  if (isBlockedAdviceColumn(titleText, summaryText, contentText)) {
    return {
      accepted: false,
      score: -5,
      reason: "rejected as advice/etiquette/problem-column content",
    };
  }

  if (
    isBlockedWashingtonPostLifestyleStory(
      sourceName,
      titleText,
      summaryText,
      contentText
    )
  ) {
    return {
      accepted: false,
      score: -5,
      reason: "rejected as non-uplifting Washington Post Lifestyle column",
    };
  }

  if (trustedSource) {
    const headlineScore = scoreText(combinedHeadline);
    const shortenedContent = contentText.slice(0, 1200);
    const contentScore = scoreText(shortenedContent);

    const trustedScore =
      sourceWeight +
      Math.max(headlineScore, 0) +
      Math.max(Math.round(contentScore * 0.5), 0);

    return {
      accepted: true,
      score: Math.max(trustedScore, sourceWeight),
      reason: "accepted from trusted source",
    };
  }

  if (SOFT_BLOCK_PATTERNS.some((pattern) => pattern.test(combinedHeadline))) {
    return {
      accepted: false,
      score: -5,
      reason: "rejected by warning/concern/travel blocker",
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
      reason: "rejected by warning/concern/travel blocker in content",
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

function freshnessBonusFromDate(publishDate: string) {
  const published = new Date(publishDate).getTime();
  if (Number.isNaN(published)) return 0;

  const now = Date.now();
  const ageMs = now - published;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 24) return 3;
  if (ageHours <= 48) return 2;
  if (ageHours <= 72) return 1;
  return 0;
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

function extractImageCandidatesFromMeta(html: string, articleUrl: string): string[] {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["'][^>]*>/gi,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']image["'][^>]*>/gi,
  ];

  const candidates: string[] = [];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cleaned = cleanImageUrl(match[1], articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function extractImageCandidatesFromJsonLd(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];
  const scriptMatches =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const scriptTag of scriptMatches) {
    const jsonText = scriptTag
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    const imageMatches = [
      ...jsonText.matchAll(/"image"\s*:\s*"([^"]+)"/gi),
      ...jsonText.matchAll(/"contentUrl"\s*:\s*"([^"]+)"/gi),
      ...jsonText.matchAll(/"url"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi),
    ];

    for (const match of imageMatches) {
      const maybe = match[1]?.replace(/\\\//g, "/");
      const cleaned = cleanImageUrl(maybe, articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function extractImageCandidatesFromGenericHtml(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];

  const patterns = [
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/gi,
    /<img[^>]+data-lazy-src=["']([^"']+)["']/gi,
    /<img[^>]+data-src=["']([^"']+)["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
    /<amp-img[^>]+src=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const cleaned = cleanImageUrl(match[1], articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  for (const match of html.matchAll(/<img[^>]+srcset=["']([^"']+)["']/gi)) {
    const first = match[1]?.split(",")[0]?.trim().split(" ")[0];
    const cleaned = cleanImageUrl(first, articleUrl);
    if (cleaned) candidates.push(cleaned);
  }

  return candidates;
}

function extractImageCandidatesFromScripts(html: string, articleUrl: string): string[] {
  const candidates: string[] = [];

  const patterns = [
    /https?:\/\/[^"'\\\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s>]*)?/gi,
    /"image"\s*:\s*"([^"]+)"/gi,
    /"hero-image"\s*:\s*"([^"]+)"/gi,
    /"promo_image"\s*:\s*"([^"]+)"/gi,
    /"url"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi,
    /"originalUrl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = (match[1] || match[0] || "").replace(/\\\//g, "/");
      const cleaned = cleanImageUrl(raw, articleUrl);
      if (cleaned) candidates.push(cleaned);
    }
  }

  return candidates;
}

function pickBestImageCandidate(candidates: string[]): string | null {
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    if (
      /sprite|icon|logo|avatar|1x1|pixel/i.test(candidate) ||
      /\.(svg)(\?|$)/i.test(candidate) ||
      /generic-newsletter-signup/i.test(candidate)
    ) {
      continue;
    }

    return candidate;
  }

  return null;
}

function extractBestImageFromHtml(html: string, articleUrl: string): string | null {
  const meta = extractImageCandidatesFromMeta(html, articleUrl);
  const jsonLd = extractImageCandidatesFromJsonLd(html, articleUrl);
  const generic = extractImageCandidatesFromGenericHtml(html, articleUrl);
  const scripts = extractImageCandidatesFromScripts(html, articleUrl);

  const all = [...meta, ...jsonLd, ...generic, ...scripts];
  return pickBestImageCandidate(all);
}

async function extractImageFromArticlePage(articleUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Referer: "https://www.google.com/",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
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
    logs.push(`IMPORTER_VERSION: ${IMPORTER_VERSION}`);
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
      let sourceFeedImages = 0;
      let sourcePageImages = 0;
      let sourceExistingImages = 0;
      let sourceNoImages = 0;
      let fetchedCount = 0;
      let batchCount = 0;

      try {
        const feed = await parser.parseURL(source.url);
        fetchedCount = feed.items.length;
        logs.push(`Feed: ${source.name} (${feed.items.length} items)`);

        const batchSize = source.batchSize ?? 5;
        const batchItems = feed.items.slice(0, batchSize);
        batchCount = batchItems.length;

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

            const safeSummary =
              summary || truncateNicely(cleanStoryText(rawSummary || title), 500);

            const decision = decideImportStory(
              title,
              safeSummary,
              content,
              source.weight ?? 1,
              source.trusted ?? false,
              source.name
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
            const categorySlug = guessCategory(title, safeSummary, source.defaultCategory);

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

            const trustedBonus = source.trusted ? 1 : 0;
            const freshnessBonus = freshnessBonusFromDate(publishDate);

            const storyScore =
              decision.score +
              (imageUrl ? 2 : 0) +
              (source.weight ?? 1) +
              trustedBonus +
              freshnessBonus;

            const story = {
              title,
              slug,
              summary: safeSummary,
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

            if (imageSource === "feed") {
              feedImageCount += 1;
              sourceFeedImages += 1;
            } else if (imageSource === "page") {
              pageImageCount += 1;
              sourcePageImages += 1;
            } else if (imageSource === "existing") {
              existingImageCount += 1;
              sourceExistingImages += 1;
            } else {
              noImageCount += 1;
              sourceNoImages += 1;
            }
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
        sourceErrors += 1;
        logs.push(`Error reading feed ${source.name}: ${String(err)}`);
      }

      await supabase.from("importer_runs").insert({
        importer_version: IMPORTER_VERSION,
        source_name: source.name,
        fetched_count: fetchedCount,
        batch_count: batchCount,
        saved_count: sourceSaved,
        skipped_count: sourceSkipped,
        error_count: sourceErrors,
        feed_image_count: sourceFeedImages,
        page_image_count: sourcePageImages,
        existing_image_count: sourceExistingImages,
        no_image_count: sourceNoImages,
      });
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