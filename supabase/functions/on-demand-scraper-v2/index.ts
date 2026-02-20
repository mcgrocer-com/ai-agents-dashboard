/**
 * Price Comparison Edge Function v2 - ScraperAPI Edition
 *
 * Uses ScraperAPI for BOTH Google search AND web scraping, replacing:
 * - Serper API (Google search)
 * - RunPod product-checker (browser-based availability checking)
 *
 * ARCHITECTURE:
 * 1. Single Google search via ScraperAPI (num=100) + DB search in parallel
 * 2. Categorize results: priority vendors first, then others
 * 3. AI verifies products (Gemini) with auto-approve for high-similarity DB matches
 * 4. Deduplicate by vendor, filter by confidence
 * 5. Scrape verified product URLs via ScraperAPI for prices + availability
 * 6. Sort by price, return results
 *
 * COST ADVANTAGE: Single API (ScraperAPI) for both search and scraping
 * instead of Serper + RunPod.
 *
 * ENV VARS REQUIRED:
 * - SCRAPER_API_KEY: ScraperAPI key
 * - GEMINI_API_KEY: Google Gemini API key
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isBlockedDomain } from "./blocked-domains.ts";
import { isProductPageUrl, VENDOR_URL_PATTERNS } from "./vendor-url-patterns.ts";

// Cache TTL in hours
const DEFAULT_CACHE_TTL_HOURS = 2;

// ScraperAPI endpoints
const SCRAPERAPI_SEARCH_URL = 'https://api.scraperapi.com/structured/google/search';
const SCRAPERAPI_SCRAPE_URL = 'https://api.scraperapi.com';

// Concurrency limit for ScraperAPI scraping (avoid rate limits)
const SCRAPE_CONCURRENCY = 8;

// Per-scrape timeout
const SCRAPE_TIMEOUT_MS = 30_000;

// Gemini models: flash-lite for high-volume simple tasks, flash-preview for complex extraction
const GEMINI_FAST = 'gemini-2.0-flash-lite';   // verification, availability checks
const GEMINI_SMART = 'gemini-3-flash-preview';  // price extraction from HTML

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

interface ProductResult {
  product_name: string;
  price: number;
  currency: string;
  source_url: string;
  vendor: string;
  confidence: number;
  availability: 'In Stock' | 'Out of Stock' | 'Unsure';
  extraction_method?: 'json-ld' | 'html-parse' | 'ai-html' | 'cached';
  reason?: string;
  last_checked?: string; // ISO timestamp from scraped_products
}

interface SearchResult {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  vendor: string;
  snippet?: string;
  stockStatus?: 'In Stock' | 'Out of Stock' | 'Unsure';
  lastChecked?: string; // ISO timestamp from scraped_products
  fromDb?: boolean; // true if result came from scraped_products table
  similarityScore?: number; // trigram similarity score from DB search (0-1)
}

// ---------------------
// UTILITY FUNCTIONS
// ---------------------

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVendor(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

function isCategoryPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();

    const categoryPatterns = [
      '/c/', '/category/', '/categories/', '/browse/', '/shop/',
      '/s?', '/s/', '/search', '/collection/', '/collections/',
      '/designers/', '/brands/', '/brand/', '/shop-by-brand/',
      '/shop-by/', '/shopping/', '/items.aspx',
    ];

    for (const pattern of categoryPatterns) {
      if (path.includes(pattern)) return true;
    }

    if (urlObj.hostname.includes('amazon') && !path.includes('/dp/') && !path.includes('/gp/product/')) {
      if (path.includes('/s?') || urlObj.searchParams.has('node') || urlObj.searchParams.has('rh')) {
        return true;
      }
    }

    const pathSegments = path.split('/').filter(s => s.length > 0);
    if (pathSegments.length === 1) {
      const segment = pathSegments[0];
      if (/^[a-z-]+$/i.test(segment) && !/\d/.test(segment)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ---------------------
// PRIORITY VENDORS
// ---------------------

const PRIORITY_VENDORS = [
  { name: 'Aptamil', domain: 'aptaclub.co.uk' },
  { name: 'Argos', domain: 'argos.co.uk' },
  { name: 'ASDA', domain: 'asda.com' },
  { name: 'Boots', domain: 'boots.com' },
  { name: 'CafePod', domain: 'cafepod.com' },
  { name: 'Coca-Cola', domain: 'coca-cola.co.uk' },
  { name: 'Costco UK', domain: 'costco.co.uk' },
  { name: 'Harrods', domain: 'harrods.com' },
  { name: 'HiPP', domain: 'hipp.co.uk' },
  { name: 'Holland & Barrett', domain: 'hollandandbarrett.com' },
  { name: 'Iceland', domain: 'iceland.co.uk' },
  { name: 'John Lewis', domain: 'johnlewis.com' },
  { name: 'Kendamil', domain: 'kendamil.com' },
  { name: 'LEGO', domain: 'lego.com' },
  { name: 'Lidl', domain: 'lidl.co.uk' },
  { name: 'Lush', domain: 'lush.com' },
  { name: 'Morrisons', domain: 'morrisons.com' },
  { name: 'M&S', domain: 'marksandspencer.com' },
  { name: 'Next', domain: 'next.co.uk' },
  { name: 'Ocado', domain: 'ocado.com' },
  { name: 'Orientalmart', domain: 'orientalmart.co.uk' },
  { name: "Sainsbury's", domain: 'sainsburys.co.uk' },
  { name: 'Superdrug', domain: 'superdrug.com' },
  { name: 'Tesco', domain: 'tesco.com' },
  { name: 'Waitrose', domain: 'waitrose.com' },
];

const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  'sainsbury': "Sainsbury's",
  'johnlewis': 'John Lewis',
  'm&s': 'M&S',
  'holland&barret': 'Holland & Barrett',
  'superdrug': 'Superdrug',
  'ocado': 'Ocado',
  'next': 'Next',
  'boots': 'Boots',
  'asda': 'ASDA',
  'argos': 'Argos',
  'lego': 'LEGO',
  'costco': 'Costco UK',
  'harrods': 'Harrods',
  'cocacola': 'Coca-Cola',
  'cafepod': 'CafePod',
  'hipp': 'HiPP',
  'waitrose': 'Waitrose',
  'tesco': 'Tesco',
  'morrisons': 'Morrisons',
  'iceland': 'Iceland',
  'lidl': 'Lidl',
  'lush': 'Lush',
  'aptamil': 'Aptamil',
  'kendamil': 'Kendamil',
  'orientalmart': 'Orientalmart',
};

// ---------------------
// CACHE FUNCTIONS
// ---------------------

async function checkCache(
  supabase: any,
  query: string,
  limit: number
): Promise<{ hit: boolean; data?: any }> {
  const queryNormalized = normalizeQuery(query);

  try {
    const { data, error } = await supabase
      .from('price_comparison_cache')
      .select('*')
      .eq('query_normalized', queryNormalized)
      .eq('limit_requested', limit)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log(`[Cache] MISS for "${queryNormalized}" (limit: ${limit})`);
      return { hit: false };
    }

    supabase
      .from('price_comparison_cache')
      .update({ hit_count: (data.hit_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {});

    console.log(`[Cache] HIT for "${queryNormalized}" (hits: ${data.hit_count + 1})`);
    return { hit: true, data };
  } catch (e) {
    console.error('[Cache] Check error:', e);
    return { hit: false };
  }
}

async function writeCache(
  supabase: any,
  query: string,
  limit: number,
  results: any,
  metadata: any
): Promise<void> {
  const queryNormalized = normalizeQuery(query);
  const expiresAt = new Date(Date.now() + DEFAULT_CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  try {
    const { error } = await supabase
      .from('price_comparison_cache')
      .upsert({
        query_normalized: queryNormalized,
        query_original: query,
        limit_requested: limit,
        results,
        metadata,
        expires_at: expiresAt,
        hit_count: 0,
        last_updated: null  // Reset so on-demand-sync-cache picks up new results
      }, {
        onConflict: 'query_normalized,limit_requested'
      });

    if (error) {
      console.error('[Cache] Write error:', error);
    } else {
      console.log(`[Cache] Stored "${queryNormalized}" (expires: ${expiresAt})`);
    }
  } catch (e) {
    console.error('[Cache] Write error:', e);
  }
}

// ---------------------
// LEARNED PATTERNS
// ---------------------

async function loadLearnedPatterns(supabase: any, domains?: string[]): Promise<Map<string, { product: string[], category: string[] }>> {
  try {
    let query = supabase
      .from('vendor_url_patterns')
      .select('domain, product_patterns, category_patterns')
      .eq('learning_status', 'learned');

    if (domains && domains.length > 0) {
      query = query.in('domain', domains);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.log('[Patterns] No learned patterns found');
      return new Map();
    }

    const patternsMap = new Map<string, { product: string[], category: string[], productRegex: RegExp[], categoryRegex: RegExp[] }>();
    for (const row of data) {
      const productStrs = row.product_patterns || [];
      const categoryStrs = row.category_patterns || [];
      // Pre-compile RegExp objects once to avoid repeated compilation per URL check
      const productRegex: RegExp[] = [];
      for (const p of productStrs) {
        try { productRegex.push(new RegExp(p, 'i')); } catch {}
      }
      const categoryRegex: RegExp[] = [];
      for (const c of categoryStrs) {
        try { categoryRegex.push(new RegExp(c, 'i')); } catch {}
      }
      patternsMap.set(row.domain, {
        product: productStrs,
        category: categoryStrs,
        productRegex,
        categoryRegex
      });
    }

    console.log(`[Patterns] Loaded ${patternsMap.size} learned patterns${domains ? ` (for ${domains.length} domains)` : ''}`);
    return patternsMap;
  } catch (e) {
    console.error('[Patterns] Load error:', e);
    return new Map();
  }
}

/** Extract normalized domain from a URL */
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '').replace('groceries.', '');
    const parts = hostname.split('.');
    return parts.length >= 3 && (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'gov')
      ? parts.slice(-3).join('.')
      : parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

