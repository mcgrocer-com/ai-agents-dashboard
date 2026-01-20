# sync-completed-products-to-erpnext

## Overview

Scheduled cron job (runs every 15 minutes) that automatically syncs completed products from the AI dashboard to ERPNext. This function validates agent processing, classifies products using Gemini AI, filters rejected products, and implements a dual-write pattern to both Production and optional Staging ERPNext instances.

This replaces the background threading approach from the original Python implementation (`mcgrocer/main.py`).

## Endpoint

- **URL**: `/sync-completed-products-to-erpnext`
- **Method**: `POST` (also accepts `GET` for cron triggers)
- **Authentication**: None (public endpoint for cron scheduler)

## Request

### Headers
- `Content-Type`: `application/json` (optional)

### Body (Optional)
Configuration parameters can be provided in the POST request body. If not provided, the function will use admin user preferences from the database or default values.

```json
{
  "batchSize": 50,        // Max products to query per run (default: 50)
  "apiBatchSize": 5,      // Products per ERPNext API batch (default: 5)
  "vendor": "vendorName"  // Optional: sync specific vendor only
}
```

## Response

### Success Response
**Status Code**: `200 OK`

```json
{
  "success": true,
  "result": {
    "total_queried": 45,
    "marked_syncing": 40,
    "batches_processed": 8,
    "created_or_updated": 38,
    "failed": 2,
    "verified": 38,
    "skipped_data_source": 5,
    "validation_resets": {
      "category": 2,
      "weight_dimension": 1,
      "seo": 0,
      "copyright": 1
    },
    "errors": []
  }
}
```

### Sync Disabled Response
When ERPNext sync is disabled via admin preferences:

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "ERPNext sync is disabled",
  "result": {
    "total_queried": 0,
    "marked_syncing": 0,
    "batches_processed": 0,
    "created_or_updated": 0,
    "failed": 0,
    "verified": 0,
    "skipped_data_source": 0,
    "validation_resets": { "category": 0, "weight_dimension": 0, "seo": 0, "copyright": 0 },
    "errors": [],
    "sync_disabled": true
  }
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
- `GEMINI_API_KEY`: Google Gemini API key for product classification

### Optional
- `ERPNEXT_AUTH_TOKEN_STAGING`: API token for Staging ERPNext (enables dual-write)
- `ERPNEXT_BASE_URL_STAGING`: Staging ERPNext URL (default: `https://staging-erpnext.mcgrocer.com`)
- `ERPNEXT_API_ENDPOINT`: ERPNext API endpoint path (default: `/api/method/mcgrocer_customization.mcgrocer_customization.apis.item.create_items_from_json`)

## Database Tables

### Primary Tables
- **pending_products**: Contains products with agent processing status and ERPNext sync tracking
  - Columns: `id`, `url`, `vendor`, `item_code`, `category_status`, `weight_and_dimension_status`, `seo_status`, `copyright_status`, `erpnext_updated_at`, `updated_at`, `sync_full_product`, `failed_sync_at`, `failed_sync_error_message`
  - Agent data: `category`, `breadcrumbs`, `weight`, `height`, `width`, `length`, `volumetric_weight`, `ai_title`, `ai_description`, `meta_title`, `meta_description`, `non_copyright_images`, `non_copyright_desc`

- **scraped_products**: Source product data scraped from vendors
  - Columns: `id`, `name`, `price`, `original_price`, `description`, `images`, `main_image`, `stock_status`, `variants`, `url`, `product_id`, `classification`, `rejected`

- **users**: Admin user preferences for sync configuration
  - Preferences: `sync_to_erpnext`, `sync_vendors`, `prioritize_copyright`, `sync_data_source`

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Validate Agent Statuses                                  │
│    - Reset invalid: category, weight/dimension, SEO,        │
│      copyright                                               │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Check Admin Preferences                                   │
│    - sync_to_erpnext (master toggle)                        │
│    - sync_vendors (vendor filter)                           │
│    - prioritize_copyright (require completed copyright)     │
│    - sync_data_source (All vs Scrapper filter)             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Query Products Needing Sync                              │
│    - All required agents complete (category AND weight-     │
│      dimension AND SEO)                                      │
│    - Valid scraped_product_id reference                     │
│    - Valid price (not NULL or 0)                            │
│    - Apply vendor filter if configured                      │
│    - Apply copyright filter if configured                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Process Classification Validation                         │
│    - Classify unclassified products via Gemini AI          │
│    - Filter: Accept (not_medicine, gsl)                    │
│    - Filter: Reject (pharmacy, pom, unclear)               │
│    - Sync agent data for rejected products                  │
│    - Remove rejected products from pending_products         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Mark Products as Syncing                                 │
│    - Set erpnext_updated_at = current timestamp            │
│    - Prevent duplicate processing                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Batch Process Products                                    │
│    - Check existing items in ERPNext (batch API call)       │
│    - Apply data_source filter for updates                   │
│    - Transform to ERPNext payload format                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Push to Production ERPNext (REQUIRED)                    │
│    - Failures block the process                             │
│    - API returns created/updated items + errors             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Push to Staging ERPNext (OPTIONAL)                       │
│    - Only if ERPNEXT_AUTH_TOKEN_STAGING is set             │
│    - Non-blocking: errors logged only                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Verify Items in ERPNext                                  │
│    - Query ERPNext API for each item_code                   │
│    - Get modified timestamp from ERPNext                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Update Verified Products in Database                    │
│     - Set erpnext_updated_at = ERPNext modified timestamp  │
│     - Update item_code                                      │
│     - Clear sync_full_product flag                         │
│     - Clear failed_sync_error_message and failed_sync_at   │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Sync Agent Data to scraped_products                     │
│     - Copy: category, breadcrumbs, ai_title, ai_description│
│     - Copy: weight, height, width, length, volumetric_weight│
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. Handle Failed Products                                   │
│     - Store error messages (failed_sync_error_message)      │
│     - Set failed_sync_at timestamp                          │
│     - Clear erpnext_updated_at (enable retry)              │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Agent Status Validation
Before syncing, the function validates that all agent-processed data is valid:
- **Category Agent**: `category` must not be NULL or empty
- **Weight-Dimension Agent**: `weight` must be > 0 AND at least one dimension (height/width/length) must be > 0
- **SEO Agent**: Both `ai_title` and `ai_description` must not be NULL or empty
- **Copyright Agent**: `non_copyright_images` must not be empty AND `non_copyright_desc` must not be NULL or empty

