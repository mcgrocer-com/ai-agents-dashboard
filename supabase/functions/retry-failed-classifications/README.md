# retry-failed-classifications

Retry Queue Processor for failed product classifications.

## Purpose

Processes products that failed initial classification by reading from `classification_retry_log` table, retrying classification with Gemini AI, and managing retry state with exponential backoff.

## Method

`POST`

## Trigger

- **Scheduled**: pg_cron runs every 15 minutes
- **Manual**: POST request for immediate processing

## Request Body

```json
{
  "batchSize": 20,     // Optional: products to process (default: 20)
  "vendor": "argos"    // Optional: filter by vendor
}
```

## Response

```json
{
  "success": true,
  "message": "Processed 20 products: 15 successful, 3 failed, 2 skipped",
  "total_processed": 20,
  "successful": 15,
  "failed": 3,
  "skipped": 2,
  "results": [
    { "product_id": "uuid", "status": "success", "message": "Classified as ACCEPTED" },
    { "product_id": "uuid", "status": "failed", "message": "Retry 3 failed, will retry at..." }
  ]
}
```

## Features

- **Rate Limiting**: 500ms between requests (2 req/sec max)
- **Exponential Backoff**: 1min, 2min, 4min, 8min... between retries
- **Infinite Retries**: No max retry limit - retries until success
- **Duplicate Prevention**: Checks `pending_products` before creating entries
- **Clean-up**: Deletes log entries on successful classification

## Logic Flow

1. Query `classification_retry_log` for products where `next_retry_at <= now`
2. For each product:
   - Call Gemini AI for classification
   - On success: Update `scraped_products`, delete log entry
   - On failure: Increment retry count, set next retry time
3. Rate limit between requests

## Error Types

| Type | Trigger | Retryable |
|------|---------|-----------|
| `quota_exceeded` | 429, rate limit | Yes |
| `server_error` | 500-504 | Yes |
| `network_error` | Connection failures | Yes |
| `validation_error` | Parse/validation issues | Yes |
| `unknown` | Other errors | Yes |

## Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `GEMINI_API_KEY` - Google Gemini AI key

## Database Tables

- **Reads**: `classification_retry_log`, `scraped_products`, `pending_products`
- **Writes**: `classification_retry_log`, `scraped_products`

## Related Functions

- [classify-product](../classify-product/README.md) - Stateless classification API
- [push-to-pending](../push-to-pending/README.md) - Creates retry log entries on failures
- [populate-retry-log](../populate-retry-log/README.md) - Backfills retry log