// ---------------------
// SCRAPERAPI: GOOGLE SEARCH
// ---------------------

/**
 * Search Google via ScraperAPI structured data endpoint
 * GET https://api.scraperapi.com/structured/google/search?api_key=KEY&query=QUERY&country_code=uk&tld=co.uk&num=10
 */
async function scraperApiSearch(
  apiKey: string,
  query: string,
  num: number = 10
): Promise<any[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: query,
    country_code: 'uk',
    tld: 'co.uk',
    num: String(num),
  });

  const url = `${SCRAPERAPI_SEARCH_URL}?${params.toString()}`;
  console.log(`[ScraperAPI] Search: "${query}" (num: ${num})`);

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[ScraperAPI] Search error: ${res.status} - ${errorText}`);
      return [];
    }

    const data = await res.json();
    return data.organic_results || [];
  } catch (e) {
    console.error(`[ScraperAPI] Search error:`, e);
    return [];
  }
}

/**
 * Single Google search that finds products across ALL vendors at once.
 * Instead of 25 separate searches (one per vendor), we do ONE search with num=100
 * and categorize results into priority vendors vs others.
 *
 * Credit savings: ~96% reduction (1 request instead of 26)
 */
async function searchGoogleOnce(
  apiKey: string,
  product: string,
  supabase: ReturnType<typeof createClient> | null
): Promise<{ priorityResults: SearchResult[]; otherResults: SearchResult[]; learnedPatterns: Map<string, { product: string[], category: string[] }> }> {
  const query = `${product} buy UK`;
  console.log(`[Search] Single search: "${query}" (num: 100)`);

  try {
    const organic = await scraperApiSearch(apiKey, query, 100);

    // Extract unique domains from raw results, then load only those learned patterns
    const domainsInResults = new Set<string>();
    for (const item of organic) {
      if (!item.link) continue;
      const d = extractDomain(item.link);
      if (d) domainsInResults.add(d);
    }

    const learnedPatterns = supabase && domainsInResults.size > 0
      ? await loadLearnedPatterns(supabase, Array.from(domainsInResults))
      : new Map<string, { product: string[], category: string[] }>();

    const priorityResults: SearchResult[] = [];
    const otherResults: SearchResult[] = [];

    for (const item of organic) {
      if (!item.link) continue;
      if (isBlockedDomain(item.link)) continue;
      if (!isProductPageUrl(item.link, isCategoryPage, learnedPatterns)) continue;

      const price = extractPriceFromSearchResult(item);
      let vendor = 'Unknown';
      let isPriority = false;

      try {
        const hostname = new URL(item.link).hostname.toLowerCase();
        const matchedVendor = PRIORITY_VENDORS.find(v => hostname.includes(v.domain.toLowerCase()));
        if (matchedVendor) {
          vendor = matchedVendor.name;
          isPriority = true;
        } else {
          const hostClean = hostname.replace('www.', '');
          const parts = hostClean.split('.');
          const genericSubdomains = ['groceries', 'shop', 'store', 'online', 'uk', 'en'];
          if (parts.length >= 2 && genericSubdomains.includes(parts[0].toLowerCase())) {
            vendor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
          } else {
            vendor = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          }
        }
      } catch {}

      const result: SearchResult = {
        title: item.title || '',
        url: item.link,
        price,
        currency: 'GBP',
        vendor,
        snippet: item.snippet || ''
      };

      if (isPriority) {
        priorityResults.push(result);
      } else {
        otherResults.push(result);
      }
    }

    console.log(`[Search] Single search: ${priorityResults.length} priority + ${otherResults.length} other results`);
    return { priorityResults, otherResults, learnedPatterns };
  } catch (e) {
    console.error(`[Search] Single search error:`, e);
    return { priorityResults: [], otherResults: [], learnedPatterns: new Map() };
  }
}

/**
 * Try to extract price from ScraperAPI search result rich snippets
 * ScraperAPI may include price data in various locations
 */
function extractPriceFromSearchResult(item: any): number | null {
  // Direct price field (if ScraperAPI provides it)
  if (item.price != null) {
    const p = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[£$€,]/g, ''));
    if (!isNaN(p) && p > 0) return p;
  }

  // Check rich_snippet extensions
  const richSnippet = item.rich_snippet;
  if (richSnippet) {
    const extensions = richSnippet.top?.detected_extensions || richSnippet.bottom?.detected_extensions || {};
    if (extensions.price) {
      const p = parseFloat(String(extensions.price).replace(/[£$€,]/g, ''));
      if (!isNaN(p) && p > 0) return p;
    }
  }

  // Check snippet text for price pattern (£X.XX)
  if (item.snippet) {
    const priceMatch = item.snippet.match(/£(\d+(?:\.\d{1,2})?)/);
    if (priceMatch) {
      const p = parseFloat(priceMatch[1]);
      if (!isNaN(p) && p > 0) return p;
    }
  }

  return null;
}


// ---------------------
// SCRAPERAPI: WEB SCRAPING
// ---------------------

/**
 * Extract JSON-LD data from raw HTML
 */
function extractJsonLdFromHtml(html: string): any | null {
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(regex)];

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1].trim());

      // Direct Product type
      if (data['@type'] === 'Product' || data.offers) {
        return data;
      }

      // ProductGroup with hasVariant (e.g. Clarins, sites with size/color variants)
      // Extract the first variant's Product data and merge with group-level info
      if (data['@type'] === 'ProductGroup' && data.hasVariant) {
        const variants = Array.isArray(data.hasVariant) ? data.hasVariant : [data.hasVariant];
        const firstVariant = variants.find((v: any) => v['@type'] === 'Product' && v.offers);
        if (firstVariant) {
          console.log(`[JSON-LD] Found ProductGroup with ${variants.length} variant(s), using first variant`);
          return firstVariant;
        }
      }

      // Array of objects
      if (Array.isArray(data)) {
        const product = data.find((d: any) => d['@type'] === 'Product' || d.offers);
        if (product) return product;
        // Also check for ProductGroup in arrays
        const group = data.find((d: any) => d['@type'] === 'ProductGroup' && d.hasVariant);
        if (group) {
          const variants = Array.isArray(group.hasVariant) ? group.hasVariant : [group.hasVariant];
          const firstVariant = variants.find((v: any) => v['@type'] === 'Product' && v.offers);
          if (firstVariant) return firstVariant;
        }
      }

      // Nested @graph
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const product = data['@graph'].find((d: any) => d['@type'] === 'Product' || d.offers);
        if (product) return product;
        // Also check for ProductGroup in @graph
        const group = data['@graph'].find((d: any) => d['@type'] === 'ProductGroup' && d.hasVariant);
        if (group) {
          const variants = Array.isArray(group.hasVariant) ? group.hasVariant : [group.hasVariant];
          const firstVariant = variants.find((v: any) => v['@type'] === 'Product' && v.offers);
          if (firstVariant) return firstVariant;
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return null;
}

/**
 * Extract price from JSON-LD data
 */
// Accepted currencies for UK price comparison
const ACCEPTED_CURRENCIES = new Set(['GBP']);

function extractPriceFromJsonLd(jsonLd: any): { price: number | null; currency: string | null } {
  if (!jsonLd) return { price: null, currency: null };

  try {
    // Helper to extract price + currency from an offer object
    const fromOffer = (offer: any): { price: number | null; currency: string | null } => {
      const p = parseFloat(String(offer.price));
      const currency = offer.priceCurrency || null;
      if (!isNaN(p) && p > 0) return { price: p, currency };
      return { price: null, currency };
    };

    // Direct offers.price
    if (jsonLd.offers?.price) {
      const result = fromOffer(jsonLd.offers);
      if (result.price !== null) return result;
    }

    // offers array (multiple offers)
    if (Array.isArray(jsonLd.offers)) {
      for (const offer of jsonLd.offers) {
        if (offer.price) {
          const result = fromOffer(offer);
          if (result.price !== null) return result;
        }
      }
    }

    // Offers within offers (some sites nest it)
    if (jsonLd.offers?.offers) {
      const nestedOffers = Array.isArray(jsonLd.offers.offers) ? jsonLd.offers.offers : [jsonLd.offers.offers];
      for (const offer of nestedOffers) {
        if (offer.price) {
          const result = fromOffer(offer);
          if (result.price !== null) return result;
        }
      }
    }

    // lowPrice / highPrice
    if (jsonLd.offers?.lowPrice) {
      const p = parseFloat(String(jsonLd.offers.lowPrice));
      const currency = jsonLd.offers.priceCurrency || null;
      if (!isNaN(p) && p > 0) return { price: p, currency };
    }
  } catch {}

  return { price: null, currency: null };
}

/**
 * Extract availability from JSON-LD data
 */
function extractAvailabilityFromJsonLd(jsonLd: any): 'In Stock' | 'Out of Stock' | 'Unsure' {
  if (!jsonLd) return 'Unsure';

  try {
    const availability = jsonLd.offers?.availability || jsonLd.availability;

    if (!availability) {
      // Check offers array
      if (Array.isArray(jsonLd.offers)) {
        for (const offer of jsonLd.offers) {
          if (offer.availability) {
            return parseAvailabilityString(String(offer.availability));
          }
        }
      }
      return 'Unsure';
    }

    return parseAvailabilityString(String(availability));
  } catch {
    return 'Unsure';
  }
}

function parseAvailabilityString(availStr: string): 'In Stock' | 'Out of Stock' | 'Unsure' {
  const lower = availStr.toLowerCase();
  if (lower.includes('instock') || lower.includes('in_stock') || lower === 'in stock') {
    return 'In Stock';
  }
  if (lower.includes('outofstock') || lower.includes('out_of_stock') ||
      lower.includes('soldout') || lower === 'out of stock') {
    return 'Out of Stock';
  }
  if (lower.includes('preorder') || lower.includes('backorder') || lower.includes('limitedavailability')) {
    return 'In Stock';
  }
  if (lower.includes('discontinued')) {
    return 'Out of Stock';
  }
  return 'Unsure';
}

/**
 * Tier 1 availability check: use Gemini to determine stock status from visible page text.
 * More reliable than JSON-LD which some retailers set incorrectly.
 * Uses a minimal prompt focused only on availability (cheap & fast).
 */
async function checkAvailabilityWithAI(
  geminiKey: string,
  html: string,
  productUrl: string
): Promise<'In Stock' | 'Out of Stock' | 'Unsure'> {
  try {
    const trimmedHtml = trimHtmlForLlm(html, 8000);
    if (trimmedHtml.length < 200) return 'Unsure';

    const prompt = `Is the MAIN product on this page in stock or out of stock?

