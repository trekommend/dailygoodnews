import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { supabase } = await import("../lib/supabase");

  type StoryRow = {
    id: string;
    title: string;
    source_url: string;
    source_name: string | null;
    image_url: string | null;
    publish_date: string | null;
  };

  const advicePatterns: RegExp[] = [
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

  function isAdviceTitle(title: string) {
    return advicePatterns.some((pattern) => pattern.test(title));
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
      .replace(/&amp;/g, "&")
      .replace(/&#38;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
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

  function extractBestImageFromHtml(html: string, articleUrl: string): string | null {
    const meta = extractImageCandidatesFromMeta(html, articleUrl);
    const jsonLd = extractImageCandidatesFromJsonLd(html, articleUrl);
    const generic = extractImageCandidatesFromGenericHtml(html, articleUrl);
    const scripts = extractImageCandidatesFromScripts(html, articleUrl);

    const all = [...meta, ...jsonLd, ...generic, ...scripts];
    return pickBestImageCandidate(all);
  }

  async function fetchImageFromArticlePage(articleUrl: string): Promise<string | null> {
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

  console.log("Loading Washington Post Lifestyle stories...");

  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, source_url, source_name, image_url, publish_date")
    .eq("source_name", "Washington Post Lifestyle")
    .order("publish_date", { ascending: false });

  if (error) {
    console.error("Failed to load stories:", error.message);
    process.exit(1);
  }

  const rows = (stories ?? []) as StoryRow[];
  console.log(`Loaded ${rows.length} Washington Post Lifestyle stories.`);

  const rowsToDelete = rows.filter((row) => isAdviceTitle(row.title || ""));
  const rowsToKeep = rows.filter((row) => !isAdviceTitle(row.title || ""));

  console.log(`Advice/etiquette rows to delete: ${rowsToDelete.length}`);
  console.log(`Rows to keep: ${rowsToKeep.length}`);

  if (rowsToDelete.length > 0) {
    const idsToDelete = rowsToDelete.map((row) => row.id);

    const { error: deleteError } = await supabase
      .from("stories")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("Delete failed:", deleteError.message);
      process.exit(1);
    }

    console.log(`Deleted ${rowsToDelete.length} advice/etiquette stories.`);
  } else {
    console.log("No advice/etiquette stories matched deletion rules.");
  }

  const rowsMissingImages = rowsToKeep.filter((row) => !row.image_url);

  console.log(`Remaining stories missing images: ${rowsMissingImages.length}`);

  let updated = 0;
  let noImage = 0;
  let failed = 0;

  for (const story of rowsMissingImages) {
    try {
      const imageUrl = await fetchImageFromArticlePage(story.source_url);

      if (!imageUrl) {
        noImage += 1;
        console.log(`No image found: ${story.title}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("stories")
        .update({ image_url: imageUrl })
        .eq("id", story.id);

      if (updateError) {
        failed += 1;
        console.log(`Update failed: ${story.title} -> ${updateError.message}`);
        continue;
      }

      updated += 1;
      console.log(`Updated image: ${story.title}`);
    } catch (err) {
      failed += 1;
      console.log(`Error: ${story.title} -> ${String(err)}`);
    }
  }

  console.log("Done.");
  console.log({
    deleted: rowsToDelete.length,
    imageBackfilled: updated,
    noImageFound: noImage,
    failed,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});