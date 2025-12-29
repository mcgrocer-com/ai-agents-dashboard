# resync-product-to-erpnext

## Overview

Simple edge function that resets ERPNext sync status for a single product, forcing it to be re-synced in the next automatic sync cycle. This function clears the `erpnext_updated_at`, `failed_sync_at`, and `failed_sync_error_message` fields, making the product eligible for the scheduled sync job.

Useful for retrying failed syncs or forcing re-sync after manual data corrections.

## Endpoint

- **URL**: `/resync-product-to-erpnext`
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
  "productId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Required Fields:**
- `productId`: UUID from `pending_products.id`

## Response

### Success Response
**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Successfully reset product for ERPNext resync. It will be re-synced in the next sync cycle.",
  "productId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Validation Error Response
**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "error": "Missing required field: productId",
  "usage": {
    "endpoint": "POST /resync-product-to-erpnext",
    "body": { "productId": "string (required)" }
  }
}
```

### Not Found Response
**Status Code**: `404 Not Found`

```json
{
  "success": false,
  "error": "Product not found with ID: 550e8400-e29b-41d4-a716-446655440000"
}
```

### Error Response
**Status Code**: `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Failed to reset sync status",
  "details": "Error message details"
}
```

## Environment Variables

### Required
- `SUPABASE_URL`: Supabase project URL (automatically provided)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access (automatically provided)

## Database Tables

### Primary Tables
- **pending_products**: Product sync status tracking
  - Modified columns:
    - `erpnext_updated_at`: Set to NULL (removes successful sync timestamp)
    - `failed_sync_at`: Set to NULL (clears failed sync timestamp)
    - `failed_sync_error_message`: Set to NULL (clears error message)

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Parse Request Body                                        │
│    - Extract productId                                       │
│    - Validate productId is provided                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Reset Sync Status Fields                                 │
│    - Set erpnext_updated_at = NULL                          │
│    - Set failed_sync_at = NULL                              │
│    - Set failed_sync_error_message = NULL                   │
│    - WHERE id = productId                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Return Success or Not Found                              │
│    - Success: Product found and updated                     │
│    - Not Found: No product with given ID                    │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Single Product Reset
Resets only the specified product by UUID, leaving all other products unchanged.

### 2. Comprehensive Status Clear
Clears three related fields in a single operation:
- `erpnext_updated_at`: Removes successful sync timestamp
- `failed_sync_at`: Removes failed sync timestamp
- `failed_sync_error_message`: Clears error message

### 3. Non-Destructive
Does not modify product data (category, weight, SEO, etc.), only sync status fields.

### 4. Automatic Retry
After reset, the product will be picked up by the scheduled `sync-completed-products-to-erpnext` function in the next cycle (every 15 minutes).

## Example Usage

### Reset Single Product
```bash
curl -X POST https://your-project.supabase.co/functions/v1/resync-product-to-erpnext \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Reset from Frontend (TypeScript)
```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resyncProduct(productId: string) {
  const { data, error } = await supabase.functions.invoke('resync-product-to-erpnext', {
    body: { productId }
  });

  if (error) {
    console.error('Resync failed:', error);
    return false;
  }

  console.log(data.message);
  return true;
}

// Usage
const success = await resyncProduct('550e8400-e29b-41d4-a716-446655440000');
if (success) {
  console.log('Product will be re-synced in the next cycle (within 15 minutes)');
}
```

### Batch Reset Multiple Products
```typescript
// Reset multiple products sequentially
async function resyncMultipleProducts(productIds: string[]) {
  const results = await Promise.all(
    productIds.map(id =>
      supabase.functions.invoke('resync-product-to-erpnext', {
        body: { productId: id }
      })
    )
  );

  const successful = results.filter(r => !r.error).length;
  console.log(`Reset ${successful}/${productIds.length} products`);

  return results;
}
```

## Use Cases

### 1. Retry Failed Sync
When a product fails to sync due to transient errors (network issues, ERPNext downtime):

```typescript
// Check for failed products
const { data: failedProducts } = await supabase
  .from('pending_products')
  .select('id, url, failed_sync_error_message')
  .not('failed_sync_error_message', 'is', null);

// Reset all failed products for retry
for (const product of failedProducts) {
  await resyncProduct(product.id);
}
```

