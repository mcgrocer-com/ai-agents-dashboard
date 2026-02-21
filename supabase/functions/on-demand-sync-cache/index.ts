/**
 * Sync Price Comparison Cache Edge Function
 *
 * Syncs price and availability data from price_comparison_cache to scraped_products.
 * Matches cache results to scraped products by URL and updates price/stock_status.
 *
 * Features:
 * - Processes cache entries where last_updated IS NULL
 * - Strips query parameters for URL matching
 * - Updates scraped_products.price, stock_status, scraper_updated_at
 * - Marks cache entries as processed with last_updated timestamp
 * - Logs statistics for monitoring
 *
 * Invocation:
 * - Scheduled via pg_cron (every 15 minutes)
 * - Manual via POST request
 *
 * Request body (optional):
 * {
 *   "batchSize": 50  // Number of cache entries to process (default: 50)
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Interfaces
interface CacheResult {
  product_name: string;
  price: number;
  currency: string;
  source_url: string;
  vendor: string;
  availability: 'In Stock' | 'Out of Stock' | 'Unsure';
  confidence?: number;
  extraction_method?: 'json-ld' | 'html-parse' | 'ai-html' | 'cached';
}

interface CacheEntry {
  id: string;
  query_normalized: string;
  results: CacheResult[];
  created_at: string;
}

interface SyncStats {
  cache_entries_processed: number;
  products_checked: number;
  products_matched: number;
  products_updated: number;
  pending_products_triggered: number;
  products_skipped_no_match: number;
  products_skipped_unsure: number;
  errors: number;
}

// Configuration
const DEFAULT_BATCH_SIZE = 50;

// Price markup rules (converted from mark_up_price.js)
const priceMarkupRules = [
  { lower: 500, upper: 9000000000, markup: 100 },  // Testing Strategy
  { lower: 500, upper: 9000000000, markup: 20 },
  { lower: 300, upper: 499.99, markup: 30 },
  { lower: 200, upper: 299.99, markup: 35 },
  { lower: 100, upper: 199.99, markup: 40 },
  { lower: 30, upper: 99.99, markup: 55 },
  { lower: 20, upper: 29.99, markup: 60 },
  { lower: 10, upper: 19.99, markup: 70 },
  { lower: 1, upper: 9.99, markup: 75 },
  { lower: 0.99, upper: 0.99, markup: 90 },
];

/**
 * Apply dynamic markup to cost price based on markup rules
 */
function applyDynamicMarkup(costPrice: number): number {
  for (const rule of priceMarkupRules) {
    if (rule.lower <= costPrice && costPrice <= rule.upper) {
      const markupPercent = rule.markup;
      return Math.round((costPrice * (1 + markupPercent / 100)) * 100) / 100;
    }
  }
  return costPrice; // Return cost price if no rule matches
}

/**
 * Strip query parameters from URL for matching
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
 * Convert availability string to stock_status format used in scraped_products
 */
function mapAvailabilityToStockStatus(availability: string): string | null {
  switch (availability) {
    case 'In Stock':
      return 'in stock';
    case 'Out of Stock':
      return 'out of stock';
    default:
      return null; // Don't update if 'Unsure'
  }
}

/**
 * Call update-scraped-product edge function to update products and trigger ERPNext sync
 */
