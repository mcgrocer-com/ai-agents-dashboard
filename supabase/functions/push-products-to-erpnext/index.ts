/**
 * Supabase Edge Function: push-products-to-erpnext
 *
 * Manual on-demand push of specific products to ERPNext by product URLs.
 * Accepts array of product URLs and pushes them to ERPNext immediately.
 *
 * Flow:
 * 1. Accept array of product URLs in request body
 * 2. Query and validate products (must have valid scraped_product_id, url, vendor)
 * 3. Batch process products using ERPNext API (batch_size=5)
 * 4. Push to Production ERPNext (REQUIRED - failures block process)
 * 5. Push to Staging ERPNext (OPTIONAL - failures logged only, non-blocking)
 * 6. Verify successful updates via ERPNext API
 * 7. Update erpnext_updated_at timestamps for verified products
 * 8. Sync agent data back to scraped_products
 * 9. Return detailed results for each product
 *
 * Request Body:
 * {
 *   productUrls: string[]  // Array of pending_products.url
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   results: Array<{
 *     productId: string
 *     url: string
 *     status: 'success' | 'failed'
 *     itemCode?: string
 *     error?: string
 *   }>
 *   summary: {
 *     total: number
 *     successful: number
 *     failed: number
 *   }
 * }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Database connection
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

// Shared utilities
import {
  type PendingProduct,
  type ERPNextItemPayload,
  type VerifiedProduct,
  productToERPNextFormat,
  sendToERPNextAPI,
  sendToStagingERPNext,
  getExistingERPNextItems,
  verifyItemsUpdated,
  updateVerifiedProducts,
  syncAgentDataToScrapedProducts,
  clearSuccessfulSyncErrors,
  storeFailedSyncErrors,
} from "../_shared/erpnext-utils.ts";

interface PushResult {
  productId: string;
  url: string;
  status: 'success' | 'failed';
  itemCode?: string;
  error?: string;
}

// Initialize Postgres connection
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

/**
 * Query products by URLs
 * Note: No agent status checking - allows manual push of any product with valid data
 * Includes copyright fields to use vendor-neutral content when available
 */
async function getProductsByUrls(productUrls: string[]): Promise<PendingProduct[]> {
  if (productUrls.length === 0) return [];

  const products = await sql`
    SELECT
      pp.*,
      sp.name, sp.price, sp.original_price, sp.description, sp.images,
      sp.main_image, sp.stock_status, sp.variants, sp.url AS scraped_url, sp.product_id AS scraped_product_vendor_id
    FROM pending_products pp
    INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
    WHERE pp.url = ANY(${productUrls})
      AND pp.scraped_product_id IS NOT NULL
  `;

  console.log(`[PUSH] Found ${products.length}/${productUrls.length} valid products to push`);
  return products as PendingProduct[];
}

/**
 * Process products and push to ERPNext
 */
