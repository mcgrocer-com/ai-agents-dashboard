/**
 * Price Comparison Edge Function v34 - Batch API & 6-Browser Parallelism
 *
 * Uses Serper Search API with "{product} {vendor} product page" query format
 * to get direct retailer URLs with prices in a single step.
 *
 * ARCHITECTURE:
 * 1. Search priority vendors in parallel (filter: GBP currency, blocked domains, product pages)
 * 2. Deduplicate by vendor
 * 3. AI verifies EACH product using search results (no scraping needed)
 * 4. Filter by 90%+ confidence
 * 5. Fallback broader search if needed (same filters applied)
 * 6. Enrich ALL products with availability via batch product-checker API (6 parallel browsers)
 * 7. Sort by price, return results
 *
 * v34 CHANGES:
 * - Switched to batch API endpoint (/check-batch) for product-checker calls
 * - Increased parallelism from 4 to 6 browsers
 * - Reduced timeout from 90s to 60s (batch is faster)
 * - Single API call for all products instead of N individual calls
 * - Expected speedup: ~40% faster execution time
 *
 * v33 CHANGES:
 * - AI now skeptical of search titles (can have wrong/outdated sizes)
 * - Requires size confirmation from URL or snippet, not just title
 * - Added common UK grocery size knowledge (HP Sauce: 450g/600g/285g, NOT 475g)
 * - Adjusted confidence: 0.9 only if size verified in URL/snippet
 * - If query has size but can't verify exact match, AI rejects
 *
 * v32 CHANGES:
 * - Added strict currency filtering - only GBP results allowed
 * - Rejects results with currency field != GBP (e.g., PLN, USD, EUR)
 * - Added 60+ social media, news, review, and classified sites to blocklist
 * - Blocks: Facebook, Instagram, Twitter, Pinterest, Reddit, YouTube, etc.
 * - Blocks: TheSun, DailyMail, BBC, Guardian, etc.
 * - Blocks: Trustpilot, Gumtree, Vinted, Depop, etc.
 *
 * v31 CHANGES:
 * - REMOVED pre-scraping step (STEP 4 in v30) to save Serper credits
 * - AI verification now uses search title/URL/snippet only (no JSON-LD)
 * - Scraping ONLY happens as fallback in enrichProductsWithChecker
 * - Much faster execution (no scraping delay for all results)
 *
 * v30 CHANGES:
 * - Added product-checker API for availability status (not price - Serper price is more accurate)
 * - Stagehand + Gemini Vision gets real-time stock status from browser
 * - Product-checker API runs on RunPod (hardcoded URL: lkzqju0uvvpqa2-3003.proxy.runpod.net)
 *
 * v29 CHANGES:
 * - Separate products without prices into `products_without_price` array
 * - Main `products` array only contains items with valid prices (price > 0)
 * - Provides transparency: users can see products found but without price data
 * - Better UX: main results are clean and sortable by price
 *
 * v28 CHANGES:
 * - Context-aware pattern learning: Uses actual user query (e.g., "leather boots")
 * - Strategy 0: site:domain {user_query} (NEW - highest relevance)
 * - Searches for products user is ACTUALLY looking for, not generic terms
 * - Much more likely to find relevant product pages for difficult vendors
 * - Example: "site:dunelondon.com leather boots" vs "site:dunelondon.com product"
 *
 * v27 CHANGES:
 * - Multi-strategy search for pattern learning (fixes category page issue)
 * - Strategy 1: "add to bag" OR "add to cart" (highest precision)
 * - Strategy 2: price/buy keywords with category exclusions
 * - Strategy 3: Fallback to original "product" query
 * - Prioritizes URLs with prices in Serper response (strong product signal)
 * - Expected improvement: 50% → 75-85% vendor learning success rate
 *
 * v26 CHANGES:
 * - Integrated synchronous pattern learning (3-7s one-time delay for new vendors)
 * - Learn patterns BEFORE filtering, use immediately in same request
 * - Removed fire-and-forget async learning (simpler UX, no retry needed)
 * - Patterns available immediately for current search, cached for future searches
 *
 * v25 CHANGES:
 * - Self-learning URL pattern system for unknown vendors
 * - Loads learned patterns from vendor_url_patterns table in Supabase
 * - learn-vendor-patterns endpoint researches and saves URL patterns
 * - System gets smarter over time without manual pattern updates
 *
 * v24 CHANGES:
 * - Removed price requirement from broader search filter
 * - Broader search now scrapes ALL product page URLs (not just ones with prices)
 * - Fixes issue where fashion/specialty retailers don't expose prices in Serper
 * - Scraper extracts prices from JSON-LD for these retailers
 *
 * v23 CHANGES:
 * - Added vendor URL pattern validation for 27 retailers
 * - Product/category URL templates per vendor (fast regex pre-filter)
 * - Rejects category pages BEFORE expensive scraping/AI calls
 * - Falls back to generic detection for broader search results
 * - Excluded own company (mcgrocer.com) from comparison results
 *
 * v22 CHANGES:
 * - Added optional `description` field to request body
 * - AI uses description for precise matching (model numbers, variants, sizes)
 * - Description passed through entire verification pipeline
 * - Metadata now includes description for logging/debugging
 *
 * v21 CHANGES:
 * - Expanded BLOCKED_DOMAINS from 14 to 105+ sites
 * - Organized blocklist by category for maintainability
 *
 * GOAL: Find best prices from priority vendors, fallback to broader UK retailers
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isBlockedDomain } from "./blocked-domains.ts";
import { isProductPageUrl, VENDOR_URL_PATTERNS } from "./vendor-url-patterns.ts";
import { getOrLearnPatterns } from "./vendor-patterns.ts";

// Custom error for Serper credit exhaustion - triggers fallback to secondary key
class SerperCreditsExhaustedError extends Error {
  constructor(message: string = 'Serper API credits exhausted') {
    super(message);
    this.name = 'SerperCreditsExhaustedError';
  }
}

// Cache TTL in hours
const DEFAULT_CACHE_TTL_HOURS = 2;

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
  extraction_method?: 'css' | 'ai' | 'cached'; // How availability/price was extracted
  reason?: string; // AI verification reason explaining why this product matched
}

interface SearchResult {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  vendor: string;
  snippet?: string;
  // Raw scraped data for AI to reason through
  rawJsonLd?: any | null;
  scrapedPrice?: number | null;
}

interface ScrapeResult {
  url: string;
  rawJsonLd: any | null;
  scrapedPrice: number | null;
}

/**
 * Normalize query for cache lookup (lowercase, trim, collapse spaces)
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check cache for existing results
 */
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

    // Increment hit count (fire and forget)
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

