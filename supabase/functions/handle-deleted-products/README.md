# handle-deleted-products

## Overview
Processes products that have been deleted at source (vendor website). Blacklists them in the database and disables them in ERPNext. Used when the scraper detects products are no longer available.

## Endpoint
- **URL**: `/handle-deleted-products`
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
[
  { "url": "https://vendor.com/product-1" },
  { "url": "https://vendor.com/product-2" }
]
```

Array of objects, each with a `url` field (string, required).

## Response

### Success (200)
```json
{
  "success": true,
  "total": 2,
  "blacklisted": 2,
  "failed": 0,
  "erpnext_disabled": true,
  "results": [
    { "url": "https://vendor.com/product-1", "success": true },
    { "url": "https://vendor.com/product-2", "success": true }
  ]
}
```

### Partial Failure (200)
```json
{
  "success": false,
  "total": 2,
  "blacklisted": 1,
  "failed": 1,
  "erpnext_disabled": true,
  "erpnext_error": null,
  "results": [
    { "url": "https://vendor.com/product-1", "success": true },
    { "url": "https://vendor.com/product-2", "success": false, "error": "DB error" }
  ]
}
```

### Error - Invalid Body (400)
```json
{
  "success": false,
  "error": "Request body must be a non-empty array of objects with \"url\" field"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for bypassing RLS |

## Processing Flow

1. **Blacklist in database**: Updates `scraped_products` for each URL:
   - Sets `blacklisted = true`
   - Sets `blacklist_reason = 'Product deleted at source'`
   - Sets `blacklisted_at` to current timestamp
2. **Disable in ERPNext**: Invokes `disable-products-in-erpnext` edge function with all successfully blacklisted URLs

### Batch Processing
- Database updates processed in batches of 10
- ERPNext disable sent as a single call with all successful URLs

## Database Tables

### Tables Modified
- `scraped_products` — Sets blacklist fields on matching URLs

## Related Functions
- **disable-products-in-erpnext** — Called internally to disable items in ERPNext
- **seed-scraped-products** — Ingests products (opposite flow)
