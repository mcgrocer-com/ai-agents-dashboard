# ERPNext Data Contract

Standardized requirements for product data sent to ERPNext. This document is the single reference for what fields are required, their formats, length constraints, and how data flows from scraping through agent sanitization to ERPNext sync.

## Product Lifecycle

```
Scraper             Classification        AI Agents              ERPNext Sync
  |                     |                    |                       |
  v                     v                    v                       v
scraped_products -> classify -> pending_products -> agents -> productToERPNextFormat -> ERPNext API
                    (accept/     (category,         (enrich)    (transform +
                     reject)      weight, SEO,                   sanitize)
                                  FAQ statuses)
```

A product must pass through **all required agents** before it is eligible for ERPNext sync. This is called being **"sanitized"**.

---

## Required Agent Statuses

All three required agents must have `status = 'complete'` in `pending_products`:

| Agent | Status Field | What It Produces |
|-------|-------------|-----------------|
| **Category** | `category_status` | `category`, `breadcrumbs` |
| **Weight & Dimension** | `weight_and_dimension_status` | `weight`, `height`, `width`, `length`, `volumetric_weight` |
| **SEO** | `seo_status` | `ai_title`, `ai_description`, `meta_title`, `meta_description` |
| **FAQ** (optional) | `faq_status` | `faq` (array of Q&A objects) |

---

## Agent Data Validation (Pre-Sync)

Before sending to ERPNext, `validateProductAgentData()` checks:

| Check | Requirement | Resets Status To |
|-------|------------|-----------------|
| **Category** | Non-empty, not `'[]'` | `category_status = 'pending'` |
| **Breadcrumbs** | Non-empty array, not `[]` | `category_status = 'pending'` |
| **Weight** | `> 0` | `weight_and_dimension_status = 'pending'` |
| **Volumetric Weight** | `> 0` | `weight_and_dimension_status = 'pending'` |
| **Dimensions** | At least one of `height`, `width`, `length` `> 0` | `weight_and_dimension_status = 'pending'` |
| **SEO (all 4 fields)** | All non-empty strings | `seo_status = 'pending'` |

If any check fails, the corresponding agent status is reset to `'pending'` for reprocessing.

Source: [`_shared/product-validation.ts`](../supabase/functions/_shared/product-validation.ts) - `validateProductAgentData()`

---

## ERPNext Payload Format

The `productToERPNextFormat()` function in [`_shared/erpnext-utils.ts`](../supabase/functions/_shared/erpnext-utils.ts) transforms product data into the ERPNext API payload.

### Required Fields (Always Sent)

| ERPNext Field | Source | Type | Notes |
|--------------|--------|------|-------|
| `url` | `pending_products.url` | string | Product source URL |
| `vendor` | `pending_products.vendor` | string | Vendor name, defaults to `'unknown'` |
| `timestamp` | `pending_products.updated_at` | string (ISO) | Falls back to `new Date().toISOString()` |
| `copyright` | Computed | `"true"` or `"false"` | Whether copyright-free images are used |

### Product Data Fields (Sent on Create or Full Sync)

| ERPNext Field | Source Field | Type | Notes |
|--------------|-------------|------|-------|
| `name` | `scraped_products.name` | string | Sanitized for ERPNext |
| `price` | `scraped_products.original_price` | number | Maps to ERPNext "price" (RRP) |
| `selling_price` | `scraped_products.price` | number | Maps to ERPNext "selling price" (current price) |
| `description` | `non_copyright_desc` or `description` | string (HTML) | Copyright-free version preferred |
| `stock_status` | `scraped_products.stock_status` | string | Normalized to Title Case (see below) |
| `product_id` | `scraped_products.product_id` | string | Vendor's product identifier |

### Category Fields

| ERPNext Field | Source Field | Type | Validation |
|--------------|-------------|------|-----------|
| `category` | `pending_products.category` | string | Non-empty, not `'[]'` |
| `breadcrumb` | `pending_products.breadcrumbs` | array/object | Non-empty array |

### Weight & Dimension Fields

| ERPNext Field | Source Field | Type | Unit |
|--------------|-------------|------|------|
| `weight` | `pending_products.weight` | number | grams |
| `height` | `pending_products.height` | number | cm |
| `width` | `pending_products.width` | number | cm |
| `length` | `pending_products.length` | number | cm |
| `volumetric_weight` | `pending_products.volumetric_weight` | number | grams |

All dimensions are stored as NUMERIC in the database and cast to `Number()` before sending.

### SEO Fields

| ERPNext Field | Source Field | Type | Recommended Length | Sanitized |
|--------------|-------------|------|-------------------|-----------|
| `ai_title` | `pending_products.ai_title` | string | No strict limit (human-readable title) | Yes |
| `summary` | `pending_products.ai_description` | string | No strict limit (product summary) | Yes |
| `meta_title` | `pending_products.meta_title` | string | **50-60 characters** (SEO best practice) | Yes |
| `meta_description` | `pending_products.meta_description` | string | **140-160 characters** (SEO best practice) | Yes |

All four SEO fields must be non-empty strings for the product to pass agent validation.

Note: `ai_description` maps to `summary` in the ERPNext payload.

### FAQ Fields

| ERPNext Field | Source Field | Type | Limit |
|--------------|-------------|------|-------|
| `faqs` | `pending_products.faq` | string (JSON) | **Maximum 3 FAQ items** |

