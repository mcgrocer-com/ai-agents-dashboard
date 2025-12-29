# populate-retry-log

One-time Edge Function to populate the classification retry log.

## Purpose

Finds products that failed classification before the retry system was deployed and creates log entries so they can be picked up by the `retry-failed-classifications` cron job.

## Method

`POST`

## Request Body

```json
{
  "vendor": "argos",  // Optional: filter by vendor
  "limit": 100,       // Optional: max products to process (default: 100)
  "offset": 0         // Optional: pagination offset
}
```

## Response

```json
{
  "success": true,
  "message": "Successfully populated retry log with 50 entries",
  "total_found": 75,
  "already_in_pending": 10,
  "already_have_logs": 15,
  "log_entries_created": 50,
  "next_steps": "The retry cron job will pick up these products in the next run (<=15 minutes)"
}
```

## Logic Flow

1. Query `scraped_products` for products with `status='pending'` and `classification=NULL`
2. Filter out products already in `pending_products` table
3. Filter out products that already have entries in `classification_retry_log`
4. Create new log entries with `status='retrying'` and immediate `next_retry_at`

## Database Tables

- **Reads**: `scraped_products`, `pending_products`, `classification_retry_log`
- **Writes**: `classification_retry_log`

## Usage

This is a one-time utility function. Run it once after deploying the retry system to catch up on products that failed before the system existed.

```bash
curl -X POST https://your-project.supabase.co/functions/v1/populate-retry-log \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

## Related Functions

- [retry-failed-classifications](../retry-failed-classifications/README.md) - Processes the retry log
- [push-to-pending](../push-to-pending/README.md) - Creates retry log entries on new failures