URL: ${productUrl}

RULES:
- Only consider the MAIN product, ignore related/recommended products
- "Add to Basket/Cart", "Buy Now", "Add" button → In Stock
- "Out of Stock", "Sold Out", "Unavailable", "Notify Me", "Find It For Me" → Out of Stock
- If unclear → Unsure

PAGE CONTENT:
${trimmedHtml}

RESPOND WITH ONLY ONE WORD: InStock, OutOfStock, or Unsure`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FAST}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 10 }
        })
      }
    );

    if (!response.ok) {
      console.error(`[AI-Availability] Gemini error: ${response.status}`);
      return 'Unsure';
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();

    if (text.includes('outofstock') || text.includes('out of stock')) {
      return 'Out of Stock';
    }
    if (text.includes('instock') || text.includes('in stock')) {
      return 'In Stock';
    }
    return 'Unsure';
  } catch (e) {
    console.error(`[AI-Availability] Error for ${productUrl}:`, e);
    return 'Unsure';
  }
}

/**
 * Strip HTML down to essential content for LLM analysis.
 * Removes scripts, styles, SVGs, nav, footer, and collapses whitespace.
 * Keeps a max character budget to stay within token limits.
 */
function trimHtmlForLlm(html: string, maxChars: number = 15000): string {
  let trimmed = html;

  // Remove script, style, svg, noscript blocks
  trimmed = trimmed.replace(/<script[\s\S]*?<\/script>/gi, '');
  trimmed = trimmed.replace(/<style[\s\S]*?<\/style>/gi, '');
  trimmed = trimmed.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  trimmed = trimmed.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Remove nav, header, footer elements
  trimmed = trimmed.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  trimmed = trimmed.replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Remove HTML comments
  trimmed = trimmed.replace(/<!--[\s\S]*?-->/g, '');

  // Remove all tag attributes except key ones (class, id, data-price, itemprop, aria-label)
  trimmed = trimmed.replace(/<([a-z][a-z0-9]*)\s+(?![^>]*(class|id|data-price|itemprop|aria-label))[^>]*>/gi, '<$1>');

  // Strip remaining HTML tags to get text content, but keep structure hints
  // Replace block elements with newlines
  trimmed = trimmed.replace(/<\/(div|p|h[1-6]|li|tr|section|article)>/gi, '\n');
  trimmed = trimmed.replace(/<(br|hr)\s*\/?>/gi, '\n');

  // Remove remaining HTML tags
  trimmed = trimmed.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  trimmed = trimmed.replace(/&pound;/g, '£');
  trimmed = trimmed.replace(/&amp;/g, '&');
  trimmed = trimmed.replace(/&lt;/g, '<');
  trimmed = trimmed.replace(/&gt;/g, '>');
  trimmed = trimmed.replace(/&nbsp;/g, ' ');
  trimmed = trimmed.replace(/&#\d+;/g, '');

  // Collapse whitespace
  trimmed = trimmed.replace(/[ \t]+/g, ' ');
  trimmed = trimmed.replace(/\n\s*\n/g, '\n');
  trimmed = trimmed.trim();

  // Truncate to budget
  if (trimmed.length > maxChars) {
    trimmed = trimmed.substring(0, maxChars) + '\n[...truncated]';
  }

  return trimmed;
}

/**
 * Last-resort extraction: pass trimmed HTML to Gemini to extract price + availability.
 * Only called when JSON-LD and HTML regex parsing both fail.
 */
async function extractWithAI(
  geminiKey: string,
  html: string,
  productUrl: string
): Promise<{
  price: number | null;
  availability: 'In Stock' | 'Out of Stock' | 'Unsure';
  success: boolean;
}> {
  const defaultResult = { price: null, availability: 'Unsure' as const, success: false };

  try {
    const trimmedHtml = trimHtmlForLlm(html);

    // Guard: skip if page content is too thin (likely SPA shell or error page)
    if (trimmedHtml.length < 500) {
      console.log(`[AI-Extract] HTML too short (${trimmedHtml.length} chars) for ${productUrl}, skipping`);
      return defaultResult;
    }

    // Guard: check if any £ price is actually present in the text
    const priceMentions = trimmedHtml.match(/£\d+[.,]?\d*/g) || [];
    if (priceMentions.length === 0) {
      console.log(`[AI-Extract] No £ price found in page text for ${productUrl}, skipping`);
      return defaultResult;
    }

    const prompt = `You are a price extraction specialist. Extract the MAIN product price and stock status from this product page content.

URL: ${productUrl}

