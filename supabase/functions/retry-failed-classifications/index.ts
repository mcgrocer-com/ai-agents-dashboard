/**
 * Retry Failed Classifications Edge Function
 *
 * This function retries classification for products that failed during initial processing.
 * It reads from classification_retry_log table (populated by push-to-pending on failures),
 * retries classification, and deletes successful entries or updates failed ones.
 *
 * Features:
 * - Reads failed products from classification_retry_log table
 * - Rate limiting: 2 requests/second max to avoid Gemini API quota issues
 * - Exponential backoff on failures (1min, 2min, 4min, 8min, etc.)
 * - Retries indefinitely until success (no max retries)
 * - Batch processing: 10-20 products at a time
 * - Duplicate prevention: Checks if product exists in pending_products before webhook trigger
 * - Clean-up: Deletes log entries on successful retry
 *
 * Invocation:
 * - Scheduled via pg_cron (every 15 minutes)
 * - Manual via POST request
 *
 * Request body (optional):
 * {
 *   "batchSize": 20,        // Number of products to process (default: 20)
 *   "vendor": "argos"       // Filter by vendor (optional)
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { classifyProduct } from '../_shared/gemini-classification.ts';

interface FailedProduct {
  id: string;
  name: string;
  description: string;
  vendor: string;
  url: string;
  retry_count: number;
  last_error?: string;
  last_error_type?: string;
}

interface ClassificationResult {
  productId: string;
  success: boolean;
  rejected?: boolean;
  classification?: 'not_medicine' | 'gsl' | 'pharmacy' | 'pom' | 'unclear';
  reason?: string;
  confidence?: number;
  error?: {
    message: string;
    retryable: boolean;
  };
}

interface ProcessingResult {
  total_processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{
    product_id: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
  }>;
}

// Configuration
const DEFAULT_BATCH_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 500; // 2 requests per second (500ms between requests)
const EXPONENTIAL_BACKOFF_BASE_MS = 60000; // 1 minute base delay

/**
 * Calculate next retry timestamp using exponential backoff
 * Retry 1: 1 minute
 * Retry 2: 2 minutes
 * Retry 3: 4 minutes
 */
function calculateNextRetryAt(retryCount: number): Date {
  const delayMs = EXPONENTIAL_BACKOFF_BASE_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs);
}

/**
 * Determine error type from error message for retry strategy
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
  if (errorMessage.includes('parse') || errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 'validation_error';
  }
  return 'unknown';
}

/**
 * Query failed products from classification_retry_log that need retry
 * Reads directly from log table (populated by push-to-pending on classification failures)
 */
async function getFailedProducts(
  supabase: any,
  batchSize: number,
  vendor?: string
): Promise<FailedProduct[]> {
  console.log('🔍 Querying failed products from classification_retry_log...', { batchSize, vendor });

  // Query classification_retry_log for products ready to retry
  const now = new Date().toISOString();
  let query = supabase
    .from('classification_retry_log')
    .select(`
      scraped_product_id,
      retry_count,
      last_error,
      last_error_type,
      product_name,
      product_vendor,
      next_retry_at
    `)
    .eq('status', 'retrying')
    .lte('next_retry_at', now); // Only products where next_retry_at has passed

  if (vendor) {
    query = query.eq('product_vendor', vendor);
  }

  const { data: retryLogs, error: queryError } = await query
    .order('next_retry_at', { ascending: true }) // Process oldest first
    .limit(batchSize);

  if (queryError) {
    console.error('❌ Error querying classification_retry_log:', queryError);
    throw new Error(`Failed to query classification_retry_log: ${queryError.message}`);
  }

  if (!retryLogs || retryLogs.length === 0) {
    console.log('✅ No failed products found that need retry');
    return [];
  }

  console.log(`📊 Found ${retryLogs.length} products ready for retry`);

  // Get product details from scraped_products
  const productIds = retryLogs.map((log: any) => log.scraped_product_id);
  const { data: products, error: productError } = await supabase
    .from('scraped_products')
    .select('id, name, description, vendor, url')
    .in('id', productIds);

  if (productError) {
    console.error('❌ Error querying scraped_products:', productError);
    throw new Error(`Failed to query scraped_products: ${productError.message}`);
  }

  // Map products with retry log data
  const productMap = new Map((products || []).map((p: any) => [p.id, p]));
  const failedProducts = retryLogs
    .map((log: any) => {
      const product: any = productMap.get(log.scraped_product_id);
      if (!product) return null;

      return {
        id: product.id,
        name: product.name || log.product_name,
        description: product.description || '',
        vendor: product.vendor || log.product_vendor,
        url: product.url || '',
        retry_count: log.retry_count || 0,
        last_error: log.last_error,
        last_error_type: log.last_error_type,
      };
    })
    .filter((p: any) => p !== null);

  console.log(`✅ ${failedProducts.length} products eligible for retry`);

  return failedProducts;
}

/**
 * Classify a single product using the shared Gemini classification function
 * Same approach as push-to-pending edge function
 */
