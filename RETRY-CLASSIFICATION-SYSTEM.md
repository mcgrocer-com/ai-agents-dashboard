# Classification Retry System

## Overview

The Classification Retry System automatically retries product classifications that failed during the initial import process. This system addresses the issue where 54 out of 77 Chanel products (70% failure rate) were unable to be processed due to Gemini AI API rate limiting and quota issues.

## Problem Statement

When products are imported into `scraped_products`, they must pass through UK medicine classification (using Gemini AI) before being added to `pending_products` for AI agent processing. During the Chanel import, many products failed classification due to:

- **HTTP 500 errors** from Gemini API (rate limiting)
- **Quota exceeded errors** (429 status codes)
- **Network timeouts** and temporary service issues

These failed products have:
- `classification = NULL` in `scraped_products`
- `status = 'pending'` in `scraped_products`
- **No entry** in `pending_products` table
- Cannot be processed by AI agents (category, weight/dimension, SEO, copyright)

## Solution Architecture

The retry system consists of 3 components:

### 1. Database Migration: Retry Tracking Table

**File:** `supabase/migrations/20251223000000_create_classification_retry_tracking.sql`

Creates `classification_retry_log` table to track:
- Retry attempts per product (max 3)
- Exponential backoff timing
- Error history and error types
- Retry status (pending, retrying, completed, failed, max_retries_reached)

**Key Features:**
- Prevents infinite retry loops (max 3 attempts)
- Tracks `next_retry_at` timestamp for exponential backoff
- Stores error details for debugging
- Indexes optimized for cron job queries

### 2. Edge Function: retry-failed-classifications

**File:** `supabase/functions/retry-failed-classifications/index.ts`

Edge Function that:
1. **Identifies failed products**:
   - `classification = NULL` in `scraped_products`
   - `status = 'pending'` in `scraped_products`
   - NOT in `pending_products` table
   - Respects retry count and backoff timing

2. **Rate limiting**:
   - Processes 20 products per batch (configurable)
   - 500ms delay between products (2 requests/second)
   - Prevents overwhelming Gemini API

3. **Exponential backoff**:
   - Retry 1: 1 minute delay
   - Retry 2: 2 minutes delay
   - Retry 3: 4 minutes delay

4. **Classification via classify-product**:
   - Calls existing `classify-product` edge function
   - Inherits model fallback logic (gemini-flash-lite → gemini-flash → gemini-2.0-flash-exp → gemini-2.5-pro)
   - Returns classification result (ACCEPTED/REJECTED)

5. **Updates database**:
   - On success: Updates `scraped_products` with classification
   - Triggers `push-to-pending` webhook (creates `pending_products` entry)
   - On failure: Updates `classification_retry_log` with error details

### 3. Database Migration: pg_cron Job

**File:** `supabase/migrations/20251223000001_setup_classification_retry_cron.sql`

Sets up automated retry:
- **Cron schedule**: Every 15 minutes (`*/15 * * * *`)
- **Batch size**: 20 products per run
- **Timeout**: 5 minutes (300,000ms)
- Uses `pg_cron` and `pg_net` extensions

**Additional features:**
- Manual trigger function: `trigger_classification_retry(batch_size, force_retry, vendor)`
- Stores secrets in Supabase Vault (project_url, service_role_key)
- Convenience SQL queries for monitoring

## Deployment Guide

### Prerequisites

1. Supabase CLI installed
2. Environment variables set in `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (must be available in edge function environment)

### Step 1: Deploy Edge Function

```bash
cd supabase
npm run deploy:retry
```

This deploys the `retry-failed-classifications` edge function to your Supabase project.

### Step 2: Apply Database Migrations

```bash
cd supabase
npm run migrate:retry
```

This runs both migrations:
1. Creates `classification_retry_log` table
2. Sets up `pg_cron` job

**IMPORTANT:** Before applying the second migration, you must store secrets in Supabase Vault.

### Step 3: Store Secrets in Vault

Open Supabase SQL Editor and run:

```sql
-- Store project URL
SELECT vault.create_secret('https://fxkjblrlogjumybceozk.supabase.co', 'project_url');

