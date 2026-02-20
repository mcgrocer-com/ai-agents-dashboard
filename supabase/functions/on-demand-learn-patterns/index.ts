import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// Configuration
// ============================================================
const PER_DOMAIN_TIMEOUT_MS = 60_000; // increased for ScraperAPI fallback
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_URLS = 10_000;
const MAX_SUB_SITEMAPS = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ============================================================
// Types
// ============================================================
interface ParsedUrl {
  url: string;
  path: string;
  segments: string[];
  depth: number;
  lastSegment: string;
}

interface AnalysisResult {
  productPatterns: string[];
  categoryPatterns: string[];
  exampleProductUrls: string[];
  exampleCategoryUrls: string[];
  confidence: number;
  totalUrlsAnalyzed: number;
  notes: string;
}

interface DomainResult {
  domain: string;
  success: boolean;
  error?: string;
  sitemapUrl?: string;
  stats: {
    urls_found: number;
    products_detected: number;
    categories_detected: number;
  };
  patterns: {
    product: string[];
    category: string[];
  };
  confidence: number;
  debug?: string[];
}

// User-Agent strings: try a standard bot UA first, fallback to browser-like UA
const UA_BOT = "Mozilla/5.0 (compatible; McGrocer/1.0; +https://mcgrocer.com/bot)";
const UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ScraperAPI for WAF-blocked sites (set in handler from env)
const SCRAPERAPI_URL = "https://api.scraperapi.com";
let scraperApiKey: string | undefined;

// ============================================================
// Step 1: Discover Sitemaps
// ============================================================
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA_BOT,
        "Accept": "application/xml, text/xml, */*",
        // NOTE: Do NOT send Accept-Encoding — some servers (Boots) return
        // compressed content without Content-Encoding header, breaking fetch
      },
    });
    // If blocked with bot UA, retry with browser UA
    if (res.status === 403 || res.status === 429) {
      clearTimeout(timer);
      console.log(`[Fetch] Bot UA blocked (${res.status}) for ${url}, trying browser UA...`);
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const res2 = await fetch(url, {
          signal: controller2.signal,
          headers: {
            "User-Agent": UA_BROWSER,
            "Accept": "application/xml, text/xml, */*",
          },
        });
        // If browser UA also blocked, try ScraperAPI
        if ((res2.status === 403 || res2.status === 429) && scraperApiKey) {
          clearTimeout(timer2);
          console.log(`[Fetch] Browser UA also blocked (${res2.status}), trying ScraperAPI...`);
          return await fetchViaScraperApi(url, timeoutMs);
        }
        return res2;
      } finally {
        clearTimeout(timer2);
      }
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Fetch via ScraperAPI proxy (bypasses WAF/CDN blocking)
// Tries standard first, escalates to ultra_premium on failure
async function fetchViaScraperApi(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  // Attempt 1: Standard ScraperAPI (1 credit)
  const params = new URLSearchParams({
    api_key: scraperApiKey!,
    url,
  });
  const controller1 = new AbortController();
  const timer1 = setTimeout(() => controller1.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPERAPI_URL}?${params.toString()}`, {
      signal: controller1.signal,
    });
    clearTimeout(timer1);

    if (res.ok) {
      const text = await res.text();
      // ScraperAPI returns 200 with error message for protected domains
      if (text.includes("Request failed") && text.includes("premium")) {
        console.log(`[ScraperAPI] Standard failed for ${url} (premium required), trying ultra_premium...`);
      } else {
        console.log(`[ScraperAPI] Standard OK for ${url} (${text.length}b)`);
        return new Response(text, { status: 200, headers: res.headers });
      }
    } else {
      console.log(`[ScraperAPI] Standard failed for ${url}: ${res.status}`);
    }
  } catch (e) {
    clearTimeout(timer1);
    console.log(`[ScraperAPI] Standard error for ${url}: ${e}`);
  }

  // Attempt 2: Ultra Premium ScraperAPI (75 credits) — for heavily protected sites
  const ultraParams = new URLSearchParams({
    api_key: scraperApiKey!,
    url,
    ultra_premium: "true",
  });
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
  try {
    const res = await fetch(`${SCRAPERAPI_URL}?${ultraParams.toString()}`, {
      signal: controller2.signal,
    });
    clearTimeout(timer2);
    console.log(`[ScraperAPI] Ultra premium for ${url} → ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(timer2);
    console.log(`[ScraperAPI] Ultra premium error for ${url}: ${e}`);
    return new Response("", { status: 500 });
  }
}

