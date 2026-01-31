/**
 * Push Scraped Products to Pending Products Table
 *
 * This Edge Function triggers when products are inserted, updated, or deleted in scraped_products:
 * - INSERT: Classifies product using Gemini AI, then creates pending_products entry if ACCEPTED
 * - UPDATE: Checks if product has completed agents and marks for full ERPNext sync
 * - DELETE: Removes corresponding entries from pending_products
 *
 * Classification Logic (UK Medicine Compliance):
 * - Products are classified as: not_medicine, gsl, pharmacy, pom, or unclear
 * - ACCEPTED products (not_medicine, gsl) proceed to pending_products
 * - REJECTED products (pharmacy, pom, unclear) are flagged in scraped_products and excluded
 *
 * When a product is updated and already has both category and dimension processing complete,
 * it sets sync_full_product=true to ensure ALL product fields (not just agent results)
 * are sent to ERPNext on the next cron sync.
 *
 * Trigger: Database webhook on INSERT/UPDATE/DELETE to scraped_products table
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { classifyProduct } from '../_shared/gemini-classification.ts';

const BATCH_SIZE = 100;
const EXPONENTIAL_BACKOFF_BASE_MS = 60000; // 1 minute base delay

/**
 * Calculate next retry timestamp using exponential backoff
 * Retry 1: 1 minute, Retry 2: 2 minutes, Retry 3: 4 minutes, etc.
 */
function calculateNextRetryAt(retryCount: number): string {
  const delayMs = EXPONENTIAL_BACKOFF_BASE_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs).toISOString();
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

interface ScrapedProduct {
  id: string;
  vendor: string;
  url: string;
  product_id: string;
  breadcrumbs?: any;
  name?: string;
  description?: string;
  rejected?: boolean;
  classification?: string;
}

interface PendingProduct {
  product_id: string;
  scraped_product_id: string;
  url: string;
  vendor: string;
  breadcrumbs?: any;
  category_status: string;
  weight_and_dimension_status: string;
  seo_status: string;
  faq_status: string;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: ScrapedProduct;
  schema: string;
  old_record: null | ScrapedProduct;
}

/**
 * Create a pending product entry from a scraped product
 * Includes UK medicine classification validation before insertion
 * Returns the created pending product ID or null if creation failed or product rejected
 */
async function createPendingProduct(
  supabase: any,
  scrapedProduct: ScrapedProduct,
): Promise<{ id: string | null; error: any | null; isDuplicate: boolean; rejected: boolean }> {

  // STEP 1: Classify product using Gemini AI
  console.log('🔍 Classifying product for UK medicine compliance:', {
    name: scrapedProduct.name,
    id: scrapedProduct.id,
  });

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    return { id: null, error: new Error('GEMINI_API_KEY not configured'), isDuplicate: false, rejected: true };
  }

  let classification;
  try {
    classification = await classifyProduct(
      scrapedProduct.name || 'Unknown product',
      scrapedProduct.description || '',
      geminiApiKey,
      supabase
    );

    console.log('📋 Classification result:', {
      rejected: classification.rejected,
      classification: classification.classification,
      reason: classification.reason,
      confidence: classification.confidence,
    });
  } catch (error) {
    // Classification failed - create retry log entry
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyErrorType(errorMessage);

    console.error('❌ Classification failed:', errorMessage);
    console.log('📝 Creating retry log entry for failed classification');

    // Create retry log entry
    await supabase
      .from('classification_retry_log')
      .insert({
        scraped_product_id: scrapedProduct.id,
        retry_count: 0,
        status: 'retrying',
        last_error: errorMessage,
        last_error_type: errorType,
        next_retry_at: calculateNextRetryAt(0),
        product_name: scrapedProduct.name,
        product_vendor: scrapedProduct.vendor,
      });

    console.log('✅ Retry log entry created, will retry later');

    // Return error to indicate classification failed
    return { id: null, error, isDuplicate: false, rejected: false };
  }

  // STEP 2: Update scraped_products with classification results
  const { error: updateError } = await supabase
    .from('scraped_products')
    .update({
      rejected: classification.rejected,
      classification: classification.classification,
      classification_reason: classification.reason,
      classification_confidence: classification.confidence,
    })
    .eq('id', scrapedProduct.id);

  if (updateError) {
    console.error('❌ Error updating classification in scraped_products:', updateError);
    // Continue anyway - classification is stored even if update fails
  }

  // STEP 3: If product is REJECTED, do not create pending_products entry
  if (classification.rejected) {
    console.log('🚫 Product REJECTED - will not be added to pending_products:', {
      classification: classification.classification,
      reason: classification.reason,
    });
    return { id: null, error: null, isDuplicate: false, rejected: true };
  }

  // STEP 4: Product ACCEPTED - proceed with pending_products creation
  console.log('✅ Product ACCEPTED - proceeding to pending_products:', {
    classification: classification.classification,
  });

  const pendingProduct: PendingProduct = {
    product_id: scrapedProduct.product_id,
    scraped_product_id: scrapedProduct.id,
    url: scrapedProduct.url || '',
    vendor: scrapedProduct.vendor || '',
    breadcrumbs: scrapedProduct.breadcrumbs || null,
    category_status: 'pending',
    weight_and_dimension_status: 'pending',
    seo_status: 'pending',
    faq_status: 'pending',
  };

  console.log('📦 Creating pending product:', {
    scraped_product_id: pendingProduct.scraped_product_id,
    vendor: pendingProduct.vendor,
  });

  const { data, error } = await supabase
    .from('pending_products')
    .insert([pendingProduct])
    .select();

  if (error) {
    // Check if it's a duplicate (foreign key constraint or unique constraint)
    if (
      error.code === '23505' || // Unique constraint violation
      error.message.includes('duplicate') ||
      error.message.includes('already exists')
    ) {
      console.log('⚠️ Pending product already exists, skipping');
      return { id: null, error: null, isDuplicate: true, rejected: false };
    }
    // Other errors
    console.error('❌ Database error creating pending product:', error);
    return { id: null, error, isDuplicate: false, rejected: false };
  }

  console.log('✅ Pending product created successfully');
  return { id: data?.[0]?.id || null, error: null, isDuplicate: false, rejected: false };
}