/**
 * Write results to cache
 */
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
        hit_count: 0
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

/**
 * Load learned vendor URL patterns from Supabase
 */
async function loadLearnedPatterns(supabase: any): Promise<Map<string, { product: string[], category: string[] }>> {
  try {
    const { data, error } = await supabase
      .from('vendor_url_patterns')
      .select('domain, product_patterns, category_patterns')
      .eq('learning_status', 'learned');

    if (error || !data) {
      console.log('[Patterns] No learned patterns found');
      return new Map();
    }

    const patternsMap = new Map<string, { product: string[], category: string[] }>();
    for (const row of data) {
      patternsMap.set(row.domain, {
        product: row.product_patterns || [],
        category: row.category_patterns || []
      });
    }

    console.log(`[Patterns] Loaded ${patternsMap.size} learned patterns`);
    return patternsMap;
  } catch (e) {
    console.error('[Patterns] Load error:', e);
    return new Map();
  }
}

// Priority vendors - synced with Supabase vendors table + scraped_products
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
  { name: 'Sainsbury\'s', domain: 'sainsburys.co.uk' },
  { name: 'Superdrug', domain: 'superdrug.com' },
  { name: 'Tesco', domain: 'tesco.com' },
  { name: 'Waitrose', domain: 'waitrose.com' },
];

// BLOCKED_DOMAINS and isBlockedDomain imported from ./blocked-domains.ts

/**
 * Filter out blocked domains from search results (before scraping)
 */
function filterBlockedSearchResults(results: SearchResult[]): { filtered: SearchResult[]; blockedCount: number } {
  const filtered = results.filter(r => !isBlockedDomain(r.url));
  const blockedCount = results.length - filtered.length;
  if (blockedCount > 0) {
    console.log(`[Filter] Removed ${blockedCount} blocked domains (comparison/marketplace sites)`);
  }
  return { filtered, blockedCount };
}

/**
 * Filter products by minimum confidence score
 */
function filterByConfidence(products: ProductResult[], minConfidence: number): { filtered: ProductResult[]; removedCount: number } {
  const filtered = products.filter(p => p.confidence >= minConfidence);
  const removedCount = products.length - filtered.length;
  if (removedCount > 0) {
    console.log(`[Filter] Removed ${removedCount} results with confidence < ${minConfidence * 100}%`);
  }
  return { filtered, removedCount };
}

/**
 * Deduplicate results by vendor (keeps first/best result per vendor)
 */
function deduplicateByVendor(results: SearchResult[]): { deduplicated: SearchResult[]; seenVendors: Map<string, SearchResult> } {
  const seenVendors = new Map<string, SearchResult>();
  for (const result of results) {
    const vendorKey = normalizeVendor(result.vendor);
    if (!seenVendors.has(vendorKey)) {
      seenVendors.set(vendorKey, result);
    }
  }
  const deduplicated = Array.from(seenVendors.values());
  console.log(`[Dedup] ${results.length} -> ${deduplicated.length} unique vendors`);
  return { deduplicated, seenVendors };
}

/**
 * Normalize vendor name for comparison (removes spaces, special chars)
 */
