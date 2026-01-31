/**
 * Shared ERPNext Utilities
 *
 * Common functions used by both push-products-to-erpnext and sync-completed-products-to-erpnext
 * edge functions to avoid code duplication.
 */

import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

// ============================================================================
// Type Definitions
// ============================================================================

export interface PendingProduct {
  id: string;
  url: string;
  vendor: string | null;
  product_id: string | null;
  item_code: string | null;
  category_status: string;
  weight_and_dimension_status: string;
  seo_status: string;
  copyright_status: string;
  erpnext_updated_at: string | null;
  updated_at: string | null;
  sync_full_product: boolean | null;

  // Category fields
  category: string | null;
  breadcrumbs: unknown;

  // Weight/dimension fields (all NUMERIC after migration)
  weight: number | null;
  height: number | null;
  width: number | null;
  length: number | null;
  volumetric_weight: number | null;

  // SEO fields
  ai_title: string | null;
  ai_description: string | null;
  meta_title: string | null;
  meta_description: string | null;

  // Copyright fields
  non_copyright_images: unknown;
  non_copyright_desc: string | null;

  // FAQ fields
  faqs: Array<{ question: string; answer: string }> | null;

  // Product data from scraped_products join
  name: string | null;
  price: number | string | null;
  original_price: number | string | null;
  description: string | null;
  images: unknown;
  main_image: string | null;
  stock_status: string | null;
  variants: unknown;

  // Classification fields from scraped_products join
  classification: string | null;
  rejected: boolean | null;
  scraped_product_db_id: string | null;
}

export interface ERPNextItemPayload {
  url: string;
  vendor: string;
  timestamp: string;
  product_id?: string;
  copyright?: "true" | "false";

  // Product data
  name?: string;
  price?: number;
  selling_price?: number;
  description?: string;
  images?: unknown;
  main_image?: string;
  stock_status?: string;

  // Category fields
  category?: string;
  breadcrumb?: unknown;

  // Weight/dimension fields
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  volumetric_weight?: number;

  // SEO fields
  ai_title?: string;
  summary?: string;
  meta_title?: string;
  meta_description?: string;

  // Variants
  variants?: unknown;
  variant_attribute?: string;

  // FAQs (stringified JSON array)
  faqs?: string;
}

export interface ERPNextAPIResponse {
  message: {
    status?: string;
    message?: string;
    created_items?: string[];
    updated_items?: string[];
    errors?: Array<{
      item?: string | null;
      url?: string;
      action?: string;
      error?: string;
    }>;
  };
}

export interface VerifiedProduct {
  product_id: string;
  item_code: string;
  erpnext_modified: string;
  verified: boolean;
}

// ============================================================================
// ERPNext API Functions
// ============================================================================

/**
 * Validate that a URL starts with http:// or https://
 */
function isValidUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Filter array of URLs to only include valid ones (starting with http:// or https://)
 */
function filterValidUrls(urls: unknown): string[] | null {
  if (!Array.isArray(urls)) return null;
  const validUrls = urls.filter((url): url is string => isValidUrl(url));
  return validUrls.length > 0 ? validUrls : null;
}

/**
 * Validate that a product has a valid main_image URL
 * Returns the valid main_image URL or null if none exists
 */
export function getValidMainImage(product: PendingProduct): string | null {
  // Check non_copyright_images first
  if (product.non_copyright_images && Array.isArray(product.non_copyright_images) && product.non_copyright_images.length > 0) {
    const validCopyrightImages = filterValidUrls(product.non_copyright_images);
    if (validCopyrightImages && validCopyrightImages.length > 0) {
      return validCopyrightImages[0];
    }
  }

  // Fall back to original main_image
  if (isValidUrl(product.main_image)) {
    return product.main_image!;
  }

  return null;
}

/**
 * Transform product data to ERPNext API format
 */
export function productToERPNextFormat(
  product: PendingProduct,
  isUpdate: boolean,
  syncFullProduct: boolean = false
): ERPNextItemPayload {
  const payload: ERPNextItemPayload = {
    url: product.url,
    vendor: product.vendor || 'unknown',
    timestamp: product.updated_at || new Date().toISOString(),
    product_id: (product as any).scraped_product_vendor_id || product.product_id || undefined,
    copyright: "false"
  };

  // For creation OR full product sync, include all product fields
  if (!isUpdate || syncFullProduct) {
    if (product.name) payload.name = product.name;

    if (product.description) {
      payload.description = product.description;
    }

    // Price mapping
    if (product.original_price !== null && product.original_price !== undefined) {
      payload.price = Number(product.original_price);
    }
    if (product.price !== null && product.price !== undefined) {
      payload.selling_price = Number(product.price);
    }

    if (product.stock_status) payload.stock_status = product.stock_status;


  }
  // Variants
  if (product.variants) {
    payload.variants = product.variants;
    payload.variant_attribute = "color"; // Default variant attribute
  }

  // Images - Use copyright images if available, otherwise use original images
  // IMPORTANT: ERPNext requires all URLs to start with http:// or https://
  if (product.non_copyright_images && Array.isArray(product.non_copyright_images) && product.non_copyright_images.length > 0) {
    // Filter to only valid URLs
    const validCopyrightImages = filterValidUrls(product.non_copyright_images);
    if (validCopyrightImages && validCopyrightImages.length > 0) {
      // Use first valid copyright image as main_image
      payload.main_image = validCopyrightImages[0];
      payload.images = validCopyrightImages;
      payload.copyright = "true";
    } else {
      // Fallback to original images if no valid copyright images
      console.warn(`[ERPNEXT] Product ${product.url}: non_copyright_images contain no valid URLs, falling back to original images`);
      if (isValidUrl(product.main_image)) payload.main_image = product.main_image;
      const validImages = filterValidUrls(product.images);
      if (validImages) payload.images = validImages;
    }
  } else {
    if (isValidUrl(product.main_image)) payload.main_image = product.main_image;
    const validImages = filterValidUrls(product.images);
    if (validImages) payload.images = validImages;
  }
  // Use copyright description if available, otherwise use original description
  if (product.non_copyright_desc) {
    payload.description = product.non_copyright_desc;
    payload.copyright = "true";
  }

  // Add category fields if present and NOT empty
  // Validate that category and breadcrumbs are not NULL, empty string, or empty JSON array "[]"
  const isCategoryValid = product.category &&
                          product.category !== '' &&
                          product.category !== '[]';
  const isBreadcrumbValid = product.breadcrumbs &&
                            JSON.stringify(product.breadcrumbs) !== '[]' &&
                            (Array.isArray(product.breadcrumbs) ? product.breadcrumbs.length > 0 : true);

  if (isCategoryValid) payload.category = product.category;
  if (isBreadcrumbValid) payload.breadcrumb = product.breadcrumbs;

  // Add weight/dimension fields if present (all already NUMERIC type)
  if (product.weight !== null && product.weight !== undefined) {
    payload.weight = Number(product.weight);
  }
  if (product.height !== null && product.height !== undefined) {
    payload.height = Number(product.height);
  }
  if (product.width !== null && product.width !== undefined) {
    payload.width = Number(product.width);
  }
  if (product.length !== null && product.length !== undefined) {
    payload.length = Number(product.length);
  }
  if (product.volumetric_weight !== null && product.volumetric_weight !== undefined) {
    payload.volumetric_weight = Number(product.volumetric_weight);
  }

  // Add SEO fields if present
  if (product.ai_title) payload.ai_title = product.ai_title;
  if (product.ai_description) payload.summary = product.ai_description;
  if (product.meta_title) payload.meta_title = product.meta_title;
  if (product.meta_description) payload.meta_description = product.meta_description;

  // Add FAQs if present (stringify the array for ERPNext, limit to 3)
  if (product.faqs && Array.isArray(product.faqs) && product.faqs.length > 0) {
    payload.faqs = JSON.stringify(product.faqs.slice(0, 3));
  }

  return payload;
}

/**
 * Send batch to ERPNext API (Production)
 */
export async function sendToERPNextAPI(items: ERPNextItemPayload[]): Promise<ERPNextAPIResponse> {
  const erpnextBaseUrl = Deno.env.get("ERPNEXT_BASE_URL") || "https://erpnext.mcgrocer.com";
  const erpnextApiEndpoint = Deno.env.get("ERPNEXT_API_ENDPOINT") ||
    "/api/method/mcgrocer_customization.mcgrocer_customization.apis.item.create_items_from_json";
  const erpnextAuthToken = Deno.env.get("ERPNEXT_AUTH_TOKEN");

  if (!erpnextAuthToken) {
    throw new Error("ERPNEXT_AUTH_TOKEN environment variable not set");
  }

  const url = `${erpnextBaseUrl}${erpnextApiEndpoint}`;

  console.log(`[PROD] Sending ${items.length} items to Production ERPNext API`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `token ${erpnextAuthToken}`,
      "Content-Type": "application/json",
      "Cookie": "full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image="
    },
    body: JSON.stringify(items)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[PROD] ERPNext API HTTP ${response.status}: ${errorText}`);
    throw new Error(`ERPNext API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Send batch to Staging ERPNext API (Non-blocking)
 */
export async function sendToStagingERPNext(items: ERPNextItemPayload[]): Promise<void> {
  const stagingAuthToken = Deno.env.get("ERPNEXT_AUTH_TOKEN_STAGING");

  if (!stagingAuthToken) {
    return;
  }

  try {
    const stagingBaseUrl = Deno.env.get("ERPNEXT_BASE_URL_STAGING") || "https://staging-erpnext.mcgrocer.com";
    const apiEndpoint = Deno.env.get("ERPNEXT_API_ENDPOINT") ||
      "/api/method/mcgrocer_customization.mcgrocer_customization.apis.item.create_items_from_json";

    const url = `${stagingBaseUrl}${apiEndpoint}`;

    console.log(`[STAGING] Sending ${items.length} items to Staging ERPNext`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `token ${stagingAuthToken}`,
        "Content-Type": "application/json",
        "Cookie": "full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image="
      },
      body: JSON.stringify(items)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[STAGING] ERPNext API HTTP ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    const created = result.message?.created_items?.length || 0;
    const updated = result.message?.updated_items?.length || 0;
    const errors = result.message?.errors?.length || 0;

    console.log(`[STAGING] Success: Created=${created}, Updated=${updated}, Errors=${errors}`);

  } catch (error) {
    console.error(`[STAGING] Error (non-blocking):`, error);
  }
}

/**
 * Result structure for existing ERPNext items
 */
export interface ExistingERPNextItem {
  itemCode: string;
  dataSource: string | null;
}

/**
 * Get existing ERPNext items by URLs
 * Returns a map of URL -> { itemCode, dataSource }
 */
export async function getExistingERPNextItems(urls: string[]): Promise<Map<string, ExistingERPNextItem>> {
  const erpnextBaseUrl = Deno.env.get("ERPNEXT_BASE_URL") || "https://erpnext.mcgrocer.com";
  const erpnextAuthToken = Deno.env.get("ERPNEXT_AUTH_TOKEN");

  if (!erpnextAuthToken || urls.length === 0) {
    return new Map();
  }

  try {
    const promises = urls.map(url =>
      fetch(`${erpnextBaseUrl}/api/method/frappe.desk.reportview.get`, {
        method: "POST",
        headers: {
          "Authorization": `token ${erpnextAuthToken}`,
          "Content-Type": "application/json",
          "Cookie": "full_name=Guest; sid=Guest; system_user=no; user_id=Guest; user_image="
        },
        body: JSON.stringify({
          doctype: "Item",
          fields: ["name", "data_source"],
          filters: [["Item Supplier", "custom_product_url", "=", url]]
        })
      })
        .then(async (response) => {
          if (!response.ok) return { url, itemCode: null, dataSource: null };
          const result = await response.json();

          // Parse keys and values from response
          const keys = result.message?.keys || [];
          const values = result.message?.values?.[0] || [];

          // Find indices for name (item_code) and data_source
          const nameIndex = keys.indexOf("name");
          const dataSourceIndex = keys.indexOf("data_source");

          const itemCode = nameIndex >= 0 ? values[nameIndex] : null;
          const dataSource = dataSourceIndex >= 0 ? values[dataSourceIndex] : null;

          return { url, itemCode, dataSource };
        })
        .catch(() => ({ url, itemCode: null, dataSource: null }))
    );

    const results = await Promise.all(promises);

    const existingMap = new Map<string, ExistingERPNextItem>();
    for (const { url, itemCode, dataSource } of results) {
      if (itemCode) {
        existingMap.set(url, { itemCode, dataSource });
      }
    }

    console.log(`[CHECK] ${existingMap.size}/${urls.length} items already exist in ERPNext`);
    return existingMap;

  } catch (error) {
    console.error(`Error checking existing items:`, error);
    return new Map();
  }
}

/**
 * Verify items were updated in ERPNext
 */
export async function verifyItemsUpdated(
  itemCodes: string[],
  products: PendingProduct[]
): Promise<VerifiedProduct[]> {
  if (itemCodes.length === 0) return [];

  const erpnextBaseUrl = Deno.env.get("ERPNEXT_BASE_URL") || "https://erpnext.mcgrocer.com";
  const erpnextAuthToken = Deno.env.get("ERPNEXT_AUTH_TOKEN");

  if (!erpnextAuthToken) {
    throw new Error("ERPNEXT_AUTH_TOKEN environment variable not set");
  }

  try {
    const promises = itemCodes.map(itemCode =>
      fetch(`${erpnextBaseUrl}/api/resource/Item/${itemCode}`, {
        method: "GET",
        headers: {
          "Authorization": `token ${erpnextAuthToken}`,
          "Content-Type": "application/json"
        }
      })
        .then(async (response) => {
          if (!response.ok) return null;
          const result = await response.json();
          const product = products.find(p => p.item_code === itemCode);
          if (product && result.data?.modified) {
            return {
              product_id: product.id,
              item_code: itemCode,
              erpnext_modified: result.data.modified,
              verified: true
            };
          }
          return null;
        })
        .catch(() => null)
    );

    const results = await Promise.all(promises);
    const verified = results.filter((v): v is VerifiedProduct => v !== null);

    console.log(`[VERIFY] Verified ${verified.length}/${itemCodes.length} items`);
    return verified;

  } catch (error) {
    console.error(`Error verifying items:`, error);
    return [];
  }
}

// ============================================================================
// Database Update Functions
// ============================================================================

/**
 * Update erpnext_updated_at for verified products
 */
export async function updateVerifiedProducts(
  sql: any,
  verifiedProducts: VerifiedProduct[]
): Promise<number> {
  if (verifiedProducts.length === 0) return 0;

  let updated = 0;

  for (const verified of verifiedProducts) {
    try {
      const result = await sql`
        UPDATE pending_products
        SET erpnext_updated_at = ${verified.erpnext_modified},
            item_code = ${verified.item_code},
            sync_full_product = false
        WHERE id = ${verified.product_id}
      `;

      if (result.count) updated += result.count;
    } catch (error) {
      console.error(`Failed to update product ${verified.product_id}:`, error);
    }
  }

  console.log(`[UPDATE] Updated ${updated} products with ERPNext timestamps`);
  return updated;
}

/**
 * Sync agent data back to scraped_products
 */
export async function syncAgentDataToScrapedProducts(
  sql: any,
  verifiedProducts: VerifiedProduct[],
  products: PendingProduct[]
): Promise<number> {
  if (verifiedProducts.length === 0) return 0;

  let updated = 0;

  for (const verified of verifiedProducts) {
    try {
      const product = products.find(p => p.id === verified.product_id);
      if (!product) continue;

      const scrapedProductResult = await sql`
        SELECT scraped_product_id
        FROM pending_products
        WHERE id = ${verified.product_id}
      `;

      if (scrapedProductResult.length === 0) continue;

      const scrapedProductId = scrapedProductResult[0].scraped_product_id;

      const updates: any = {};

      if (product.category) updates.category = product.category;
      if (product.breadcrumbs) updates.breadcrumbs = product.breadcrumbs;
      if (product.ai_title) updates.ai_title = product.ai_title;
      if (product.ai_description) updates.ai_description = product.ai_description;

      if (product.weight !== null && product.weight !== undefined) {
        updates.weight = Number(product.weight);
      }
      if (product.height !== null && product.height !== undefined) {
        updates.height = Number(product.height);
      }
      if (product.width !== null && product.width !== undefined) {
        updates.width = Number(product.width);
      }
      if (product.length !== null && product.length !== undefined) {
        updates.length = Number(product.length);
      }
      if (product.volumetric_weight !== null && product.volumetric_weight !== undefined) {
        updates.volumetric_weight = Number(product.volumetric_weight);
      }

      // Sync FAQs if present (limit to 3 items)
      if (product.faqs && Array.isArray(product.faqs) && product.faqs.length > 0) {
        updates.faqs = product.faqs.slice(0, 3);
      }

      if (Object.keys(updates).length === 0) continue;

      const result = await sql`
        UPDATE scraped_products
        SET ${sql(updates)}
        WHERE id = ${scrapedProductId}
      `;

      if (result.count) updated += result.count;
    } catch (error) {
      console.error(`Failed to sync agent data for product ${verified.product_id}:`, error);
    }
  }

  console.log(`[SYNC_SCRAPED] Synced agent data to ${updated} scraped_products`);
  return updated;
}

/**
 * Clear error messages for successfully synced products
 */
export async function clearSuccessfulSyncErrors(
  sql: any,
  productIds: string[]
): Promise<number> {
  if (productIds.length === 0) return 0;

  const result = await sql`
    UPDATE pending_products
    SET failed_sync_error_message = NULL,
        failed_sync_at = NULL
    WHERE id = ANY(${productIds})
    AND failed_sync_error_message IS NOT NULL
  `;

  const count = result.count || 0;
  if (count > 0) {
    console.log(`[CLEAR_ERRORS] Cleared error messages for ${count} products`);
  }
  return count;
}

/**
 * Store error messages for failed products
 */
export async function storeFailedSyncErrors(
  sql: any,
  failedProducts: Array<{ productId?: string; url?: string; error: string }>
): Promise<number> {
  if (failedProducts.length === 0) return 0;

  let updated = 0;
  const currentTime = new Date().toISOString();

  for (const failure of failedProducts) {
    try {
      let result;

      if (failure.productId) {
        result = await sql`
          UPDATE pending_products
          SET failed_sync_error_message = ${failure.error},
              failed_sync_at = ${currentTime}
          WHERE id = ${failure.productId}
        `;
      } else if (failure.url) {
        result = await sql`
          UPDATE pending_products
          SET failed_sync_error_message = ${failure.error},
              failed_sync_at = ${currentTime}
          WHERE url = ${failure.url}
        `;
      }

      if (result?.count) updated += result.count;
    } catch (error) {
      console.error(`Failed to store error for ${failure.productId || failure.url}:`, error);
    }
  }

  console.log(`[STORE_ERRORS] Stored error messages for ${updated} failed products`);
  return updated;
}
