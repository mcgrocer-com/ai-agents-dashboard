# export-validation-errors

## Overview
Exports products with validation errors from the `pending_products` table, joined with `scraped_products` data. Supports field selection and error category filtering. Used by the Validation Issues tab export feature for rescraping workflows.

## Endpoint
- **URL**: `/export-validation-errors`
- **Method**: POST
- **Authentication**: Supabase Auth (anon key or service role)

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Body
```json
{
  "fields": ["url", "vendor", "name", "price", "validation_error"],
  "error_category": "http_error"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fields | string[] | Yes | Columns to include in export |
| error_category | string | No | Filter by error category |

### Allowed Fields

**From `scraped_products`:**
`id`, `url`, `product_id`, `vendor`, `name`, `price`, `original_price`, `main_image`, `category`, `stock_status`, `ean_code`, `created_at`, `updated_at`

**From `pending_products`:**
`validation_error`

### Error Categories
| Category | Matches |
|----------|---------|
| `http_error` | Main image HTTP errors |
| `timeout` | Main image timeout errors |
| `unreachable` | Main image unreachable errors |
| `post_processing` | Post-processing errors |
| `image_mismatch` | Image mismatch errors |

## Response

### Success (200)
```json
{
  "success": true,
  "data": [
    {
      "url": "https://vendor.com/product-1",
      "vendor": "tesco",
      "name": "Product Name",
      "validation_error": "Main image HTTP 404"
    }
  ],
  "total_count": 42
}
```

### Error - No Valid Fields (400)
```json
{
  "success": false,
  "error": "No valid fields provided."
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_DB_URL | Yes | Direct Postgres connection string |

## Implementation Notes
- Uses `postgres.js` directly (not Supabase client) to avoid row count limits
- Field whitelist prevents data leakage — unknown fields are silently ignored
- Results ordered by `pending_products.updated_at DESC`

## Database Tables

### Tables Read
- `pending_products` — Products with validation errors
- `scraped_products` — Joined via `scraped_product_id` for product data

## Related Functions
- **push-to-pending** — Creates pending_products entries
- **sync-completed-products-to-erpnext** — Consumes validated products
