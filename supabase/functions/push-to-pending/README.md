# push-to-pending

## Overview
Database webhook function that automatically processes scraped products with UK medicine compliance classification using Gemini AI. Triggered on INSERT, UPDATE, or DELETE operations in the `scraped_products` table. Products are classified as not_medicine, gsl, pharmacy, pom, or unclear. Only ACCEPTED products (not_medicine, gsl) are added to pending_products for agent processing. Products with completed agents are marked for full ERPNext sync.

## Endpoint
- **URL**: `/push-to-pending`
- **Method**: POST
- **Authentication**: Service Role Key (automatically provided by Supabase)
- **Trigger**: Database webhook on INSERT/UPDATE/DELETE to scraped_products table

## Request

### Headers
```
Content-Type: application/json
```

### Webhook Payload
```json
{
  "type": "INSERT" | "UPDATE" | "DELETE",
  "table": "scraped_products",
  "schema": "public",
  "record": {
    "id": "uuid-string",
    "vendor": "vendor-name",
    "url": "https://example.com/product",
    "product_id": "VENDOR-123",
    "name": "Product Name",
    "description": "Product description",
    "breadcrumbs": {},
    "rejected": false,
    "classification": "not_medicine"
  },
  "old_record": null | { /* previous record data for UPDATE/DELETE */ }
}
```

## Response

### Success Response (INSERT - ACCEPTED)
```json
{
  "success": true,
  "message": "Product classified as ACCEPTED - pending product created successfully",
  "scraped_product_id": "uuid-string",
  "pending_product_id": "uuid-string",
  "marked_for_sync": false
}
```

### Success Response (INSERT - REJECTED)
```json
{
  "success": true,
  "message": "Product classified as REJECTED - not added to pending_products",
  "scraped_product_id": "uuid-string",
  "pending_product_id": null,
  "marked_for_sync": false
}
```

### Success Response (UPDATE - Completed Product)
```json
{
  "success": true,
  "message": "Product updated, checked for sync (marked for full ERPNext sync)",
  "scraped_product_id": "uuid-string",
  "pending_product_id": "uuid-string",
  "marked_for_sync": true
}
```

### Success Response (UPDATE - Rejected)
```json
{
  "success": true,
  "message": "Product updated and REJECTED, removed from pending queue (1 entries)",
  "scraped_product_id": "uuid-string",
  "rejected": true,
  "deleted_from_pending": 1
}
```

### Success Response (DELETE)
```json
{
  "success": true,
  "message": "Deleted 1 pending product(s)",
  "scraped_product_id": "uuid-string",
  "deleted_count": 1
}
```

### Error Responses

**400 Bad Request - Invalid Payload:**
```json
{
  "success": false,
  "error": "Invalid webhook payload: missing record or id"
}
```

**405 Method Not Allowed:**
```json
{
  "success": false,
  "error": "Method not allowed"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message details"
}
```

## Environment Variables
- `SUPABASE_URL` - Supabase project URL (required)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for bypassing RLS (required)
- `GEMINI_API_KEY` - Google Gemini API key for product classification (required)

## Database Tables

### Tables Read
- `scraped_products` - Source table for product data
- `pending_products` - Check for existing entries and agent completion status

### Tables Modified
- `scraped_products` - Updates with classification results (rejected, classification, classification_reason, classification_confidence)
- `pending_products` - Inserts new entries, updates sync flags, or deletes entries

## Classification Logic

### UK Medicine Compliance Categories
1. **not_medicine**: Regular consumer products (ACCEPTED)
2. **gsl**: General Sales List medicines - no prescription needed (ACCEPTED)
3. **pharmacy**: Pharmacy-only medicines (REJECTED)
4. **pom**: Prescription-only medicines (REJECTED)
5. **unclear**: Cannot determine classification (REJECTED)

### Classification Process
1. Product name and description sent to Gemini AI
2. AI returns classification, reason, and confidence score
3. Results stored in scraped_products table
4. If ACCEPTED: Creates pending_products entry with statuses set to 'pending'
5. If REJECTED: Does not create pending_products entry

### Pending Product Fields
When ACCEPTED product is added to pending_products:
- `product_id`: From scraped product
- `scraped_product_id`: Links to scraped_products.id
- `url`: Product URL
- `vendor`: Vendor name
- `breadcrumbs`: Category breadcrumbs
- `category_status`: 'pending'
- `weight_and_dimension_status`: 'pending'
- `seo_status`: 'pending'

## Processing Logic by Event Type

