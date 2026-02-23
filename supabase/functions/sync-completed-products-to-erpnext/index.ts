/**
 * Supabase Edge Function: sync-completed-products-to-erpnext
 *
 * Scheduled cron job (runs every 15 minutes) to push completed products to ERPNext.
 * Replaces the background threading approach from mcgrocer/main.py.
 *
 * Flow:
 * 1. Query products needing ERPNext sync (where agent status is 'complete', classification IS NOT NULL, and erpnext_updated_at is NULL)
 * 2. Filter out rejected classifications (pharmacy, pom, unclear, cbd, tobacco, fresh_perishable)
 * 3. Mark products as "syncing" to prevent duplicate processing
 * 4. Batch process products using ERPNext API (batch_size=25)
 * 5. Push to Production ERPNext (REQUIRED - failures block process)
 * 6. Verify successful updates via ERPNext API
 * 7. Update erpnext_updated_at timestamps for verified products
 * 8. Sync agent data back to scraped_products (category, breadcrumbs, ai_title, ai_description, weight, height, width, length, volumetric_weight)
 * 9. Clear sync marks for failed products (enable retry)
 *
 * Note: Classification is handled by the classify-unclassified-products cron job.
 * This function only syncs products that are already classified.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Database connection
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

// Shared utilities
import {
  type PendingProduct,
  type ERPNextItemPayload,
  type VerifiedProduct,
  type ExistingERPNextItem,
  productToERPNextFormat,
  sendToERPNextAPI,
  getExistingERPNextItems,
  updateVerifiedProducts,
  syncAgentDataToScrapedProducts,
  clearSuccessfulSyncErrors,
  storeFailedSyncErrors,
  getValidMainImage,
} from "../_shared/erpnext-utils.ts";

// Data source filter type (matches frontend)
type SyncDataSource = 'All' | 'Scrapper';

interface SyncResult {
  total_queried: number;
  marked_syncing: number;
  batches_processed: number;
  created_or_updated: number;  // Items ERPNext API claimed to process
  failed: number;              // Items ERPNext API returned errors for
  verified: number;            // Items actually confirmed in ERPNext
  skipped_data_source: number; // Items skipped due to data_source filter
  skipped_invalid_image: number; // Items skipped due to invalid/missing main_image
  validation_resets: {         // Products reset from complete to pending due to invalid data
    category: number;
    weight_dimension: number;
    seo: number;
    copyright: number;
  };
  errors: string[];
}

// Initialize Postgres connection
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

/**
 * Validate and reset agent statuses for products with invalid/empty values
 *
 * This function ensures data quality by validating agent outputs before ERPNext sync.
 * Resets status from 'complete' to 'pending' when:
 * - Category agent: category is NULL, empty string, OR empty JSON array "[]"
 *                   OR breadcrumbs is NULL, empty string, OR empty JSON array "[]"
 * - Weight-dimension agent: weight is NULL or 0, OR any dimension (height, width, length) is NULL or 0
 * - SEO agent: ai_title or ai_description is NULL or empty string
 * - Copyright agent: non_copyright_images is NULL or empty array, OR non_copyright_desc is NULL or empty string
 *
 * @returns Object containing count of resets per agent type
 */
async function validateAndResetInvalidAgents(): Promise<{
  category_reset: number;
  weight_dimension_reset: number;
  seo_reset: number;
  copyright_reset: number;
}> {
  // Reset category status for products with no category or breadcrumbs value
  // Check for NULL, empty string, or empty JSON array "[]"
  // Note: We don't update updated_at here - these are validation resets, not real processing updates
  const categoryResult = await sql`
    UPDATE pending_products
    SET category_status = 'pending'
    WHERE category_status = 'complete'
      AND (
        category IS NULL
        OR category = ''
        OR category = '[]'
        OR breadcrumbs IS NULL
        OR breadcrumbs::text = ''
        OR breadcrumbs::text = '[]'
      )
  `;

  // Reset weight-dimension status for products with missing or invalid weight/dimensions
  // Resets when: no weight OR all dimensions are zero (height AND width AND length)
  // Note: All fields are now NUMERIC type after migration
  const weightResult = await sql`
    UPDATE pending_products
    SET weight_and_dimension_status = 'pending'
    WHERE weight_and_dimension_status = 'complete'
      AND (
        -- Reset if weight is missing or zero
        (weight IS NULL OR weight <= 0)
        OR
        -- Reset if ALL dimensions are missing/zero (height AND width AND length)
        (
          (height IS NULL OR height <= 0)
          AND (width IS NULL OR width <= 0)
          AND (length IS NULL OR length <= 0)
        )
      )
  `;

  // Reset SEO status for products with missing title or description
  const seoResult = await sql`
    UPDATE pending_products
    SET seo_status = 'pending'
    WHERE seo_status = 'complete'
      AND (ai_title IS NULL OR ai_title = '' OR ai_description IS NULL OR ai_description = '')
  `;

  // Reset copyright status for products with missing or empty copyright data
  const copyrightResult = await sql`
    UPDATE pending_products
    SET copyright_status = 'pending'
    WHERE copyright_status = 'complete'
      AND (
        non_copyright_images IS NULL
        OR array_length(non_copyright_images, 1) = 0
        OR non_copyright_desc IS NULL
        OR non_copyright_desc = ''
      )
  `;

  const categoryReset = categoryResult.count || 0;
  const weightReset = weightResult.count || 0;
  const seoReset = seoResult.count || 0;
  const copyrightReset = copyrightResult.count || 0;

  if (categoryReset > 0 || weightReset > 0 || seoReset > 0 || copyrightReset > 0) {
    console.log(`[VALIDATION] Reset invalid agent statuses: Category=${categoryReset}, Weight-Dimension=${weightReset}, SEO=${seoReset}, Copyright=${copyrightReset}`);
  }

  return {
    category_reset: categoryReset,
    weight_dimension_reset: weightReset,
    seo_reset: seoReset,
    copyright_reset: copyrightReset
  };
}

