/**
 * Classify Unclassified Products Edge Function
 *
 * Proactively classifies scraped_products that have classification IS NULL.
 * Runs on a cron schedule so products are pre-classified before sync,
 * removing the classification bottleneck from the sync pipeline.
 *
 * Features:
 * - Queries scraped_products where classification IS NULL
 * - Uses the shared Gemini classification (keyword pre-filter + AI fallback)
 * - Rate limiting: 500ms between requests to avoid Gemini API quota issues
 * - Batch processing with configurable batch size (default: 50)
 * - Logs failed classifications to classification_retry_log for later retry
 * - Skips products already in classification_retry_log (being retried separately)
 *
 * Invocation:
 * - Scheduled via pg_cron (every 10 minutes)
 * - Manual via POST request
 *
 * Request body (optional):
 * {
 *   "batchSize": 50,        // Number of products to process (default: 50)
 *   "vendor": "argos"       // Filter by vendor (optional)
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { classifyProduct } from '../_shared/gemini-classification.ts';

// Configuration
const DEFAULT_BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 500; // 500ms between API calls
const EXPONENTIAL_BACKOFF_BASE_MS = 60000; // 1 minute base delay for retry log

interface UnclassifiedProduct {
  id: string;
  name: string;
  description: string;
  vendor: string;
  url: string;
  category?: string;
}

interface ProcessingResult {
  total_processed: number;
  classified_accepted: number;
  classified_rejected: number;
  failed: number;
  skipped: number;
  results: Array<{
    product_id: string;
    status: 'accepted' | 'rejected' | 'failed' | 'skipped';
    classification?: string;
    message: string;
  }>;
}

/**
 * Determine error type from error message
 */
function classifyErrorType(errorMessage: string): string {
  if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
    return 'quota_exceeded';
  }
  if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
    return 'server_error';
  }
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('fetch failed')) {
    return 'network_error';
  }
  return 'unknown';
}

/**
 * Calculate next retry timestamp using exponential backoff
 */
function calculateNextRetryAt(retryCount: number): string {
  const delayMs = EXPONENTIAL_BACKOFF_BASE_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Query unclassified products from scraped_products.
 * Excludes products already in classification_retry_log (handled by retry cron).
 */
async function getUnclassifiedProducts(
  supabase: any,
  batchSize: number,
  vendor?: string
): Promise<UnclassifiedProduct[]> {
  console.log('[Classify-Unclassified] Querying unclassified products...', { batchSize, vendor });

  // Get IDs already in retry log to exclude them
  const { data: retryIds, error: retryError } = await supabase
    .from('classification_retry_log')
    .select('scraped_product_id')
    .eq('status', 'retrying');

  if (retryError) {
    console.error('[Classify-Unclassified] Error querying retry log:', retryError);
    // Continue anyway - worst case we'll try to classify a product that's also in retry
  }

  const excludeIds = (retryIds || []).map((r: any) => r.scraped_product_id);

  // Query scraped_products where classification IS NULL
  let query = supabase
    .from('scraped_products')
    .select('id, name, description, vendor, url, category')
    .is('classification', null)
    .not('name', 'is', null); // Skip products with no name

  if (vendor) {
    query = query.eq('vendor', vendor);
  }

  // Exclude products already being retried
  if (excludeIds.length > 0) {
    // Use NOT IN filter - Supabase doesn't have a direct "not in" so we filter client-side for large sets
    // For small sets, we can use .not('id', 'in', `(${excludeIds.join(',')})`)
    if (excludeIds.length <= 100) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }
  }

  const { data: products, error: queryError } = await query
    .order('created_at', { ascending: true }) // Oldest first
    .limit(batchSize);

  if (queryError) {
    console.error('[Classify-Unclassified] Error querying scraped_products:', queryError);
    throw new Error(`Failed to query scraped_products: ${queryError.message}`);
  }

  if (!products || products.length === 0) {
    console.log('[Classify-Unclassified] No unclassified products found');
    return [];
  }

  // If we couldn't filter by ID in the query (too many retry IDs), filter client-side
  let filtered = products;
  if (excludeIds.length > 100) {
    const excludeSet = new Set(excludeIds);
    filtered = products.filter((p: any) => !excludeSet.has(p.id));
  }

  console.log(`[Classify-Unclassified] Found ${filtered.length} unclassified products to process`);
  return filtered;
}