### 2. Force Re-sync After Data Correction
After manually fixing product data in the database:

```typescript
// 1. Fix the data
await supabase
  .from('pending_products')
  .update({
    category: 'Corrected Category',
    weight: 1.5
  })
  .eq('id', productId);

// 2. Force re-sync to push corrected data to ERPNext
await resyncProduct(productId);
```

### 3. Re-sync After ERPNext Manual Changes
If ERPNext data was manually modified and needs to be overwritten:

```typescript
// Reset product to push latest data from dashboard
await resyncProduct(productId);

// Product will be re-synced with latest data from pending_products
```

## Logging

The function logs with emoji prefixes for easy identification:

- `🔄 Resync to ERPNext request for product: {productId}`
- `❌ Error resetting sync status: {error}`
- `🎉 Resync complete for product: {productId}`
- `💥 Unexpected error: {error}`

## Verification

### Check if Reset Was Successful
```sql
-- Verify sync status was cleared
SELECT
  id,
  url,
  erpnext_updated_at,
  failed_sync_at,
  failed_sync_error_message
FROM pending_products
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- All three fields should be NULL after reset
```

### Monitor Re-sync Progress
```sql
-- Check if product is picked up by scheduled sync
SELECT
  id,
  url,
  erpnext_updated_at,
  category_status,
  weight_and_dimension_status,
  seo_status
FROM pending_products
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- If agent statuses are 'complete' and erpnext_updated_at is still NULL,
-- product is queued for next sync cycle
```

## Performance Notes

- **Operation**: Single row UPDATE query (O(1) complexity)
- **Response Time**: Typically < 100ms
- **Rate Limiting**: None (can be called multiple times)
- **Idempotent**: Safe to call multiple times on same product

## Comparison with Related Functions

| Feature | resync-product-to-erpnext | resync-vendor-to-erpnext | push-products-to-erpnext |
|---------|---------------------------|--------------------------|--------------------------|
| Scope | Single product | All products from vendor | Multiple products |
| Action | Reset sync status | Reset sync status | Immediate push |
| Timing | Next scheduled sync | Next scheduled sync | Immediate |
| Input | productId (UUID) | vendor (string) | productUrls (array) |

## Security Considerations

- **Authentication Required**: Must provide valid Supabase key
- **CORS Enabled**: Can be called from browser clients
- **Service Role Access**: Uses service role for database access (bypasses RLS)
- **Input Validation**: Validates productId is provided and non-empty
- **SQL Injection Protection**: Uses Supabase client with parameterized queries

## Troubleshooting

### Product Not Found (404 Error)
**Cause**: Product ID doesn't exist in `pending_products` table

**Solution**:
```sql
-- Verify product exists
SELECT id, url FROM pending_products WHERE id = 'your-product-id';

-- Check if product is in scraped_products but not pending_products
SELECT sp.id, sp.url
FROM scraped_products sp
LEFT JOIN pending_products pp ON sp.id = pp.scraped_product_id
WHERE pp.id IS NULL;
```

### Reset Successful but Product Not Re-syncing
**Cause**: Product doesn't meet sync criteria

**Solution**:
```sql
-- Check agent completion status
SELECT
  id,
  url,
  category_status,
  weight_and_dimension_status,
  seo_status,
  erpnext_updated_at
FROM pending_products
WHERE id = 'your-product-id';

-- Product must have:
-- - category_status = 'complete'
-- - weight_and_dimension_status = 'complete'
-- - seo_status = 'complete'
-- - erpnext_updated_at = NULL (after reset)
-- - valid scraped_product_id reference
-- - valid price > 0
```

### Function Returns Error 500
**Cause**: Database connection or permission issues

**Solution**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
2. Check function deployment status
3. Review function logs for detailed errors:
   ```bash
   supabase functions logs resync-product-to-erpnext
   ```

## Related Functions

- **sync-completed-products-to-erpnext**: Scheduled automatic sync (picks up reset products)
- **resync-vendor-to-erpnext**: Reset all products for a vendor
- **push-products-to-erpnext**: Manual immediate push (bypasses sync cycle)

## Additional Resources

- [Scheduled Sync Function](../sync-completed-products-to-erpnext/README.md)
- [Vendor Resync Function](../resync-vendor-to-erpnext/README.md)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
