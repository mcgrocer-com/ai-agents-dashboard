import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Configuration
const BATCH_SIZE = 100;
const TABLE_NAME = "scraped_products";

// Types
interface ScrapedProduct {
  // Required fields
  vendor: string;
  name: string;
  url: string;
  price: number;
  description: string;
  stock_status: string;  // Will be validated and normalized to "in stock" or "out of stock"
  images: string[] | object;
  main_image: string;
  product_id: string;
  original_price: number;
  timestamp: string;

  // Optional fields
  ean_code?: string;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  category?: string;
  breadcrumbs?: object;
  breadcrumb?: object;
  variants?: object;
}

interface MappedProduct {
  id: string;
  vendor: string;
  name: string;
  price: number;
  weight: number;
  description: string | null;
  category: string | null;
  stock_status: string | null;
  images: string | null;
  main_image: string | null;
  variants: string | null;
  variant_count: number;
  product_id: string | null;
  original_price: number;
  timestamp: string | null;
  url: string;
  breadcrumbs: string | null;
  ean_code: string | null;
  status: string;
  ai_title: string;
  ai_description: string;
  height: number;
  width: number;
  length: number;
  volumetric_weight: number;
}

interface ValidationError {
  index: number;
  field: string;
  message: string;
}

interface SeedResponse {
  success: boolean;
  update_existing: boolean;
  stats: {
    total_received: number;
    validation_failed: number;
    duplicates_removed: number;
    skipped: number;
    inserted: number;
    updated: number;
  };
  validation_errors?: ValidationError[];
  errors: string[];
}

/**
 * Validate required fields for a product
 */
function validateProduct(
  product: any,
  index: number,
): ValidationError | null {
  // String fields (required, non-empty) - removed ean_code
  const requiredStringFields = [
    "vendor", "name", "url", "description", "stock_status",
    "main_image", "product_id", "timestamp"
  ];

  for (const field of requiredStringFields) {
    if (!product[field] || typeof product[field] !== "string" || product[field].trim() === "") {
      return {
        index,
        field,
        message: `Missing or invalid required field: '${field}' at product index ${index}`,
      };
    }
  }

  // Validate stock_status values
  const stockStatus = product.stock_status?.toLowerCase().trim();
  if (stockStatus !== "in stock" && stockStatus !== "out of stock") {
    return {
      index,
      field: "stock_status",
      message: `Invalid stock_status at product index ${index}. Must be 'in stock' or 'out of stock' (case insensitive)`,
    };
  }

  // Number fields (required)
  const requiredNumberFields = ["price", "original_price"];

  for (const field of requiredNumberFields) {
    if (product[field] === undefined || product[field] === null || typeof product[field] !== "number") {
      return {
        index,
        field,
        message: `Missing or invalid required field: '${field}' (must be a number) at product index ${index}`,
      };
    }
  }

  // Images field (required, must be array or object)
  if (!product.images || (typeof product.images !== "object")) {
    return {
      index,
      field: "images",
      message: `Missing or invalid required field: 'images' (must be an array or object) at product index ${index}`,
    };
  }

  return null;
}

/**
 * Validate all products and return errors
 */
function validateProducts(products: any[]): {
  valid: ScrapedProduct[];
  validationErrors: ValidationError[];
} {
  const valid: ScrapedProduct[] = [];
  const validationErrors: ValidationError[] = [];

  for (let i = 0; i < products.length; i++) {
    const error = validateProduct(products[i], i);

    if (error) {
      validationErrors.push(error);
    } else {
      valid.push(products[i] as ScrapedProduct);
    }
  }

  return { valid, validationErrors };
}

/**
 * Generate MD5 hash from vendor and URL using SHA-256 (MD5 not available in Deno)
 * Note: Using SHA-256 instead of MD5 for compatibility with Deno's Web Crypto API
 */