/**
 * Process a batch of unclassified products
 */
async function processBatch(
  supabase: any,
  products: UnclassifiedProduct[],
  geminiApiKey: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    total_processed: products.length,
    classified_accepted: 0,
    classified_rejected: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      console.log(`[Classify-Unclassified] [${i + 1}/${products.length}] Classifying: "${product.name}" (${product.vendor})`);

      const classification = await classifyProduct(
        product.name,
        product.description || '',
        geminiApiKey,
        supabase, // Pass supabase client for custom guidelines
        undefined, // Use default model
        product.category // Pass category for better accuracy
      );

      // Update scraped_products with classification result
      const { error: updateError } = await supabase
        .from('scraped_products')
        .update({
          rejected: classification.rejected,
          classification: classification.classification,
          classification_reason: classification.reason,
          classification_confidence: classification.confidence,
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`[Classify-Unclassified] Error updating product ${product.id}:`, updateError);
        result.failed++;
        result.results.push({
          product_id: product.id,
          status: 'failed',
          classification: classification.classification,
          message: `Classification succeeded but DB update failed: ${updateError.message}`,
        });
      } else if (classification.rejected) {
        console.log(`[Classify-Unclassified] REJECTED: ${product.id} -> ${classification.classification} (${classification.reason})`);
        result.classified_rejected++;
        result.results.push({
          product_id: product.id,
          status: 'rejected',
          classification: classification.classification,
          message: classification.reason,
        });
      } else {
        console.log(`[Classify-Unclassified] ACCEPTED: ${product.id} -> ${classification.classification}`);
        result.classified_accepted++;
        result.results.push({
          product_id: product.id,
          status: 'accepted',
          classification: classification.classification,
          message: classification.reason,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = classifyErrorType(errorMessage);

      console.error(`[Classify-Unclassified] Failed to classify ${product.id}:`, errorMessage);

      // Log to classification_retry_log for the retry cron to pick up
      const { error: logError } = await supabase
        .from('classification_retry_log')
        .upsert({
          scraped_product_id: product.id,
          retry_count: 0,
          status: 'retrying',
          last_error: errorMessage,
          last_error_type: errorType,
          next_retry_at: calculateNextRetryAt(0),
          product_name: product.name,
          product_vendor: product.vendor,
        }, {
          onConflict: 'scraped_product_id',
        });

      if (logError) {
        console.error(`[Classify-Unclassified] Error creating retry log for ${product.id}:`, logError);
      }

      result.failed++;
      result.results.push({
        product_id: product.id,
        status: 'failed',
        message: `Classification failed (${errorType}): ${errorMessage}`,
      });

      // If quota exceeded, stop processing to avoid wasting time
      if (errorType === 'quota_exceeded') {
        console.warn('[Classify-Unclassified] Quota exceeded, stopping batch early');
        break;
      }
    }

    // Rate limiting: wait between requests (except for last product)
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
    }
  }

  return result;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('[Classify-Unclassified] Started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;
    const vendor = body.vendor || undefined;

    console.log('[Classify-Unclassified] Config:', { batchSize, vendor });

    // Get unclassified products
    const products = await getUnclassifiedProducts(supabase, batchSize, vendor);

    if (products.length === 0) {
      console.log('[Classify-Unclassified] No unclassified products to process');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unclassified products found',
          total_processed: 0,
          classified_accepted: 0,
          classified_rejected: 0,
          failed: 0,
          skipped: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process batch
    const result = await processBatch(supabase, products, geminiApiKey);

    console.log('[Classify-Unclassified] Completed:', {
      total: result.total_processed,
      accepted: result.classified_accepted,
      rejected: result.classified_rejected,
      failed: result.failed,
      skipped: result.skipped,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${result.total_processed} products: ${result.classified_accepted} accepted, ${result.classified_rejected} rejected, ${result.failed} failed`,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[Classify-Unclassified] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