/**
 * Query products needing ERPNext sync
 * Syncs products where ALL required agents (category, weight-dimension, AND SEO) have completed
 * Excludes products with NULL or 0 price
 * Excludes products without valid scraped_product_id reference
 *
 * @param limit - Maximum number of products to fetch
 * @param vendor - Optional vendor filter (single vendor, array of vendors, or undefined for all)
 * @param prioritizeCopyright - If true, only sync products with copyright_status = 'complete'
 */
async function getProductsNeedingSync(
  limit: number,
  vendor?: string | string[],
  prioritizeCopyright: boolean = false
): Promise<PendingProduct[]> {
  // Handle vendor filtering for single vendor, multiple vendors, or all vendors
  let vendorClause;
  if (Array.isArray(vendor) && vendor.length > 0) {
    vendorClause = sql`AND pp.vendor = ANY(${vendor})`;
  } else if (typeof vendor === 'string') {
    vendorClause = sql`AND pp.vendor = ${vendor}`;
  } else {
    vendorClause = sql``;
  }

  // Handle copyright prioritization - only sync products with completed copyright status
  let copyrightClause;
  if (prioritizeCopyright) {
    copyrightClause = sql`AND pp.copyright_status = 'complete'`;
  } else {
    copyrightClause = sql``;
  }

  // Query products that:
  // 1. Have completed ALL required agent processing (category AND weight-dimension AND SEO all = 'complete')
  // 2. Agent data hasn't been synced yet:
  //    - Either never synced to ERPNext (erpnext_updated_at IS NULL)
  //    - OR this agent's data is newer than last sync (agent status updated after erpnext_updated_at)
  // 3. Have a valid scraped_product_id that exists in scraped_products
  // 4. Have a valid price (not NULL and not '0' or 0)
  // 5. If prioritizeCopyright is true, only sync products with copyright_status = 'complete'
  // 6. Skip products that failed sync recently (30 min cooldown) to prevent bad products from
  //    blocking entire batches. Failed products will be retried after the cooldown expires.
  const products = await sql`
    SELECT
      pp.*,
      sp.name, sp.price, sp.original_price, sp.description, sp.images,
      sp.main_image, sp.stock_status, sp.variants, sp.url AS scraped_url, sp.product_id AS scraped_product_vendor_id,
      sp.classification, sp.rejected, sp.blacklisted, sp.id AS scraped_product_db_id,
      sp.timestamp
    FROM pending_products pp
    INNER JOIN scraped_products sp ON pp.scraped_product_id = sp.id
    WHERE pp.category_status = 'complete'
      AND pp.weight_and_dimension_status = 'complete'
      AND pp.seo_status = 'complete'
      AND (
        pp.erpnext_updated_at IS NULL
        OR pp.updated_at > pp.erpnext_updated_at
      )
      AND (
        pp.sync_started_at IS NULL
        OR pp.sync_started_at < NOW() - INTERVAL '10 minutes'
      )
      AND (
        pp.failed_sync_at IS NULL
        OR pp.failed_sync_at < NOW() - INTERVAL '30 minutes'
      )
      AND pp.scraped_product_id IS NOT NULL
      AND sp.price IS NOT NULL
      AND sp.price::text != '0'
      AND sp.price::text != ''
      AND sp.price > 0
      AND sp.blacklisted IS NOT TRUE
      AND (sp.rejected IS NOT TRUE OR sp.rejected IS NULL)
      AND sp.classification IS NOT NULL
      ${vendorClause}
      ${copyrightClause}
    ORDER BY
      pp.updated_at ASC
    LIMIT ${limit}
  `;

  const vendorDesc = Array.isArray(vendor)
    ? `vendors: ${vendor.join(', ')}`
    : vendor
      ? `vendor: ${vendor}`
      : 'all vendors';
  const copyrightDesc = prioritizeCopyright ? ', copyright complete only' : '';
  console.log(`[SYNC] Found ${products.length} products needing ERPNext sync (${vendorDesc}${copyrightDesc}, all required agents complete: category AND weight-dimension AND SEO AND FAQ, valid scraped_product_id, valid price)`);
  return products as PendingProduct[];
}