async function callUpdateScrapedProduct(
  supabaseUrl: string,
  serviceKey: string,
  items: Array<{ url: string; [key: string]: any }>
): Promise<{ success: boolean; results: Array<{ url: string; success: boolean; error?: string }> }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/update-scraped-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Sync] update-scraped-product returned ${response.status}: ${errorText}`);
    return { success: false, results: items.map(i => ({ url: i.url, success: false, error: `HTTP ${response.status}` })) };
  }

  return await response.json();
}

/**
 * Process a single cache entry and sync to scraped_products via update-scraped-product
 */
async function processCacheEntry(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  entry: CacheEntry,
  stats: SyncStats
): Promise<void> {
  const results = entry.results || [];
  console.log(`[Sync] Processing cache entry ${entry.id}: "${entry.query_normalized}" (${results.length} products)`);

  // Collect update payloads for matched products
  const updateItems: Array<{ url: string; price?: number; original_price?: number; stock_status?: string }> = [];

  for (const result of results) {
    stats.products_checked++;

    // Skip if availability is 'Unsure' - no reliable data to sync
    if (result.availability === 'Unsure') {
      stats.products_skipped_unsure++;
      continue;
    }

    // Skip DB-cached results - these prices already came from scraped_products
    // and already have markup applied. Re-processing them causes double-markup.
    if (result.extraction_method === 'cached') {
      console.log(`[Sync] Skipping cached result for ${result.vendor} (price already from DB)`);
      continue;
    }

    // Normalize URL for matching (strip query params)
    const normalizedUrl = normalizeUrl(result.source_url);

    // Find matching scraped product by URL to verify it exists
    const { data: matchedProduct, error: matchError } = await supabase
      .from('scraped_products')
      .select('id, url, price, stock_status, vendor')
      .eq('url', normalizedUrl)
      .single();

    if (matchError || !matchedProduct) {
      // No match found - expected for external retailers not in our catalog
      stats.products_skipped_no_match++;
      continue;
    }

    stats.products_matched++;

    // Build update payload for update-scraped-product
    const updateItem: { url: string; price?: number; original_price?: number; stock_status?: string; timestamp?: string } = { url: matchedProduct.url, timestamp: new Date().toISOString() };

    // Apply markup and prepare price fields
    const stockStatus = mapAvailabilityToStockStatus(result.availability);

    if (result.price && result.price > 0) {
      const markedUpPrice = applyDynamicMarkup(result.price);
      updateItem.original_price = result.price;
      updateItem.price = markedUpPrice;
      console.log(
        `[Sync] Price markup applied for ${matchedProduct.vendor}: ${result.price} → ${markedUpPrice} (${Math.round(((markedUpPrice - result.price) / result.price) * 100)}% markup)`
      );
    }

    if (stockStatus) {
      updateItem.stock_status = stockStatus;
    }

    updateItems.push(updateItem);
  }

  // Call update-scraped-product with collected items
  if (updateItems.length > 0) {
    console.log(`[Sync] Sending ${updateItems.length} products to update-scraped-product`);

    const updateResponse = await callUpdateScrapedProduct(supabaseUrl, serviceKey, updateItems);

    for (const result of updateResponse.results || []) {
      if (result.success) {
        stats.products_updated++;
        stats.pending_products_triggered++;
        console.log(`[Sync] Updated via update-scraped-product: ${result.url}`);
      } else {
        stats.errors++;
        console.error(`[Sync] Failed to update ${result.url}: ${result.error}`);
      }
    }
  }

  // Mark cache entry as processed
  const { error: markError } = await supabase
    .from('price_comparison_cache')
    .update({ last_updated: new Date().toISOString() })
    .eq('id', entry.id);

  if (markError) {
    console.error(`[Sync] Error marking cache entry ${entry.id} as processed:`, markError);
    stats.errors++;
  }

  stats.cache_entries_processed++;
}

// Main handler
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();

  try {
    console.log('[Sync] Starting price comparison cache sync...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;

    console.log(`[Sync] Configuration: batchSize=${batchSize}`);

    // Query unprocessed cache entries (oldest first)
    const { data: cacheEntries, error: queryError } = await supabase
      .from('price_comparison_cache')
      .select('id, query_normalized, results, created_at')
      .is('last_updated', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (queryError) {
      console.error('[Sync] Error querying cache entries:', queryError);
      throw new Error(`Failed to query cache entries: ${queryError.message}`);
    }

    if (!cacheEntries || cacheEntries.length === 0) {
      console.log('[Sync] No unprocessed cache entries found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No cache entries to process',
          stats: {
            cache_entries_processed: 0,
            products_checked: 0,
            products_matched: 0,
            products_updated: 0,
            pending_products_triggered: 0,
            products_skipped_no_match: 0,
            products_skipped_unsure: 0,
            errors: 0,
          },
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Sync] Found ${cacheEntries.length} cache entries to process`);

    // Initialize stats
    const stats: SyncStats = {
      cache_entries_processed: 0,
      products_checked: 0,
      products_matched: 0,
      products_updated: 0,
      pending_products_triggered: 0,
      products_skipped_no_match: 0,
      products_skipped_unsure: 0,
      errors: 0,
    };

    // Process each cache entry
    for (const entry of cacheEntries) {
      await processCacheEntry(supabase, supabaseUrl, supabaseServiceKey, entry, stats);
    }

    const duration = Date.now() - startTime;
    console.log(`[Sync] Completed in ${duration}ms:`, stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.cache_entries_processed} cache entries, updated ${stats.products_updated} products`,
        stats,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Sync] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
