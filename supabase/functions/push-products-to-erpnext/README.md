# push-products-to-erpnext

## Overview

Manual on-demand edge function that pushes specific products to ERPNext by their URLs. Unlike the scheduled sync function, this endpoint allows immediate push of selected products without waiting for the cron job cycle. It does not validate agent completion status, allowing manual push of products with valid data regardless of agent processing state.

Uses shared utilities from `_shared/erpnext-utils.ts` for consistency with the scheduled sync function.

## Endpoint

- **URL**: `/push-products-to-erpnext`
- **Method**: `POST`
- **Authentication**: Supabase Anon/Service Key via Bearer token
- **CORS**: Enabled for cross-origin requests

## Request

### Headers
- `Content-Type`: `application/json` (required)
- `Authorization`: `Bearer YOUR_SUPABASE_KEY` (required)

### Body
```json
{
  "productUrls": [
    "https://vendor.com/product-1",
    "https://vendor.com/product-2",
    "https://vendor.com/product-3"
  ]
}
```

**Required Fields:**
- `productUrls`: Array of strings (product URLs from `pending_products.url`)

## Response

### Success Response
**Status Code**: `200 OK`

```json
{
  "success": true,
  "results": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://vendor.com/product-1",
      "status": "success",
      "itemCode": "ITEM-001"
    },
    {
      "productId": "550e8400-e29b-41d4-a716-446655440001",
      "url": "https://vendor.com/product-2",
      "status": "failed",
      "error": "[update] ITEM-002: Validation error: Price cannot be negative"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  }
}
```

**Response Fields:**
- `success`: `true` if at least one product succeeded, `false` otherwise
- `results`: Array of result objects for each product
  - `productId`: UUID from `pending_products.id`
  - `url`: Product URL
  - `status`: `"success"` or `"failed"`
  - `itemCode`: ERPNext item code (only on success)
  - `error`: Error message (only on failure)
- `summary`: Aggregate statistics
  - `total`: Total products requested
  - `successful`: Number of successful pushes
  - `failed`: Number of failed pushes

### Validation Error Response
**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "error": "productUrls array is required and cannot be empty"
}
```

Or when no valid products found:

```json
{
  "success": false,
  "error": "No valid products found. Products must have a valid scraped_product_id to be pushed to ERPNext.",
  "details": "Requested 3 product(s), found 0 that meet requirements"
}
```

### Error Response
**Status Code**: `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Error message description"
}
```

## Environment Variables

### Required
- `SUPABASE_DB_URL`: PostgreSQL connection string for database access
- `ERPNEXT_BASE_URL`: Production ERPNext instance URL (default: `https://erpnext.mcgrocer.com`)
- `ERPNEXT_AUTH_TOKEN`: API authentication token for Production ERPNext (REQUIRED)

### Optional
- `ERPNEXT_AUTH_TOKEN_STAGING`: API token for Staging ERPNext (enables dual-write)
- `ERPNEXT_BASE_URL_STAGING`: Staging ERPNext URL (default: `https://staging-erpnext.mcgrocer.com`)
- `ERPNEXT_API_ENDPOINT`: ERPNext API endpoint path (default: `/api/method/mcgrocer_customization.mcgrocer_customization.apis.item.create_items_from_json`)

## Database Tables

### Primary Tables
- **pending_products**: Contains products with agent processing status
  - Required columns: `id`, `url`, `item_code`, `scraped_product_id`, `non_copyright_desc`, `erpnext_updated_at`, `sync_full_product`, `failed_sync_at`, `failed_sync_error_message`
  - Agent data: `category`, `breadcrumbs`, `weight`, `height`, `width`, `length`, `volumetric_weight`, `ai_title`, `ai_description`, `meta_title`, `meta_description`, `non_copyright_images`, `non_copyright_desc`