/**
 * Mark products as "syncing" to prevent duplicate processing
 */
async function markProductsSyncing(productIds: string[]): Promise<number> {
  if (productIds.length === 0) return 0;

  const currentTime = new Date().toISOString();

  const result = await sql`
    UPDATE pending_products
    SET sync_started_at = ${currentTime}
    WHERE id = ANY(${productIds})
  `;

  const count = result.count || 0;
  console.log(`[SYNC] Marked ${count} products as syncing (sync_started_at)`);
  return count;
}

/**
 * Clear sync marks for failed products (enable retry)
 */
async function clearSyncMarks(productIds: string[]): Promise<number> {
  if (productIds.length === 0) return 0;

  const result = await sql`
    UPDATE pending_products
    SET sync_started_at = NULL
    WHERE id = ANY(${productIds})
  `;

  const count = result.count || 0;
  console.log(`[SYNC] Cleared sync marks for ${count} products (available for retry)`);
  return count;
}

/**
 * Filter products by classification acceptance status.
 *
 * IMPORTANT: This is a critical safety function that prevents regulated medical products
 * from being added to ERPNext. UK law requires proper licensing for pharmacy and POM items.
 *
 * Note: Classification is handled by the classify-unclassified-products cron job.
 * All products reaching this point already have sp.classification IS NOT NULL.
 *
 * Flow:
 * - Filters out rejected products (pharmacy, pom, unclear, cbd, tobacco, fresh_perishable)
 * - Syncs agent data to scraped_products before removal (preserves AI work)
 * - Removes rejected products from pending_products table
 *
 * @param products - Pre-classified products to validate
 * @returns Only products that are safe to sync to ERPNext (not_medicine or GSL only)
 */
async function processClassificationValidation(
  products: PendingProduct[]
): Promise<PendingProduct[]> {
  if (products.length === 0) return [];

  console.log(`[CLASSIFICATION] Processing ${products.length} products for classification validation`);

  const acceptedProducts: PendingProduct[] = [];
  const rejectedProducts: PendingProduct[] = [];

  for (const product of products) {
    // Check if product is explicitly rejected in database
    if (product.rejected === true) {
      rejectedProducts.push(product);
      continue;
    }

    // Check if product is blacklisted from ERPNext sync
    if (product.blacklisted === true) {
      rejectedProducts.push(product);
      console.log(`[CLASSIFICATION] Product ${product.name} is blacklisted - skipping ERPNext sync`);
      continue;
    }

    // Check classification type
    const classification = product.classification?.toLowerCase();

    if (classification === 'not_medicine' || classification === 'gsl') {
      // Accepted: safe to sell
      acceptedProducts.push(product);
    } else if (classification === 'pharmacy' || classification === 'pom' || classification === 'unclear' || classification === 'cbd' || classification === 'tobacco' || classification === 'fresh_perishable') {
      // Rejected: cannot sell
      rejectedProducts.push(product);
    } else {
      // Unknown classification type - treat as rejected for safety
      console.warn(`[CLASSIFICATION] Product ${product.name} has unknown classification: "${classification}" - treating as rejected`);
      rejectedProducts.push(product);
    }
  }

  console.log(`[CLASSIFICATION] Breakdown: ${acceptedProducts.length} accepted, ${rejectedProducts.length} rejected`);

  // Sync agent data to scraped_products BEFORE removing rejected products
  // This preserves category, breadcrumbs, ai_title, ai_description, weight, dimensions, etc.
  if (rejectedProducts.length > 0) {
    console.log(`[CLASSIFICATION] Syncing agent data for ${rejectedProducts.length} rejected products before removal`);

    const rejectedVerified: VerifiedProduct[] = rejectedProducts
      .filter(p => p.scraped_product_db_id)
      .map(p => ({
        product_id: p.id,
        item_code: p.item_code || 'REJECTED',
        erpnext_modified: new Date().toISOString(),
        verified: false
      }));

    if (rejectedVerified.length > 0) {
      await syncAgentDataToScrapedProducts(sql, rejectedVerified, rejectedProducts);
      console.log(`[CLASSIFICATION] Synced agent data for ${rejectedVerified.length} rejected products to scraped_products`);
    }
  }

  // Remove rejected products from pending_products table
  if (rejectedProducts.length > 0) {
    console.log(`[CLASSIFICATION] Removing ${rejectedProducts.length} rejected products (pharmacy/pom/unclear) from pending_products`);

    const rejectedPendingIds = rejectedProducts.map(p => p.id);
    const result = await sql`
      DELETE FROM pending_products
      WHERE id = ANY(${rejectedPendingIds})
    `;

    const deletedCount = result.count || 0;
    console.log(`[CLASSIFICATION] Removed ${deletedCount} rejected products from pending_products table`);
  }

  console.log(`[CLASSIFICATION] Returning ${acceptedProducts.length} accepted products for ERPNext sync`);
  return acceptedProducts;
}