function normalizeVendor(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize URL by stripping query parameters for matching
 * Removes tracking params like srsltid, gclid, etc. that differ between search results and scraped URLs
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Check if URL belongs to a specific vendor domain
 */
function isFromVendorDomain(url: string, vendorDomain: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes(vendorDomain.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Check if URL is likely a category/listing page (not a product page)
 * Category pages often have patterns like /c/, /category/, /browse/, /shop/, /s?
 */
function isCategoryPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();

    // Common category page patterns
    const categoryPatterns = [
      '/c/',              // Superdrug: /c/pt_baby_baby_oil
      '/category/',       // Generic
      '/categories/',     // Generic
      '/browse/',         // Browse pages
      '/shop/',           // Shop landing pages (but not /shop/product/)
      '/s?',              // Amazon search results
      '/s/',              // Search results
      '/search',          // Search pages
      '/collection/',     // Collections
      '/collections/',    // Shopify collections
      '/designers/',      // Designer/brand landing pages (Harrods, etc.)
      '/brands/',         // Brand landing pages
      '/brand/',          // Brand landing pages
      '/shop-by-brand/',  // Shop by brand pages
      '/shop-by/',        // Shop by category pages
      '/shopping/',       // Shopping category pages
      '/items.aspx',      // Legacy listing pages
    ];

    // Check if path contains category patterns
    for (const pattern of categoryPatterns) {
      if (path.includes(pattern)) {
        console.log(`[Filter] Category page detected: ${url} (pattern: ${pattern})`);
        return true;
      }
    }

    // Check for Amazon category pages (node IDs without product ASIN)
    if (urlObj.hostname.includes('amazon') && !path.includes('/dp/') && !path.includes('/gp/product/')) {
      if (path.includes('/s?') || urlObj.searchParams.has('node') || urlObj.searchParams.has('rh')) {
        console.log(`[Filter] Amazon category/search page detected: ${url}`);
        return true;
      }
    }

    // Check for short brand-only paths (e.g., /paige/, /nike/)
    // These are usually category/brand landing pages, not product pages
    const pathSegments = path.split('/').filter(s => s.length > 0);
    if (pathSegments.length === 1) {
      // Single segment path like /paige/ - likely a brand page
      const segment = pathSegments[0];
      // If it's just a word (no numbers, hyphens with numbers, or product codes), it's likely a category
      if (/^[a-z-]+$/i.test(segment) && !/\d/.test(segment)) {
        console.log(`[Filter] Short brand-only path detected: ${url} (segment: ${segment})`);
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Scrape a URL to get raw JSON-LD data
 * Returns the raw data for AI to reason through
 */
async function scrapeUrl(serperKey: string, url: string): Promise<ScrapeResult> {
  console.log(`[Scrape] Scraping: ${url}`);

  const emptyResult: ScrapeResult = {
    url,
    rawJsonLd: null,
    scrapedPrice: null
  };

  try {
    const res = await fetch('https://scrape.serper.dev', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      console.error(`[Scrape] Error for ${url}: ${res.status}`);
      return emptyResult;
    }

    const data = await res.json();
    const jsonld = data.jsonld;

    if (!jsonld) {
      console.log(`[Scrape] No JSON-LD found for ${url}`);
      return emptyResult;
    }

    // Extract price if available (for sorting purposes)
    const scrapedPrice = jsonld.offers?.price ? parseFloat(jsonld.offers.price) : null;

    console.log(`[Scrape] ${url}: has JSON-LD, price=${scrapedPrice}`);

    return {
      url,
      rawJsonLd: jsonld,
      scrapedPrice
    };

  } catch (e) {
    console.error(`[Scrape] Error for ${url}:`, e);
    return emptyResult;
  }
}

/**
 * Search a single vendor for a product
 * Query format: "{product} {vendor} product page"
 * Returns results that have a price field AND are from the vendor's domain
 */
async function searchVendor(
  serperKey: string,
  product: string,
  vendorName: string,
  vendorDomain: string
): Promise<SearchResult[]> {
  const query = `${product} ${vendorName} product page`;
  console.log(`[Search] Vendor: ${vendorName}, Query: "${query}"`);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        gl: 'gb',
        location: 'United Kingdom',
        num: 10
      })
    });

    if (!res.ok) {
      // Check for credit exhaustion error
      const errorText = await res.text();
      console.error(`[Search] Error for ${vendorName}: ${res.status} - ${errorText}`);
      if (errorText.includes('Not enough credits') || errorText.includes('credits')) {
        throw new SerperCreditsExhaustedError(`Serper API credits exhausted: ${errorText}`);
      }
      return [];
    }

    const data = await res.json();
    const organic = data.organic || [];

    // Allowed currencies (GBP only)
    const ALLOWED_CURRENCIES = ['GBP', '£', 'gbp'];

    // Filter: only results WITH price field AND from vendor's domain AND is product page AND GBP currency
    const results: SearchResult[] = organic
      .filter((item: any) =>
        item.price != null &&
        item.link &&
        isFromVendorDomain(item.link, vendorDomain) &&
        isProductPageUrl(item.link, isCategoryPage) &&
        (!item.currency || ALLOWED_CURRENCIES.includes(item.currency)) // Allow GBP or no currency specified
      )
      .map((item: any) => ({
        title: item.title,
        url: item.link,
        price: item.price,
        currency: item.currency || 'GBP',
        vendor: vendorName,
        snippet: item.snippet
      }));

    console.log(`[Search] ${vendorName}: Found ${results.length} results with price from ${vendorDomain}`);
    return results;
  } catch (e) {
    // Re-throw credit exhaustion errors to trigger fallback
    if (e instanceof SerperCreditsExhaustedError) throw e;
    console.error(`[Search] Error for ${vendorName}:`, e);
    return [];
  }
}

/**
 * Broader search for fallback (any UK retailer)
 * Query format: "{product} product page"
 */