async function generateProductId(vendor: string, url: string): Promise<string> {
  const data = `${vendor}-${url}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Take first 16 bytes to match MD5 length (32 hex chars)
  return hashArray.slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate variant count from variants object
 */
function calculateVariantCount(variants: any): number {
  if (!variants) return 0;

  try {
    // If it's already parsed as an object
    if (typeof variants === "object" && !Array.isArray(variants)) {
      // Count the number of keys/properties
      return Object.keys(variants).length;
    }
    // If it's an array of variants
    if (Array.isArray(variants)) {
      return variants.length;
    }
  } catch (e) {
    console.warn("Error calculating variant count:", e);
  }

  return 0;
}

/**
 * Map product data to match Supabase table schema
 */
async function mapProductToSchema(
  product: ScrapedProduct,
): Promise<MappedProduct> {
  const vendor = product.vendor.toLowerCase().trim();
  const productId = await generateProductId(vendor, product.url);

  // Calculate variant_count from variants object
  const variantCount = calculateVariantCount(product.variants);

  // Normalize stock_status to lowercase
  const stockStatus = product.stock_status.toLowerCase().trim();

  return {
    id: productId,
    vendor: vendor,
    name: product.name.trim(),
    price: product.price,
    weight: product.weight || 0,
    description: product.description.trim(),
    category: product.category || null,
    stock_status: stockStatus,  // Normalized to "in stock" or "out of stock"
    images: JSON.stringify(product.images),
    main_image: product.main_image.trim(),
    variants: product.variants ? JSON.stringify(product.variants) : null,
    variant_count: variantCount,
    product_id: product.product_id.trim(),
    original_price: product.original_price,
    timestamp: product.timestamp.trim(),
    url: product.url.trim(),
    breadcrumbs: product.breadcrumbs
      ? JSON.stringify(product.breadcrumbs)
      : (product.breadcrumb ? JSON.stringify(product.breadcrumb) : null),
    ean_code: product.ean_code ? product.ean_code.trim() : null,  // Optional field
    status: "pending",
    ai_title: "",
    ai_description: "",
    height: product.height || 0,
    width: product.width || 0,
    length: product.length || 0,
    volumetric_weight: 0,
  };
}

/**
 * Remove duplicate products based on product_id
 */
function deduplicateByProductId(
  products: ScrapedProduct[],
): { unique: ScrapedProduct[]; duplicatesCount: number } {
  const seenProductIds = new Set<string>();
  const unique: ScrapedProduct[] = [];
  let duplicatesCount = 0;

  for (const product of products) {
    const productId = product.product_id;

    if (productId && !seenProductIds.has(productId)) {
      seenProductIds.add(productId);
      unique.push(product);
    } else if (productId) {
      duplicatesCount++;
    } else {
      unique.push(product);
    }
  }

  return { unique, duplicatesCount };
}

/**
 * Remove duplicate products based on URL (most critical for unique constraint)
 */
function deduplicateByUrl(
  products: MappedProduct[],
): { unique: MappedProduct[]; duplicatesCount: number } {
  const seenUrls = new Set<string>();
  const unique: MappedProduct[] = [];
  let duplicatesCount = 0;

  for (const product of products) {
    const url = product.url;

    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      unique.push(product);
    } else if (url) {
      duplicatesCount++;
    } else {
      unique.push(product);
    }
  }

  return { unique, duplicatesCount };
}

/**
 * Fetch existing product URLs from database with pagination
 */
async function getExistingUrls(
  supabase: any,
): Promise<Set<string>> {
  const existingUrls = new Set<string>();
  let page = 0;

  while (true) {
    const startIndex = page * 1000;
    const endIndex = startIndex + 999;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("url")
      .range(startIndex, endIndex);

    if (error) {
      console.warn("Warning: Could not fetch existing URLs:", error);
      break;
    }

    if (data && data.length > 0) {
      for (const item of data) {
        if (item.url) {
          existingUrls.add(item.url);
        }
      }

      if (data.length < 1000) {
        break;
      }
      page++;
    } else {
      break;
    }
  }

  return existingUrls;
}

/**
 * Filter products based on update_existing flag
 * Returns products to insert and products to update
 */
function categorizeProducts(
  products: MappedProduct[],
  existingUrls: Set<string>,
  updateExisting: boolean,
): { toInsert: MappedProduct[]; toUpdate: MappedProduct[]; skipped: number } {
  if (existingUrls.size === 0) {
    return { toInsert: products, toUpdate: [], skipped: 0 };
  }

  const toInsert: MappedProduct[] = [];
  const toUpdate: MappedProduct[] = [];
  let skipped = 0;

  for (const product of products) {
    if (existingUrls.has(product.url)) {
      if (updateExisting) {
        toUpdate.push(product);
      } else {
        skipped++;
      }
    } else {
      toInsert.push(product);
    }
  }

  return { toInsert, toUpdate, skipped };
}

/**
 * Insert products in batches
 */
async function insertProductsInBatches(
  supabase: any,
  products: MappedProduct[],
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert(batch);

      if (error) {
        errors.push(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`,
        );
      } else {
        inserted += batch.length;
      }
    } catch (e) {
      errors.push(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} exception: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  return { inserted, errors };
}

/**
 * Update products individually using explicit UPDATE queries
 * Uses URL as the match criteria (since it's unique)
 * This prevents issues with foreign key constraints and NOT NULL constraints on 'id'
 */