/**
 * Validate that a product has all required agent data before syncing to ERPNext
 * If validation fails, resets the corresponding agent status to 'pending'
 * Returns validation result with list of invalid fields
 */
async function validateProductAgentData(product: PendingProduct): Promise<{
  isValid: boolean;
  invalidFields: string[];
}> {
  const invalidFields: string[] = [];

  // Category validation
  const hasValidCategory = product.category &&
                           product.category !== '' &&
                           product.category !== '[]';
  if (!hasValidCategory) invalidFields.push('category');

  // Breadcrumb validation
  const hasValidBreadcrumb = product.breadcrumbs &&
                             JSON.stringify(product.breadcrumbs) !== '[]' &&
                             (Array.isArray(product.breadcrumbs) ? product.breadcrumbs.length > 0 : true);
  if (!hasValidBreadcrumb) invalidFields.push('breadcrumb');

  // Weight validation
  const hasValidWeight = product.weight !== null &&
                        product.weight !== undefined &&
                        product.weight > 0;
  if (!hasValidWeight) invalidFields.push('weight');

  // Volumetric weight validation
  const hasValidVolumetricWeight = product.volumetric_weight !== null &&
                                   product.volumetric_weight !== undefined &&
                                   product.volumetric_weight > 0;
  if (!hasValidVolumetricWeight) invalidFields.push('volumetric_weight');

  // Dimensions validation - at least one dimension required
  const hasValidDimensions = (product.height !== null && product.height > 0) ||
                            (product.width !== null && product.width > 0) ||
                            (product.length !== null && product.length > 0);
  if (!hasValidDimensions) invalidFields.push('dimensions');

  // SEO validation
  const hasValidSEO = product.ai_title &&
                     product.ai_title !== '' &&
                     product.ai_description &&
                     product.ai_description !== '';
  if (!hasValidSEO) invalidFields.push('SEO');

  // If validation failed, reset the appropriate agent statuses to 'pending'
  if (invalidFields.length > 0) {
    const updates: { [key: string]: string } = {};

    // Reset category status if category or breadcrumb is invalid
    if (!hasValidCategory || !hasValidBreadcrumb) {
      updates.category_status = 'pending';
    }

    // Reset weight-dimension status if weight, volumetric_weight, or dimensions are invalid
    if (!hasValidWeight || !hasValidVolumetricWeight || !hasValidDimensions) {
      updates.weight_and_dimension_status = 'pending';
    }

    // Reset SEO status if SEO data is invalid
    if (!hasValidSEO) {
      updates.seo_status = 'pending';
    }

    // Update the database
    if (Object.keys(updates).length > 0) {
      const updateFields = Object.entries(updates)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(', ');

      await sql.unsafe(`
        UPDATE pending_products
        SET ${updateFields}
        WHERE id = '${product.id}'
      `);

      console.log(`[VALIDATION] Reset agent statuses for product ${product.id}: ${Object.keys(updates).join(', ')}`);
    }
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields
  };
}

/**
 * Process a batch of products and sync to ERPNext
 *
 * OPTIMIZED: Uses single batch API call to check existence instead of N individual calls.
 * This reduces API overhead from O(n) to O(1) for existence checks.
 *
 * Key validations before sync:
 * 1. All required agent data must be present and valid
 * 2. Image URL must be valid http/https URL (ERPNext requirement)
 * 3. Data source filter applied (e.g., only sync Scrapper-sourced items)
 *
 * Dual-write pattern:
 * - Production ERPNext: Required, failures block process
 * - Staging ERPNext: Optional, failures logged only (non-blocking)
 *
 * @param products - Products to process
 * @param dataSourceFilter - Filter for ERPNext data_source ('All' = no filter, 'Scrapper' = only update items with data_source='Scrapper')
 * @returns Processing results with item codes, verification status, and error details
 */