-- Store service role key (replace with your actual key)
SELECT vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
```

### Step 4: Verify Cron Job

Check that the cron job was created:

```sql
SELECT
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'retry-failed-classifications';
```

## Usage

### Automatic Retry (Cron Job)

The cron job runs automatically every 15 minutes. No manual intervention required.

**Monitor cron job runs:**

```sql
-- View recent cron job executions
SELECT
  jobid,
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications')
ORDER BY start_time DESC
LIMIT 10;
```

**Check HTTP response from edge function:**

```sql
SELECT
  id,
  status_code,
  content,
  created
FROM net._http_response
WHERE id IN (
  SELECT request_id::bigint
  FROM cron.job_run_details
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications')
)
ORDER BY created DESC
LIMIT 5;
```

### Manual Trigger via SQL Function

Trigger retry manually with custom parameters:

```sql
-- Retry 10 products, no force, all vendors
SELECT public.trigger_classification_retry(10, false, NULL);

-- Retry 20 Chanel products only
SELECT public.trigger_classification_retry(20, false, 'chanel');

-- Force retry even if max retries reached
SELECT public.trigger_classification_retry(5, true, NULL);
```

### Manual Trigger via HTTP POST

Call the edge function directly:

```bash
curl -X POST "https://fxkjblrlogjumybceozk.supabase.co/functions/v1/retry-failed-classifications" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 20,
    "forceRetry": false,
    "vendor": "chanel"
  }'
```

## Monitoring & Debugging

### Check Failed Products

```sql
-- Products with NULL classification not in pending_products
SELECT
  sp.id,
  sp.name,
  sp.vendor,
  sp.classification,
  sp.rejected,
  pp.id AS pending_id
FROM scraped_products sp
LEFT JOIN pending_products pp ON pp.scraped_product_id = sp.id
WHERE
  sp.status = 'pending'
  AND sp.classification IS NULL
  AND pp.id IS NULL
LIMIT 20;
```

### Check Retry Log

```sql
-- View retry history
SELECT
  scraped_product_id,
  product_name,
  product_vendor,
  retry_count,
  max_retries,
  status,
  last_error_type,
  last_error,
  next_retry_at,
  created_at,
  updated_at
FROM classification_retry_log
ORDER BY updated_at DESC
LIMIT 20;
```

### Check Products at Max Retries

```sql
-- Products that have exhausted all retry attempts
SELECT
  crl.scraped_product_id,
  crl.product_name,
  crl.product_vendor,
  crl.retry_count,
  crl.last_error,
  crl.last_error_type,
  sp.name,
  sp.description
FROM classification_retry_log crl
JOIN scraped_products sp ON sp.id = crl.scraped_product_id
WHERE crl.status = 'max_retries_reached'
ORDER BY crl.updated_at DESC;
```

### Check Pending Retries

```sql
-- Products scheduled for retry
SELECT
  scraped_product_id,
  product_name,
  product_vendor,
  retry_count,
  next_retry_at,
  last_error_type
FROM classification_retry_log
WHERE
  status IN ('pending', 'retrying')
  AND next_retry_at <= NOW()
ORDER BY next_retry_at ASC
LIMIT 20;
```

## Retry Strategy

### Exponential Backoff Schedule

| Retry Attempt | Delay         | Next Retry At       |
|---------------|---------------|---------------------|
| 1             | 1 minute      | Now + 1 min         |
| 2             | 2 minutes     | Now + 2 min         |
| 3             | 4 minutes     | Now + 4 min         |
| Max reached   | No more retry | NULL                |

### Error Type Classification

Errors are classified into 5 types for debugging:

1. **quota_exceeded**: HTTP 429, quota errors, rate limit errors
2. **server_error**: HTTP 500-504 errors
3. **network_error**: ECONNREFUSED, ETIMEDOUT, fetch failed
4. **validation_error**: Parse errors, invalid responses
5. **unknown**: All other errors

### Success Criteria

A product is considered successfully classified when:
1. Edge function returns success (no error)
2. `scraped_products` updated with classification result
3. If ACCEPTED: `push-to-pending` webhook triggers and creates `pending_products` entry
4. If REJECTED: Product flagged in `scraped_products`, excluded from `pending_products`

## Maintenance

### Disable Cron Job

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications'),
  active := false
);
```