// Decompress gzipped content (direct fetch, with ScraperAPI fallback)
async function fetchAndDecompressGz(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA_BOT,
        "Accept": "*/*",
      },
    });

    // If blocked, try ScraperAPI (it returns decompressed content)
    if ((res.status === 403 || res.status === 429) && scraperApiKey) {
      clearTimeout(timer);
      console.log(`[GZ] Blocked (${res.status}) for ${url}, trying ScraperAPI...`);
      const scraperRes = await fetchViaScraperApi(url, timeoutMs);
      if (scraperRes.ok) {
        // ScraperAPI returns decompressed content directly
        return await scraperRes.text();
      }
      return "";
    }

    if (!res.ok || !res.body) return "";

    const decompressed = res.body.pipeThrough(new DecompressionStream("gzip"));
    const reader = decompressed.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const MAX_DECOMPRESS_SIZE = 10 * 1024 * 1024; // 10MB limit

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_DECOMPRESS_SIZE) {
        console.warn(`[GZ] ${url} exceeds 10MB decompressed, truncating`);
        chunks.push(value);
        break;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder();
    return chunks.map(c => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  } catch (e) {
    console.warn(`[GZ] Failed to decompress ${url}: ${e}`);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// Check if response text looks like valid XML sitemap content
// Checks header for XML markers, and also searches for <loc> tags anywhere
// (ScraperAPI ultra_premium wraps XML in HTML, so <loc> may appear deep in the content)
function isValidSitemapContent(text: string): boolean {
  const trimmed = text.trimStart().substring(0, 500).toLowerCase();
  if (trimmed.includes("<?xml") || trimmed.includes("<urlset") || trimmed.includes("<sitemapindex")) {
    return true;
  }
  // Search deeper for <loc> tags (handles HTML-wrapped XML from ScraperAPI)
  return text.includes("<loc>") && text.includes("</loc>");
}

// Check if response text is HTML (challenge page, WAF block, etc.)
function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart().substring(0, 200).toLowerCase();
  return trimmed.includes("<html") || trimmed.includes("<!doctype html");
}

// Fetch a sitemap URL, falling back to ScraperAPI on HTML/binary/blocked/error responses
async function fetchSitemapText(url: string): Promise<string | null> {
  let directFailed = false;
  let failReason = "";

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      directFailed = true;
      failReason = `HTTP ${res.status}`;
    } else {
      const text = await res.text();

      // If the response is valid XML sitemap, return it
      if (isValidSitemapContent(text)) {
        return text;
      }

      directFailed = true;
      failReason = isHtmlResponse(text) ? "HTML challenge" : `non-XML (${text.length}b)`;
    }
  } catch (e) {
    // Connection errors (broken pipe, timeout, etc.)
    directFailed = true;
    failReason = `fetch error: ${String(e).substring(0, 100)}`;
  }

  // Direct fetch failed — try ScraperAPI if available
  if (directFailed && scraperApiKey) {
    console.log(`[Sitemap] ${url} direct failed (${failReason}), trying ScraperAPI...`);
    try {
      const scraperRes = await fetchViaScraperApi(url);
      if (scraperRes.ok) {
        const scraperText = await scraperRes.text();
        if (isValidSitemapContent(scraperText)) {
          console.log(`[Sitemap] ScraperAPI success for ${url} (${scraperText.length}b)`);
          return scraperText;
        }
        console.log(`[Sitemap] ScraperAPI returned non-XML for ${url}`);
      } else {
        console.log(`[Sitemap] ScraperAPI failed for ${url}: ${scraperRes.status}`);
      }
    } catch (e) {
      console.warn(`[Sitemap] ScraperAPI error for ${url}: ${e}`);
    }
  } else if (directFailed) {
    console.log(`[Sitemap] ${url} failed (${failReason}), no ScraperAPI key`);
  }

  return null;
}

async function discoverSitemaps(domain: string): Promise<string[]> {
  const sitemapUrls: string[] = [];
  const prefixes = [`https://www.${domain}`, `https://${domain}`];

  // Try robots.txt first
  for (const prefix of prefixes) {
    try {
      const res = await fetchWithTimeout(`${prefix}/robots.txt`, 10_000);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split("\n");
        for (const line of lines) {
          const match = line.match(/^sitemap:\s*(.+)/i);
          if (match) {
            sitemapUrls.push(match[1].trim());
          }
        }
        if (sitemapUrls.length > 0) {
          console.log(
            `[${domain}] Found ${sitemapUrls.length} sitemap(s) in robots.txt`
          );
          return sitemapUrls;
        }
      }
    } catch {
      // robots.txt failed, try next prefix
    }
  }

  // Fallback: try common sitemap paths
  const fallbackPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemapindex.xml",
    "/sitemap/sitemap.xml",
  ];

  for (const prefix of prefixes) {
    for (const path of fallbackPaths) {
      try {
        const url = `${prefix}${path}`;
        const res = await fetchWithTimeout(url, 10_000);
        if (res.ok) {
          const text = await res.text();
          if (text.includes("<loc>") || text.includes("<urlset") || text.includes("<sitemapindex")) {
            console.log(`[${domain}] Found sitemap at ${url}`);
            return [url];
          }
        }
      } catch {
        // Continue trying
      }
    }
  }

  return [];
}

// ============================================================
// Step 2: Fetch & Parse Sitemap XML
// ============================================================
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) locs.push(url);
  }
  return locs;
}

function isSitemapIndex(xml: string): boolean {
  return xml.includes("<sitemapindex");
}

interface SitemapFetchResult {
  urls: string[];
  sitemapSource: string;
  subSitemapNames: string[];
  debugLog: string[];
}