async function processBatch(
  products: PendingProduct[],
  dataSourceFilter: SyncDataSource = 'All'
): Promise<{
  created_or_updated: string[];  // Item codes returned by ERPNext API
  failed: Array<{ url: string; error: string }>;  // Failed products with error messages
  verified: VerifiedProduct[];   // Actually verified in ERPNext
  skipped_data_source: number;   // Products skipped due to data_source filter
  skipped_invalid_image: number; // Products skipped due to invalid/missing main_image
  invalid_image_products: Array<{ url: string; error: string }>; // Products with invalid images for error storage
}> {
  const batchItems: ERPNextItemPayload[] = [];
  const productUrlMap = new Map<string, PendingProduct>();
  let skippedDataSource = 0;
  let skippedInvalidImage = 0;
  const invalidImageProducts: Array<{ url: string; error: string }> = [];

  // OPTIMIZATION: Batch check all URLs at once instead of individual lookups
  const productUrls = products.filter(p => p.url).map(p => p.url!);
  const existingItems = await getExistingERPNextItems(productUrls);

  // Prepare batch items
  for (const product of products) {
    try {
      if (!product.url) {
        console.error(`Skipping product ${product.id}: No URL`);
        continue;
      }

      // Check if item exists using batched results
      const existingItem: ExistingERPNextItem | undefined = existingItems.get(product.url);
      const erpnextItemCode = existingItem?.itemCode || product.item_code;
      const isUpdate = !!erpnextItemCode;

      // DATA SOURCE FILTER: For updates, check if ERPNext item's data_source matches our filter
      if (isUpdate && dataSourceFilter !== 'All' && existingItem) {
        const erpnextDataSource = existingItem.dataSource;

        // If ERPNext item has a different data_source than our filter, skip it
        if (erpnextDataSource && erpnextDataSource !== dataSourceFilter) {
          console.log(`[SYNC] Skipping product ${product.id} (${product.url}): ERPNext data_source='${erpnextDataSource}' doesn't match filter='${dataSourceFilter}'`);
          skippedDataSource++;
          continue;
        }
      }

      // Check if we need to sync full product (set when scraped_products updated)
      const syncFullProduct = product.sync_full_product === true;

      // For creation, require description
      if (!isUpdate && !product.description) {
        console.error(`Skipping product ${product.id}: No description for creation`);
        continue;
      }

      // CRITICAL: Validate ALL agent data before sending to ERPNext
      const validation = await validateProductAgentData(product);
      if (!validation.isValid) {
        console.error(`[SYNC] Skipping product ${product.id} (${product.name}): Missing required agent data - ${validation.invalidFields.join(', ')}`);
        continue;
      }

      // CRITICAL: Validate main_image URL - ERPNext requires valid http/https URLs
      const validMainImage = getValidMainImage(product);
      if (!validMainImage) {
        const currentImageValue = product.main_image ||
          (Array.isArray(product.non_copyright_images) ? product.non_copyright_images[0] : null) ||
          'null';
        const errorMsg = `Invalid or missing main_image URL. Image must start with http:// or https://. Current value: ${currentImageValue}`;
        console.error(`[SYNC] Skipping product ${product.id} (${product.name}): ${errorMsg}`);
        skippedInvalidImage++;
        invalidImageProducts.push({
          url: product.url,
          error: errorMsg
        });
        continue;
      }

      // Update product's item_code if we found it from ERPNext but don't have it in DB
      if (erpnextItemCode && !product.item_code) {
        product.item_code = erpnextItemCode;
      }

      const itemData = productToERPNextFormat(product, isUpdate, syncFullProduct);
      batchItems.push(itemData);
      productUrlMap.set(product.url, product);

      // Log when syncing full product
      if (syncFullProduct) {
        console.log(`[SYNC] Product ${product.id} marked for FULL sync (all fields will be sent)`);
      }

    } catch (error) {
      console.error(`Error preparing product ${product.id}:`, error);
    }
  }

  if (skippedDataSource > 0) {
    console.log(`[SYNC] Skipped ${skippedDataSource} products due to data_source filter (filter=${dataSourceFilter})`);
  }

  if (skippedInvalidImage > 0) {
    console.log(`[SYNC] Skipped ${skippedInvalidImage} products due to invalid/missing main_image`);
  }

  if (batchItems.length === 0) {
    return {
      created_or_updated: [],
      failed: [],
      verified: [],
      skipped_data_source: skippedDataSource,
      skipped_invalid_image: skippedInvalidImage,
      invalid_image_products: invalidImageProducts
    };
  }

  // Send to Production ERPNext API
  try {
    const apiResponse = await sendToERPNextAPI(batchItems);

    // LOG: Full API response for debugging
    console.log(`[PROD] ERPNext API Response:`, JSON.stringify(apiResponse, null, 2));

    const created_or_updated: string[] = [];  // Item codes
    const failed: Array<{ url: string; error: string }> = [];  // Failed with errors
    const verified: VerifiedProduct[] = [];

    // ERPNext API returns: { message: { status, created_items, updated_items, errors } }
    // Items are objects: { item_code: string, url: string }
    if (apiResponse.message && typeof apiResponse.message === "object") {
      const message = apiResponse.message;
      const createdItems = message.created_items || [];
      const updatedItems = message.updated_items || [];
      const skippedItems = message.skipped_items || [];
      const errors = message.errors || [];

      console.log(`[PROD] ERPNext API: Created=${createdItems.length}, Updated=${updatedItems.length}, Skipped=${skippedItems.length}, Errors=${errors.length}`);

      const now = new Date().toISOString();

      // Process created + updated + skipped items — match by URL directly from API response
      // Skipped items (reason: no_change) are also successful — the product exists in ERPNext
      for (const item of [...createdItems, ...updatedItems, ...skippedItems]) {
        // Support both new format (object with item_code + url) and legacy format (plain string)
        const itemCode = typeof item === 'string' ? item : item.item_code;
        const itemUrl = typeof item === 'string' ? null : item.url;

        if (itemCode) created_or_updated.push(itemCode);

        // Match to our product by URL (preferred) or item_code (fallback)
        const product = itemUrl
          ? productUrlMap.get(itemUrl)
          : products.find(p => p.item_code === itemCode);

        if (product) {
          verified.push({
            product_id: product.id,
            item_code: itemCode,
            erpnext_modified: now,
            verified: true
          });
        } else {
          console.warn(`[PROD] Could not match item ${itemCode} (url: ${itemUrl}) to a product`);
        }
      }

      // Extract error details from API response
      for (const err of errors) {
        const url = err.url || '';
        const errorMsg = err.error || 'Unknown error';
        const action = err.action || 'unknown';
        const item = err.item || 'unknown';

        failed.push({
          url,
          error: `[${action}] ${item}: ${errorMsg}`
        });
      }
    } else {
      console.log(`[PROD] API Response unexpected format. Type: ${typeof apiResponse.message}`);
    }

    console.log(`[PROD] Batch result: ${created_or_updated.length} created/updated, ${failed.length} failed, ${verified.length} verified`);

    return {
      created_or_updated,
      failed,
      verified,
      skipped_data_source: skippedDataSource,
      skipped_invalid_image: skippedInvalidImage,
      invalid_image_products: invalidImageProducts
    };

  } catch (error) {
    console.error(`[PROD] Batch processing error:`, error);
    // Mark all as failed with the error message
    const errorMessage = String(error);
    return {
      created_or_updated: [],
      failed: products.map(p => ({
        url: p.url,
        error: `Batch error: ${errorMessage}`
      })),
      verified: [],
      skipped_data_source: skippedDataSource,
      skipped_invalid_image: skippedInvalidImage,
      invalid_image_products: invalidImageProducts
    };
  }
}