- **scraped_products**: Source product data (joined via `scraped_product_id`)
  - Columns: `id`, `name`, `price`, `original_price`, `description`, `images`, `main_image`, `stock_status`, `variants`, `url`, `product_id`

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Parse Request Body                                        │
│    - Extract productUrls array                              │
│    - Validate array is not empty                            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Query Products by URLs                                    │
│    - Join pending_products with scraped_products            │
│    - Filter by provided URLs                                │
│    - Require valid scraped_product_id                       │
│    - No agent status validation (manual push)               │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Check Existing Items in ERPNext                          │
│    - Batch query ERPNext by URLs                            │
│    - Get item_code and data_source for existing items       │
│    - Determine create vs update for each product            │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Transform to ERPNext Payload                             │
│    - Use copyright images/description if available          │
│    - Include category, weight/dimension, SEO fields         │
│    - Require description for new item creation              │
│    - Build ERPNextItemPayload for each product              │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Push to Production ERPNext                               │
│    - Batch API call (5 products at a time)                  │
│    - API returns created/updated items + errors             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Push to Staging ERPNext (Optional)                       │
│    - Only if ERPNEXT_AUTH_TOKEN_STAGING is set             │
│    - Non-blocking: errors logged only                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Verify Items in ERPNext                                  │
│    - Query ERPNext API for each created/updated item_code   │
│    - Get modified timestamp from ERPNext                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Update Database for Verified Products                    │
│    - Set erpnext_updated_at = ERPNext modified timestamp   │
│    - Update item_code                                       │
│    - Clear sync_full_product flag                          │
│    - Clear failed_sync_error_message and failed_sync_at    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Sync Agent Data to scraped_products                      │
│    - Copy: category, breadcrumbs, ai_title, ai_description │
│    - Copy: weight, height, width, length, volumetric_weight│
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Store Error Messages for Failed Products                │
│     - Update failed_sync_error_message                      │
│     - Set failed_sync_at timestamp                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Build Response with Per-Product Results                 │
│     - Include success/failure status for each product       │
│     - Provide summary statistics                            │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Manual Push Control
Unlike the scheduled sync function, this endpoint:
- Does NOT check agent completion status
- Allows immediate push without waiting for cron cycle
- Useful for testing, debugging, or force-syncing specific products

### 2. Dual-Write Pattern
Same as scheduled sync:
- **Production ERPNext**: Required, failures block the process
- **Staging ERPNext**: Optional (requires `ERPNEXT_AUTH_TOKEN_STAGING`), non-blocking

### 3. Batch Processing
Processes products in batches of 5 to avoid API rate limits and optimize performance.

### 4. Per-Product Result Tracking
Returns individual status for each product:
- Success: Returns ERPNext `item_code`
- Failure: Returns specific error message from ERPNext API

### 5. Copyright Content Prioritization
When available, uses vendor-neutral copyright content:
- `non_copyright_images` over `images`
- `non_copyright_desc` over `description`
- Sets `copyright: "true"` flag in payload

### 6. Validation Requirements
Products must have:
- Valid `scraped_product_id` reference
- Valid `url`
- Valid `description` or `non_copyright_desc` (for creation only)

## Example Usage

### Push Single Product
```bash
curl -X POST https://your-project.supabase.co/functions/v1/push-products-to-erpnext \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productUrls": [
      "https://freshfarm.com/products/organic-tomatoes"
    ]
  }'
```

### Push Multiple Products
```bash
curl -X POST https://your-project.supabase.co/functions/v1/push-products-to-erpnext \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productUrls": [
      "https://freshfarm.com/products/organic-tomatoes",
      "https://freshfarm.com/products/organic-carrots",
      "https://freshfarm.com/products/organic-lettuce"
    ]
  }'
```

### Push from Frontend (TypeScript)
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.functions.invoke('push-products-to-erpnext', {
  body: {
    productUrls: [
      'https://vendor.com/product-1',
      'https://vendor.com/product-2'
    ]
  }
});

