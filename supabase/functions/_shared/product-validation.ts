/**
 * Shared Product Validation Service
 *
 * Single source of truth for validating and normalizing product data
 * across edge functions (seed-scraped-products, update-scraped-product).
 *
 * Two modes:
 *  - 'seed'   = strict, all required fields must be present (product creation)
 *  - 'update' = lenient, only validates fields present in the payload (partial update)
 */

// ─── Interfaces & Types ─────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  index?: number;
}

export type ValidationMode = 'seed' | 'update';

export interface ValidationOptions {
  mode: ValidationMode;
  /** Product index within a batch (seed mode). */
  index?: number;
  /** Product source. When 'shopify', only name + url required. */
  source?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Normalized payload, only populated when valid === true. */
  normalized?: Record<string, unknown>;
}

export interface BatchValidationResult {
  valid: Record<string, unknown>[];
  validationErrors: ValidationError[];
}

// ─── Constants ──────────────────────────────────────────────────────

/**
 * Fields the update endpoint is allowed to modify on scraped_products.
 * Acts as a security allowlist.
 */
export const ALLOWED_UPDATE_FIELDS = [
  'name',
  'price',
  'original_price',
  'description',
  'stock_status',
  'main_image',
  'images',
  'weight',
  'height',
  'width',
  'length',
  'category',
  'breadcrumbs',
  'variants',
  'variant_count',
  'ean_code',
  'product_id',
  'timestamp',
] as const;

export type AllowedUpdateField = typeof ALLOWED_UPDATE_FIELDS[number];

// ─── Internal Field Validators ──────────────────────────────────────

interface FieldResult<T = unknown> {
  value?: T;
  error?: string;
}

function validateRequiredString(
  value: unknown,
  fieldName: string,
): FieldResult<string> {
  if (value === undefined || value === null) {
    return { error: `Missing required field: '${fieldName}'` };
  }
  if (typeof value !== 'string') {
    return { error: `Invalid type for '${fieldName}': expected string, got ${typeof value}` };
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return { error: `Field '${fieldName}' cannot be empty` };
  }
  return { value: trimmed };
}

function validateUrl(
  value: unknown,
  fieldName: string,
): FieldResult<string> {
  const strResult = validateRequiredString(value, fieldName);
  if (strResult.error) return strResult;

  const url = strResult.value!;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { error: `Invalid '${fieldName}': must start with http:// or https://` };
  }
  return { value: url };
}

function validatePositiveNumber(
  value: unknown,
  fieldName: string,
  required: boolean,
): FieldResult<number> {
  if (value === undefined || value === null) {
    if (required) {
      return { error: `Missing required field: '${fieldName}' (must be a positive number)` };
    }
    return {};
  }

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) {
    num = Number(value);
  } else {
    return { error: `Invalid '${fieldName}': must be a number (got ${typeof value})` };
  }

  if (num <= 0) {
    return { error: `Invalid '${fieldName}': must be greater than 0 (got ${num})` };
  }
  return { value: num };
}

function validateDescription(
  value: unknown,
  fieldName: string,
  required: boolean,
): FieldResult<string> {
  if (value === undefined || value === null) {
    if (required) {
      return { error: `Missing required field: '${fieldName}'` };
    }
    return {};
  }
  if (typeof value !== 'string') {
    return { error: `Invalid type for '${fieldName}': expected string, got ${typeof value}` };
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    if (required) {
      return { error: `Field '${fieldName}' cannot be empty` };
    }
    return {};
  }

  // Strip HTML tags and check for actual text content
  const textContent = stripHtml(trimmed);
  if (textContent === '' && required) {
    return { error: `Field '${fieldName}' contains only empty HTML tags with no text content` };
  }

  // Return original HTML (we only strip to validate, preserve for storage)
  return { value: trimmed };
}

function validateAndNormalizeStockStatus(
  value: unknown,
  required: boolean,
): FieldResult<string> {
  if (value === undefined || value === null) {
    if (required) {
      return { error: `Missing required field: 'stock_status'` };
    }
    return {};
  }
  if (typeof value !== 'string') {
    return { error: `Invalid type for 'stock_status': expected string, got ${typeof value}` };
  }

  const normalized = normalizeStockStatus(value);
  if (normalized === null) {
    return { error: `Invalid 'stock_status': must be 'in stock' or 'out of stock' (got "${value}")` };
  }
  return { value: normalized };
}

function validateImages(
  value: unknown,
  fieldName: string,
  required: boolean,
): FieldResult<unknown> {
  if (value === undefined || value === null) {
    if (required) {
      return { error: `Missing required field: '${fieldName}' (must be an array or object)` };
    }
    return {};
  }
  // Accept objects/arrays directly
  if (typeof value === 'object') {
    return { value };
  }
  // Accept JSON strings (images are stored as JSON.stringify() in the DB)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return { value: parsed };
      }
    } catch {
      // fall through to error
    }
    return { error: `Invalid '${fieldName}': must be an array or object (got non-JSON string)` };
  }
  return { error: `Invalid '${fieldName}': must be an array or object (got ${typeof value})` };
}