/**
 * Check if products exist in pending_products with both category and dimension complete
 * If so, update their updated_at timestamp and set sync_full_product flag to trigger cron job sync
 *
 * BUG FIX: Skip products that were recently synced to ERPNext (within last 5 minutes)
 * to prevent infinite loop between this function and sync-completed-products-to-erpnext
 */
async function markCompletedProductsForSync(
  supabase: any,
  scrapedProductIds: string[],
): Promise<number> {
  try {
    if (scrapedProductIds.length === 0) return 0;

    // Calculate timestamp for "recently synced" check (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Query pending_products to find products with both statuses complete
    // EXCLUDE products that were recently synced to ERPNext to prevent infinite loop
    const { data: completedProducts, error: queryError } = await supabase
      .from("pending_products")
      .select("id, scraped_product_id, category_status, weight_and_dimension_status, erpnext_updated_at")
      .in("scraped_product_id", scrapedProductIds)
      .eq("category_status", "complete")
      .eq("weight_and_dimension_status", "complete")
      .or(`erpnext_updated_at.is.null,erpnext_updated_at.lt.${fiveMinutesAgo}`);

    if (queryError) {
      console.error("[SYNC] Error checking completed products:", queryError);
      return 0;
    }

    if (!completedProducts || completedProducts.length === 0) {
      console.log("[SYNC] No completed products found to mark for sync (or all recently synced)");
      return 0;
    }

    console.log(`[SYNC] Found ${completedProducts.length} completed products, marking for ERPNext sync`);

    // Set erpnext_updated_at to NULL AND sync_full_product flag to trigger cron job sync
    // The cron job picks up products where erpnext_updated_at IS NULL or updated_at > erpnext_updated_at
    // sync_full_product=true tells the cron to send ALL product fields, not just agent results
    const productIds = completedProducts.map((p: any) => p.id);

    const { error: updateError } = await supabase
      .from("pending_products")
      .update({
        erpnext_updated_at: null,  // Reset to trigger sync
        sync_full_product: true     // Flag to sync all product fields
      })
      .in("id", productIds);

    if (updateError) {
      console.error("[SYNC] Error updating sync flags:", updateError);
      return 0;
    }

    console.log(`[SYNC] Marked ${completedProducts.length} products for full sync (erpnext_updated_at set to NULL + sync_full_product flag set)`);
    return completedProducts.length;
  } catch (error) {
    console.error("[SYNC] Error in markCompletedProductsForSync:", error);
    return 0;
  }
}