async function searchBroader(
  serperKey: string,
  product: string,
  limit: number,
  learnedPatterns: Map<string, { product: string[], category: string[] }>,
  supabaseUrl: string,
  authHeader: string
): Promise<SearchResult[]> {
  const query = `${product} product page`;
  console.log(`[Search] Broader fallback: "${query}"`);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        gl: 'gb',
        location: 'United Kingdom',
        num: 30
      })
    });

    if (!res.ok) {
      // Check for credit exhaustion error
      const errorText = await res.text();
      console.error(`[Search] Broader fallback failed: ${res.status} - ${errorText}`);
      if (errorText.includes('Not enough credits') || errorText.includes('credits')) {
        throw new SerperCreditsExhaustedError(`Serper API credits exhausted: ${errorText}`);
      }
      return [];
    }

    const data = await res.json();
    const organic = data.organic || [];
    console.log(`[Search] Broader: Got ${organic.length} organic results`);

    // Log all results with prices for debugging
    const withPrices = organic.filter((item: any) => item.price != null);
    console.log(`[Search] Broader: ${withPrices.length} results have price field in Serper response`);
    withPrices.forEach((item: any) => {
      console.log(`  - ${item.link} -> £${item.price}`);
    });

    // Filter: REMOVED price requirement - scraper will extract prices from JSON-LD
    // Only filter by: valid link AND product page URL AND not blocked domain AND GBP currency
    // Track unknown domains for pattern learning
    const unknownDomains = new Set<string>();

    // Allowed currencies (GBP only - reject PLN, USD, EUR, etc.)
    const ALLOWED_CURRENCIES = ['GBP', '£', 'gbp'];

    let results: SearchResult[] = organic
      .filter((item: any) => {
        if (!item.link) return false;

        // Filter by currency - only allow GBP (reject PLN, USD, EUR, etc.)
        // If no currency specified AND has a price, assume it might not be GBP - reject to be safe
        // If no currency AND no price, allow (we'll extract price later)
        if (item.currency && !ALLOWED_CURRENCIES.includes(item.currency)) {
          console.log(`[Filter] Rejected non-GBP currency: ${item.link} (currency: ${item.currency})`);
          return false;
        }

        // Check if URL is product page (with learned patterns)
        const isProduct = isProductPageUrl(item.link, isCategoryPage, learnedPatterns);
        if (!isProduct) return false;

        // Check if blocked domain
        if (isBlockedDomain(item.link)) return false;

        // Track unknown domains for learning
        try {
          const hostname = new URL(item.link).hostname.replace('www.', '').replace('groceries.', '');

          // Extract proper domain (handle .co.uk, .com, etc.)
          const parts = hostname.split('.');
          let domain: string;
          if (parts.length >= 3 && (parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'gov')) {
            // Handle .co.uk, .gov.uk, etc.
            domain = parts.slice(-3).join('.');
          } else {
            // Standard .com, .net, etc.
            domain = parts.slice(-2).join('.');
          }

          // Check if we have patterns for this domain (static or learned)
          const hasStaticPattern = Object.keys(VENDOR_URL_PATTERNS).some(d => hostname.includes(d));
          const hasLearnedPattern = learnedPatterns.has(domain);

          if (!hasStaticPattern && !hasLearnedPattern) {
            unknownDomains.add(domain);
          }
        } catch (e) {
          // Ignore parsing errors
        }

        return true;
      })
      .map((item: any) => {
        // Extract vendor name from URL
        let vendor = 'Unknown';
        try {
          const hostname = new URL(item.link).hostname.replace('www.', '');
          const parts = hostname.split('.');

          // Common subdomains to skip (use second part instead)
          const genericSubdomains = ['groceries', 'shop', 'store', 'online', 'www', 'uk', 'en'];

          // Check if first part is a priority vendor domain
          const matchedVendor = PRIORITY_VENDORS.find(v => hostname.includes(v.domain.toLowerCase()));
          if (matchedVendor) {
            vendor = matchedVendor.name;
          } else if (parts.length >= 2 && genericSubdomains.includes(parts[0].toLowerCase())) {
            // Skip generic subdomain, use second part (e.g., groceries.morrisons.com -> Morrisons)
            vendor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
          } else {
            vendor = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          }
        } catch {}

        return {
          title: item.title,
          url: item.link,
          price: item.price || null, // May be null - scraper will extract from JSON-LD
          currency: item.currency || 'GBP',
          vendor,
          snippet: item.snippet
        };
      })
      .slice(0, limit);

    console.log(`[Search] Broader: Found ${results.length} product page results (prices will be extracted via scraping)`);

    // Learn patterns for unknown domains BEFORE filtering (synchronous)
    if (unknownDomains.size > 0 && supabaseUrl && authHeader) {
      console.log(`[Search] Found ${unknownDomains.size} unknown domains, learning patterns...`);

      const serperApiKey = Deno.env.get('SERPER_API_KEY');
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (serperApiKey && geminiApiKey && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Learn all domains in parallel (3-7s total due to Promise.all)
        // Pass user's search query for context-aware pattern learning
        const learningPromises = Array.from(unknownDomains).map(domain =>
          getOrLearnPatterns(supabase, serperApiKey, geminiApiKey, domain, undefined, product)
            .catch(e => {
              console.error(`[Search] Failed to learn ${domain}:`, e.message);
              return null; // Don't fail entire search if one vendor fails
            })
        );

        const learnedResults = await Promise.all(learningPromises);

        // Update learnedPatterns map with newly learned patterns
        learnedResults.forEach((result, i) => {
          if (result) {
            const domain = Array.from(unknownDomains)[i];
            learnedPatterns.set(domain, {
              product: result.product_patterns || [],
              category: [] // Category patterns removed in v7
            });
            console.log(`[Search] Learned patterns for ${domain} (confidence: ${result.confidence_score})`);
          }
        });

        // Re-filter results with updated patterns
        const refiltered: SearchResult[] = [];
        for (const item of organic) {
          if (!item.link) continue;

          // Filter by currency - only allow GBP
          if (item.currency && !ALLOWED_CURRENCIES.includes(item.currency)) continue;

          // Re-check with potentially updated patterns
          const isProduct = isProductPageUrl(item.link, isCategoryPage, learnedPatterns);
          if (!isProduct) continue;

          if (isBlockedDomain(item.link)) continue;

          // Extract vendor name from URL
          let vendor = 'Unknown';
          try {
            const hostname = new URL(item.link).hostname.replace('www.', '');
            const parts = hostname.split('.');

            // Common subdomains to skip (use second part instead)
            const genericSubdomains = ['groceries', 'shop', 'store', 'online', 'www', 'uk', 'en'];

            // Check if first part is a priority vendor domain
            const matchedVendor = PRIORITY_VENDORS.find(v => hostname.includes(v.domain.toLowerCase()));
            if (matchedVendor) {
              vendor = matchedVendor.name;
            } else if (parts.length >= 2 && genericSubdomains.includes(parts[0].toLowerCase())) {
              // Skip generic subdomain, use second part (e.g., groceries.morrisons.com -> Morrisons)
              vendor = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
            } else {
              vendor = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }
          } catch {}

          refiltered.push({
            title: item.title,
            url: item.link,
            price: item.price || null,
            currency: item.currency || 'GBP',
            vendor,
            snippet: item.snippet
          });
        }

        results = refiltered.slice(0, limit);
        console.log(`[Search] After re-filtering with learned patterns: ${results.length} results`);
      }
    }

    return results;
  } catch (e) {
    // Re-throw credit exhaustion errors to trigger fallback
    if (e instanceof SerperCreditsExhaustedError) throw e;
    console.error(`[Search] Broader search error:`, e);
    return [];
  }
}

/**
 * Get availability and price using product-checker API (Playwright + CSS extractors + Stagehand AI fallback)
 * Returns both availability and price for priority vendors
 * @param geminiApiKey - Gemini API key for AI extraction (passed to RunPod)
 */
/**
 * Get availability for multiple products using batch API (much faster than individual calls)
 * RunPod browser pool handles true parallel processing with 6 browsers
 */
/**
 * Clean tracking parameters from URL that cause blocking or navigation issues
 * Removes: srsltid (Google), gclid, fbclid, utm_*, etc.
 */
