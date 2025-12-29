# seed-scraped-products

## Overview
Bulk import scraped products into the `scraped_products` table with comprehensive validation, deduplication, and update capabilities. Validates required fields, handles duplicates by product_id and URL, and supports updating existing products. Requires custom API key authentication via the `verify_api_key` RPC function.

## Endpoint
- **URL**: `/seed-scraped-products`
- **Method**: POST
- **Authentication**: Custom API Key (X-API-Key header with insert permission for scraped_products)

## Request

### Headers
```
Content-Type: application/json
X-API-Key: your-custom-api-key
```

### Body

**Format 1: Direct Array (Legacy)**
```json
[
  {
    "vendor": "acme-corp",
    "name": "Product Name",
    "url": "https://example.com/product",
    "price": 29.99,
    "description": "Product description",
    "stock_status": "in stock",
    "images": ["https://example.com/image1.jpg"],
    "main_image": "https://example.com/image1.jpg",
    "product_id": "ACME-12345",
    "original_price": 39.99,
    "timestamp": "2025-12-18T10:00:00Z",
    "ean_code": "1234567890123",
    "weight": 1.5,
    "height": 10,
    "width": 5,
    "length": 3,
    "category": "Electronics",
    "breadcrumbs": {"level1": "Home", "level2": "Electronics"},
    "variants": {"color": ["Red", "Blue"]}
  }
]
```

**Format 2: Object with Update Flag (Recommended)**
```json
{
  "products": [ /* array of products as above */ ],
  "update_existing": true
}
```

### Required Fields
- `vendor` (string): Vendor/supplier name
- `name` (string): Product name
- `url` (string): Product URL (unique constraint)
- `price` (number): Current price
- `description` (string): Product description
- `stock_status` (string): Must be "in stock" or "out of stock" (case insensitive)
- `images` (array or object): Product images
- `main_image` (string): Primary product image URL
- `product_id` (string): Vendor's product ID
- `original_price` (number): Original/MSRP price
- `timestamp` (string): Scraping timestamp (ISO 8601 format)

### Optional Fields
- `ean_code` (string): EAN/barcode
- `weight` (number): Product weight
- `height` (number): Product height
- `width` (number): Product width
- `length` (number): Product length
- `category` (string): Product category
- `breadcrumbs` or `breadcrumb` (object): Category breadcrumb trail
- `variants` (object): Product variants

### Parameters
- `update_existing` (boolean, optional): If true, updates existing products by URL. If false (default), skips existing products.

## Response

### Success Response
```json
{
  "success": true,
  "update_existing": false,
  "stats": {
    "total_received": 100,
    "validation_failed": 0,
    "duplicates_removed": 5,
    "skipped": 10,
    "inserted": 85,
    "updated": 0
  },
  "errors": []
}
```

### Success Response with Updates
```json
{
  "success": true,
  "update_existing": true,
  "stats": {
    "total_received": 100,
    "validation_failed": 0,
    "duplicates_removed": 5,
    "skipped": 0,
    "inserted": 80,
    "updated": 15
  },
  "errors": []
}
```

### Validation Error Response
```json
{
  "success": false,
  "error": "Validation failed. Required fields: vendor, name, url, price, description, stock_status ('in stock' or 'out of stock'), images, main_image, product_id, original_price, timestamp. Optional: ean_code, weight, height, width, length, category, breadcrumbs, variants.",
  "validation_errors": [
    {
      "index": 0,
      "field": "stock_status",
      "message": "Invalid stock_status at product index 0. Must be 'in stock' or 'out of stock' (case insensitive)"
    }
  ],
  "stats": {
    "total_received": 100,
    "validation_failed": 1,
    "duplicates_removed": 0,
    "skipped": 0,
    "inserted": 0,
    "updated": 0
  }
}
```

### Error Responses

**401 Unauthorized - Missing API Key:**
```json
{
  "success": false,
  "error": "Missing X-API-Key header. Custom API key is required."
}
```

**401 Unauthorized - Invalid API Key:**
```json
{
  "success": false,
  "error": "Invalid or expired API key."
}
```

**403 Forbidden - No Permission:**
```json
{
  "success": false,
  "error": "API key does not have permission to insert products."
}
```

**400 Bad Request - Invalid Format:**
```json
{
  "error": "Invalid request. Expected an array of products or an object with 'products' array and optional 'update_existing' boolean."
}
```

**400 Bad Request - Empty Array:**
```json
{
  "error": "Invalid request. Product array cannot be empty."
}
```

**405 Method Not Allowed:**
```json
{
  "error": "Method not allowed. Use POST."
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Error message details"
}
```