if (error) {
  console.error('Push failed:', error);
} else {
  console.log('Push result:', data);
  console.log(`Success: ${data.summary.successful}/${data.summary.total}`);

  // Check individual results
  data.results.forEach(result => {
    if (result.status === 'success') {
      console.log(`✓ ${result.url} → ${result.itemCode}`);
    } else {
      console.error(`✗ ${result.url}: ${result.error}`);
    }
  });
}
```

## Logging

The function provides detailed console logging:

- `[PUSH]` - Main push operation status
- `[PROD]` - Production ERPNext API interactions
- `[STAGING]` - Staging ERPNext API interactions (optional)
- `[CHECK]` - Existing item checks in ERPNext
- `[VERIFY]` - Item verification after sync
- `[UPDATE]` - Database updates for verified products
- `[SYNC_SCRAPED]` - Agent data sync to scraped_products
- `[CLEAR_ERRORS]` - Error message cleanup
- `[STORE_ERRORS]` - Error message storage

## Error Handling

### Product-Level Errors
Each product's error is captured individually and included in the response:
```json
{
  "productId": "...",
  "url": "https://vendor.com/product",
  "status": "failed",
  "error": "[create] NEW-ITEM: Duplicate item code"
}
```

Common error formats from ERPNext API:
- `[create] {item_code}: {error_message}` - Error during creation
- `[update] {item_code}: {error_message}` - Error during update
- `No URL` - Product missing URL field
- `No description for creation` - New item requires description
- `Batch error: {message}` - Entire batch failed

### Batch-Level Errors
If an entire batch fails (network error, ERPNext API down), all products in that batch are marked as failed with the same error message.

### Database Persistence
Failed sync attempts are stored in `pending_products` table:
- `failed_sync_error_message`: Error message text
- `failed_sync_at`: Timestamp of failure

These can be cleared by the scheduled sync function upon successful retry.

## Performance Notes

- **Batch Size**: Fixed at 5 products per ERPNext API call
- **Parallel Processing**: Multiple batches processed sequentially
- **Verification**: Parallel verification of all created/updated items
- **CORS**: Enabled for browser-based client requests

## Comparison with Scheduled Sync

| Feature | push-products-to-erpnext | sync-completed-products-to-erpnext |
|---------|--------------------------|-------------------------------------|
| Trigger | Manual (on-demand) | Automatic (cron every 15 min) |
| Product Selection | By URL array | By agent completion status |
| Agent Validation | None (allows manual push) | Strict (all agents must be complete) |
| Classification | Not performed | Gemini AI classification + rejection |
| Admin Preferences | Not used | Respects sync_to_erpnext, sync_vendors, etc. |
| Batch Size | Fixed (5) | Configurable (default 20 query, 5 API) |
| Use Case | Testing, debugging, force sync | Production automated sync |

## Security Considerations

- **Authentication Required**: Must provide valid Supabase key
- **CORS Enabled**: Can be called from browser clients
- **Service Role Access**: Function uses service role for database access (bypasses RLS)
- **Input Validation**: Validates productUrls is non-empty array
- **SQL Injection Protection**: Uses parameterized queries via postgres-js

## Troubleshooting

### "No valid products found" Error
**Cause**: Products don't have valid `scraped_product_id` reference

**Solution**:
```sql
-- Check if products have scraped_product_id
SELECT id, url, scraped_product_id
FROM pending_products
WHERE url IN ('https://vendor.com/product-1', '...');

-- Fix missing references if needed
UPDATE pending_products pp
SET scraped_product_id = sp.id
FROM scraped_products sp
WHERE pp.url = sp.url
  AND pp.scraped_product_id IS NULL;
```

### Products Marked as Failed but No Error
**Cause**: Check ERPNext API connectivity or authentication

**Solution**:
1. Verify `ERPNEXT_BASE_URL` is accessible
2. Verify `ERPNEXT_AUTH_TOKEN` is valid
3. Check function logs for detailed error messages

### Copyright Content Not Used
**Cause**: `non_copyright_images` or `non_copyright_desc` is NULL/empty

**Solution**:
```sql
-- Check copyright data availability
SELECT id, url,
       non_copyright_images IS NOT NULL as has_copyright_images,
       non_copyright_desc IS NOT NULL as has_copyright_desc
FROM pending_products
WHERE url = 'https://vendor.com/product';

-- Products with copyright data will have copyright='true' in payload
```

## Related Functions

- **sync-completed-products-to-erpnext**: Scheduled automatic sync
- **resync-product-to-erpnext**: Reset single product for resync
- **resync-vendor-to-erpnext**: Reset all vendor products for resync

## Additional Resources

- [Shared ERPNext Utilities](_shared/erpnext-utils.ts)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [ERPNext API Documentation](https://frappeframework.com/docs/user/en/api)
