# Product Validation Service

**File:** `supabase/functions/_shared/product-validation.ts`

## Table of Contents

- [Overview](#overview)
- [Validation Modes](#validation-modes)
- [Exported Interfaces and Types](#exported-interfaces-and-types)
- [Exported Constants](#exported-constants)
- [Core Exported Functions](#core-exported-functions)
- [Utility Exports](#utility-exports)
- [Image Pinging (Internal)](#image-pinging-internal)
- [Field Validation Rules](#field-validation-rules)
- [Shopify Special Case](#shopify-special-case)
- [Usage Examples](#usage-examples)
- [Behavioral Notes](#behavioral-notes)

---

## Overview

`product-validation.ts` is a shared module that serves as the **single source of truth** for validating and normalizing product data across Supabase Edge Functions. It is consumed by two edge functions:

| Consumer | Purpose |
|---|---|
| `seed-scraped-products` | Bulk product creation (inserts new scraped products into the database) |
| `update-scraped-product` | Partial product updates (modifies fields on existing scraped products) |
| `push-to-pending` | Database webhook — validates product + image accessibility before Gemini classification |

Before this module existed, each edge function implemented its own validation logic. Centralizing validation here ensures consistent rules, consistent error formats, and a single place to update when the schema changes.

---

## Validation Modes

The module supports two validation modes that mirror the two consumption patterns:

### `seed` mode (strict)

Used by `seed-scraped-products` during product creation. **All required fields must be present and valid.** If any required field is missing or malformed, the product is rejected entirely.

### `update` mode (lenient)

Used by `update-scraped-product` for partial updates. **Only fields present in the payload are validated.** A payload containing just `{ price: 14.99 }` is valid -- the module does not complain about the absence of `name`, `vendor`, or any other field.

---

## Exported Interfaces and Types

### `ValidationError`

Describes a single validation failure.

```typescript
interface ValidationError {
  field: string;    // The field name that failed validation
  message: string;  // Human-readable error description
  index?: number;   // Product index within a batch (seed mode only)
}
```

### `ValidationMode`

```typescript
type ValidationMode = 'seed' | 'update';
```

### `ValidationOptions`

Configuration object passed to `validateProduct`.

```typescript
interface ValidationOptions {
  mode: ValidationMode;
  /** Product index within a batch (seed mode). */
  index?: number;
  /** Product source. When 'shopify', only name + url are required in seed mode. */
  source?: string;
  /** Run async image accessibility checks (HEAD requests). Default: false. */
  checkImages?: boolean;
  /** Timeout per image HEAD request in ms. Default: 5000. */
  imagePingTimeoutMs?: number;
}
```

### `ValidationResult`

Returned by `validateProduct` and `validateProductUpdate`.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Normalized payload -- only populated when valid === true. */
  normalized?: Record<string, unknown>;
}
```

When `valid` is `true`, the `normalized` object contains the original product fields merged with any normalizations applied by the validator (trimmed strings, coerced numbers, lowercased vendor, normalized stock status, etc.).

### `ImagePingResult`

Returned internally by `pingImageUrl` (used via `validateProduct` with `checkImages: true`).

```typescript
interface ImagePingResult {
  url: string;
  accessible: boolean;
  status?: number;   // HTTP status code, present when fetch succeeded
  error?: string;    // Error message, present when fetch failed or timed out
}
```

### `BatchValidationResult`

Returned by `validateProductBatch`.

```typescript
interface BatchValidationResult {
  valid: Record<string, unknown>[];    // Array of normalized products that passed validation
  validationErrors: ValidationError[]; // Collected errors from all invalid products
}
```

### `AllowedUpdateField`

Union type of field names the update endpoint is allowed to modify.

```typescript
type AllowedUpdateField = typeof ALLOWED_UPDATE_FIELDS[number];
// Resolves to:
// 'name' | 'price' | 'original_price' | 'description' | 'stock_status' |
// 'main_image' | 'images' | 'weight' | 'height' | 'width' | 'length' |
// 'category' | 'breadcrumbs' | 'variants' | 'variant_count' | 'ean_code' |
// 'product_id' | 'timestamp'
```

---

## Exported Constants

### `ALLOWED_UPDATE_FIELDS`

A `readonly` array that acts as a **security allowlist** of fields the update endpoint can modify on the `scraped_products` table. Any field sent by a caller that is not in this list is silently dropped by `filterToAllowedFields`.

```typescript
const ALLOWED_UPDATE_FIELDS = [
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
```

---

## Core Exported Functions

### `validateProduct(product, options)` -- `Promise<ValidationResult>`

The main validation entry point. Validates a single product payload according to the specified mode.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `product` | `Record<string, unknown>` | The product data to validate |
| `options` | `ValidationOptions` | Validation configuration (mode, source, checkImages, etc.) |

**Behavior by mode:**

- **Seed mode:** Checks that all required fields are present and valid. Missing required fields produce errors.
- **Update mode:** Only validates fields that are present in the `product` object. Missing fields are silently skipped.

When `checkImages` is `true` and no other validation errors exist, the function performs an asynchronous HEAD request against `main_image` to verify the URL is accessible. Image pinging is skipped when other errors already exist to avoid unnecessary network calls.

The `normalized` field on the result contains the original product merged with validated/coerced values (e.g., numeric strings converted to numbers, vendor lowercased, stock status normalized).

---

### `validateProductBatch(products, options?)` -- `Promise<BatchValidationResult>`

Validates an array of products in **seed mode**. This is the direct replacement for the old inline `validateProducts()` that previously lived in `seed-scraped-products`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `products` | `Record<string, unknown>[]` | Array of product payloads |
| `options` | `Partial<Omit<ValidationOptions, 'mode' \| 'index'>>` | Optional overrides (source, checkImages, etc.). Mode is always `seed`. |

Image pinging is **disabled by default** for batch operations because it is too slow for batches of 500+ products. The `source` for each product is read from the individual product's `source` field.

The function iterates sequentially (not in parallel) and collects results into two arrays: `valid` (normalized products) and `validationErrors` (all errors with `index` annotated).

---

### `validateProductUpdate(fields)` -- `Promise<ValidationResult>`

A convenience wrapper that validates a single product update payload in **update mode** with `checkImages: true`.

```typescript
async function validateProductUpdate(
  fields: Record<string, unknown>,
): Promise<ValidationResult> {
  return validateProduct(fields, { mode: 'update', checkImages: true });
}
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `fields` | `Record<string, unknown>` | The update fields to validate (should already be filtered to allowed fields) |

---

## Utility Exports

### `filterToAllowedFields(fields)` -- `Record<string, unknown>`

Filters an object's keys to only those present in `ALLOWED_UPDATE_FIELDS`. Used by `update-scraped-product` to strip any disallowed fields before validation.

```typescript
function filterToAllowedFields(
  fields: Record<string, unknown>,
): Record<string, unknown>
```

**Example:**

```typescript
filterToAllowedFields({ name: "Milk", price: 2.99, malicious_field: "drop table" })
// Returns: { name: "Milk", price: 2.99 }
```

---

### `normalizeStockStatus(value)` -- `string | null`

Normalizes a stock status string to one of two canonical values: `"in stock"` or `"out of stock"`. Returns `null` if the value cannot be mapped.

```typescript
function normalizeStockStatus(value: string): string | null
```

**Handling:**

- Lowercases the input
- Replaces underscores with spaces
- Trims whitespace

**Accepted inputs and their outputs:**

| Input (case-insensitive) | Output |
|---|---|
| `"in stock"`, `"In Stock"`, `"in_stock"`, `"instock"` | `"in stock"` |
| `"out of stock"`, `"Out Of Stock"`, `"out_of_stock"`, `"outofstock"` | `"out of stock"` |
| Anything else | `null` |

---

### `stripHtml(html)` -- `string`

Strips HTML tags from a string using regex and returns the decoded text content. Used internally for description validation (checking if an HTML string has any actual text content). Also exported for external use.

```typescript
function stripHtml(html: string): string
```

**Processing steps:**

1. Remove all HTML tags (`<...>`)
2. Decode `&nbsp;` to space
3. Decode `&amp;` to `&`
4. Decode `&lt;` to `<` and `&gt;` to `>`
5. Replace numeric HTML entities (`&#123;`) with space
6. Collapse whitespace and trim

**Note:** This uses regex, not a DOM parser, because the Deno edge runtime does not provide DOMParser.

---

## Image Pinging (Internal)

Image accessibility checking is handled **internally** by `validateProduct` when `checkImages: true` is passed. There are no exported image ping functions — this keeps the API surface clean and encapsulates the network I/O.

### How it works

When `validateProduct` is called with `checkImages: true` and no other validation errors exist, it internally calls `pingImageUrl(main_image)` — a HEAD request with an `AbortController` timeout (default 5000ms).

**Behavior:**

- Only runs when `errors.length === 0` (avoids unnecessary network calls for already-invalid products)
- Only pings `main_image` if it's a non-empty string starting with `http`
- Returns `{ accessible: false, error: 'Invalid URL' }` for non-string or empty inputs
- Follows redirects (`redirect: 'follow'`)
- Sets `accessible: true` only when `response.ok` is `true` (HTTP 2xx)
- On timeout: adds validation error `"Main image not accessible: Timeout after {timeoutMs}ms"`
- On network error: adds validation error with the error message

### Consumers

| Function | `checkImages` | Notes |
|---|---|---|
| `push-to-pending` | `true` | Checks image before Gemini classification to save API cost |
| `update-scraped-product` (via `validateProductUpdate`) | `true` | Checks image on update |
| `seed-scraped-products` (via `validateProductBatch`) | `false` (default) | Too slow for 500+ product batches |

---

## Field Validation Rules

The following table describes how each field is validated and normalized. "Required" refers to seed mode; in update mode, fields are only validated if present.

| Field | Required (seed) | Type | Validation | Normalization |
|---|---|---|---|---|
| `name` | Yes | `string` | Must be non-empty after trimming | Trimmed |
| `url` | Yes | `string` | Must be non-empty, must start with `http://` or `https://` | Trimmed |
| `vendor` | Yes | `string` | Must be non-empty after trimming | Trimmed and **lowercased** |
| `description` | Yes | `string` | Must be non-empty; HTML-aware -- empty HTML tags like `<p></p>` with no text content are rejected | Trimmed (original HTML preserved for storage) |
| `price` | Yes | `number` | Must be a positive number (> 0) | Numeric strings coerced to number (e.g., `"12.99"` becomes `12.99`) |
| `original_price` | Yes | `number` | Must be a positive number (> 0) | Numeric strings coerced to number |
| `stock_status` | Yes | `string` | Must normalize to `"in stock"` or `"out of stock"` | Lowercased, underscores replaced, see `normalizeStockStatus` |
| `images` | Yes | `array \| object` | Must be an array or object | Passed through |
| `main_image` | Yes | `string` | Must be non-empty after trimming; pinged via HEAD in update mode | Trimmed |
| `product_id` | Yes | `string` | Must be non-empty after trimming | Trimmed |
| `timestamp` | Yes | `string` | Must be non-empty after trimming | Trimmed |
| `weight` | No | `number` | Must be a valid number if present | Coerced from string via `Number()` |
| `height` | No | `number` | Must be a valid number if present | Coerced from string via `Number()` |
| `width` | No | `number` | Must be a valid number if present | Coerced from string via `Number()` |
| `length` | No | `number` | Must be a valid number if present | Coerced from string via `Number()` |
| `category` | No | `string` | Accepted if string | Trimmed |
| `ean_code` | No | `string` | Accepted if string | Trimmed |
| `breadcrumbs` | No | `object` | Accepted if object | Passed through |
| `variants` | No | `object` | Accepted if object | Passed through |

**Note on optional numeric fields:** Unlike `price` and `original_price`, the dimension fields (`weight`, `height`, `width`, `length`) do **not** have a positivity constraint. They only need to be convertible to a number via `Number()`. A value of `0` is accepted.

---

## Shopify Special Case

When the product source is `'shopify'` (detected via `options.source === 'shopify'` or `product.source === 'shopify'`), seed mode applies a **reduced requirement set**:

- **Only `name` and `url` are required.**
- All other fields are treated as optional and normalized if present via `applyOptionalNormalizations`.
- The function short-circuits after validating `name` and `url`, skipping vendor, description, price, and other normally-required fields.

This accommodates Shopify product data which may arrive with a different field structure than standard scraped products.

---

## Usage Examples

### seed-scraped-products (batch creation)

```typescript
import {
  validateProductBatch,
  type ValidationError,
} from '../_shared/product-validation.ts';

// Validate all incoming products in seed mode (strict, no image pinging)
const { valid: validProducts, validationErrors } = await validateProductBatch(rawProducts);

if (validationErrors.length > 0) {
  // Return 400 with error details
  return new Response(JSON.stringify({
    success: false,
    error: "Validation failed.",
    validation_errors: validationErrors,
  }), { status: 400 });
}

// validProducts is an array of normalized product objects ready for DB insertion
```

### push-to-pending (webhook — validate + image check before classification)

```typescript
import { validateProduct } from '../_shared/product-validation.ts';

// Validate product fields + image accessibility (cheap check before expensive Gemini call)
const validation = await validateProduct(
  scrapedProduct as unknown as Record<string, unknown>,
  { mode: 'seed', checkImages: true },
);

if (!validation.valid) {
  const errorSummary = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
  // Skip Gemini classification, insert into pending_products with validation_error
}
```

### update-scraped-product (partial update)

```typescript
import {
  validateProductUpdate,
  filterToAllowedFields,
} from '../_shared/product-validation.ts';

// Step 1: Strip disallowed fields (security allowlist)
const filteredUpdates = filterToAllowedFields(fields);

if (Object.keys(filteredUpdates).length === 0) {
  // No valid fields to update
  return { url, success: false, error: 'No valid fields to update' };
}

// Step 2: Validate and normalize (update mode, pings main_image if present)
const validation = await validateProductUpdate(filteredUpdates);

if (!validation.valid) {
  const errorMsg = validation.errors.map(e => e.message).join('; ');
  return { url, success: false, error: errorMsg };
}

// Step 3: Use validation.normalized for the database update
await supabaseClient
  .from('scraped_products')
  .update({ ...validation.normalized, updated_at: now })
  .eq('url', url.trim());
```

---

## Behavioral Notes

### Error collection is exhaustive (not fail-fast)

All validation errors for a product are collected before returning. If a product has three invalid fields, all three errors will appear in the `errors` array. This makes it easier for callers to fix all problems in one pass.

### Image pinging is gated on prior validity

Image accessibility checks (`pingImageUrl`) only run when `checkImages: true` **and** no other validation errors exist (`errors.length === 0`). This avoids making unnecessary network calls for products that will be rejected anyway.

### Numeric string coercion

Fields like `price`, `original_price`, `weight`, `height`, `width`, and `length` accept numeric strings. A value of `"12.99"` is coerced to `12.99` rather than being rejected. This accommodates scrapers that return numbers as strings.

### Description HTML validation

In seed mode, a description field that contains only empty HTML tags with no actual text content is rejected. For example, `"<p></p>"` and `"<div>  </div>"` are considered empty after `stripHtml` processing. The original HTML is preserved for storage -- stripping is only used for validation.

### Stock status normalization gap

`normalizeStockStatus` only maps to `"in stock"` and `"out of stock"`. However, the ERPNext sync layer (`_shared/erpnext-utils.ts`) recognizes additional statuses: `"Low Stock"` and `"On Order"`. Products with `stock_status` values like `"low stock"` or `"on order"` will be **rejected** by this validation module (returns `null` from `normalizeStockStatus`, which produces a validation error). If these statuses need to pass through, `normalizeStockStatus` must be extended.

### Normalized output merges over original

When validation passes, the `normalized` object is constructed as `{ ...product, ...normalized }` -- the original product fields are used as a base, then overwritten by any values the validator explicitly normalized. Fields the validator did not touch retain their original values.

### Seed-mode Shopify short-circuit

When source is `'shopify'` in seed mode, the function returns immediately after validating `name` and `url` and applying optional normalizations. Fields like `vendor`, `description`, `price`, `original_price`, `stock_status`, `images`, `main_image`, `product_id`, and `timestamp` are **not** required and not validated.

### Vendor error suppression in update mode

In update mode, if `vendor` is present but invalid (e.g., not a string), the error is suppressed -- it is only added in seed mode (`if (result.error && isSeed)`). The same pattern applies to `main_image`, `product_id`, and `timestamp`. This means providing an invalid value for these fields in update mode silently drops them from the normalized output rather than returning an error.