CRITICAL RULES:
1. You MUST find an actual £ price displayed on the page. NEVER guess or infer a price.
2. If no clear product price is visible in the content below, you MUST return price as 0.
3. Find the PRIMARY selling price (ignore "was" prices, crossed-out prices, per-unit prices like "per kg")
4. Price must be in GBP (£). The price MUST appear as text in the page content below.
5. For availability: "Add to Basket/Cart", "In Stock", "Buy Now", "Add" button → In Stock
   "Out of Stock", "Sold Out", "Unavailable", "Notify Me" → Out of Stock
   If unclear → Unsure
6. NEVER invent, estimate, or hallucinate a price. Only extract what is explicitly shown.

PAGE CONTENT:
${trimmedHtml}

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{"price": 0, "availability": "Unsure"}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_SMART}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.0, maxOutputTokens: 100 }
        })
      }
    );

    if (!response.ok) {
      console.error(`[AI-Extract] Gemini error: ${response.status}`);
      return defaultResult;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[AI-Extract] No JSON in response for ${productUrl}`);
      return defaultResult;
    }

    const result = JSON.parse(jsonMatch[0]);

    const price = typeof result.price === 'number' && result.price > 0 ? result.price : null;

    // Validation: verify the AI-extracted price actually appears in the page text
    if (price !== null) {
      const priceStr = price.toFixed(2);
      const priceAlt = price % 1 === 0 ? String(price) : priceStr; // e.g. "2" or "1.45"
      const pageHasThatPrice = trimmedHtml.includes(`£${priceStr}`) ||
                               trimmedHtml.includes(`£${priceAlt}`) ||
                               trimmedHtml.includes(`£${price}`);
      if (!pageHasThatPrice) {
        console.warn(`[AI-Extract] Price £${priceStr} NOT found in page text for ${productUrl} — likely hallucinated, rejecting`);
        return defaultResult;
      }
    }

    let availability: 'In Stock' | 'Out of Stock' | 'Unsure' = 'Unsure';
    if (result.availability) {
      const avail = String(result.availability).toLowerCase();
      if (avail.includes('in stock')) availability = 'In Stock';
      else if (avail.includes('out of stock')) availability = 'Out of Stock';
    }

    console.log(`[AI-Extract] price=£${price}, availability=${availability} for ${productUrl}`);
    return { price, availability, success: price !== null };
  } catch (e) {
    console.error(`[AI-Extract] Error for ${productUrl}:`, e);
    return defaultResult;
  }
}

/**
 * SPA detection: check if HTML has meaningful product content.
 * If 2+ signals fire, the page is likely an empty SPA shell.
 */
function isLikelySpaShell(html: string): { isSpa: boolean; signals: string[] } {
  const signals: string[] = [];
  if ((html.match(/£/g) || []).length === 0) signals.push('no_price_symbols');
  if (!/<script[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html)) signals.push('no_json_ld');
  if (!/add to (cart|basket|bag|trolley)/i.test(html)) signals.push('no_add_to_cart');
  const trimmed = trimHtmlForLlm(html, 5000);
  if (trimmed.length < 500) signals.push('trimmed_too_short');
  return { isSpa: signals.length >= 2, signals };
}

/**
 * Fetch HTML via ScraperAPI with SPA auto-detection.
 * Tries basic fetch first (fast/cheap). If the response looks like an empty
 * SPA shell, retries with render=true to execute JavaScript.
 */
async function fetchWithSpaRetry(
  apiKey: string,
  url: string,
  timeoutMs: number = SCRAPE_TIMEOUT_MS
): Promise<{ html: string; renderUsed: boolean } | null> {
  // Attempt 1: basic fetch (no JS rendering — fast & cheap)
  const params = new URLSearchParams({ api_key: apiKey, url });
  const controller1 = new AbortController();
  const t1 = setTimeout(() => controller1.abort(), timeoutMs);

  try {
    const res = await fetch(`${SCRAPERAPI_SCRAPE_URL}?${params.toString()}`, { signal: controller1.signal });
    clearTimeout(t1);

    if (!res.ok) {
      console.error(`[Scrape] Basic fetch error for ${url}: ${res.status}`);
      return null;
    }

    const html = await res.text();
    const spaCheck = isLikelySpaShell(html);

    if (!spaCheck.isSpa) {
      console.log(`[Scrape] Basic fetch OK (${html.length} chars) for ${url}`);
      return { html, renderUsed: false };
    }

    // Attempt 2: SPA detected — retry with render=true
    console.log(`[Scrape] SPA detected (${spaCheck.signals.join(', ')}), retrying with render=true for ${url}`);
    const renderParams = new URLSearchParams({ api_key: apiKey, url, render: 'true' });
    const controller2 = new AbortController();
    const t2 = setTimeout(() => controller2.abort(), timeoutMs);

    const renderRes = await fetch(`${SCRAPERAPI_SCRAPE_URL}?${renderParams.toString()}`, { signal: controller2.signal });
    clearTimeout(t2);

    if (!renderRes.ok) {
      console.error(`[Scrape] Render fetch error for ${url}: ${renderRes.status}, falling back to basic`);
      // Still return the basic HTML — better than nothing
      return { html, renderUsed: false };
    }

    const renderHtml = await renderRes.text();
    console.log(`[Scrape] Render fetch OK (${renderHtml.length} chars) for ${url}`);
    return { html: renderHtml, renderUsed: true };
  } catch (e) {
    clearTimeout(t1);
    if (e instanceof Error && e.name === 'AbortError') {
      console.error(`[Scrape] Timeout for ${url}`);
    } else {
      console.error(`[Scrape] Fetch error for ${url}:`, e);
    }
    return null;
  }
}

/**
 * Scrape a product URL via ScraperAPI and extract price + availability.
 * Uses 3-tier extraction: JSON-LD → HTML regex → AI (Gemini).
 * Automatically detects SPAs and retries with JS rendering.
 */
async function scrapeProductPage(
  apiKey: string,
  url: string,
  geminiKey?: string
): Promise<{
  price: number | null;
  availability: 'In Stock' | 'Out of Stock' | 'Unsure';
  extractionMethod: 'json-ld' | 'html-parse' | 'ai-html' | null;
  success: boolean;
}> {
  const defaultResult = { price: null, availability: 'Unsure' as const, extractionMethod: null, success: false };

  // Strip query params before scraping - many retailers (e.g. Clarins/Demandware)
  // return empty JSON-LD when query params like ?sectionid=bv-reviews are present
  const cleanUrl = normalizeUrl(url);
  const fetchResult = await fetchWithSpaRetry(apiKey, cleanUrl);
  if (!fetchResult) return defaultResult;

  const { html } = fetchResult;
  console.log(`[Scrape] Processing ${html.length} chars for ${url} (render=${fetchResult.renderUsed})`);

  // Tier 1: JSON-LD for price (most reliable for pricing)
  const jsonLd = extractJsonLdFromHtml(html);
  if (jsonLd) {
    const { price, currency } = extractPriceFromJsonLd(jsonLd);

    // Reject non-GBP prices (e.g. iHerb geo-redirecting to NGN, USD, EUR)
    if (price !== null && currency && !ACCEPTED_CURRENCIES.has(currency.toUpperCase())) {
      console.warn(`[Scrape] REJECT non-GBP price: ${currency} ${price} for ${url}`);
      // Fall through to AI extraction which may handle it better
    } else {
      // Use Gemini as Tier 1 for availability — JSON-LD availability is unreliable on some retailers
      let availability: 'In Stock' | 'Out of Stock' | 'Unsure' = 'Unsure';
      if (geminiKey) {
        availability = await checkAvailabilityWithAI(geminiKey, html, url);
        console.log(`[Scrape] JSON-LD price=£${price}, AI availability=${availability} for ${url}`);
      }
      // Fall back to JSON-LD availability if Gemini unavailable or returns Unsure
      if (availability === 'Unsure') {
        availability = extractAvailabilityFromJsonLd(jsonLd);
        console.log(`[Scrape] JSON-LD price=£${price}, JSON-LD availability=${availability} (fallback) for ${url}`);
      }
      return { price, availability, extractionMethod: 'json-ld', success: price !== null };
    }
  }

  // Tier 2: AI extraction (Gemini smart model — extracts price + availability from HTML)
  if (geminiKey) {
    console.log(`[Scrape] No JSON-LD found, trying AI extraction for ${url}`);
    const aiResult = await extractWithAI(geminiKey, html, url);
    if (aiResult.success) {
      return { price: aiResult.price, availability: aiResult.availability, extractionMethod: 'ai-html', success: true };
    }
  }

  console.log(`[Scrape] All extraction methods failed for ${url}`);
  return defaultResult;
}

/**
 * Batch scrape multiple product URLs with concurrency control
 * Replaces RunPod batch product-checker
 */
async function batchScrapeProducts(
  apiKey: string,
  products: ProductResult[],
  supabase?: ReturnType<typeof createClient> | null,
  geminiKey?: string,
  targetCount: number = Infinity,
  isOverDeadline?: () => boolean
): Promise<ProductResult[]> {
  if (products.length === 0) return [];

  const FRESHNESS_THRESHOLD_HOURS = 7 * 24; // 7 days
  const cutoffTime = new Date(Date.now() - FRESHNESS_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

  // Check freshness using last_checked timestamp from DB results
  // Products with a fresh last_checked can skip scraping; stale or missing must be scraped
  const productsWithFreshData: ProductResult[] = [];
  const productsNeedingScrape: ProductResult[] = [];

  for (const product of products) {
    if (product.last_checked && product.last_checked > cutoffTime) {
      // DB product with fresh timestamp - trust the cached data
      console.log(`[Scrape] FRESH (${product.vendor}): last_checked ${product.last_checked} > cutoff ${cutoffTime}`);
      productsWithFreshData.push({ ...product, extraction_method: 'cached' });
    } else if (product.last_checked) {
      // DB product with STALE timestamp - needs re-scraping
      console.log(`[Scrape] STALE (${product.vendor}): last_checked ${product.last_checked} < cutoff ${cutoffTime}`);
      productsNeedingScrape.push(product);
    } else if (product.availability !== 'Unsure') {
      // Non-DB product that already has status from ScraperAPI search (no last_checked)
      // These came from live Google search, not DB - check DB for fresh data
      productsNeedingScrape.push(product);
    } else {
      // No status, no timestamp - needs scraping
      productsNeedingScrape.push(product);
    }
  }

  console.log(`[Scrape] ${productsWithFreshData.length} fresh from DB, ${productsNeedingScrape.length} need scraping`);

  if (productsNeedingScrape.length === 0) {
    return productsWithFreshData;
  }

  // For products needing scrape, check if DB has fresh data before hitting ScraperAPI
  const productsToActuallyScrape: ProductResult[] = [];
  const productsFromDbCache: ProductResult[] = [];

  if (supabase && productsNeedingScrape.length > 0) {
    const normalizedUrls = productsNeedingScrape.map(p => normalizeUrl(p.source_url));

    const { data: freshProducts, error } = await supabase
      .from('scraped_products')
      .select('url, price, original_price, stock_status, scraper_updated_at')
      .in('url', normalizedUrls)
      .gt('scraper_updated_at', cutoffTime);

    if (!error && freshProducts && freshProducts.length > 0) {
      const freshDataMap = new Map<string, { price: number | null; stock_status: string }>();
      for (const fp of freshProducts) {
        freshDataMap.set(normalizeUrl(fp.url), { price: fp.original_price ?? fp.price, stock_status: fp.stock_status });
      }

      for (const product of productsNeedingScrape) {
        const freshData = freshDataMap.get(normalizeUrl(product.source_url));
        if (freshData) {
          const stockStr = (freshData.stock_status || '').toLowerCase();
          const availability: 'In Stock' | 'Out of Stock' | 'Unsure' =
            stockStr.includes('in stock') || stockStr === 'in_stock' ? 'In Stock' :
            stockStr.includes('out of stock') || stockStr === 'out_of_stock' ? 'Out of Stock' : 'Unsure';
          const isPriority = isPriorityVendor(product.vendor);

          if (isPriority && freshData.price !== null) {
            productsFromDbCache.push({ ...product, price: freshData.price, availability, extraction_method: 'cached' });
          } else {
            productsFromDbCache.push({ ...product, availability, extraction_method: 'cached' });
          }
        } else {
          productsToActuallyScrape.push(product);
        }
      }
      console.log(`[Scrape] ${productsFromDbCache.length} from DB cache, ${productsToActuallyScrape.length} need live scraping`);
    } else {
      productsToActuallyScrape.push(...productsNeedingScrape);
    }
  } else {
    productsToActuallyScrape.push(...productsNeedingScrape);
  }

  if (productsToActuallyScrape.length === 0) {
    return [...productsWithFreshData, ...productsFromDbCache];
  }

  // Scrape in batches with concurrency control + early termination
  console.log(`[Scrape] Live scraping ${productsToActuallyScrape.length} products (concurrency: ${SCRAPE_CONCURRENCY}, target: ${targetCount})...`);

  const enrichedProducts: ProductResult[] = [];
  // Count how many products already have prices from fresh/cached data
  let priceCount = [...productsWithFreshData, ...productsFromDbCache].filter(p => p.price > 0).length;

  for (let i = 0; i < productsToActuallyScrape.length; i += SCRAPE_CONCURRENCY) {
    // Early termination: stop if approaching function deadline
    if (isOverDeadline?.()) {
      const remaining = productsToActuallyScrape.length - i;
      console.log(`[Scrape] Deadline approaching, skipping ${remaining} remaining products`);
      enrichedProducts.push(...productsToActuallyScrape.slice(i));
      break;
    }
    // Early termination: stop scraping if we already have enough products with prices
    if (priceCount >= targetCount) {
      const remaining = productsToActuallyScrape.length - i;
      console.log(`[Scrape] Early termination: ${priceCount} products with prices >= target ${targetCount}, skipping ${remaining} remaining`);
      // Add remaining products unsscraped
      enrichedProducts.push(...productsToActuallyScrape.slice(i));
      break;
    }

    const batch = productsToActuallyScrape.slice(i, i + SCRAPE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (product) => {
        const scrapeResult = await scrapeProductPage(apiKey, product.source_url, geminiKey);

        if (scrapeResult.success) {
          const updatedProduct = { ...product };
          if (scrapeResult.availability !== 'Unsure') {
            updatedProduct.availability = scrapeResult.availability;
          }
          // Always use scraped price when available - it's from the actual product page
          // and more reliable than prices from Google search snippets or AI guesses
          if (scrapeResult.price !== null) {
            updatedProduct.price = scrapeResult.price;
          }
          if (scrapeResult.extractionMethod) {
            updatedProduct.extraction_method = scrapeResult.extractionMethod;
          }
          return updatedProduct;
        }

        return product;
      })
    );
    enrichedProducts.push(...batchResults);
    priceCount += batchResults.filter(p => p.price > 0).length;
  }

  const allProducts = [...productsWithFreshData, ...productsFromDbCache, ...enrichedProducts];
  const withAvailability = allProducts.filter(p => p.availability !== 'Unsure').length;
  console.log(`[Scrape] Got availability for ${withAvailability}/${products.length} products`);

  return allProducts;
}

// ---------------------
// SCRAPED PRODUCTS DB
// ---------------------

async function searchScrapedProducts(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  console.log(`[ScrapedProducts] Searching for "${query}" in scraped_products...`);

  try {
    const { data, error } = await supabase.rpc('search_products_similarity', {
      search_query: query,
      result_limit: limit * 3
    });

    if (error) {
      console.log(`[ScrapedProducts] RPC not available, using ILIKE fallback...`);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('scraped_products')
        .select('name, vendor, price, original_price, url, stock_status, scraper_updated_at')
        .ilike('name', `%${query}%`)
        .gt('price', 0)
        .or('rejected.is.null,rejected.eq.false')
        .limit(limit * 3);

      if (fallbackError) {
        console.error(`[ScrapedProducts] Fallback error:`, fallbackError);
        return [];
      }

      return (fallbackData || []).map((item: any) => {
        const stockStr = (item.stock_status || '').toLowerCase();
        const stockStatus: 'In Stock' | 'Out of Stock' | 'Unsure' =
          stockStr.includes('in stock') || stockStr === 'in_stock' ? 'In Stock' :
          stockStr.includes('out of stock') || stockStr === 'out_of_stock' ? 'Out of Stock' : 'Unsure';

        return {
          title: item.name,
          url: item.url,
          price: parseFloat(item.original_price) || parseFloat(item.price) || null,
          currency: 'GBP',
          vendor: VENDOR_DISPLAY_NAMES[item.vendor?.toLowerCase()] ||
                  (item.vendor ? item.vendor.charAt(0).toUpperCase() + item.vendor.slice(1) : 'Unknown'),
          snippet: `Stock: ${item.stock_status || 'Unknown'}`,
          stockStatus,
          lastChecked: item.scraper_updated_at || null,
          fromDb: true
        };
      });
    }

    const results: SearchResult[] = (data || []).map((item: any) => {
      const stockStr = (item.stock_status || '').toLowerCase();
      const stockStatus: 'In Stock' | 'Out of Stock' | 'Unsure' =
        stockStr.includes('in stock') || stockStr === 'in_stock' ? 'In Stock' :
        stockStr.includes('out of stock') || stockStr === 'out_of_stock' ? 'Out of Stock' : 'Unsure';

      return {
        title: item.name,
        url: item.url,
        price: parseFloat(item.original_price) || parseFloat(item.price) || null,
        currency: 'GBP',
        vendor: resolveVendor(item.vendor, item.url),
        snippet: `Stock: ${item.stock_status || 'Unknown'} | Score: ${(item.score * 100).toFixed(0)}%`,
        stockStatus,
        lastChecked: item.scraper_updated_at || null,
        fromDb: true,
        similarityScore: item.score || 0
      };
    });

    // Exclude own company products
    const filtered = results.filter(r => !r.vendor.toLowerCase().includes('mcgrocer'));
    console.log(`[ScrapedProducts] Found ${results.length} products (${results.length - filtered.length} excluded as own company)`);
    return filtered;
  } catch (e) {
    console.error(`[ScrapedProducts] Error:`, e);
    return [];
  }
}

// ---------------------
// FILTERING HELPERS
// ---------------------

function filterBlockedSearchResults(results: SearchResult[]): { filtered: SearchResult[]; blockedCount: number } {
  const filtered = results.filter(r => !isBlockedDomain(r.url));
  const blockedCount = results.length - filtered.length;
  if (blockedCount > 0) {
    console.log(`[Filter] Removed ${blockedCount} blocked domains`);
  }
  return { filtered, blockedCount };
}

function filterByConfidence(products: ProductResult[], minConfidence: number): { filtered: ProductResult[]; removedCount: number } {
  const filtered = products.filter(p => p.confidence >= minConfidence);
  const removedCount = products.length - filtered.length;
  if (removedCount > 0) {
    console.log(`[Filter] Removed ${removedCount} results with confidence < ${minConfidence * 100}%`);
  }
  return { filtered, removedCount };
}

/**
 * Resolve vendor display name from raw vendor string and URL.
 * Tries VENDOR_DISPLAY_NAMES lookup, then PRIORITY_VENDORS domain match, then capitalizes.
 */
function resolveVendor(vendor: string, url: string): string {
  // Try display name lookup first
  const normalized = (vendor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (VENDOR_DISPLAY_NAMES[normalized]) {
    return VENDOR_DISPLAY_NAMES[normalized];
  }

  // Try matching URL against priority vendor domains
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const matched = PRIORITY_VENDORS.find(v => hostname.includes(v.domain.toLowerCase()));
    if (matched) return matched.name;
  } catch {}

  // Fallback: capitalize
  if (vendor) {
    return vendor.charAt(0).toUpperCase() + vendor.slice(1);
  }
  return 'Unknown';
}

function isPriorityVendor(vendorName: string): boolean {
  const normalizedVendor = vendorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PRIORITY_VENDORS.some(pv => {
    const normalizedPriority = pv.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedVendor.includes(normalizedPriority) || normalizedPriority.includes(normalizedVendor);
  });
}

// ---------------------
// MULTIPACK DETECTION
// ---------------------

const MULTIPACK_PATTERNS = /\b(\d+)\s*x\s*\d+|\b(\d+)\s*pack\b|multipack|multi-pack|\bcase of\b|\bbox of\b|\bbundle of\b/i;
const MULTIPACK_QUERY_PATTERNS = /\d+\s*x\s*\d+|\bpack\b|\bmultipack\b|\bmulti-pack\b|\bcase\b|\bbox\b|\bbundle\b/i;

/**
 * Detect if a product is a multipack when the query is for a single item.
 * Checks both title and URL for multipack indicators.
 * Returns true if the result should be REJECTED (is a multipack but query is single).
 */
function isMultipackMismatch(queryText: string, resultTitle: string, resultUrl?: string): boolean {
  const queryHasMultipack = MULTIPACK_QUERY_PATTERNS.test(queryText);
  if (queryHasMultipack) return false; // Query is for a multipack, allow multipack results

  // Check title for multipack patterns
  const titleMatch = resultTitle.match(MULTIPACK_PATTERNS);
  if (titleMatch) {
    const qty = parseInt(titleMatch[1] || titleMatch[2] || '0');
    if (qty > 1) return true;
  }

  // Check URL for multipack patterns (e.g., "12x60g" in slug)
  if (resultUrl) {
    const urlMultipackMatch = resultUrl.match(/(\d+)x\d+g/i);
    if (urlMultipackMatch) {
      const qty = parseInt(urlMultipackMatch[1]);
      if (qty > 1) return true;
    }
  }

  return false;
}

// ---------------------
// AI VERIFICATION (Gemini)
// ---------------------

/**
 * Lightweight verification for DB products — we already know the URL is a valid product page.
 * Only checks if the product name/details are an exact match to the query.
 */
async function verifyDbProduct(
  geminiKey: string,
  userQuery: string,
  description: string,
  result: SearchResult
): Promise<ProductResult | null> {
  const descriptionContext = description
    ? `\nPRODUCT DESCRIPTION: "${description}"\n`
    : '';

  const prompt = `Does this product from our database match the user's query? It must be the SAME specific product, not just the same brand.

USER QUERY: "${userQuery}"
${descriptionContext}
DATABASE PRODUCT:
- Name: "${result.title}"
- Vendor: ${result.vendor}

RULES:
1. The product name must refer to the SAME specific product, not just the same brand. "Wasabi Mix" ≠ "Wasabi Peanut Crunch" — different products from same brand = REJECT
2. Minor wording variations across retailers are OK (e.g. "Ready to Feed from Birth" = "From Birth Ready To Feed")
3. SIZE/WEIGHT IS CRITICAL: If the query specifies a size (e.g. "800g", "1L"), the product MUST have the same or very similar size. "800g" ≠ "125g" = REJECT. Only accept if sizes match or query has no size specified.
4. Multi-pack vs single must match (e.g. "4x200ml" ≠ "200ml") = REJECT
5. Variant/shade/color must match if specified in the query

RESPOND WITH ONLY ONE OF:
A) If match: {"match": true, "product_name": "...", "confidence": 0.9, "reason": "explanation"}
B) If NOT a match: {"match": false, "reason": "why it doesn't match"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FAST}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
        })
      }
    );

    if (!response.ok) {
      console.error(`[AI-DB] Verification failed for ${result.vendor}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonText = objectMatch[0];

    const aiResult = JSON.parse(jsonText);

    if (aiResult.match) {
      const availability = result.stockStatus || 'Unsure';
      console.log(`[AI-DB] ✓ ${result.vendor}: matched (confidence ${aiResult.confidence}), stock: ${availability}`);
      return {
        product_name: aiResult.product_name || result.title,
        price: result.price || 0,
        currency: 'GBP',
        source_url: result.url,
        vendor: result.vendor,
        confidence: aiResult.confidence || 0.7,
        availability,
        reason: aiResult.reason || 'DB product verified',
        last_checked: result.lastChecked || undefined
      };
    } else {
      console.log(`[AI-DB] ✗ ${result.vendor}: rejected - ${aiResult.reason}`);
      return null;
    }
  } catch (e) {
    console.error(`[AI-DB] Error verifying ${result.vendor}:`, e);
    return null;
  }
}

async function verifySingleProduct(
  geminiKey: string,
  userQuery: string,
  description: string,
  result: SearchResult
): Promise<ProductResult | null> {
  const descriptionContext = description
    ? `\nPRODUCT DESCRIPTION (use this to help identify the correct product):\n"${description}"\n`
    : '';

  const priceContext = result.price != null ? `- Price from search: £${result.price}\n` : '';

  const prompt = `You are a STRICT product matching assistant. Your job is to verify if search results are THE EXACT SAME product the user is looking for. Be STRICT - only accept exact matches.

USER QUERY: "${userQuery}"
${descriptionContext}
SEARCH RESULT:
- Vendor: ${result.vendor}
- Search Title: "${result.title}"
- URL: ${result.url}
${priceContext}${result.snippet ? `- Snippet: "${result.snippet}"` : ''}

CRITICAL MATCHING RULES:

1. VARIANT/SHADE/COLOR MATCHING (STRICTEST RULE):
   - If query contains a shade code (e.g., "12N", "9N", "8.5C", "01", "Fair"), the product MUST have the EXACT same shade
   - "12N Ebony" ≠ "9N Truffle" - these are COMPLETELY DIFFERENT products, REJECT
   - "Shade 01" ≠ "Shade 02" - REJECT
   - "Rose Gold" ≠ "Silver" - REJECT
   - "Size M" ≠ "Size L" - REJECT

2. SIZE/WEIGHT MATCHING:
   - If query has a size (e.g., "450g", "2L"), it MUST match exactly
   - 450g ≠ 475g, 2L ≠ 1.5L - REJECT
   - Multi-pack vs single: "415g" ≠ "4x415g" - REJECT

3. PRODUCT MATCHING:
   - Brand and product type must match
   - REJECT accessories, cases, or related items

4. URL VALIDATION:
   - REJECT category pages (/c/, /category/, /browse/, /shop/, /search)

5. PRICE: Set "price" to null. Do NOT guess or invent a price. The price will be extracted separately by scraping.

RESPOND WITH ONLY ONE OF:
A) If EXACT match: {"match": true, "product_name": "...", "price": null, "confidence": 0.9, "reason": "explanation"}
B) If NOT exact match: {"match": false, "reason": "why it doesn't match"}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FAST}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.error(`[AI] Verification failed for ${result.vendor}: ${response.status} - ${errorBody.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.error(`[AI] Empty response for ${result.vendor}: ${JSON.stringify(data).substring(0, 300)}`);
      return null;
    }

    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonText = objectMatch[0];

    const aiResult = JSON.parse(jsonText);

    if (aiResult.match) {
      const availability = result.stockStatus || 'Unsure';
      console.log(`[AI] ✓ ${result.vendor}: matched with confidence ${aiResult.confidence}, stock: ${availability}, lastChecked: ${result.lastChecked || 'N/A'}`);
      return {
        product_name: aiResult.product_name || result.title,
        price: typeof aiResult.price === 'number' ? aiResult.price : (result.price || 0),
        currency: 'GBP',
        source_url: result.url,
        vendor: result.vendor,
        confidence: aiResult.confidence || 0.7,
        availability,
        reason: aiResult.reason || 'Product verified by AI',
        last_checked: result.lastChecked || undefined
      };
    } else {
      console.log(`[AI] ✗ ${result.vendor}: rejected - ${aiResult.reason}`);
      return null;
    }
  } catch (e) {
    console.error(`[AI] Error verifying ${result.vendor}:`, e);
    return null;
  }
}

/**
 * Batch-verify up to BATCH_SIZE products in a single Gemini call.
 * Returns verified ProductResult[] for matches.
 */
async function verifyWithAI(
  geminiKey: string,
  userQuery: string,
  description: string,
  results: SearchResult[],
  _limit: number
): Promise<ProductResult[]> {
  if (results.length === 0) return [];

  // Filter out multipack results when query is for a single item
  const preFilterCount = results.length;
  const filtered = results.filter(r => {
    if (isMultipackMismatch(userQuery, r.title, r.url)) {
      console.log(`[AI] MULTIPACK REJECTED: "${r.title}" (${r.vendor}) — query is for single item`);
      return false;
    }
    return true;
  });
  if (filtered.length < preFilterCount) {
    console.log(`[AI] Multipack filter removed ${preFilterCount - filtered.length} results`);
  }

  const dbResults = filtered.filter(r => r.fromDb);
  const searchResults = filtered.filter(r => !r.fromDb);
  console.log(`[AI] Verifying ${filtered.length} products (${dbResults.length} DB, ${searchResults.length} search)...`);

  // Auto-approve high-confidence DB results without Gemini (similarity >= 0.85)
  const HIGH_SIMILARITY_THRESHOLD = 0.85;
  const autoApproved: ProductResult[] = [];
  const dbNeedingVerification: SearchResult[] = [];

  for (const r of dbResults) {
    if (r.similarityScore && r.similarityScore >= HIGH_SIMILARITY_THRESHOLD) {
      console.log(`[AI] AUTO-APPROVED ${r.vendor}: "${r.title}" (similarity: ${(r.similarityScore * 100).toFixed(0)}%)`);
      autoApproved.push({
        product_name: r.title,
        price: r.price || 0,
        currency: 'GBP',
        source_url: r.url,
        vendor: r.vendor,
        confidence: r.similarityScore,
        availability: r.stockStatus || 'Unsure',
        reason: `Auto-approved: ${(r.similarityScore * 100).toFixed(0)}% name similarity`,
        last_checked: r.lastChecked || undefined
      });
    } else {
      dbNeedingVerification.push(r);
    }
  }

  console.log(`[AI] ${autoApproved.length} DB products auto-approved, ${dbNeedingVerification.length} DB + ${searchResults.length} search need Gemini verification`);

  // Batch Gemini calls to avoid rate limiting (max 10 concurrent, 500ms between batches)
  const GEMINI_BATCH_SIZE = 10;
  const GEMINI_BATCH_DELAY_MS = 500;

  const allToVerify: { result: SearchResult; isDb: boolean }[] = [
    ...dbNeedingVerification.map(r => ({ result: r, isDb: true })),
    ...searchResults.map(r => ({ result: r, isDb: false }))
  ];

  const aiVerified: ProductResult[] = [];

  for (let i = 0; i < allToVerify.length; i += GEMINI_BATCH_SIZE) {
    const batch = allToVerify.slice(i, i + GEMINI_BATCH_SIZE);
    const batchPromises = batch.map(({ result: r, isDb }) =>
      isDb
        ? verifyDbProduct(geminiKey, userQuery, description, r)
        : verifySingleProduct(geminiKey, userQuery, description, r)
    );
    const batchResults = await Promise.all(batchPromises);
    const batchVerified = batchResults.filter((r): r is ProductResult => r !== null);
    aiVerified.push(...batchVerified);
    console.log(`[AI] Batch ${Math.floor(i / GEMINI_BATCH_SIZE) + 1}: ${batchVerified.length}/${batch.length} verified`);

    // Delay between batches to avoid rate limits
    if (i + GEMINI_BATCH_SIZE < allToVerify.length) {
      await new Promise(resolve => setTimeout(resolve, GEMINI_BATCH_DELAY_MS));
    }
  }

  const verified = [...autoApproved, ...aiVerified];
  console.log(`[AI] Verified ${verified.length}/${results.length} products (${autoApproved.length} auto-approved, ${aiVerified.length} AI-verified)`);
  return verified;
}

// ---------------------
// MAIN ORCHESTRATION
// ---------------------

interface FindProductsResult {
  products: ProductResult[];
  products_without_price: ProductResult[];
  debug: {
    scraped_products_found: number;
    scraped_products_verified: number;
    scraped_vendors: string[];
    scraperapi_vendors_searched: number;
    priority_results: number;
    after_dedup: number;
    before_ai: number;
    after_ai: number;
    filtered_low_confidence: number;
    fallback_results: number;
    vendors_before_ai: string[];
    scrape_results: number;
  };
}

// Global deadline: return partial results before Supabase's 150s hard timeout
const FUNCTION_DEADLINE_MS = 120_000; // 120s (30s buffer before 150s limit)

async function findProducts(
  geminiKey: string,
  scraperApiKey: string,
  userQuery: string,
  limit: number,
  description: string = '',
  supabase?: ReturnType<typeof createClient> | null,
  startTime: number = Date.now()
): Promise<FindProductsResult> {
  const isOverDeadline = () => Date.now() - startTime > FUNCTION_DEADLINE_MS;

  function buildPartialResult(
    products: ProductResult[],
    debugInfo: FindProductsResult['debug']
  ): FindProductsResult {
    const withPrice = products.filter(p => p.price > 0);
    const withoutPrice = products.filter(p => p.price === 0 || p.price === null);
    withPrice.sort((a, b) => a.price - b.price);
    console.log(`[Main] Returning partial: ${withPrice.length} with prices, ${withoutPrice.length} without`);
    return { products: withPrice.slice(0, limit), products_without_price: withoutPrice, debug: debugInfo };
  }
  const debug: FindProductsResult['debug'] = {
    scraped_products_found: 0,
    scraped_products_verified: 0,
    scraped_vendors: [],
    scraperapi_vendors_searched: 0,
    priority_results: 0,
    after_dedup: 0,
    before_ai: 0,
    after_ai: 0,
    filtered_low_confidence: 0,
    fallback_results: 0,
    vendors_before_ai: [],
    scrape_results: 0,
  };

  // STEP 1 + 2: Run DB search and single Google search IN PARALLEL
  let verified: ProductResult[] = [];
  const seenVendors = new Map<string, SearchResult>();

  console.log(`[Main] STEP 1+2: Running DB search and single Google search in parallel...`);

  // Launch both searches simultaneously
  const dbSearchPromise = supabase
    ? searchScrapedProducts(supabase, userQuery, limit)
    : Promise.resolve([] as SearchResult[]);

  const googleSearchPromise = searchGoogleOnce(scraperApiKey, userQuery, supabase);

  const [scrapedResults, { priorityResults, otherResults, learnedPatterns }] = await Promise.all([dbSearchPromise, googleSearchPromise]);

  // Combine Google results: priority vendors first, then others as fill
  const rawSearchResults = [...priorityResults, ...otherResults];

  debug.scraped_products_found = scrapedResults.length;
  debug.scraperapi_vendors_searched = 1; // Single Google search
  debug.priority_results = priorityResults.length;
  debug.fallback_results = otherResults.length;

  debug.scraped_vendors = scrapedResults.map(r => normalizeVendor(r.vendor));

  // Filter blocked domains from both sets separately
  const filteredDb = filterBlockedSearchResults(scrapedResults).filtered;
  const filteredSearch = filterBlockedSearchResults(rawSearchResults).filtered;
  debug.before_ai = filteredDb.length + filteredSearch.length;
  debug.vendors_before_ai = [
    ...filteredDb.map((r: SearchResult) => `[DB] ${r.vendor}: £${r.price ?? 'N/A'}`),
    ...filteredSearch.map((r: SearchResult) => `[Search] ${r.vendor}: £${r.price ?? 'N/A'}`),
  ];

  console.log(`[Main] After block filter: ${filteredDb.length} DB + ${filteredSearch.length} search (${priorityResults.length} priority, ${otherResults.length} other)`);

  // Queue unknown domains for background pattern learning (fire-and-forget)
  if (supabase && filteredSearch.length > 0) {
    const unknownDomains = new Set<string>();
    for (const r of filteredSearch) {
      const domain = extractDomain(r.url);
      if (!domain) continue;
      const hostname = new URL(r.url).hostname.toLowerCase().replace('www.', '').replace('groceries.', '');
      const hasStatic = Object.keys(VENDOR_URL_PATTERNS).some(d => hostname.includes(d));
      const hasLearned = learnedPatterns.has(domain);
      if (!hasStatic && !hasLearned) unknownDomains.add(domain);
    }
    if (unknownDomains.size > 0) {
      console.log(`[Search] Queuing ${unknownDomains.size} unknown domains for background learning: ${Array.from(unknownDomains).join(', ')}`);
      const rows = Array.from(unknownDomains).map(d => ({
        domain: d,
        vendor_name: d.split('.')[0],
        learning_status: 'pending',
      }));
      supabase
        .from('vendor_url_patterns')
        .upsert(rows, { onConflict: 'domain', ignoreDuplicates: true })
        .then(({ error: upsertErr }: { error: any }) => {
          if (upsertErr) console.error('[Search] Failed to queue domains:', upsertErr.message);
        });
    }
  }

  if (isOverDeadline()) {
    console.log(`[Main] DEADLINE reached after search (${((Date.now() - startTime) / 1000).toFixed(1)}s), returning partial results`);
    return buildPartialResult(verified, debug);
  }

  // VERIFY with AI, then dedup by vendor
  // Combine all results into a single verification call to ensure proper Gemini batching
  const allToVerify = [...filteredDb, ...filteredSearch];
  const allVerifiedFromAI = allToVerify.length > 0
    ? await verifyWithAI(geminiKey, userQuery, description, allToVerify, limit + 10)
    : [];

  // Split back to get DB-specific count for debug
  const dbVerifiedUrls = new Set(filteredDb.map(r => r.url));
  const dbVerified = allVerifiedFromAI.filter(r => dbVerifiedUrls.has(r.source_url));
  const searchVerified = allVerifiedFromAI.filter(r => !dbVerifiedUrls.has(r.source_url));

  debug.scraped_products_verified = dbVerified.length;
  debug.after_ai = allVerifiedFromAI.length;

  // Dedup AFTER verification: prefer DB results (they already have prices/stock)
  const allVerified = [...dbVerified, ...searchVerified];
  const confidenceFilter = filterByConfidence(allVerified, 0.7);
  debug.filtered_low_confidence = confidenceFilter.removedCount;

  for (const result of confidenceFilter.filtered) {
    const vendorKey = normalizeVendor(result.vendor);
    if (!seenVendors.has(vendorKey)) {
      seenVendors.set(vendorKey, result as any);
      verified.push(result);
    }
  }
  console.log(`[Main] Verified ${verified.length} products (${dbVerified.length} from DB, ${searchVerified.length} from search, after dedup)`);

  // STEP 3: Scrape verified product URLs for prices + availability
  if (isOverDeadline()) {
    console.log(`[Main] DEADLINE reached before STEP 3 (${((Date.now() - startTime) / 1000).toFixed(1)}s), returning partial results`);
    return buildPartialResult(verified, debug);
  }
  console.log(`[Main] STEP 3: Scraping ${verified.length} verified products for prices + availability...`);
  const enrichedProducts = await batchScrapeProducts(scraperApiKey, verified, supabase, geminiKey, limit, isOverDeadline);
  debug.scrape_results = enrichedProducts.filter(p => p.price > 0).length;

  // Separate products with and without prices
  const productsWithPrice = enrichedProducts.filter(p => p.price > 0);
  const productsWithoutPrice = enrichedProducts.filter(p => p.price === 0 || p.price === null);

  // Sort: priority vendors first, then by price
  productsWithPrice.sort((a, b) => {
    const aIsPriority = isPriorityVendor(a.vendor);
    const bIsPriority = isPriorityVendor(b.vendor);
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    return a.price - b.price;
  });
  const limitedProducts = productsWithPrice.slice(0, limit);

  console.log(`[Main] Final: ${limitedProducts.length} with prices, ${productsWithoutPrice.length} without prices`);

  return {
    products: limitedProducts,
    products_without_price: productsWithoutPrice,
    debug
  };
}

// ---------------------
// MAIN HANDLER
// ---------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  const startTime = Date.now();

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const scraperApiKey = Deno.env.get('SCRAPER_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiKey || !scraperApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API keys not configured (GEMINI_API_KEY and SCRAPER_API_KEY required)' }),
        { status: 500, headers: corsHeaders }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { query, description = '', bypass_cache = false } = body;
    const limit = Math.min(Math.max(1, Number(body.limit) || 5), 20);

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing query' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (query.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query too long (max 200 characters)' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[PriceComparisonV2] Query: "${query}", Description: "${(description || 'none').substring(0, 50)}", Limit: ${limit}, BypassCache: ${bypass_cache}`);

    const supabase = supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;

    // Check cache first
    if (supabase && !bypass_cache) {
      const cacheResult = await checkCache(supabase, query, limit);
      if (cacheResult.hit && cacheResult.data) {
        const executionTime = (Date.now() - startTime) / 1000;
        return new Response(
          JSON.stringify({
            success: true,
            products: cacheResult.data.results,
            metadata: {
              ...cacheResult.data.metadata,
              cache_hit: true,
              cache_age_seconds: Math.round((Date.now() - new Date(cacheResult.data.created_at).getTime()) / 1000),
              execution_time: executionTime
            },
            debug: { cache_hit: true, hit_count: cacheResult.data.hit_count + 1 }
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // Execute search
    const result = await findProducts(geminiKey, scraperApiKey, query, limit, description, supabase, startTime);

    const executionTime = (Date.now() - startTime) / 1000;

    const metadata = {
      query,
      description: description || null,
      limit,
      results_count: result.products.length,
      execution_time: executionTime,
      method: 'scraperapi-v2',
      timestamp: new Date().toISOString(),
      cache_hit: false,
    };

    // Write to cache (awaited to prevent GC from killing the write)
    if (supabase && result.products.length > 0) {
      await writeCache(supabase, query, limit, result.products, metadata);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products: result.products,
        products_without_price: result.products_without_price,
        metadata,
        debug: result.debug
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[PriceComparisonV2] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { execution_time: (Date.now() - startTime) / 1000 }
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