function cleanTrackingParams(url: string): string {
  try {
    const urlObj = new URL(url);
    const trackingParams = [
      'srsltid', 'gclid', 'gclsrc', 'fbclid', 'msclkid', 'dclid',
      'twclid', 'igshid', 'mc_cid', 'mc_eid', '_ga',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'
    ];

    let removed = 0;
    for (const param of trackingParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ProductChecker] Cleaned ${removed} tracking params from URL`);
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}

async function getBatchDataWithProductChecker(
  products: ProductResult[],
  geminiApiKey?: string
): Promise<Map<string, { availability: 'In Stock' | 'Out of Stock' | 'Unsure'; price: number | null; extractionMethod?: 'css' | 'ai'; success: boolean }>> {
  const apiUrl = 'https://lkzqju0uvvpqa2-3003.proxy.runpod.net';
  const results = new Map<string, { availability: 'In Stock' | 'Out of Stock' | 'Unsure'; price: number | null; extractionMethod?: 'css' | 'ai'; success: boolean }>();

  // Initialize all products with default values
  for (const product of products) {
    results.set(product.source_url, { availability: 'Unsure', price: null, extractionMethod: undefined, success: false });
  }

  if (products.length === 0) return results;

  console.log(`[ProductChecker] Batch checking ${products.length} products with concurrency 6...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for entire batch

    // Clean tracking parameters from URLs before sending to checker API
    const batchItems = products.map(p => ({
      url: cleanTrackingParams(p.source_url),
      productName: p.product_name
    }));

    const response = await fetch(`${apiUrl}/check-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: batchItems,
        concurrency: 6, // 6 parallel browsers for maximum throughput
        geminiApiKey
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[ProductChecker] Batch API error: ${response.status}`);
      return results;
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      console.error(`[ProductChecker] Invalid batch response`);
      return results;
    }

    // Process batch results
    for (const item of data.results) {
      if (!item.url) continue;

      let availability: 'In Stock' | 'Out of Stock' | 'Unsure' = 'Unsure';
      if (item.availability) {
        const avail = item.availability.toLowerCase();
        if (avail.includes('in stock') || avail === 'instock') {
          availability = 'In Stock';
        } else if (avail.includes('out of stock') || avail === 'outofstock') {
          availability = 'Out of Stock';
        }
      }

      let price: number | null = null;
      if (item.price && typeof item.price === 'string') {
        const priceMatch = item.price.match(/[\d,.]+/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(',', ''));
          if (isNaN(price) || price <= 0) price = null;
        }
      } else if (typeof item.price === 'number' && item.price > 0) {
        price = item.price;
      }

      // Capture extraction method from batch API response
      const extractionMethod: 'css' | 'ai' | undefined =
        item.extractionMethod === 'css' ? 'css' :
        item.extractionMethod === 'ai' ? 'ai' : undefined;

      results.set(item.url, {
        availability,
        price,
        extractionMethod,
        success: item.success && availability !== 'Unsure'
      });
    }

    const successful = Array.from(results.values()).filter(r => r.success).length;
    console.log(`[ProductChecker] Batch complete: ${successful}/${products.length} with availability, ${data.summary?.duration || 'N/A'}`);

    return results;

  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.error(`[ProductChecker] Batch timeout after 60s`);
    } else {
      console.error(`[ProductChecker] Batch error:`, e);
    }
    return results;
  }
}

/**
 * Check if vendor is a priority vendor (trusted UK retailer)
 */
function isPriorityVendor(vendorName: string): boolean {
  const normalizedVendor = vendorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PRIORITY_VENDORS.some(pv => {
    const normalizedPriority = pv.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedVendor.includes(normalizedPriority) || normalizedPriority.includes(normalizedVendor);
  });
}

/**
 * Enrich ALL products with fresh availability from product-checker API
 * Uses batch API for efficiency - single request with 6 parallel browsers
 * Falls back to JSON-LD scraping for products that fail batch check
 * OPTIMIZATION: Checks scraped_products for recent data first to avoid redundant API calls
 * @param geminiApiKey - Gemini API key for AI extraction (passed to RunPod)
 * @param supabase - Supabase client for checking scraped_products (optional)
 */