/**
 * Type-check and normalize optional fields (dimensions, category, etc.).
 */
function applyOptionalNormalizations(
  product: Record<string, unknown>,
  normalized: Record<string, unknown>,
  errors: ValidationError[],
  index?: number,
): void {
  // Optional numeric fields
  for (const field of ['weight', 'height', 'width', 'length'] as const) {
    if (product[field] !== undefined && product[field] !== null) {
      const num = Number(product[field]);
      if (isNaN(num)) {
        errors.push({
          field,
          message: `Invalid '${field}': expected a number (got ${typeof product[field]})`,
          index,
        });
      } else {
        normalized[field] = num;
      }
    }
  }

  // Optional string fields: trim
  for (const field of ['category', 'ean_code'] as const) {
    if (product[field] !== undefined && product[field] !== null) {
      if (typeof product[field] === 'string') {
        normalized[field] = (product[field] as string).trim();
      }
    }
  }

  // Object fields: pass through if valid type
  for (const field of ['breadcrumbs', 'breadcrumb', 'variants'] as const) {
    if (product[field] !== undefined && product[field] !== null) {
      if (typeof product[field] === 'object') {
        normalized[field] = product[field];
      }
    }
  }
}

// ─── Utility Functions (exported) ───────────────────────────────────

/**
 * Strip HTML tags from a string and return the text content.
 * Uses regex (no DOM parser in Deno edge runtime).
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize stock_status to "in stock" or "out of stock".
 * Handles case variations and underscore variants.
 * Returns null if the value cannot be mapped.
 */
export function normalizeStockStatus(value: string): string | null {
  const lower = value.toLowerCase().replace(/_/g, ' ').trim();

  if (lower === 'in stock' || lower === 'instock') {
    return 'in stock';
  }
  if (lower === 'out of stock' || lower === 'outofstock') {
    return 'out of stock';
  }
  return null;
}

/**
 * Filter an object to only include keys from ALLOWED_UPDATE_FIELDS.
 */
export function filterToAllowedFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if ((ALLOWED_UPDATE_FIELDS as readonly string[]).includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// ─── Core Validation ────────────────────────────────────────────────

/**
 * Validate a single product payload.
 *
 * In 'seed' mode: all required fields must be present and valid.
 * In 'update' mode: only fields present in the payload are validated.
 *
 * Returns { valid, errors, normalized }.
 */
export async function validateProduct(
  product: Record<string, unknown>,
  options: ValidationOptions,
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const normalized: Record<string, unknown> = {};
  const { mode, index } = options;
  const isShopify = options.source === 'shopify' || product.source === 'shopify';
  const isSeed = mode === 'seed';

  const addError = (field: string, message: string) => {
    errors.push({ field, message, index });
  };

  const has = (field: string): boolean =>
    product[field] !== undefined && product[field] !== null;

  // ── NAME (always required in seed, validate if present in update) ──
  if (isSeed || has('name')) {
    const result = validateRequiredString(product.name, 'name');
    if (result.error) addError('name', result.error);
    else normalized.name = result.value;
  }

  // ── URL (always required in seed, validate if present in update) ──
  if (isSeed || has('url')) {
    const result = validateUrl(product.url, 'url');
    if (result.error) addError('url', result.error);
    else normalized.url = result.value;
  }

  // Shopify short-circuit: only name + url required
  if (isShopify && isSeed) {
    applyOptionalNormalizations(product, normalized, errors, index);
    return {
      valid: errors.length === 0,
      errors,
      normalized: errors.length === 0 ? { ...product, ...normalized } : undefined,
    };
  }

  // ── VENDOR ──
  if (isSeed || has('vendor')) {
    const result = validateRequiredString(product.vendor, 'vendor');
    if (result.error && isSeed) addError('vendor', result.error);
    else if (!result.error) normalized.vendor = (result.value as string).toLowerCase();
  }

  // ── DESCRIPTION (HTML-aware) ──
  if (isSeed || has('description')) {
    const result = validateDescription(product.description, 'description', isSeed);
    if (result.error) addError('description', result.error);
    else if (result.value !== undefined) normalized.description = result.value;
  }

  // ── PRICE ──
  if (isSeed || has('price')) {
    const result = validatePositiveNumber(product.price, 'price', isSeed);
    if (result.error) addError('price', result.error);
    else if (result.value !== undefined) normalized.price = result.value;
  }

  // ── ORIGINAL_PRICE ──
  if (isSeed || has('original_price')) {
    const result = validatePositiveNumber(product.original_price, 'original_price', isSeed);
    if (result.error) addError('original_price', result.error);
    else if (result.value !== undefined) normalized.original_price = result.value;
  }

  // ── STOCK_STATUS ──
  if (isSeed || has('stock_status')) {
    const result = validateAndNormalizeStockStatus(product.stock_status, isSeed);
    if (result.error) addError('stock_status', result.error);
    else if (result.value !== undefined) normalized.stock_status = result.value;
  }

  // ── IMAGES ──
  if (isSeed || has('images')) {
    const result = validateImages(product.images, 'images', isSeed);
    if (result.error) addError('images', result.error);
    else if (result.value !== undefined) normalized.images = result.value;
  }

  // ── MAIN_IMAGE ──
  if (isSeed || has('main_image')) {
    const result = validateRequiredString(product.main_image, 'main_image');
    if (result.error && isSeed) addError('main_image', result.error);
    else if (!result.error) normalized.main_image = result.value;
  }

  // ── PRODUCT_ID ──
  if (isSeed || has('product_id')) {
    const result = validateRequiredString(product.product_id, 'product_id');
    if (result.error && isSeed) addError('product_id', result.error);
    else if (!result.error) normalized.product_id = result.value;
  }

  // ── TIMESTAMP ──
  if (isSeed || has('timestamp')) {
    const result = validateRequiredString(product.timestamp, 'timestamp');
    if (result.error && isSeed) addError('timestamp', result.error);
    else if (!result.error) normalized.timestamp = result.value;
  }

  // ── OPTIONAL FIELDS ──
  applyOptionalNormalizations(product, normalized, errors, index);

  // ── IMAGE ACCESSIBILITY CHECK — DISABLED ──
  // Image HEAD-request checks caused widespread false validation errors
  // (vendors rotate CDN URLs, return 404 for HEAD but serve images fine via GET).
  // Removed 2026-03-09 to stop blocking valid products.

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    normalized: valid ? { ...product, ...normalized } : undefined,
  };
}