async function classifySingleProduct(
  supabase: any,
  product: FailedProduct,
  geminiApiKey: string
): Promise<ClassificationResult> {
  try {
    console.log(`🔮 Classifying product: ${product.name}`);

    // Call shared classification function (same as push-to-pending)
    const classification = await classifyProduct(
      product.name || 'Unknown product',
      product.description || '',
      geminiApiKey,
      supabase // Pass supabase client for custom guidelines
    );

    console.log(`📋 Classification result: ${classification.classification} (rejected: ${classification.rejected})`);

    return {
      productId: product.id,
      success: true,
      rejected: classification.rejected,
      classification: classification.classification,
      reason: classification.reason,
      confidence: classification.confidence,
      error: undefined,
    };

  } catch (error) {
    console.error(`❌ Error classifying product ${product.id}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      productId: product.id,
      success: false,
      rejected: false,
      error: {
        message: errorMessage,
        retryable: errorMessage.includes('429') ||
                   errorMessage.includes('quota') ||
                   errorMessage.includes('rate limit') ||
                   errorMessage.includes('500') ||
                   errorMessage.includes('502') ||
                   errorMessage.includes('503') ||
                   errorMessage.includes('504') ||
                   errorMessage.includes('ECONNREFUSED') ||
                   errorMessage.includes('ETIMEDOUT'),
      },
    };
  }
}

/**
 * Process a batch of failed products with rate limiting
 * Uses the same classification approach as push-to-pending
 */
async function processBatch(
  supabase: any,
  products: FailedProduct[]
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    total_processed: products.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  if (products.length === 0) {
    return result;
  }

  console.log(`⚙️ Processing batch of ${products.length} products with rate limiting...`);

  // Get Gemini API key (same as push-to-pending)
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Process each product with rate limiting
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Classify product using shared function (same as push-to-pending)
    const classification = await classifySingleProduct(supabase, product, geminiApiKey);

    if (!classification) {
      console.error(`❌ No classification result for product ${product.id}`);
      result.failed++;
      result.results.push({
        product_id: product.id,
        status: 'failed',
        message: 'No classification result returned',
      });
      continue;
    }

    // Handle successful classification
    if (classification.success && !classification.error) {
      console.log(`✅ Product ${product.id} classified successfully: ${classification.rejected ? 'REJECTED' : 'ACCEPTED'}`);

      // Check if product already exists in pending_products to avoid duplicates
      const { data: existingPending, error: checkError } = await supabase
        .from('pending_products')
        .select('id')
        .eq('scraped_product_id', product.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error(`❌ Error checking pending_products for ${product.id}:`, checkError);
        result.failed++;
        result.results.push({
          product_id: product.id,
          status: 'failed',
          message: `Classification succeeded but pending check failed: ${checkError.message}`,
        });
        continue;
      }

      if (existingPending) {
        console.log(`⏭️ Product ${product.id} already exists in pending_products, skipping webhook trigger`);

        // Delete log entry - product already successfully classified and in pending_products
        await supabase
          .from('classification_retry_log')
          .delete()
          .eq('scraped_product_id', product.id);

        console.log(`🗑️ Deleted log entry for ${product.id} - already in pending_products`);

        result.skipped++;
        result.results.push({
          product_id: product.id,
          status: 'skipped',
          message: 'Already exists in pending_products',
        });
        continue;
      }

      // Update scraped_products with classification (same as push-to-pending)
      const { error: updateError } = await supabase
        .from('scraped_products')
        .update({
          rejected: classification.rejected,
          classification: classification.classification,
          classification_reason: classification.reason || 'Retry classification successful',
          classification_confidence: classification.confidence || 0.8,
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`❌ Error updating scraped_products for ${product.id}:`, updateError);
        result.failed++;
        result.results.push({
          product_id: product.id,
          status: 'failed',
          message: `Classification succeeded but database update failed: ${updateError.message}`,
        });
      } else {
        // If ACCEPTED, the push-to-pending webhook will fire automatically
        // (The webhook is set up for INSERT/UPDATE on scraped_products)
        // Since we just updated the product, it will create the pending_products entry

        // Delete log entry - classification succeeded
        await supabase
          .from('classification_retry_log')
          .delete()
          .eq('scraped_product_id', product.id);

        console.log(`🗑️ Deleted log entry for ${product.id} - classification successful`);

        result.successful++;
        result.results.push({
          product_id: product.id,
          status: 'success',
          message: `Classified as ${classification.rejected ? 'REJECTED' : 'ACCEPTED'}`,
        });
      }
    }
    // Handle failed classification
    else if (classification.error) {
      console.error(`❌ Product ${product.id} classification failed:`, classification.error.message);

      const newRetryCount = product.retry_count + 1;
      const errorType = classifyErrorType(classification.error.message);
      const nextRetryAt = calculateNextRetryAt(newRetryCount);

      // Update retry log with incremented retry count
      await supabase
        .from('classification_retry_log')
        .update({
          retry_count: newRetryCount,
          last_retry_at: new Date().toISOString(),
          next_retry_at: nextRetryAt,
          last_error: classification.error.message,
          last_error_type: errorType,
        })
        .eq('scraped_product_id', product.id);

      console.log(`🔄 Updated log entry for ${product.id} - retry ${newRetryCount}, next retry at ${nextRetryAt}`);

      result.failed++;
      result.results.push({
        product_id: product.id,
        status: 'failed',
        message: `Retry ${newRetryCount} failed, will retry at ${nextRetryAt}`,
      });
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

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('🚀 Retry failed classifications started');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;
    const vendor = body.vendor || undefined;

    console.log('📋 Configuration:', { batchSize, vendor });

    // Get failed products from classification_retry_log
    const failedProducts = await getFailedProducts(supabase, batchSize, vendor);

    if (failedProducts.length === 0) {
      console.log('✅ No failed products to retry');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No failed products found that need retry',
          total_processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          results: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process batch
    const result = await processBatch(supabase, failedProducts);

    console.log('✅ Retry processing completed:', {
      total: result.total_processed,
      successful: result.successful,
      failed: result.failed,
      skipped: result.skipped,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${result.total_processed} products: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('💥 Unexpected error:', err);
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