/**
 * Main sync handler
 */
async function syncCompletedProducts(
  batchSize: number = 25,
  apiBatchSize: number = 5,
  vendor?: string | string[],
  prioritizeCopyright: boolean = false,
  dataSourceFilter: SyncDataSource = 'All'
): Promise<SyncResult> {
  const result: SyncResult = {
    total_queried: 0,
    marked_syncing: 0,
    batches_processed: 0,
    created_or_updated: 0,
    failed: 0,
    verified: 0,
    skipped_data_source: 0,
    skipped_invalid_image: 0,
    validation_resets: {
      category: 0,
      weight_dimension: 0,
      seo: 0,
      copyright: 0
    },
    errors: []
  };

  // Global time budget: exit batch loop before hitting 150s Edge Function wall clock limit
  const WALL_CLOCK_BUDGET_MS = 120_000; // 120s budget, leaving 30s safety margin
  const syncStartTime = Date.now();

  try {
    // 0. Validate and reset invalid agent statuses BEFORE syncing
    const validationResult = await validateAndResetInvalidAgents();
    result.validation_resets.category = validationResult.category_reset;
    result.validation_resets.weight_dimension = validationResult.weight_dimension_reset;
    result.validation_resets.seo = validationResult.seo_reset;
    result.validation_resets.copyright = validationResult.copyright_reset;

    // 1. Get products needing sync (any completed agent)
    const allProducts = await getProductsNeedingSync(batchSize, vendor, prioritizeCopyright);
    result.total_queried = allProducts.length;

    if (allProducts.length === 0) {
      console.log(`[SYNC] No products to sync`);
      return result;
    }

    // 2. Filter out rejected classifications (pharmacy, pom, unclear, etc.)
    // Classification is handled by the classify-unclassified-products cron
    const products = await processClassificationValidation(allProducts);

    if (products.length === 0) {
      console.log(`[SYNC] No products passed classification validation - all rejected`);
      return result;
    }

    // 3. Mark products as syncing (prevent duplicates)
    const productIds = products.map(p => p.id);
    result.marked_syncing = await markProductsSyncing(productIds);

    // 4. Process in batches (with time budget enforcement)
    for (let i = 0; i < products.length; i += apiBatchSize) {
      // Check time budget before starting a new batch
      const elapsed = Date.now() - syncStartTime;
      if (elapsed > WALL_CLOCK_BUDGET_MS) {
        const remainingProducts = products.length - i;
        console.warn(`[SYNC] Time budget exceeded (${Math.round(elapsed / 1000)}s / ${WALL_CLOCK_BUDGET_MS / 1000}s). Stopping with ${remainingProducts} products remaining for next run.`);
        result.errors.push(`Time budget exceeded after ${Math.round(elapsed / 1000)}s - ${remainingProducts} products deferred to next run`);
        // Clear sync marks for unprocessed products so they retry next run
        const unprocessedIds = products.slice(i).map(p => p.id);
        await clearSyncMarks(unprocessedIds);
        break;
      }

      const batch = products.slice(i, i + apiBatchSize);
      console.log(`[SYNC] Processing batch ${Math.floor(i / apiBatchSize) + 1}: ${batch.length} products (elapsed: ${Math.round(elapsed / 1000)}s)`);

      try {
        const batchResult = await processBatch(batch, dataSourceFilter);

        result.created_or_updated += batchResult.created_or_updated.length;
        result.failed += batchResult.failed.length;
        result.verified += batchResult.verified.length;
        result.skipped_data_source += batchResult.skipped_data_source;
        result.skipped_invalid_image += batchResult.skipped_invalid_image;
        result.batches_processed++;

        // 4a. Store error messages for products with invalid images and clear sync marks
        if (batchResult.invalid_image_products.length > 0) {
          await storeFailedSyncErrors(sql, batchResult.invalid_image_products);

          // Clear sync marks to enable retry after image is fixed
          const invalidImageUrls = batchResult.invalid_image_products.map(p => p.url);
          const invalidImageProductIds = batch
            .filter(p => invalidImageUrls.includes(p.url))
            .map(p => p.id);

          await clearSyncMarks(invalidImageProductIds);
        }

        // 4b. Update verified products in database
        if (batchResult.verified.length > 0) {
          await updateVerifiedProducts(sql, batchResult.verified);

          // Sync agent data back to scraped_products
          await syncAgentDataToScrapedProducts(sql, batchResult.verified, batch);

          // Clear error messages for successfully synced products
          const successfulIds = batchResult.verified.map(v => v.product_id);
          await clearSuccessfulSyncErrors(sql, successfulIds);
        }

        // 5. Store error messages and clear sync marks for failed products
        if (batchResult.failed.length > 0) {
          // Store error messages
          await storeFailedSyncErrors(sql, batchResult.failed);

          // Clear sync marks to enable retry
          const failedUrls = batchResult.failed.map(f => f.url);
          const failedProductIds = batch
            .filter(p => failedUrls.includes(p.url))
            .map(p => p.id);

          await clearSyncMarks(failedProductIds);
        }

        // 5b. Clear sync marks for unverified products (sent to API but not confirmed in ERPNext)
        // and for skipped products (no URL, no description, failed validation, etc.)
        {
          const verifiedIds = new Set(batchResult.verified.map(v => v.product_id));
          const failedUrls = new Set(batchResult.failed.map(f => f.url));
          const invalidImageUrls = new Set(batchResult.invalid_image_products.map(p => p.url));

          const unverifiedIds = batch
            .filter(p => !verifiedIds.has(p.id) && !failedUrls.has(p.url) && !invalidImageUrls.has(p.url))
            .map(p => p.id);

          if (unverifiedIds.length > 0) {
            console.log(`[SYNC] Clearing sync marks for ${unverifiedIds.length} unverified/skipped products`);
            await clearSyncMarks(unverifiedIds);
          }
        }

      } catch (error) {
        const errorMsg = `Batch ${Math.floor(i / apiBatchSize) + 1} error: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);

        // Store error for all products in batch
        const batchErrors = batch.map(p => ({
          url: p.url,
          error: errorMsg
        }));
        await storeFailedSyncErrors(sql, batchErrors);

        // Clear sync marks for entire batch on error
        const batchIds = batch.map(p => p.id);
        await clearSyncMarks(batchIds);
        result.failed += batch.length;
      }
    }

    console.log(`[SYNC] Complete: ${result.created_or_updated} created/updated by API, ${result.failed} failed, ${result.verified} verified, ${result.skipped_invalid_image} skipped (invalid image) in ERPNext database`);

  } catch (error) {
    const errorMsg = `Sync error: ${error}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Edge Function handler
 */
Deno.serve(async (req) => {
  try {
    // Parse request body for configuration (optional)
    let batchSize = 5000;  // Query up to 5000 products per run; time budget (120s) will stop early if needed
    let apiBatchSize = 25; // Send 25 products per ERPNext API call to reduce round trips
    let vendor: string | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        batchSize = body.batchSize || batchSize;
        apiBatchSize = body.apiBatchSize || apiBatchSize;
        vendor = body.vendor;
      } catch {
        // Use defaults if body parsing fails
      }
    }

    // Check for admin user preferences if no vendor specified
    // Cron jobs don't have user context, so query admin user directly
    let syncVendors: string[] | string | undefined = vendor;
    let prioritizeCopyright = false;
    let syncDataSource: SyncDataSource = 'All';
    let syncEnabled = true; // Default to enabled

    if (!vendor) {
      try {
        // Query admin user preferences (cron jobs don't have user context)
        const adminResult = await sql`
          SELECT id, preferences
          FROM users
          WHERE role = 'admin'
          AND is_active = true
          LIMIT 1
        `;

        if (adminResult.length > 0 && adminResult[0].preferences) {
          const userPreferences = adminResult[0].preferences;

          // Check sync_to_erpnext master toggle (defaults to true if not set)
          if (userPreferences.sync_to_erpnext === false) {
            syncEnabled = false;
            console.log(`[SYNC] ERPNext sync is DISABLED by admin user preference`);
          }

          // Check sync_vendors preference
          if (userPreferences.sync_vendors) {
            const userSyncVendors = userPreferences.sync_vendors;

            // If sync_vendors is not empty, use it (pass as array to support multiple vendors)
            if (Array.isArray(userSyncVendors) && userSyncVendors.length > 0) {
              syncVendors = userSyncVendors;
              console.log(`[SYNC] Admin user has vendor preferences: ${userSyncVendors.join(', ')}`);
            }
          }

          // Check prioritize_copyright preference
          if (userPreferences.prioritize_copyright === true) {
            prioritizeCopyright = true;
            console.log(`[SYNC] Admin user has copyright prioritization enabled`);
          }

          // Check sync_data_source preference
          if (userPreferences.sync_data_source) {
            const dataSource = userPreferences.sync_data_source;
            if (dataSource === 'All' || dataSource === 'Scrapper') {
              syncDataSource = dataSource;
              console.log(`[SYNC] Admin user has data_source filter: ${dataSource}`);
            }
          }
        }
      } catch (error) {
        console.warn("[SYNC] Failed to load admin preferences, using default behavior:", error);
        // Continue with default behavior (all vendors, sync enabled)
      }
    }

    // Early exit if sync is disabled
    if (!syncEnabled) {
      console.log(`[SYNC] Sync is disabled - returning without processing`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "ERPNext sync is disabled",
          result: {
            total_queried: 0,
            marked_syncing: 0,
            batches_processed: 0,
            created_or_updated: 0,
            failed: 0,
            verified: 0,
            skipped_data_source: 0,
            validation_resets: { category: 0, weight_dimension: 0, seo: 0, copyright: 0 },
            errors: [],
            sync_disabled: true
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const vendorDesc = Array.isArray(syncVendors)
      ? syncVendors.join(', ')
      : syncVendors || 'all';
    const copyrightDesc = prioritizeCopyright ? ', prioritizing copyright-complete products' : '';
    const dataSourceDesc = syncDataSource !== 'All' ? `, data_source filter: ${syncDataSource}` : '';
    console.log(`[SYNC] Starting sync: batchSize=${batchSize}, apiBatchSize=${apiBatchSize}, vendors=${vendorDesc}${copyrightDesc}${dataSourceDesc}`);

    const result = await syncCompletedProducts(batchSize, apiBatchSize, syncVendors, prioritizeCopyright, syncDataSource);

    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        result
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[SYNC] Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});