async function fetchSitemapUrls(
  sitemapUrl: string
): Promise<SitemapFetchResult> {
  const result: SitemapFetchResult = {
    urls: [],
    sitemapSource: sitemapUrl,
    subSitemapNames: [],
    debugLog: [],
  };

  try {
    // Handle .gz URLs: try plain fetch first (server may auto-decompress), then gz decompress
    let text: string | null;
    if (sitemapUrl.endsWith(".gz")) {
      text = await fetchSitemapText(sitemapUrl);
      if (!text) {
        const decompressed = await fetchAndDecompressGz(sitemapUrl);
        text = decompressed || null;
      }
    } else {
      text = await fetchSitemapText(sitemapUrl);
    }
    if (!text) return result;

    if (isSitemapIndex(text)) {
      // It's a sitemap index — extract sub-sitemap URLs
      const subSitemaps = extractLocs(text);
      console.log(
        `[Sitemap] Index at ${sitemapUrl} has ${subSitemaps.length} sub-sitemaps`
      );

      let fetched = 0;
      for (const subUrl of subSitemaps) {
        if (fetched >= MAX_SUB_SITEMAPS) break;
        if (result.urls.length >= MAX_SITEMAP_URLS) break;

        // Track sub-sitemap name for classification hints
        const subName = subUrl.split("/").pop() || "";
        result.subSitemapNames.push(subName.toLowerCase());

        try {
          let subText = "";
          if (subUrl.endsWith(".gz")) {
            // Server may auto-decompress .gz — try plain text first, then gz decompress
            const plainText = await fetchSitemapText(subUrl);
            if (plainText) {
              subText = plainText;
            } else {
              subText = await fetchAndDecompressGz(subUrl);
              if (!subText) {
                result.debugLog.push(`sub ${subName}: gz fetch+decompress failed`);
                continue;
              }
            }
          } else {
            const fetchedText = await fetchSitemapText(subUrl);
            if (!fetchedText) {
              result.debugLog.push(`sub ${subName}: fetchSitemapText returned null`);
              continue;
            }
            subText = fetchedText;
          }

          // Check if this sub-sitemap is itself a sitemap index (nested index)
          if (isSitemapIndex(subText)) {
            const nestedSitemaps = extractLocs(subText);
            console.log(
              `[Sitemap] ${subName} is a nested index with ${nestedSitemaps.length} sub-sitemaps`
            );
            let nestedFetched = 0;
            for (const nestedUrl of nestedSitemaps) {
              if (nestedFetched >= MAX_SUB_SITEMAPS) break;
              if (result.urls.length >= MAX_SITEMAP_URLS) break;

              const nestedName = nestedUrl.split("/").pop() || "";
              result.subSitemapNames.push(nestedName.toLowerCase());

              try {
                let nestedText = "";
                if (nestedUrl.endsWith(".gz")) {
                  const plainText = await fetchSitemapText(nestedUrl);
                  if (plainText) {
                    nestedText = plainText;
                  } else {
                    nestedText = await fetchAndDecompressGz(nestedUrl);
                    if (!nestedText) {
                      console.log(`[Sitemap] Failed to fetch nested: ${nestedName}`);
                      continue;
                    }
                  }
                } else {
                  const fetched = await fetchSitemapText(nestedUrl);
                  if (!fetched) continue;
                  nestedText = fetched;
                }

                const nestedUrls = extractLocs(nestedText);
                for (const u of nestedUrls) {
                  if (result.urls.length >= MAX_SITEMAP_URLS) break;
                  result.urls.push(u);
                }
                console.log(
                  `[Sitemap]   ${nestedName}: ${nestedUrls.length} URLs (total: ${result.urls.length})`
                );
              } catch (e) {
                console.warn(`[Sitemap] Failed nested sub-sitemap ${nestedUrl}: ${e}`);
              }

              nestedFetched++;
              if (nestedFetched < nestedSitemaps.length) {
                await new Promise((r) => setTimeout(r, 100));
              }
            }
          } else {
            const subUrls = extractLocs(subText);
            for (const u of subUrls) {
              if (result.urls.length >= MAX_SITEMAP_URLS) break;
              result.urls.push(u);
            }
            console.log(
              `[Sitemap] ${subName}: ${subUrls.length} URLs (total: ${result.urls.length})`
            );
          }
        } catch (e) {
          result.debugLog.push(`sub ${subName}: EXCEPTION: ${e}`);
          console.warn(`[Sitemap] Failed to fetch sub-sitemap ${subUrl}: ${e}`);
        }

        fetched++;
        // Small delay between sub-sitemap fetches
        if (fetched < subSitemaps.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } else {
      // Direct sitemap
      result.urls = extractLocs(text).slice(0, MAX_SITEMAP_URLS);
      console.log(`[Sitemap] Direct sitemap: ${result.urls.length} URLs`);
    }
  } catch (e) {
    console.error(`[Sitemap] Error fetching ${sitemapUrl}: ${e}`);
  }

  return result;
}

// ============================================================
// Step 3: Parse URLs into segments
// ============================================================
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|webp|pdf|doc|css|js|xml|json|ico|woff|woff2|ttf|eot|mp4|mp3|zip)$/i;
const SKIP_PATHS = /\/(sitemap|rss|feed|atom|wp-json|api|cdn-cgi|static|assets)\//i;

function parseUrls(urls: string[], domain: string): ParsedUrl[] {
  const parsed: ParsedUrl[] = [];
  const domainLower = domain.toLowerCase();

  for (const url of urls) {
    try {
      const u = new URL(url);
      const hostname = u.hostname.toLowerCase();

      // Only keep URLs for the target domain
      if (!hostname.includes(domainLower)) continue;

      // Skip non-page URLs
      if (SKIP_EXTENSIONS.test(u.pathname)) continue;
      if (SKIP_PATHS.test(u.pathname)) continue;

      const path = u.pathname.replace(/\/$/, "") || "/";
      const segments = path.split("/").filter(Boolean);

      // Skip homepage
      if (segments.length === 0) continue;

      parsed.push({
        url,
        path,
        segments,
        depth: segments.length,
        lastSegment: segments[segments.length - 1] || "",
      });
    } catch {
      // Invalid URL, skip
    }
  }

  return parsed;
}

// ============================================================
// Step 4: Algorithmic Clustering
// ============================================================

// Strong product ID patterns (SKU codes, long numeric IDs)
const SKU_PATTERN = /^[A-Z]{0,3}\d{5,}/;
const SKU_WITH_EXT = /^[A-Z]{0,3}\d{5,}.*\.html?$/i;
const PURE_LONG_NUMERIC = /^\d{5,}$/;
// Require at least 2 distinct hex letter chars (a-f) to avoid matching
// prefixed numeric IDs like "c100000180066" (John Lewis category IDs)
const HEX_ID = /^(?=.*[a-f].*[a-f])[a-f0-9]{8,}$/i;

// Product prefix ID: p + long numeric (e.g., John Lewis p1931726)
const PRODUCT_PREFIX_ID = /^p\d{5,}$/;
// Hyphen-prefixed numeric ID (e.g., Boots -10350329)
const HYPHEN_NUMERIC_ID = /^-\d{5,}$/;
// Slug ending with numeric ID (e.g., product-name-10002476)
// Must start with a word char (not hyphen), then any slug chars, ending with -digits
const SLUG_ENDING_NUMERIC = /^[\w][\w-]*-\d{5,}$/;

// Category ID patterns (short numeric, or letter-prefix like c100000180066)
const SHORT_NUMERIC = /^\d{1,4}(-\w+)?$/;
const CATEGORY_PREFIX_ID = /^c\d{5,}$/; // lowercase c + long numeric (e.g., John Lewis c100000180066)

// Known path keywords
const PRODUCT_PATH_KEYWORDS = /\/(products?|item|items|dp|pd|p)(?:\/|$)/i;
const CATEGORY_PATH_KEYWORDS = /\/(category|categories|collections?|shop|browse|brands?|departments?|c)(?:\/|$)/i;

function isProductId(segment: string): boolean {
  const clean = segment.replace(/\.html?$/i, "");
  return (
    SKU_PATTERN.test(clean) ||
    PURE_LONG_NUMERIC.test(clean) ||
    HEX_ID.test(clean) ||
    PRODUCT_PREFIX_ID.test(clean) ||
    HYPHEN_NUMERIC_ID.test(clean) ||
    SLUG_ENDING_NUMERIC.test(clean)
  );
}

function isCategoryId(segment: string): boolean {
  const clean = segment.replace(/\.html?$/i, "");
  return SHORT_NUMERIC.test(clean);
}

function analyzeUrlStructure(
  parsedUrls: ParsedUrl[],
  subSitemapNames: string[]
): AnalysisResult {
  const notes: string[] = [];
  const productUrls: ParsedUrl[] = [];
  const categoryUrls: ParsedUrl[] = [];
  const contentUrls: ParsedUrl[] = [];
  const ambiguousUrls: ParsedUrl[] = [];

  // Check for named sub-sitemaps (strongest signal)
  const hasProductSitemap = subSitemapNames.some(
    (n) => n.includes("product") && !n.includes("category")
  );
  const hasCategorySitemap = subSitemapNames.some(
    (n) => n.includes("category") || n.includes("collection")
  );

  if (hasProductSitemap || hasCategorySitemap) {
    notes.push(
      `Named sub-sitemaps detected: ${subSitemapNames.filter((n) => n.includes("product") || n.includes("category")).join(", ")}`
    );
  }

  // Group by depth
  const byDepth = new Map<number, ParsedUrl[]>();
  for (const p of parsedUrls) {
    const group = byDepth.get(p.depth) || [];
    group.push(p);
    byDepth.set(p.depth, group);
  }

  notes.push(
    `Depth distribution: ${[...byDepth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([d, u]) => `d${d}=${u.length}`)
      .join(", ")}`
  );

  // Classify each URL
  for (const p of parsedUrls) {
    const { lastSegment, path, segments } = p;

    // Content pages: known content paths
    if (
      path.includes("/beauty-faq/") ||
      path.includes("/beauty-expert") ||
      path.includes("/blog/") ||
      path.includes("/article/") ||
      path.includes("/news/") ||
      path.includes("/help/") ||
      path.includes("/faq/") ||
      path.includes("/about")
    ) {
      contentUrls.push(p);
      continue;
    }

    // Check last segment for SKU/ID patterns
    if (isProductId(lastSegment)) {
      productUrls.push(p);
      continue;
    }

    // Check for product path keywords
    if (PRODUCT_PATH_KEYWORDS.test(path)) {
      // If it has a product keyword in the path AND more than one segment, likely product
      if (segments.length >= 2) {
        productUrls.push(p);
        continue;
      }
    }

    // Check for category prefix ID (lowercase c + long numeric, e.g., c100000180066)
    if (CATEGORY_PREFIX_ID.test(lastSegment)) {
      categoryUrls.push(p);
      continue;
    }

    // Check for short numeric category IDs
    if (isCategoryId(lastSegment) && segments.length >= 2) {
      categoryUrls.push(p);
      continue;
    }

    // Check for category path keywords
    if (CATEGORY_PATH_KEYWORDS.test(path)) {
      categoryUrls.push(p);
      continue;
    }

    // Depth-1 slugs are usually categories or marketing pages
    if (segments.length === 1) {
      categoryUrls.push(p);
      continue;
    }

    // Deep path + long slug + trailing short number = likely product
    // e.g., /us/cosmetics/nutricosmetics/product-name-4
    // Requires: depth ≥ 4, last segment has 4+ hyphens, ends with -N (1-2 digits)
    // Strict to avoid false positives on category pages with short trailing numbers
    const hyphenCount = lastSegment.split("-").length - 1;
    if (segments.length >= 4 && hyphenCount >= 4 && /\-\d{1,2}$/.test(lastSegment)) {
      productUrls.push(p);
      continue;
    }

    // Depth-2+ with just slugs — analyze further
    if (segments.length >= 2 && hyphenCount >= 4) {
      // Long descriptive slug at depth 2+ = likely product
      ambiguousUrls.push(p); // Still ambiguous, but lean product
    } else {
      ambiguousUrls.push(p);
    }
  }

  notes.push(
    `Classification: ${productUrls.length} products, ${categoryUrls.length} categories, ${contentUrls.length} content, ${ambiguousUrls.length} ambiguous`
  );

  // Generate regex patterns
  const productPatterns = generateProductPatterns(productUrls, notes);
  const categoryPatterns = generateCategoryPatterns(categoryUrls, notes);

  // Calculate confidence
  const classified = productUrls.length + categoryUrls.length + contentUrls.length;
  const total = parsedUrls.length;
  const classificationRate = total > 0 ? classified / total : 0;

  // No patterns generated = no useful learning occurred
  const hasProductPatterns = productPatterns.length > 0;
  const hasCategoryPatterns = categoryPatterns.length > 0;

  if (!hasProductPatterns && !hasCategoryPatterns) {
    notes.push("No product or category patterns could be generated");
    return {
      productPatterns: [],
      categoryPatterns: [],
      exampleProductUrls: [],
      exampleCategoryUrls: [],
      confidence: 0,
      totalUrlsAnalyzed: total,
      notes: notes.join("\n"),
    };
  }

  // Check for pattern overlap (would reduce confidence)
  let overlapPenalty = 0;
  if (hasProductPatterns && hasCategoryPatterns) {
    let overlaps = 0;
    const sampleSize = Math.min(productUrls.length, 20);
    for (let i = 0; i < sampleSize; i++) {
      for (const catPat of categoryPatterns) {
        try {
          if (new RegExp(catPat, "i").test(productUrls[i].url)) {
            overlaps++;
            break;
          }
        } catch { /* invalid regex, skip */ }
      }
    }
    overlapPenalty = sampleSize > 0 ? (overlaps / sampleSize) * 0.3 : 0;
  }

  // Penalty if only one type of pattern found
  const missingPatternPenalty = (!hasProductPatterns || !hasCategoryPatterns) ? 0.15 : 0;

  const confidence = Math.max(
    0,
    Math.min(1, classificationRate * 0.9 + 0.1 - overlapPenalty - missingPatternPenalty)
  );

  // Reduce confidence if too few URLs
  const finalConfidence =
    total < 10
      ? confidence * 0.5
      : total < 50
        ? confidence * 0.8
        : confidence;

  return {
    productPatterns,
    categoryPatterns,
    exampleProductUrls: productUrls.slice(0, 10).map((p) => p.url),
    exampleCategoryUrls: categoryUrls.slice(0, 10).map((p) => p.url),
    confidence: Math.round(finalConfidence * 100) / 100,
    totalUrlsAnalyzed: total,
    notes: notes.join("\n"),
  };
}

// ============================================================
// Step 5: Generate Regex Patterns
// ============================================================

function generateProductPatterns(
  productUrls: ParsedUrl[],
  notes: string[]
): string[] {
  if (productUrls.length === 0) return [];

  const patterns: string[] = [];

  // Group product URLs by their structural signature
  // Signature = which segment position has the ID + what prefix the ID has
  const signatures = new Map<string, ParsedUrl[]>();

  for (const p of productUrls) {
    const { lastSegment, depth } = p;
    const clean = lastSegment.replace(/\.html?$/i, "");
    const hasExt = /\.html?$/i.test(lastSegment);

    let idPrefix = "";
    if (/^CS\d/.test(clean)) idPrefix = "CS";
    else if (/^C\d/.test(clean)) idPrefix = "C";
    else if (PRODUCT_PREFIX_ID.test(clean)) idPrefix = "PPREFIX";
    else if (/^\d{5,}$/.test(clean)) idPrefix = "NUM";
    else if (HEX_ID.test(clean)) idPrefix = "HEX";
    else if (HYPHEN_NUMERIC_ID.test(clean)) idPrefix = "HYPHEN";
    else if (SLUG_ENDING_NUMERIC.test(clean)) idPrefix = "SLUGNUM";
    else if (/\-\d{1,2}$/.test(clean) && p.segments.length >= 3) idPrefix = "DEEPSUFFIX";
    else if (PRODUCT_PATH_KEYWORDS.test(p.path)) idPrefix = "KEYWORD";
    else idPrefix = "OTHER";

    const sig = `d${depth}_${idPrefix}_ext${hasExt ? "Y" : "N"}`;
    const group = signatures.get(sig) || [];
    group.push(p);
    signatures.set(sig, group);
  }

  // Generate a pattern for each significant signature group
  for (const [sig, urls] of signatures.entries()) {
    if (urls.length < 2) continue; // Need at least 2 URLs to form a pattern

    const sample = urls[0];
    const hasExt = /\.html?$/i.test(sample.lastSegment);
    // All patterns end with optional trailing slash: \/? before $
    const trail = hasExt ? "\\.html?\\/?$" : "\\/?$";

    if (sig.includes("_CS_")) {
      // Clarins-style CS prefix: /slug/CS12345678.html
      patterns.push(`\\/[\\w%-]+\\/CS\\d{5,}${trail}`);
      notes.push(`Pattern: CS-prefixed SKU (${urls.length} URLs)`);
    } else if (sig.includes("_C_")) {
      // C-prefix SKU: /slug/C080033165.html
      patterns.push(`\\/[\\w%-]+\\/C\\d{5,}${trail}`);
      notes.push(`Pattern: C-prefixed SKU (${urls.length} URLs)`);
    } else if (sig.includes("_PPREFIX_")) {
      // p-prefix product ID: /slug/p1931726 (John Lewis style)
      patterns.push(`\\/p\\d{5,}${trail}`);
      notes.push(`Pattern: p-prefixed product ID (${urls.length} URLs)`);
    } else if (sig.includes("_NUM_")) {
      // Pure numeric ID: /slug/80104490
      patterns.push(`\\/[\\w%-]+\\/\\d{5,}${trail}`);
      notes.push(`Pattern: Numeric ID (${urls.length} URLs)`);
    } else if (sig.includes("_HEX_")) {
      // Hex-style ID
      patterns.push(`\\/[\\w%-]+\\/[a-f0-9]{8,}${trail}`);
      notes.push(`Pattern: Hex ID (${urls.length} URLs)`);
    } else if (sig.includes("_HYPHEN_")) {
      // Hyphen-prefixed numeric ID: /-10350329 (Boots style)
      patterns.push(`\\/-\\d{5,}${trail}`);
      notes.push(`Pattern: Hyphen-numeric ID (${urls.length} URLs)`);
    } else if (sig.includes("_SLUGNUM_")) {
      // Slug ending with numeric ID: /product-name-10002476 (Boots style)
      patterns.push(`\\/[\\w-]+-\\d{5,}${trail}`);
      notes.push(`Pattern: Slug-ending numeric ID (${urls.length} URLs)`);
    } else if (sig.includes("_DEEPSUFFIX_")) {
      // Deep path + long slug ending with short numeric suffix (e.g., /cat/subcat/product-name-4)
      // Require at least 20 URLs to generate — weak signal, needs volume to be trustworthy
      if (urls.length >= 20) {
        patterns.push(`\\/[a-z][\\w-]*(?:-[\\w]+){3,}-\\d{1,2}${trail}`);
        notes.push(`Pattern: Deep slug with trailing ID (${urls.length} URLs)`);
      }
    } else if (sig.includes("_KEYWORD_")) {
      // Path keyword: /products/slug or /p/id
      const pathMatch = sample.path.match(PRODUCT_PATH_KEYWORDS);
      if (pathMatch) {
        const keyword = pathMatch[1];
        patterns.push(`\\/${keyword}\\/[\\w%-]+`);
        notes.push(
          `Pattern: /${keyword}/ path keyword (${urls.length} URLs)`
        );
      }
    }
  }

  // Deduplicate patterns
  return [...new Set(patterns)];
}

function generateCategoryPatterns(
  categoryUrls: ParsedUrl[],
  notes: string[]
): string[] {
  if (categoryUrls.length === 0) return [];

  const patterns: string[] = [];

  // Check for category prefix IDs (lowercase c + long numeric, e.g., c100000180066)
  const withPrefixId = categoryUrls.filter((p) =>
    CATEGORY_PREFIX_ID.test(p.lastSegment)
  );

  if (withPrefixId.length >= 3) {
    patterns.push(`\\/c\\d{5,}\\/?$`);
    notes.push(
      `Category pattern: c-prefix category ID (${withPrefixId.length} URLs)`
    );
  }

  // Check for short numeric category IDs
  const withNumericId = categoryUrls.filter((p) =>
    SHORT_NUMERIC.test(p.lastSegment.replace(/\.html?$/i, ""))
  );

  if (withNumericId.length >= 3) {
    patterns.push(`\\/[\\w-]+\\/\\d{1,4}(-\\w+)?\\/?$`);
    notes.push(
      `Category pattern: Numeric category ID (${withNumericId.length} URLs)`
    );
  }

  // Check for category path keywords
  const withKeyword = categoryUrls.filter((p) =>
    CATEGORY_PATH_KEYWORDS.test(p.path)
  );

  if (withKeyword.length >= 3) {
    // Extract the keyword used
    const keywordCounts = new Map<string, number>();
    for (const p of withKeyword) {
      const match = p.path.match(CATEGORY_PATH_KEYWORDS);
      if (match) {
        const kw = match[1].toLowerCase();
        keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
      }
    }

    for (const [kw, count] of keywordCounts.entries()) {
      if (count >= 3) {
        patterns.push(`\\/${kw}(\\/|$)`);
        notes.push(
          `Category pattern: /${kw}/ keyword (${count} URLs)`
        );
      }
    }
  }

  return [...new Set(patterns)];
}

// ============================================================
// Step 6: Process a single domain
// ============================================================

async function processDomain(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  force: boolean
): Promise<DomainResult> {
  const startTime = Date.now();

  const emptyResult: DomainResult = {
    domain,
    success: false,
    stats: { urls_found: 0, products_detected: 0, categories_detected: 0 },
    patterns: { product: [], category: [] },
    confidence: 0,
  };

  try {
    // Check if already learned (unless force)
    if (!force) {
      const { data: existing } = await supabase
        .from("vendor_url_patterns")
        .select("learning_status, confidence_score")
        .eq("domain", domain)
        .single();

      if (existing?.learning_status === "learned" && existing?.confidence_score > 0.5) {
        return {
          ...emptyResult,
          success: true,
          error: "Already learned (use force=true to re-learn)",
        };
      }
    }

    const debug: string[] = [];
    debug.push(`scraperApiKey: ${scraperApiKey ? "set" : "NOT SET"}`);

    // Step 1: Discover sitemaps
    console.log(`\n${"=".repeat(50)}`);
    console.log(`[${domain}] Starting sitemap discovery...`);
    const sitemapUrls = await discoverSitemaps(domain);
    debug.push(`sitemaps_discovered: ${JSON.stringify(sitemapUrls)}`);

    if (sitemapUrls.length === 0) {
      const error = "No sitemap found";
      console.log(`[${domain}] ${error}`);
      await saveFailed(supabase, domain, error);
      return { ...emptyResult, error, debug };
    }

    // Step 2: Fetch and parse sitemaps
    let allUrls: string[] = [];
    let sitemapSource = "";
    let subSitemapNames: string[] = [];

    for (const sitemapUrl of sitemapUrls) {
      if (allUrls.length >= MAX_SITEMAP_URLS) break;
      if (Date.now() - startTime > PER_DOMAIN_TIMEOUT_MS) {
        console.log(`[${domain}] Timeout reached during sitemap fetching`);
        break;
      }

      const result = await fetchSitemapUrls(sitemapUrl);
      debug.push(`sitemap ${sitemapUrl}: ${result.urls.length} URLs, subs: ${result.subSitemapNames.join(",")}`);
      debug.push(...result.debugLog);
      allUrls = allUrls.concat(result.urls);
      subSitemapNames = subSitemapNames.concat(result.subSitemapNames);
      if (!sitemapSource && result.urls.length > 0) {
        sitemapSource = sitemapUrl;
      }
    }

    if (allUrls.length === 0) {
      const error = "Sitemap found but contains no URLs";
      console.log(`[${domain}] ${error}`);
      await saveFailed(supabase, domain, error);
      return { ...emptyResult, error, sitemapUrl: sitemapSource, debug };
    }

    console.log(`[${domain}] Total URLs from sitemaps: ${allUrls.length}`);

    // Step 3: Parse URLs
    const parsedUrls = parseUrls(allUrls, domain);
    console.log(`[${domain}] Parsed URLs (after filtering): ${parsedUrls.length}`);

    if (parsedUrls.length === 0) {
      const error = "No valid page URLs found in sitemap";
      await saveFailed(supabase, domain, error);
      return { ...emptyResult, error, sitemapUrl: sitemapSource };
    }

    // Step 4 & 5: Analyze and generate patterns
    const analysis = analyzeUrlStructure(parsedUrls, subSitemapNames);

    console.log(`[${domain}] Analysis complete:`);
    console.log(`  Product patterns: ${analysis.productPatterns.length}`);
    console.log(`  Category patterns: ${analysis.categoryPatterns.length}`);
    console.log(`  Confidence: ${analysis.confidence}`);
    console.log(`  Notes:\n    ${analysis.notes.split("\n").join("\n    ")}`);

    // If no patterns could be generated, mark as failed
    if (analysis.productPatterns.length === 0 && analysis.categoryPatterns.length === 0) {
      const error = `Sitemap analyzed (${parsedUrls.length} URLs) but no product/category patterns detected`;
      console.log(`[${domain}] ${error}`);
      await saveFailed(supabase, domain, error);
      return { ...emptyResult, error, sitemapUrl: sitemapSource, stats: { urls_found: parsedUrls.length, products_detected: 0, categories_detected: 0 } };
    }

    // Step 6: Save to database
    const vendorName = domain
      .replace(/\.(com|co\.uk|co|org|net).*$/, "")
      .split(".")
      .pop() || domain;

    const capitalizedName =
      vendorName.charAt(0).toUpperCase() + vendorName.slice(1);

    const upsertData = {
      domain,
      vendor_name: capitalizedName,
      product_patterns: analysis.productPatterns,
      category_patterns: analysis.categoryPatterns,
      learning_status: "learned",
      example_product_urls: analysis.exampleProductUrls,
      example_category_urls: analysis.exampleCategoryUrls,
      confidence_score: analysis.confidence,
      sample_size: analysis.totalUrlsAnalyzed,
      learned_at: new Date().toISOString(),
      research_notes: `Sitemap-based learning (${sitemapSource})\n${analysis.notes}`,
    };

    const { error: dbError } = await supabase
      .from("vendor_url_patterns")
      .upsert(upsertData, { onConflict: "domain" });

    if (dbError) {
      console.error(`[${domain}] DB error:`, dbError);
      return {
        ...emptyResult,
        error: `Database error: ${dbError.message}`,
        sitemapUrl: sitemapSource,
      };
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[${domain}] Saved successfully (${elapsedMs}ms)`);

    return {
      domain,
      success: true,
      sitemapUrl: sitemapSource,
      stats: {
        urls_found: parsedUrls.length,
        products_detected: analysis.exampleProductUrls.length > 0
          ? parsedUrls.filter((p) => {
              for (const pat of analysis.productPatterns) {
                try {
                  if (new RegExp(pat, "i").test(p.url)) return true;
                } catch { /* skip */ }
              }
              return false;
            }).length
          : 0,
        categories_detected: analysis.exampleCategoryUrls.length > 0
          ? parsedUrls.filter((p) => {
              for (const pat of analysis.categoryPatterns) {
                try {
                  if (new RegExp(pat, "i").test(p.url)) return true;
                } catch { /* skip */ }
              }
              return false;
            }).length
          : 0,
      },
      patterns: {
        product: analysis.productPatterns,
        category: analysis.categoryPatterns,
      },
      confidence: analysis.confidence,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${domain}] Unexpected error:`, error);
    await saveFailed(supabase, domain, error);
    return { ...emptyResult, error };
  }
}

async function saveFailed(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  reason: string
): Promise<void> {
  try {
    const vendorName = domain
      .replace(/\.(com|co\.uk|co|org|net).*$/, "")
      .split(".")
      .pop() || domain;

    await supabase.from("vendor_url_patterns").upsert(
      {
        domain,
        vendor_name: vendorName.charAt(0).toUpperCase() + vendorName.slice(1),
        learning_status: "failed",
        research_notes: `Sitemap learning failed: ${reason}`,
        confidence_score: 0,
      },
      { onConflict: "domain" }
    );
  } catch (e) {
    console.error(`[${domain}] Failed to save failure state:`, e);
  }
}

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  const startTime = Date.now();

  try {
    // Init Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load ScraperAPI key for WAF-blocked sites
    scraperApiKey = Deno.env.get("SCRAPER_API_KEY") || undefined;

    // Parse request
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    // Normalize domains input
    let domains: string[] = [];
    if (body.mode === "process_pending") {
      // Cron mode: fetch all pending domains from the DB
      const batchLimit = body.limit || 20; // Process up to 20 per run
      const { data, error } = await supabase
        .from("vendor_url_patterns")
        .select("domain")
        .eq("learning_status", "pending")
        .order("created_at", { ascending: true })
        .limit(batchLimit);

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch pending domains", details: error.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      domains = (data || []).map((r: any) => r.domain);

      if (domains.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No pending domains to process", summary: { total: 0, learned: 0, failed: 0 } }),
          { status: 200, headers: corsHeaders }
        );
      }

      console.log(`[Cron] Found ${domains.length} pending domains to process`);
    } else if (body.domain) {
      domains = [body.domain];
    } else if (body.domains && Array.isArray(body.domains)) {
      domains = body.domains;
    } else {
      return new Response(
        JSON.stringify({
          error:
            'Missing required field: "domain" (string), "domains" (string[]), or "mode": "process_pending"',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Normalize domains (remove protocol, www, trailing slashes)
    domains = domains.map((d) =>
      d
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, "")
        .toLowerCase()
    );

    console.log(
      `\nStarting sitemap-based pattern learning for ${domains.length} domain(s): ${domains.join(", ")}`
    );
    console.log(`Force re-learn: ${force}`);

    // Process each domain sequentially with a hard timeout wrapper
    // This ensures we mark domains as 'failed' before the gateway kills us (150s limit)
    const HARD_TIMEOUT_MS = PER_DOMAIN_TIMEOUT_MS + 5_000; // 65s per domain
    const FUNCTION_DEADLINE_MS = 140_000; // stop starting new domains at 140s to leave room for response

    const results: DomainResult[] = [];
    for (const domain of domains) {
      // Don't start a new domain if we're near the function deadline
      if (Date.now() - startTime > FUNCTION_DEADLINE_MS) {
        console.log(`[Cron] Function deadline approaching, skipping remaining domains`);
        break;
      }

      let result: DomainResult;
      try {
        result = await Promise.race([
          processDomain(supabase, domain, force),
          new Promise<DomainResult>((_, reject) =>
            setTimeout(() => reject(new Error("Hard timeout")), HARD_TIMEOUT_MS)
          ),
        ]);
      } catch (e) {
        const error = `Domain processing timed out after ${HARD_TIMEOUT_MS / 1000}s`;
        console.error(`[${domain}] ${error}`);
        await saveFailed(supabase, domain, error);
        result = {
          domain,
          success: false,
          error,
          stats: { urls_found: 0, products_detected: 0, categories_detected: 0 },
          patterns: { product: [], category: [] },
          confidence: 0,
        };
      }
      results.push(result);

      // Small delay between domains to be polite
      if (domains.indexOf(domain) < domains.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const summary = {
      total: results.length,
      learned: results.filter((r) => r.success && !r.error).length,
      failed: results.filter((r) => !r.success).length,
      skipped: results.filter(
        (r) => r.success && r.error?.includes("Already learned")
      ).length,
      execution_time_ms: Date.now() - startTime,
    };

    console.log(`\nComplete! ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({ success: true, results, summary }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