async function processPush(products: PendingProduct[]): Promise<PushResult[]> {
  const results: PushResult[] = [];
  const batchItems: ERPNextItemPayload[] = [];
  const productUrlMap = new Map<string, PendingProduct>();

  // Check which items already exist in ERPNext
  const productUrls = products.filter(p => p.url).map(p => p.url!);
  const existingItems = await getExistingERPNextItems(productUrls);

  // Prepare batch items
  for (const product of products) {
    try {
      if (!product.url) {
        results.push({
          productId: product.id,
          url: '',
          status: 'failed',
          error: 'No URL'
        });
        continue;
      }

      const erpnextItemCode = existingItems.get(product.url) || product.item_code;
      const isUpdate = !!erpnextItemCode;

      // For creation, require either copyright description or original description
      if (!isUpdate && !product.non_copyright_desc && !product.description) {
        results.push({
          productId: product.id,
          url: product.url,
          status: 'failed',
          error: 'No description for creation'
        });
        continue;
      }

      if (erpnextItemCode && !product.item_code) {
        product.item_code = erpnextItemCode;
      }

      const itemData = productToERPNextFormat(product, isUpdate);
      batchItems.push(itemData);
      productUrlMap.set(product.url, product);

    } catch (error) {
      results.push({
        productId: product.id,
        url: product.url || '',
        status: 'failed',
        error: String(error)
      });
    }
  }

  if (batchItems.length === 0) {
    return results;
  }

  // Send to ERPNext
  try {
    const apiResponse = await sendToERPNextAPI(batchItems);

    console.log(`[PUSH] ERPNext API Response:`, JSON.stringify(apiResponse, null, 2));

    const createdOrUpdated: string[] = [];
    const failed: Array<{ productId: string; url: string; error: string }> = [];

    if (apiResponse.message && typeof apiResponse.message === "object") {
      const message = apiResponse.message;
      const createdItems = message.created_items || [];
      const updatedItems = message.updated_items || [];
      const errors = message.errors || [];

      console.log(`[PUSH] Created=${createdItems.length}, Updated=${updatedItems.length}, Errors=${errors.length}`);

      createdOrUpdated.push(...createdItems, ...updatedItems);

      // Extract error details
      for (const err of errors) {
        const url = err.url || '';
        const product = productUrlMap.get(url);
        if (product) {
          failed.push({
            productId: product.id,
            url,
            error: `[${err.action || 'unknown'}] ${err.item || 'unknown'}: ${err.error || 'Unknown error'}`
          });
        }
      }
    }

    // Push to staging (non-blocking)
    await sendToStagingERPNext(batchItems);

    // Verify items in ERPNext
    const verified = createdOrUpdated.length > 0
      ? await verifyItemsUpdated(createdOrUpdated, products)
      : [];

    // Update verified products
    if (verified.length > 0) {
      await updateVerifiedProducts(sql, verified);
      await syncAgentDataToScrapedProducts(sql, verified, products);

      const successfulIds = verified.map(v => v.product_id);
      await clearSuccessfulSyncErrors(sql, successfulIds);

      // Add success results
      for (const v of verified) {
        results.push({
          productId: v.product_id,
          url: products.find(p => p.id === v.product_id)?.url || '',
          status: 'success',
          itemCode: v.item_code
        });
      }
    }

    // Store errors for failed products
    if (failed.length > 0) {
      await storeFailedSyncErrors(sql, failed);

      for (const f of failed) {
        results.push({
          productId: f.productId,
          url: f.url,
          status: 'failed',
          error: f.error
        });
      }
    }

  } catch (error) {
    console.error(`[PUSH] Processing error:`, error);
    const errorMessage = String(error);

    // Mark all as failed
    for (const product of products) {
      if (!results.find(r => r.productId === product.id)) {
        results.push({
          productId: product.id,
          url: product.url || '',
          status: 'failed',
          error: `Batch error: ${errorMessage}`
        });
      }
    }
  }

  return results;
}

/**
 * CORS headers for edge function
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge Function handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body = await req.json();
    const productUrls: string[] = body.productUrls || [];

    if (!Array.isArray(productUrls) || productUrls.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "productUrls array is required and cannot be empty"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[PUSH] Received request to push ${productUrls.length} products`);

    // Get products by URLs
    const products = await getProductsByUrls(productUrls);

    if (products.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No valid products found. Products must have a valid scraped_product_id to be pushed to ERPNext.",
          details: `Requested ${productUrls.length} product(s), found 0 that meet requirements`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Process in batches of 5
    const batchSize = 5;
    const allResults: PushResult[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      console.log(`[PUSH] Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} products`);

      const batchResults = await processPush(batch);
      allResults.push(...batchResults);
    }

    // Calculate summary
    const successful = allResults.filter(r => r.status === 'success').length;
    const failed = allResults.filter(r => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        success: successful > 0,
        results: allResults,
        summary: {
          total: productUrls.length,
          successful,
          failed
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[PUSH] Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