Deno.serve(async (req) => {
  // CORS headers
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload: WebhookPayload = await req.json();

    console.log('📥 Webhook received:', {
      type: payload.type,
      table: payload.table,
      record_id: payload.record?.id,
    });

    // Process INSERT, UPDATE, and DELETE events
    if (payload.type !== 'INSERT' && payload.type !== 'UPDATE' && payload.type !== 'DELETE') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ignoring non-INSERT/UPDATE/DELETE event',
          type: payload.type,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate scraped product record (for DELETE, use old_record)
    const scrapedProduct = payload.type === 'DELETE' ? payload.old_record : payload.record;
    if (!scrapedProduct || !scrapedProduct.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid webhook payload: missing record or id',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseMessage = '';
    let pendingProductId = null;

    // Handle INSERT: Create new pending_products entry (with classification)
    if (payload.type === 'INSERT') {
      const result = await createPendingProduct(supabase, scrapedProduct);

      if (result.error) {
        // Non-duplicate errors should fail the request
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Database insertion failed',
            details: result.error.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (result.rejected) {
        responseMessage = 'Product classified as REJECTED - not added to pending_products';
      } else if (result.isDuplicate) {
        responseMessage = 'Pending product already exists';
      } else {
        responseMessage = 'Product classified as ACCEPTED - pending product created successfully';
        pendingProductId = result.id;
      }
    }

    // Handle UPDATE: Check classification and manage pending_products entry accordingly
    if (payload.type === 'UPDATE') {
      console.log('🔄 Product updated in scraped_products, checking classification status');

      // Check if product is now rejected (e.g., reclassified)
      if (scrapedProduct.rejected === true) {
        console.log('🚫 Product is REJECTED, removing from pending_products if exists');

        // Delete from pending_products
        const { error: deleteError, count } = await supabase
          .from('pending_products')
          .delete()
          .eq('scraped_product_id', scrapedProduct.id);

        if (deleteError) {
          console.error('❌ Error deleting rejected product from pending_products:', deleteError);
          responseMessage = 'Product updated and REJECTED, but failed to remove from pending queue';
        } else {
          console.log(`✅ Removed ${count || 0} rejected product(s) from pending_products`);
          responseMessage = `Product updated and REJECTED, removed from pending queue (${count || 0} entries)`;
        }

        // Skip sync check for rejected products
        return new Response(
          JSON.stringify({
            success: true,
            message: responseMessage,
            scraped_product_id: scrapedProduct.id,
            rejected: true,
            deleted_from_pending: count || 0,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Product is NOT rejected, ensure pending_products entry exists
      console.log('✅ Product is ACCEPTED, ensuring pending_products entry exists');

      // Check if pending_products entry exists
      const { data: existingPending, error: checkError } = await supabase
        .from('pending_products')
        .select('id, scraped_product_id')
        .eq('scraped_product_id', scrapedProduct.id)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking pending_products:', checkError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to check pending_products',
            details: checkError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If pending_products entry doesn't exist, create it (with classification)
      if (!existingPending) {
        console.log('⚠️ Pending product does not exist, creating new entry');

        const result = await createPendingProduct(supabase, scrapedProduct);

        if (result.error) {
          console.error('❌ Error creating pending product on UPDATE:', result.error);
          // Don't fail the entire request, just log the error
          responseMessage = 'Product updated, but failed to create pending entry';
        } else if (result.rejected) {
          console.log('🚫 Product classified as REJECTED during UPDATE');
          responseMessage = 'Product updated, classified as REJECTED';
        } else if (result.isDuplicate) {
          // Race condition: another process created it between our check and insert
          console.log('⚠️ Pending product created by another process');
          responseMessage = 'Product updated, pending entry already exists';
        } else {
          console.log('✅ Pending product created during UPDATE');
          pendingProductId = result.id;
          responseMessage = 'Product updated, classified as ACCEPTED, pending entry created';
        }
      } else {
        console.log('✅ Pending product exists, continuing with sync check');
        pendingProductId = existingPending.id;
        responseMessage = 'Product updated, checked for sync';
      }
    }

    // Handle DELETE: Remove corresponding pending_products entry
    if (payload.type === 'DELETE') {
      console.log('🗑️ Product deleted from scraped_products, removing from pending_products:', {
        scraped_product_id: scrapedProduct.id,
        vendor: scrapedProduct.vendor,
      });

      const { error: deleteError, count } = await supabase
        .from('pending_products')
        .delete()
        .eq('scraped_product_id', scrapedProduct.id);

      if (deleteError) {
        console.error('❌ Error deleting pending product:', deleteError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to delete pending product',
            details: deleteError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Deleted ${count || 0} pending product(s)`);
      responseMessage = `Deleted ${count || 0} pending product(s)`;

      return new Response(
        JSON.stringify({
          success: true,
          message: responseMessage,
          scraped_product_id: scrapedProduct.id,
          deleted_count: count || 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For both INSERT and UPDATE: Check if product needs full sync to ERPNext
    const syncedCount = await markCompletedProductsForSync(supabase, [scrapedProduct.id]);

    if (syncedCount > 0) {
      console.log(`✅ Marked ${syncedCount} product(s) for full ERPNext sync`);
      responseMessage += ` (marked for full ERPNext sync)`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: responseMessage || 'Processed successfully',
        scraped_product_id: scrapedProduct.id,
        pending_product_id: pendingProductId,
        marked_for_sync: syncedCount > 0,
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