// ─── Batch & Convenience Wrappers ───────────────────────────────────

/**
 * Validate an array of products in seed mode.
 * Direct replacement for the old validateProducts() in seed-scraped-products.
 * Image pinging is disabled by default for batch operations (too slow for 500+ products).
 */
export async function validateProductBatch(
  products: Record<string, unknown>[],
  options?: Partial<Omit<ValidationOptions, 'mode' | 'index'>>,
): Promise<BatchValidationResult> {
  const valid: Record<string, unknown>[] = [];
  const validationErrors: ValidationError[] = [];

  for (let i = 0; i < products.length; i++) {
    const result = await validateProduct(products[i], {
      mode: 'seed',
      index: i,
      source: products[i].source as string | undefined,
      ...options,
    });

    if (result.valid && result.normalized) {
      valid.push(result.normalized);
    } else {
      for (const error of result.errors) {
        validationErrors.push({
          ...error,
          index: i,
          message: error.index !== undefined ? error.message : `${error.message} at product index ${i}`,
        });
      }
    }
  }

  return { valid, validationErrors };
}

/**
 * Validate a single product update payload (update mode).
 * Image accessibility is checked downstream by push-to-pending, not here.
 */
export async function validateProductUpdate(
  fields: Record<string, unknown>,
): Promise<ValidationResult> {
  return validateProduct(fields, { mode: 'update' });
}

// ─── Agent Data Validation (pre-ERPNext sync) ──────────────────────

export interface AgentDataValidationResult {
  isValid: boolean;
  invalidFields: string[];
  /** Agent statuses that should be reset to 'pending' */
  statusResets: Record<string, string>;
}

/**
 * Validate that a product has all required agent data before syncing to ERPNext.
 *
 * Pure validation — no DB side effects. The caller is responsible for
 * applying the returned `statusResets` to the database.
 *
 * Checks:
 * - Category: non-empty, not '[]'
 * - Breadcrumbs: non-empty array
 * - Weight: > 0
 * - Volumetric weight: > 0
 * - Dimensions: at least one of height/width/length > 0
 * - SEO: ai_title, ai_description, meta_title, meta_description all non-empty
 */
export function validateProductAgentData(product: {
  category?: string | null;
  breadcrumbs?: unknown;
  weight?: number | null;
  volumetric_weight?: number | null;
  height?: number | null;
  width?: number | null;
  length?: number | null;
  ai_title?: string | null;
  ai_description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}): AgentDataValidationResult {
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

  // SEO validation - all four fields are required
  const hasValidSEO = product.ai_title &&
                     product.ai_title !== '' &&
                     product.ai_description &&
                     product.ai_description !== '' &&
                     product.meta_title &&
                     product.meta_title !== '' &&
                     product.meta_description &&
                     product.meta_description !== '';
  if (!hasValidSEO) invalidFields.push('SEO');

  // Determine which agent statuses need resetting
  const statusResets: Record<string, string> = {};
  if (!hasValidCategory || !hasValidBreadcrumb) {
    statusResets.category_status = 'pending';
  }
  if (!hasValidWeight || !hasValidVolumetricWeight || !hasValidDimensions) {
    statusResets.weight_and_dimension_status = 'pending';
  }
  if (!hasValidSEO) {
    statusResets.seo_status = 'pending';
  }

  return {
    isValid: invalidFields.length === 0,
    invalidFields,
    statusResets,
  };
}