Invalid products have their agent status reset from `complete` to `pending`.

### 2. Product Classification
Uses Google Gemini AI to classify products into categories:
- **Accepted**: `not_medicine`, `gsl` (General Sales List)
- **Rejected**: `pharmacy` (Pharmacy medicine), `pom` (Prescription Only Medicine), `unclear`

Rejected products are:
1. Have their agent data synced to `scraped_products`
2. Removed from `pending_products` table
3. Excluded from ERPNext sync

### 3. Dual-Write Pattern
- **Production ERPNext**: Required, failures block the process
- **Staging ERPNext**: Optional (requires `ERPNEXT_AUTH_TOKEN_STAGING`), non-blocking

### 4. Admin Preferences Support
When no vendor is specified in the request, the function queries admin user preferences:

```typescript
// Admin preferences in users.preferences JSONB column
{
  "sync_to_erpnext": true,           // Master toggle (default: true)
  "sync_vendors": ["vendor1", "..."], // Filter by vendors (empty = all)
  "prioritize_copyright": true,       // Only sync copyright-complete products
  "sync_data_source": "Scrapper"     // "All" or "Scrapper" (filter ERPNext updates)
}
```

### 5. Data Source Filtering
When updating existing items in ERPNext, the function can filter by `data_source`:
- `All`: Update all items regardless of data_source
- `Scrapper`: Only update items where ERPNext `data_source` matches the filter

This prevents overwriting manually-entered or imported data.

### 6. Retry Mechanism
Failed products have `erpnext_updated_at` cleared, making them eligible for retry in the next sync cycle.

### 7. Gemini AI Classification with Model Fallback
Classification uses retry logic with model fallback:
1. Primary model: `gemini-1.5-flash-8b`
2. Fallback 1: `gemini-1.5-flash`
3. Fallback 2: `gemini-1.5-pro`
4. Fallback 3: `gemini-1.0-pro`

Each attempt uses exponential backoff (1s, 2s, 4s base delay + random jitter).

## Example Usage

### Cron Job (Default Configuration)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-completed-products-to-erpnext
```

### Manual Trigger with Custom Batch Size
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-completed-products-to-erpnext \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 50,
    "apiBatchSize": 10
  }'
```

### Sync Specific Vendor
```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-completed-products-to-erpnext \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "FreshFarm"
  }'
```

## Logging

The function provides detailed console logging for debugging:

- `[VALIDATION]` - Agent status validation results
- `[SYNC]` - Sync process status and progress
- `[CLASSIFICATION]` - Product classification via Gemini AI
- `[CLASSIFICATION Retry]` - Retry attempts with model fallback
- `[PROD]` - Production ERPNext API interactions
- `[STAGING]` - Staging ERPNext API interactions (optional)
- `[CHECK]` - Existing item checks in ERPNext
- `[VERIFY]` - Item verification after sync
- `[UPDATE]` - Database updates for verified products
- `[SYNC_SCRAPED]` - Agent data sync to scraped_products
- `[CLEAR_ERRORS]` - Error message cleanup
- `[STORE_ERRORS]` - Error message storage

## Performance Notes

- **Batch Size**: Default 50 products queried per run
- **API Batch Size**: Default 5 products per ERPNext API call
- **Classification**: Parallel batch processing for optimal speed
- **Verification**: Parallel verification of all created/updated items
- **Retry Logic**: Automatic retry with exponential backoff for transient errors

## Error Handling

Errors are logged at multiple levels:

1. **Product-level errors**: Stored in `pending_products.failed_sync_error_message` with timestamp in `failed_sync_at`
2. **Batch-level errors**: All products in batch marked as failed and `erpnext_updated_at` cleared for retry
3. **Function-level errors**: Returned in response with 500 status code

Failed products are automatically retried in the next sync cycle (every 15 minutes).
