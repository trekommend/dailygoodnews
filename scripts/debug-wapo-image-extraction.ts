import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

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

  function absoluteUrl(url: string, baseUrl: string) {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  function cleanImageUrl(url: string | null | undefined, baseUrl: string) {
    if (!url) return null;

    const raw = url.trim();

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
        /\.(svg)(\?|$)/i.test(candidate)
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

  function extractBestImageFromHtml(html: string, articleUrl: string) {
    const meta = extractImageCandidatesFromMeta(html, articleUrl);
    const jsonLd = extractImageCandidatesFromJsonLd(html, articleUrl);
    const generic = extractImageCandidatesFromGenericHtml(html, articleUrl);
    const scripts = extractImageCandidatesFromScripts(html, articleUrl);

    const all = [...meta, ...jsonLd, ...generic, ...scripts];
    const best = pickBestImageCandidate(all);

    return {
      best,
      counts: {
        meta: meta.length,
        jsonLd: jsonLd.length,
        generic: generic.length,
        scripts: scripts.length,
        total: all.length,
      },
      sampleCandidates: all.slice(0, 10),
    };
  }

  async function fetchArticleHtml(articleUrl: string) {
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

      const html = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        finalUrl: response.url,
        html,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function safeFileName(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  const debugDir = path.resolve(process.cwd(), "scripts", "debug-output");
  await fs.mkdir(debugDir, { recursive: true });

  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, source_url, source_name, image_url, publish_date")
    .eq("source_name", "Washington Post Lifestyle")
    .is("image_url", null)
    .order("publish_date", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to load stories:", error.message);
    process.exit(1);
  }

  const rows = (stories ?? []) as StoryRow[];

  console.log(`Checking ${rows.length} Washington Post stories with missing images.`);

  for (let i = 0; i < rows.length; i += 1) {
    const story = rows[i];
    console.log(`\n--- ${i + 1}/${rows.length} ---`);
    console.log(`Title: ${story.title}`);
    console.log(`URL: ${story.source_url}`);

    try {
      const result = await fetchArticleHtml(story.source_url);

      console.log(`HTTP status: ${result.status}`);
      console.log(`Final URL: ${result.finalUrl}`);
      console.log(`HTML length: ${result.html.length}`);

      const titleMatch = result.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
      console.log(`HTML <title>: ${titleMatch}`);

      const extraction = extractBestImageFromHtml(result.html, story.source_url);

      console.log("Candidate counts:", extraction.counts);
      console.log("Sample candidates:", extraction.sampleCandidates);
      console.log("Best image:", extraction.best);

      const fileBase = `${String(i + 1).padStart(2, "0")}-${safeFileName(story.title)}`;

      await fs.writeFile(
        path.join(debugDir, `${fileBase}.html`),
        result.html,
        "utf8"
      );

      await fs.writeFile(
        path.join(debugDir, `${fileBase}.json`),
        JSON.stringify(
          {
            title: story.title,
            source_url: story.source_url,
            status: result.status,
            finalUrl: result.finalUrl,
            htmlTitle: titleMatch,
            counts: extraction.counts,
            sampleCandidates: extraction.sampleCandidates,
            bestImage: extraction.best,
          },
          null,
          2
        ),
        "utf8"
      );

      if (extraction.best) {
        const { error: updateError } = await supabase
          .from("stories")
          .update({ image_url: extraction.best })
          .eq("id", story.id);

        if (updateError) {
          console.log(`DB update failed: ${updateError.message}`);
        } else {
          console.log("DB updated with image.");
        }
      }
    } catch (err) {
      console.log(`Fetch/extract failed: ${String(err)}`);
    }
  }

  console.log(`\nDone. Debug files saved to: ${debugDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});