FAQs are sent as a JSON-stringified array:
```json
[
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." }
]
```

Items beyond the first 3 are truncated via `.slice(0, 3)`.

### Image Fields

| ERPNext Field | Source | Type | Notes |
|--------------|--------|------|-------|
| `main_image` | `non_copyright_images[0]` or `main_image` | string (URL) | Must start with `http://` or `https://` |
| `images` | `non_copyright_images` or `images` | string[] (URLs) | Filtered to valid URLs only |

**Image Priority:**
1. Copyright-free images (`non_copyright_images`) if available and valid
2. Original scraped images as fallback
3. Invalid URLs (not starting with `http://` or `https://`) are filtered out

### Other Fields

| ERPNext Field | Source | Notes |
|--------------|--------|-------|
| `last_scrapped_at` | `scraped_products.timestamp` | When the scraper last fetched this product |

---

## Text Sanitization Rules

All text fields sent to ERPNext are sanitized via `sanitizeForERPNext()`:

| Character | Action | Reason |
|-----------|--------|--------|
| `\` (backslash) | Removed | ERPNext escaping issues |
| `*` (asterisk) | Removed | Breaks ERPNext formatting (e.g., `56g*`) |
| `"` (double quote) | Removed | Inch marks cause ERPNext API errors |
| `?` (question mark) | Removed | ERPNext validation rejects these (since ~Feb 2026) |
| `\|` (pipe) | Replaced with `-` | Used as separator in some titles |
| `...` (unicode ellipsis) | Replaced with `...` (three dots) | Unicode compatibility |
| `" "` (curly double quotes) | Removed | Unicode normalization |
| `' '` (curly single quotes) | Replaced with `'` | Unicode normalization |
| `– —` (en/em dashes) | Replaced with `-` | Unicode normalization |
| Non-printable unicode | Removed | Keeps only ASCII printable + Latin-1 supplement |
| Multiple spaces | Collapsed to single space | Whitespace cleanup |

Affected fields: `name`, `ai_title`, `ai_description` (summary), `meta_title`, `meta_description`

Note: `description` (HTML) is **not** sanitized through this function.

Source: [`_shared/erpnext-utils.ts`](../supabase/functions/_shared/erpnext-utils.ts) - `sanitizeForERPNext()`

---

## Stock Status Mapping

Stock status is normalized to Title Case for ERPNext:

| Input (case-insensitive) | ERPNext Value |
|--------------------------|--------------|
| `in stock`, `in_stock` | `In Stock` |
| `low stock`, `low_stock` | `Low Stock` |
| `on order`, `on_order` | `On Order` |
| `out of stock`, `out_of_stock` | `Out of Stock` |

---

## Classification Requirements

Products must pass UK medicine classification before entering the agent pipeline:

| Classification | Outcome | Enters Pipeline? |
|---------------|---------|-----------------|
| `not_medicine` | Accepted | Yes |
| `gsl` (General Sale List) | Accepted | Yes |
| `pharmacy` | Rejected | No |
| `pom` (Prescription Only) | Rejected | No |
| `unclear` | Rejected | No |

Additional filters:
- `blacklisted = false` (not on manual blacklist)
- `price > 0` (must have a valid price)
- `name IS NOT NULL` (must have a product name)

---

## Scraping Validation (Product Ingestion)

When products are first ingested via `seed-scraped-products`, these fields are required:

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `name` | string | Yes | Non-empty after trim |
| `url` | string | Yes | Must start with `http://` or `https://` |
| `vendor` | string | Yes | Non-empty, lowercased |
| `description` | string (HTML) | Yes | Must contain actual text content (not just empty HTML tags) |
| `price` | number | Yes | Must be > 0 |
| `original_price` | number | Yes | Must be > 0 |
| `stock_status` | string | Yes | Must normalize to `in stock` or `out of stock` |
| `images` | array/object | Yes | Must be valid array or object |
| `main_image` | string | Yes | Non-empty |
| `product_id` | string | Yes | Non-empty (vendor's product ID) |
| `timestamp` | string | Yes | Non-empty (scrape timestamp) |

Optional fields: `weight`, `height`, `width`, `length`, `category`, `ean_code`, `breadcrumbs`, `variants`

Source: [`_shared/product-validation.ts`](../supabase/functions/_shared/product-validation.ts)

---

## ERPNext API Endpoint

```
POST {ERPNEXT_BASE_URL}/api/method/mcgrocer_customization.apis.item.create_items_from_json
```

- Accepts a JSON array of `ERPNextItemPayload` objects
- Creates new items or updates existing items (matched by URL)
- Returns `created_items`, `updated_items`, and `errors` arrays
- Timeout: 30 seconds per request
- Dual-write: Production (required) + Staging (optional, non-blocking)

---

## Sync Pipeline

```
sync-completed-products-to-erpnext (cron: every 15 minutes)
  |
  1. Validate agent statuses (reset invalid ones)
  2. Query products: all 3 agents complete + valid price/name/classification
  3. Check main_image URL validity
  4. Transform via productToERPNextFormat()
  5. Send batch to Production ERPNext
  6. Send batch to Staging ERPNext (optional)
  7. Verify items in ERPNext
  8. Sync agent data back to scraped_products
  9. Clear/store sync error messages
```

---

**Last Updated**: 2026-03-25