### INSERT Event
1. Classify product using Gemini AI
2. Update scraped_products with classification results
3. If REJECTED: Return success without creating pending_products entry
4. If ACCEPTED: Create pending_products entry with pending statuses
5. Check for sync requirements (usually none for new products)

### UPDATE Event
1. Check if product is now rejected:
   - If rejected: Delete from pending_products
   - If not rejected: Ensure pending_products entry exists
2. If pending_products entry missing: Classify and create (if ACCEPTED)
3. Check if both category and dimension agents are complete
4. If complete AND not recently synced (>5 min ago): Mark for full ERPNext sync
   - Sets `erpnext_updated_at = NULL`
   - Sets `sync_full_product = true`

### DELETE Event
1. Delete corresponding entries from pending_products
2. Returns count of deleted entries

## Sync Marking Logic

### Full ERPNext Sync Trigger
Products are marked for full sync when:
1. Both `category_status` and `weight_and_dimension_status` are 'complete'
2. NOT recently synced (erpnext_updated_at > 5 minutes ago OR NULL)

### Infinite Loop Prevention
The function checks `erpnext_updated_at` timestamp to avoid infinite loops with the sync-completed-products-to-erpnext function. Products synced within the last 5 minutes are excluded from sync marking.

### Sync Flags Set
- `erpnext_updated_at`: Set to NULL (triggers cron job)
- `sync_full_product`: Set to true (tells cron to sync ALL fields, not just agent results)

## Shared Modules
Uses `_shared/gemini-classification.ts` module for Gemini AI classification logic.

## Webhook Setup

### Create Database Webhook in Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to Database > Webhooks (left sidebar)
3. Click Create a new hook (green button)
4. Configure the webhook:
   - **Name**: `push-to-pending-webhook`
   - **Table**: Select `scraped_products` from dropdown
   - **Events**: Check INSERT, UPDATE, DELETE
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://your-project.supabase.co/functions/v1/push-to-pending`
   - **HTTP Headers** (click "Add header"):
     - Header 1: `Authorization` → `Bearer YOUR_SUPABASE_ANON_KEY`
     - Header 2: `Content-Type` → `application/json`
5. Click Create webhook (bottom right)
6. Webhook should now appear in the list with status "Active"

### Verify Webhook is Working
- Insert a product via seed-scraped-products endpoint
- Check pending_products table for corresponding entry
- View webhook logs in Database > Webhooks > click on webhook name > Invocations tab

## Example Usage

This function is automatically triggered by database webhooks. It cannot be called directly via HTTP for production use.

### Manual Test (Simulate Webhook)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/push-to-pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "type": "INSERT",
    "table": "scraped_products",
    "record": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "vendor": "test",
      "url": "https://test.com/product-1",
      "product_id": "TEST-001",
      "name": "Test Product",
      "description": "Test description"
    }
  }'
```

### Real Test (Insert into scraped_products)
Use the seed-scraped-products endpoint to insert a product, which will automatically trigger this function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/seed-scraped-products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_CUSTOM_API_KEY" \
  -d '[{
    "vendor": "test",
    "name": "Test Product",
    "url": "https://test.com/product-webhook-test",
    "price": 9.99,
    "description": "Test description",
    "stock_status": "in stock",
    "images": ["test.jpg"],
    "main_image": "test.jpg",
    "product_id": "TEST-WEBHOOK-001",
    "original_price": 12.99,
    "timestamp": "2025-12-18T10:00:00Z"
  }]'
```

## Monitoring

### Check Edge Function Logs
1. Navigate to Edge Functions > push-to-pending
2. Click Logs tab
3. View real-time invocations and errors

### Check Webhook Logs
1. Navigate to Database > Webhooks
2. Click on the webhook name
3. View Invocations tab for delivery status

## Error Handling
- **Duplicate entries**: Gracefully handled via unique constraint detection
- **Missing scraped product**: Foreign key constraint prevents orphan records
- **Invalid payload**: Returns 400 Bad Request with error details
- **Database errors**: Returns 500 with error details
- **Classification API errors**: Returns error and marks product as rejected

## Notes
- This function is designed to be triggered by database events, not direct HTTP calls
- Classification caching reduces API calls to Gemini (same product name/description)
- Duplicate pending_products entries are handled gracefully (unique constraint)
- The function uses CORS headers for potential direct testing
- Products are processed individually for INSERT/UPDATE operations
- DELETE operations can affect multiple pending_products if duplicates exist
- The sync marking logic prevents infinite loops by checking recent sync timestamps
- Classification confidence scores help identify uncertain classifications
- REJECTED products are flagged but not deleted from scraped_products
- Processes one product at a time (not batched)
- Real-time processing ensures immediate availability for agents