## Environment Variables
- `SUPABASE_URL` - Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations (required)

## Database Tables

### Tables Modified
- `scraped_products` - Inserts new products or updates existing products based on URL

### RPC Functions Used
- `verify_api_key(provided_key: string)` - Validates custom API key and returns permissions

## Processing Logic

### Step-by-Step Flow
1. **Authentication**: Verifies X-API-Key header using `verify_api_key` RPC
2. **Permission Check**: Ensures API key has insert permission for scraped_products
3. **Validation**: Validates all required fields for each product
4. **Deduplication by product_id**: Removes duplicate products within the batch
5. **Schema Mapping**: Maps products to database schema with calculated fields
6. **Deduplication by URL**: Removes duplicate URLs within the batch
7. **Categorization**: Splits products into insert/update/skip based on existing URLs
8. **Batch Insert**: Inserts new products in batches of 100
9. **Batch Update**: Updates existing products individually (if update_existing=true)

### Calculated Fields
- `id`: SHA-256 hash of vendor + URL (first 16 bytes, 32 hex chars)
- `variant_count`: Calculated from variants object/array
- `stock_status`: Normalized to lowercase
- `vendor`: Normalized to lowercase
- `status`: Set to "pending"
- `ai_title`: Empty string (populated by AI agents)
- `ai_description`: Empty string (populated by AI agents)
- `volumetric_weight`: Set to 0 (calculated by dimension agents)

### Deduplication Logic
1. **Within batch**: Products with duplicate `product_id` values are removed
2. **Within batch**: Products with duplicate `url` values are removed
3. **Against database**: Products with URLs matching existing records are either:
   - Skipped (if `update_existing=false`)
   - Updated (if `update_existing=true`)

### Update Behavior
When `update_existing=true`:
- Matches products by URL (unique constraint)
- Updates all fields EXCEPT `id` and `url`
- Sets `updated_at` timestamp automatically
- Processes updates individually (not in batches)

## Example Usage

### Insert New Products (Skip Existing)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/seed-scraped-products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-custom-api-key" \
  -d '{
    "products": [
      {
        "vendor": "acme-corp",
        "name": "Wireless Mouse",
        "url": "https://acme.com/mouse-123",
        "price": 29.99,
        "description": "Ergonomic wireless mouse",
        "stock_status": "in stock",
        "images": ["https://acme.com/mouse.jpg"],
        "main_image": "https://acme.com/mouse.jpg",
        "product_id": "MOUSE-123",
        "original_price": 39.99,
        "timestamp": "2025-12-18T10:00:00Z"
      }
    ]
  }'
```

### Update Existing Products
```bash
curl -X POST https://your-project.supabase.co/functions/v1/seed-scraped-products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-custom-api-key" \
  -d '{
    "products": [ /* products array */ ],
    "update_existing": true
  }'
```

## Generating API Keys

Use the provided script to generate new API keys:

```bash
# Navigate to supabase directory
cd supabase

# Install dependencies (first time only)
npm install @supabase/supabase-js dotenv

# Generate a new API key (never expires)
node generate-api-key.js "Dashboard API Key"

# Generate API key with 365-day expiration
node generate-api-key.js "Dashboard API Key" 365
```

The script will output:
- API key ID and metadata
- The actual API key (copy immediately - it won't be shown again!)
- Example usage commands

## Related Functions

- **manual-push-to-pending**: Manually push scraped products to pending queue for agent processing
- **push-to-pending**: Webhook that automatically queues new scraped products
- **classify-product**: AI agent for product classification and categorization
- **reset-agent-completed**: Reset agent status from complete to pending for reprocessing

## Notes
- Batch size is 100 products per insert operation
- Stock status is validated and normalized to lowercase ("in stock" or "out of stock")
- Images can be array or object format
- URL is the primary deduplication key (has unique constraint)
- Product ID is generated using SHA-256 hash (not MD5 for Deno compatibility)
- The function sets up products for agent processing via the push-to-pending webhook
- Breadcrumbs field accepts both `breadcrumbs` and `breadcrumb` keys
- All string fields are trimmed of whitespace
- Vendor names are normalized to lowercase
- The function does NOT trigger the push-to-pending webhook directly; that happens via database trigger
- Maximum payload size: approximately 6MB (Supabase Edge Function limit)
- For large datasets (>10,000 products): consider chunking requests
- CORS enabled for all origins with preflight support
- Update operations exclude `id` and `url` fields to preserve database constraints
- Existing URL check is paginated (1000 rows per batch) to handle large datasets efficiently
- Variant count is calculated from both object properties and array lengths
