# classify-unclassified-products

## Overview
Proactively classifies scraped products that have no classification yet (`classification IS NULL`). Runs on a cron schedule to pre-classify products before sync, removing the classification bottleneck from the ERPNext sync pipeline. Prioritizes sync-ready products (all agent data complete) to unblock ERPNext pushes first.

## Endpoint
- **URL**: `/classify-unclassified-products`
- **Method**: POST
- **Authentication**: Service Role Key
- **Trigger**: Scheduled via pg_cron (every 10 minutes) or manual POST

## Request

### Headers
```
Content-Type: application/json
```

### Body (optional)
```json
{
  "batchSize": 50,
  "vendor": "argos"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| batchSize | number | 50 | Number of products to process per run |
| vendor | string | all | Filter by vendor name (optional) |

## Response

### Success (200)
```json
{
  "success": true,
  "message": "Processed 50 products: 42 accepted, 5 rejected, 3 failed",
  "total_processed": 50,
  "classified_accepted": 42,
  "classified_rejected": 5,
  "failed": 3,
  "skipped": 0,
  "results": [
    {
      "product_id": "uuid",
      "status": "accepted",
      "classification": "not_medicine",
      "message": "Regular consumer product"
    }
  ]
}
```

### No Products Found (200)
```json
{
  "success": true,
  "message": "No unclassified products found",
  "total_processed": 0
}
```

### Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error message"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for bypassing RLS |
| GEMINI_API_KEY | Yes | Google Gemini API key for classification |

## Classification Logic

### Two-Phase Product Selection
1. **Phase 1 (Priority)**: Sync-ready products — all agent data complete but missing classification. These block ERPNext sync and are classified first.
2. **Phase 2 (Backfill)**: Any remaining unclassified products, oldest first, to fill the batch.

### Exclusions
- Products already in `classification_retry_log` with status `retrying` (handled by retry cron)

### Rate Limiting
- 500ms delay between individual API calls to avoid Gemini quota issues
- Stops batch early if quota exceeded error is detected

### Error Handling
- Failed classifications are logged to `classification_retry_log` with exponential backoff
- Error types classified: `quota_exceeded`, `server_error`, `network_error`, `unknown`
- Backoff formula: `60s * 2^retryCount`

## Database Tables

### Tables Read
- `scraped_products` — Source products with `classification IS NULL`
- `classification_retry_log` — Exclusion list for products being retried
- `pending_products` — Via RPC for sync-ready product detection

### Tables Modified
- `scraped_products` — Updates with classification results
- `classification_retry_log` — Inserts failed classification entries

## Shared Modules
- `_shared/gemini-classification.ts` — Gemini AI classification logic

## Related Functions
- **classify-product** — Stateless classification API (single request)
- **retry-failed-classifications** — Retries products in the retry log
- **push-to-pending** — Webhook that classifies on INSERT (realtime)
- **populate-retry-log** — Bulk populates retry log for unclassified products