async function enrichProductsWithChecker(
  products: ProductResult[],
  serperKey: string,
  geminiApiKey?: string,
  supabase?: ReturnType<typeof createClient> | null
): Promise<ProductResult[]> {
  if (products.length === 0) {
    return [];
  }

  console.log(`[ProductChecker] Enriching ${products.length} products...`);

  // OPTIMIZATION: Check scraped_products for recent data first
  // This avoids redundant API calls when cache TTL expired but scraped_products has fresh data
  const FRESHNESS_THRESHOLD_HOURS = 24;
  const productsNeedingCheck: ProductResult[] = [];
  const productsWithFreshData: ProductResult[] = [];

  if (supabase) {
    // Normalize URLs and query scraped_products for matches
    const normalizedUrls = products.map(p => normalizeUrl(p.source_url));
    const cutoffTime = new Date(Date.now() - FRESHNESS_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

    const { data: freshProducts, error } = await supabase
      .from('scraped_products')
      .select('url, price, stock_status, scraper_updated_at')
      .in('url', normalizedUrls)
      .gt('scraper_updated_at', cutoffTime);

    if (error) {
      console.error(`[ProductChecker] Error checking scraped_products:`, error);
      // Fall through to check all products via API
      productsNeedingCheck.push(...products);
    } else if (freshProducts && freshProducts.length > 0) {
      // Build a map of URL -> fresh data
      const freshDataMap = new Map<string, { price: number | null; stock_status: string; updated_at: string }>();
      for (const fp of freshProducts) {
        freshDataMap.set(fp.url, {
          price: fp.price,
          stock_status: fp.stock_status,
          updated_at: fp.scraper_updated_at
        });
      }

      console.log(`[ProductChecker] Found ${freshProducts.length} products with fresh data in scraped_products`);

      // Separate products into those with fresh data and those needing API check
      for (const product of products) {
        const normalizedUrl = normalizeUrl(product.source_url);
        const freshData = freshDataMap.get(normalizedUrl);

        if (freshData) {
          // Use fresh data from scraped_products
          const availability = freshData.stock_status === 'in_stock' ? 'In Stock' :
                              freshData.stock_status === 'out_of_stock' ? 'Out of Stock' : 'Unsure';
          const isPriority = isPriorityVendor(product.vendor);

          if (isPriority && freshData.price !== null) {
            console.log(`[ProductChecker] Using cached data for ${product.vendor}: price=£${freshData.price}, stock=${availability}`);
            productsWithFreshData.push({ ...product, price: freshData.price, availability, extraction_method: 'cached' });
          } else {
            console.log(`[ProductChecker] Using cached stock for ${product.vendor}: ${availability}`);
            productsWithFreshData.push({ ...product, availability, extraction_method: 'cached' });
          }
        } else {
          productsNeedingCheck.push(product);
        }
      }

      console.log(`[ProductChecker] ${productsWithFreshData.length} from cache, ${productsNeedingCheck.length} need API check`);
    } else {
      // No fresh data found, check all via API
      productsNeedingCheck.push(...products);
    }
  } else {
    // No Supabase client, check all via API
    productsNeedingCheck.push(...products);
  }

  // If all products have fresh data, return early
  if (productsNeedingCheck.length === 0) {
    console.log(`[ProductChecker] All ${products.length} products had fresh cached data, skipping API call`);
    return productsWithFreshData;
  }

  console.log(`[ProductChecker] Calling batch API for ${productsNeedingCheck.length} products (6 parallel browsers)...`);

  // Use batch API for products that need checking
  const batchResults = await getBatchDataWithProductChecker(productsNeedingCheck, geminiApiKey);

  // Process results and apply fallbacks for failures
  const enrichedProducts: ProductResult[] = [];
  const failedProducts: ProductResult[] = [];

  for (const product of productsNeedingCheck) {
    const result = batchResults.get(product.source_url);
    const isPriority = isPriorityVendor(product.vendor);

    if (result?.success) {
      // Update availability always, but price ONLY for priority vendors
      // Include extraction_method to track how data was extracted (css or ai)
      if (isPriority && result.price !== null) {
        console.log(`[ProductChecker] Updating price for priority vendor ${product.vendor}: £${product.price} -> £${result.price} (${result.extractionMethod})`);
        enrichedProducts.push({ ...product, availability: result.availability, price: result.price, extraction_method: result.extractionMethod });
      } else {
        enrichedProducts.push({ ...product, availability: result.availability, extraction_method: result.extractionMethod });
      }
    } else {
      // Mark for fallback processing
      failedProducts.push(product);
    }
  }

  // Fallback: scrape JSON-LD for products that failed batch check (in parallel)
  if (failedProducts.length > 0) {
    console.log(`[ProductChecker] Fallback scraping for ${failedProducts.length} failed products...`);
    const fallbackResults = await Promise.all(
      failedProducts.map(async (product) => {
        const isPriority = isPriorityVendor(product.vendor);
        const scrapeResult = await scrapeUrl(serperKey, product.source_url);
        if (scrapeResult.rawJsonLd) {
          const availability = extractAvailabilityFromJsonLd(scrapeResult.rawJsonLd);
          if (isPriority && scrapeResult.scrapedPrice !== null) {
            return { ...product, availability, price: scrapeResult.scrapedPrice };
          }
          return { ...product, availability };
        }
        return product;
      })
    );
    enrichedProducts.push(...fallbackResults);
  }

  // Combine products with fresh cached data + products enriched via API
  const allEnrichedProducts = [...productsWithFreshData, ...enrichedProducts];

  const withAvailability = allEnrichedProducts.filter(p => p.availability !== 'Unsure').length;
  console.log(`[ProductChecker] Got availability for ${withAvailability}/${products.length} products (${productsWithFreshData.length} cached, ${enrichedProducts.length} API)`);

  return allEnrichedProducts;
}

/**
 * Extract availability status from raw JSON-LD data
 * Fallback when AI fails to extract availability
 */
function extractAvailabilityFromJsonLd(jsonLd: any): 'In Stock' | 'Out of Stock' | 'Unsure' {
  if (!jsonLd) return 'Unsure';

  try {
    // Check offers.availability (most common location)
    const availability = jsonLd.offers?.availability || jsonLd.availability;

    if (!availability) return 'Unsure';

    const availStr = String(availability).toLowerCase();

    // Check for InStock patterns
    if (availStr.includes('instock') || availStr.includes('in_stock') || availStr === 'in stock') {
      return 'In Stock';
    }

    // Check for OutOfStock patterns
    if (availStr.includes('outofstock') || availStr.includes('out_of_stock') ||
        availStr.includes('soldout') || availStr === 'out of stock') {
      return 'Out of Stock';
    }

    // Check for other schema.org availability values
    if (availStr.includes('preorder') || availStr.includes('backorder') ||
        availStr.includes('limitedavailability')) {
      return 'In Stock'; // Treat as available since it can be ordered
    }

    if (availStr.includes('discontinued') || availStr.includes('outofstock')) {
      return 'Out of Stock';
    }

    return 'Unsure';
  } catch {
    return 'Unsure';
  }
}

/**
 * Verify a SINGLE product with AI
 * AI uses search title/URL/snippet to verify (no JSON-LD needed)
 * Availability is set to "Unsure" - product-checker API will update it later
 */
async function verifySingleProduct(
  geminiKey: string,
  userQuery: string,
  description: string,
  result: SearchResult
): Promise<ProductResult | null> {
  // Build description context for AI
  const descriptionContext = description
    ? `\nPRODUCT DESCRIPTION (use this to help identify the correct product):\n"${description}"\n`
    : '';

  const prompt = `You are a product matching assistant. Your job is to verify if search results are likely the same product the user is looking for. Be GENEROUS - if the product appears to match, ACCEPT it.

USER QUERY: "${userQuery}"
${descriptionContext}
SEARCH RESULT:
- Vendor: ${result.vendor}
- Search Title: "${result.title}"
- URL: ${result.url}
- Price from search: £${result.price}
${result.snippet ? `- Snippet: "${result.snippet}"` : ''}

MATCHING RULES:

1. URL VALIDATION:
   - REJECT if URL is a category page (/c/, /category/, /browse/, /shop/, /search)
   - REJECT if URL is a comparison site or marketplace
   - Product URLs have product IDs, SKUs, or specific product slugs

2. SIZE/WEIGHT MATCHING (for groceries, beverages, household items):
   - ONLY applies to products with measurable sizes: grams (g), ml, L, kg, oz, packs
   - If query has a size (e.g., "450g", "2L", "6x330ml"), verify it matches
   - SIZE MUST MATCH EXACTLY - 450g ≠ 475g, 2L ≠ 1.5L
   - REJECT if multi-pack vs single item mismatch
   - Normalize units: 1000ml = 1L, 1000g = 1kg

3. VARIANT MATCHING (for cosmetics, fashion, electronics):
   - Variants include: colors, shades, sizes (S/M/L), model numbers
   - If search title EXACTLY matches query variant, ACCEPT with 0.9 confidence
   - Examples: "Shade 01", "Fair to Medium", "Rose Gold", "Size M"
   - Don't require variant confirmation in URL for non-grocery items

4. PRODUCT MATCHING:
   - Brand and product type must match
   - REJECT if it's an accessory, case, or related item

5. PRICE CHECK:
   - Price should be reasonable (not shipping cost, not suspiciously low)

EXAMPLES:
✓ ACCEPT: Query "HP Sauce 450g" → Title "HP Brown Sauce 450g" (size match)
✓ ACCEPT: Query "Burberry Palette Shade 01" → Title "Burberry Palette Shade 01" (exact match)
✓ ACCEPT: Query "Burberry Glow Palette Shade 01 - Fair to Medium" → Title "Burberry Glow Palette Shade 01 - Fair to Medium 130/1423" (same product with SKU)
✓ ACCEPT: Query "iPhone 15 Pro 256GB" → Title "iPhone 15 Pro 256GB" (model match)
✓ ACCEPT: Query "Product Name Long" → Title "Product Name Long | Argos" (same product with site suffix)
✓ ACCEPT: Query "Product Name" → Title "Product Name - Buy at Store" (same product with marketing text)
✗ REJECT: Query "Beans 415g" → "Beans 4x415g" (single vs multi-pack)
✗ REJECT: Query "Milk 2L" → "Milk 1L" (volume mismatch)
✗ REJECT: Query "Palette Shade 01" → "Palette Shade 02" (wrong variant)

IMPORTANT: If the search title contains ALL the key words from the query (brand + product + variant), ACCEPT it even if there are extra words like SKUs, store names, or "Buy Now". Truncated titles should be accepted if they match up to the truncation.

RESPOND WITH ONLY ONE OF:
A) If match: {"match": true, "product_name": "...", "price": 1.23, "confidence": 0.7-0.9, "reason": "explanation"}
B) If NOT a match: {"match": false, "reason": "why it doesn't match"}

CONFIDENCE RULES:
- 0.9 = search title contains all key product words from query
- 0.8 = brand and main product name match, minor differences
- 0.7 = product likely matches but some details unclear
- DEFAULT TO ACCEPTING with 0.8 confidence if brand and product type clearly match`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
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
      console.error(`[AI] Verification failed for ${result.vendor}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonText = jsonMatch[1].trim();
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonText = objectMatch[0];

    const aiResult = JSON.parse(jsonText);

    if (aiResult.match) {
      // Availability set to "Unsure" - product-checker API will update it later
      console.log(`[AI] ✓ ${result.vendor}: matched with confidence ${aiResult.confidence} - ${aiResult.reason || 'no reason'}`);
      return {
        product_name: aiResult.product_name || result.title,
        price: typeof aiResult.price === 'number' ? aiResult.price : (result.price || 0),
        currency: 'GBP',
        source_url: result.url,
        vendor: result.vendor,
        confidence: aiResult.confidence || 0.7,
        availability: 'Unsure', // Will be updated by enrichProductsWithChecker
        reason: aiResult.reason || 'Product verified by AI'
      };
    } else {
      console.log(`[AI] ✗ ${result.vendor}: rejected - ${aiResult.reason} | Title was: "${result.title}"`);
      return null;
    }

  } catch (e) {
    console.error(`[AI] Error verifying ${result.vendor}:`, e);
    return null;
  }
}

/**
 * Verify all products with AI in PARALLEL
 * Each product is processed independently for better accuracy
 */
async function verifyWithAI(
  geminiKey: string,
  userQuery: string,
  description: string,
  results: SearchResult[],
  _limit: number
): Promise<ProductResult[]> {
  if (results.length === 0) return [];

  console.log(`[AI] Verifying ${results.length} products in parallel...`);

  // Process all products in parallel
  const verifyPromises = results.map(r => verifySingleProduct(geminiKey, userQuery, description, r));
  const verifyResults = await Promise.all(verifyPromises);

  // Filter out nulls (rejected products) and collect valid ones
  const verified = verifyResults.filter((r): r is ProductResult => r !== null);

  console.log(`[AI] Verified ${verified.length}/${results.length} products`);

  return verified;
}

/**
 * Main function: Find products with the simplified approach
 */
interface FindProductsResult {
  products: ProductResult[];
  products_without_price: ProductResult[];
  debug: {
    priority_results: number;
    after_dedup: number;
    before_ai: number;
    after_ai: number;
    filtered_low_confidence: number;
    fallback_results: number;
    vendors_before_ai: string[];
  };
}

async function findProducts(
  geminiKey: string,
  serperKey: string,
  userQuery: string,
  limit: number,
  description: string = '',
  learnedPatterns: Map<string, { product: string[], category: string[] }> = new Map(),
  supabaseUrl: string = '',
  authHeader: string = '',
  supabase?: ReturnType<typeof createClient> | null
): Promise<FindProductsResult> {
  const debug: FindProductsResult['debug'] = {
    priority_results: 0,
    after_dedup: 0,
    before_ai: 0,
    after_ai: 0,
    filtered_low_confidence: 0,
    fallback_results: 0,
    vendors_before_ai: []
  };

  // STEP 1: Search all priority vendors in parallel
  console.log(`[Main] Searching ${PRIORITY_VENDORS.length} priority vendors in parallel...`);
  const vendorSearches = PRIORITY_VENDORS.map(vendor =>
    searchVendor(serperKey, userQuery, vendor.name, vendor.domain)
  );
  const vendorResults = await Promise.all(vendorSearches);
  let allResults: SearchResult[] = vendorResults.flat();
  debug.priority_results = allResults.length;

  // STEP 2: Deduplicate by vendor
  const { deduplicated, seenVendors } = deduplicateByVendor(allResults);
  allResults = deduplicated;
  debug.after_dedup = allResults.length;

  // STEP 3: Filter blocked domains BEFORE AI verification
  const blockFilter1 = filterBlockedSearchResults(allResults);
  allResults = blockFilter1.filtered;
  debug.before_ai = allResults.length;
  debug.vendors_before_ai = allResults.map(r => `${r.vendor}: £${r.price}`);

  // STEP 4: AI Verification (parallel, each product independently)
  let verified = await verifyWithAI(geminiKey, userQuery, description, allResults, limit + 10);
  debug.after_ai = verified.length;

  // STEP 5: Filter by confidence (90%+)
  const confidenceFilter = filterByConfidence(verified, 0.7);
  verified = confidenceFilter.filtered;
  debug.filtered_low_confidence = confidenceFilter.removedCount;

  // STEP 6: Fallback search if not enough results
  if (verified.length < limit) {
    console.log(`[Main] Only ${verified.length} results, need ${limit}. Running fallback...`);
    let fallbackResults = await searchBroader(serperKey, userQuery, limit * 2, learnedPatterns, supabaseUrl, authHeader);
    debug.fallback_results = fallbackResults.length;

    // Filter out vendors we already have
    fallbackResults = fallbackResults.filter(r => !seenVendors.has(normalizeVendor(r.vendor)));

    if (fallbackResults.length > 0) {
      // AI verify fallback results (no scraping - uses search title/URL/snippet)
      const fallbackVerified = await verifyWithAI(geminiKey, userQuery, description, fallbackResults, limit - verified.length + 5);

      // Filter fallback by confidence (blocked domains already filtered in searchBroader)
      const fbConfidence = filterByConfidence(fallbackVerified, 0.7);
      debug.filtered_low_confidence += fbConfidence.removedCount;

      // Add unique fallback results
      for (const result of fbConfidence.filtered) {
        const vendorKey = normalizeVendor(result.vendor);
        if (!seenVendors.has(vendorKey)) {
          seenVendors.set(vendorKey, result as any);
          verified.push(result);
        }
      }
    }
    console.log(`[Main] After fallback: ${verified.length} total results`);
  }

  // STEP 9: Enrich ALL products with fresh availability from product-checker API
  // Optimization: checks scraped_products for recent data first to avoid redundant API calls
  const enrichedProducts = await enrichProductsWithChecker(verified, serperKey, geminiKey, supabase);

  // Separate products with and without prices (after enrichment)
  const productsWithPrice = enrichedProducts.filter(p => p.price > 0);
  const productsWithoutPrice = enrichedProducts.filter(p => p.price === 0 || p.price === null);

  // Sort products: priority vendors first (by price), then external vendors (by price)
  productsWithPrice.sort((a, b) => {
    const aIsPriority = isPriorityVendor(a.vendor);
    const bIsPriority = isPriorityVendor(b.vendor);

    // Priority vendors come first
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;

    // Within same group, sort by price (lowest first)
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

// Main handler
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
    // Primary and fallback Serper API keys
    const serperKeyPrimary = Deno.env.get('SERPER_API_KEY_PRICE_COMPARISON');
    const serperKeyFallback = Deno.env.get('SERPER_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get authorization header from incoming request to forward to internal calls
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey') || '';

    if (!geminiKey || (!serperKeyPrimary && !serperKeyFallback)) {
      return new Response(
        JSON.stringify({ success: false, error: 'API keys not configured (GEMINI_API_KEY and at least one SERPER_API_KEY required)' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const { query, description = '', limit = 5, bypass_cache = false } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing query' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[PriceComparison] Query: "${query}", Description: "${description || 'none'}", Limit: ${limit}, BypassCache: ${bypass_cache}`);

    // Initialize Supabase client for caching
    const supabase = supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;

    // Load learned URL patterns from Supabase
    const learnedPatterns = supabase ? await loadLearnedPatterns(supabase) : new Map();

    // Check cache first (unless bypass requested)
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

    // Cache miss - execute search with fallback support
    let result;
    let usedFallbackKey = false;
    const activeSerperKey = serperKeyPrimary || serperKeyFallback!;

    try {
      console.log(`[PriceComparison] Trying primary Serper key...`);
      result = await findProducts(geminiKey, activeSerperKey, query, limit, description, learnedPatterns, supabaseUrl!, authHeader, supabase);
    } catch (e) {
      // If primary key fails due to credit exhaustion, try fallback
      if (e instanceof SerperCreditsExhaustedError && serperKeyFallback && serperKeyPrimary) {
        console.log(`[PriceComparison] Primary key exhausted, switching to fallback key...`);
        usedFallbackKey = true;
        result = await findProducts(geminiKey, serperKeyFallback, query, limit, description, learnedPatterns, supabaseUrl!, authHeader, supabase);
      } else {
        throw e; // Re-throw other errors
      }
    }

    const executionTime = (Date.now() - startTime) / 1000;

    const metadata = {
      query,
      description: description || null,
      limit,
      results_count: result.products.length,
      execution_time: executionTime,
      method: 'self-learning-v25',
      timestamp: new Date().toISOString(),
      cache_hit: false,
      used_fallback_key: usedFallbackKey
    };

    // Write to cache (fire and forget)
    if (supabase && result.products.length > 0) {
      writeCache(supabase, query, limit, result.products, metadata);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products: result.products,
        metadata,
        debug: result.debug
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[PriceComparison] Error:', error);
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