async function updateProductsInBatches(
  supabase: any,
  products: MappedProduct[],
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  // Process products one at a time to use explicit UPDATE queries
  // This is necessary because Supabase doesn't support batch updates with .eq()
  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      // Remove 'id' and 'url' from the update data
      // - 'id' is the primary key and should never be updated
      // - 'url' is the match criteria, not part of the update payload
      const { id, url, ...updateData } = product;

      // Use explicit UPDATE query matched by URL
      // This ensures the 'id' field is never touched
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq("url", url);

      if (error) {
        errors.push(
          `Failed to update product at URL ${url}: ${error.message}`,
        );
      } else {
        updated++;
      }
    } catch (e) {
      errors.push(
        `Exception updating product ${i + 1}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  return { updated, errors };
}

/**
 * Verify custom API key
 */
async function verifyCustomApiKey(
  supabase: any,
  apiKey: string,
): Promise<{ valid: boolean; permissions?: any }> {
  try {
    const { data, error } = await supabase.rpc("verify_api_key", {
      provided_key: apiKey,
    });

    console.log("RPC verify_api_key response:", { data, error });

    if (error) {
      console.error("RPC error:", error);
      return { valid: false };
    }

    if (!data || data.length === 0) {
      console.error("No data returned from RPC");
      return { valid: false };
    }

    const result = Array.isArray(data) ? data[0] : data;
    console.log("Verification result:", result);

    return {
      valid: result.is_valid === true,
      permissions: result.key_permissions,
    };
  } catch (e) {
    console.error("API key verification exception:", e);
    return { valid: false };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Initialize Supabase client with service role for database operations
  // (Custom API key authentication happens before this)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify custom API key from X-API-Key header
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing X-API-Key header. Custom API key is required.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { valid, permissions } = await verifyCustomApiKey(supabase, apiKey);
  if (!valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid or expired API key.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Check if API key has permission to insert into scraped_products
  const hasPermission = permissions?.scraped_products?.includes("insert");
  if (!hasPermission) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "API key does not have permission to insert products.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Parse request body - expect object with products array and optional update_existing flag
    const requestBody = await req.json();

    // Support both old format (direct array) and new format (object with products and update_existing)
    let rawProducts: any[];
    let updateExisting = false; // Default: skip existing products

    if (Array.isArray(requestBody)) {
      // Old format: direct array of products
      rawProducts = requestBody;
    } else if (requestBody.products && Array.isArray(requestBody.products)) {
      // New format: object with products array and optional update_existing flag
      rawProducts = requestBody.products;
      updateExisting = requestBody.update_existing === true;
    } else {
      return new Response(
        JSON.stringify({
          error: "Invalid request. Expected an array of products or an object with 'products' array and optional 'update_existing' boolean.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (rawProducts.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid request. Product array cannot be empty.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Validate all products
    const { valid: validProducts, validationErrors } = validateProducts(rawProducts);

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed. Required fields: vendor, name, url, price, description, stock_status ('in stock' or 'out of stock'), images, main_image, product_id, original_price, timestamp. Optional: ean_code, weight, height, width, length, category, breadcrumbs, variants.",
          validation_errors: validationErrors,
          stats: {
            total_received: rawProducts.length,
            validation_failed: validationErrors.length,
            duplicates_removed: 0,
            skipped: 0,
            inserted: 0,
            updated: 0,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Stats tracking (Supabase client already initialized at top of handler)
    const stats = {
      total_received: rawProducts.length,
      validation_failed: 0,
      duplicates_removed: 0,
      skipped: 0,
      inserted: 0,
      updated: 0,
    };
    const errors: string[] = [];

    // Step 1: Deduplicate by product_id
    const { unique: uniqueProducts, duplicatesCount: productIdDupes } =
      deduplicateByProductId(validProducts);
    stats.duplicates_removed += productIdDupes;

    // Step 2: Map to schema
    const mappedProducts = await Promise.all(
      uniqueProducts.map((p) => mapProductToSchema(p)),
    );

    // Step 3: Deduplicate by URL (critical for unique constraint)
    const { unique: uniqueMapped, duplicatesCount: urlDupes } =
      deduplicateByUrl(mappedProducts);
    stats.duplicates_removed += urlDupes;

    // Step 4: Categorize products (insert vs update vs skip)
    const existingUrls = await getExistingUrls(supabase);
    const { toInsert, toUpdate, skipped } = categorizeProducts(
      uniqueMapped,
      existingUrls,
      updateExisting,
    );
    stats.skipped = skipped;

    // Step 5: Insert new products
    if (toInsert.length > 0) {
      const { inserted, errors: insertErrors } = await insertProductsInBatches(
        supabase,
        toInsert,
      );
      stats.inserted = inserted;
      errors.push(...insertErrors);
    }

    // Step 6: Update existing products (if update_existing flag is true)
    if (toUpdate.length > 0) {
      const { updated, errors: updateErrors } = await updateProductsInBatches(
        supabase,
        toUpdate,
      );
      stats.updated = updated;
      errors.push(...updateErrors);
    }

    // Step 7: Sync marking is now handled by push-to-pending webhook
    // The webhook automatically marks completed products for full ERPNext sync
    // when scraped_products are updated
    console.log(`[INFO] Sync marking handled by push-to-pending webhook`);

    // Build response
    const response: SeedResponse = {
      success: errors.length === 0,
      update_existing: updateExisting,
      stats,
      errors,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