### Re-enable Cron Job

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications'),
  active := true
);
```

### Delete Cron Job

```sql
SELECT cron.unschedule('retry-failed-classifications');
```

### Change Cron Schedule

```sql
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications'),
  schedule := '*/30 * * * *' -- Every 30 minutes
);
```

### Clear Retry Log

```sql
-- Clear all retry log entries (use with caution)
TRUNCATE TABLE classification_retry_log;

-- Delete only completed entries older than 7 days
DELETE FROM classification_retry_log
WHERE
  status = 'completed'
  AND updated_at < NOW() - INTERVAL '7 days';
```

## Troubleshooting

### Products Not Retrying

**Check 1: Verify cron job is active**
```sql
SELECT active FROM cron.job WHERE jobname = 'retry-failed-classifications';
```

**Check 2: Verify secrets in Vault**
```sql
SELECT name FROM vault.decrypted_secrets WHERE name IN ('project_url', 'service_role_key');
```

**Check 3: Check edge function logs**
- Go to Supabase Dashboard > Edge Functions > retry-failed-classifications > Logs

### High Failure Rate

**Check 1: Gemini API quota**
- Verify `GEMINI_API_KEY` is valid
- Check Gemini API quota limits in Google AI Studio
- Consider upgrading to Tier 2 quota (1500 RPM)

**Check 2: Reduce batch size**
```sql
-- Manually trigger with smaller batch
SELECT public.trigger_classification_retry(5, false, NULL);
```

**Check 3: Review error types**
```sql
SELECT last_error_type, COUNT(*) as count
FROM classification_retry_log
GROUP BY last_error_type
ORDER BY count DESC;
```

### Products Stuck at Max Retries

For products that failed all 3 retries, you can:

1. **Force retry** (ignores max retry limit):
```sql
SELECT public.trigger_classification_retry(10, true, NULL);
```

2. **Reset retry count** manually:
```sql
UPDATE classification_retry_log
SET
  retry_count = 0,
  status = 'pending',
  next_retry_at = NOW()
WHERE status = 'max_retries_reached';
```

3. **Manual classification** (if AI keeps failing):
```sql
-- Manually mark as not_medicine if you're confident
UPDATE scraped_products
SET
  classification = 'not_medicine',
  rejected = false,
  classification_reason = 'Manually reviewed and approved',
  classification_confidence = 1.0
WHERE id = 'YOUR_PRODUCT_ID';

-- This will trigger push-to-pending webhook
```

## Performance Metrics

### Expected Processing Rate

- **Batch size**: 20 products
- **Rate limit**: 2 requests/second (500ms delay)
- **Time per batch**: ~10 seconds
- **Products per hour**: ~720 (if running continuously)
- **Cron interval**: Every 15 minutes
- **Products per day**: ~1,920 (20 products × 4 runs/hour × 24 hours)

### Resource Usage

- **Database**: Minimal (1 table, 3 indexes)
- **Edge Function**: ~10 seconds execution per batch
- **API Calls**: 20 Gemini API requests per batch
- **Network**: ~2 KB per product (metadata)

## Future Improvements

1. **Dynamic rate limiting**: Adjust rate based on API response headers
2. **Batch classification API**: Process multiple products in single Gemini API call
3. **Priority queue**: Retry high-priority vendors first
4. **Email alerts**: Notify when products reach max retries
5. **Dashboard widget**: Show retry statistics in UI
6. **Webhook integration**: Notify external systems of classification events

## Related Documentation

- [Gemini Classification Service](supabase/functions/_shared/gemini-classification.ts)
- [Push to Pending Webhook](supabase/functions/push-to-pending/index.ts)
- [Classify Product Edge Function](supabase/functions/classify-product/index.ts)
- [Chanel Import Guide](CHANEL-IMPORT-GUIDE.md)
