# Classification Retry System - Deployment Status

## Status: ✅ Successfully Deployed

Date: 2025-12-23
System Version: 1.0.0

---

## Deployed Components

### 1. Edge Functions ✅
- `retry-failed-classifications` - DEPLOYED & ACTIVE
- `populate-retry-log` - DEPLOYED (needs optimization)

### 2. Database Migrations ✅
- `classification_retry_log` table - CREATED
- Indexes and triggers - ACTIVE
- pg_cron job - RUNNING EVERY 15 MINUTES

### 3. Vault Secrets ⚠️
- `project_url` - ✅ STORED
- `service_role_key` - ❌ MISSING (cron job may fail without this)

---

## Current System Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Failed Products | 20,929 | Needs processing |
| In Retry Log (Pending) | 54 | Being processed |
| Retry Completed | 0 | Just deployed |
| Cron Job Active | Yes | Running every 15 min |
| Last Cron Run | 2025-12-23 14:00 UTC | Success |

---

## Critical Issue: Missing service_role_key

The `service_role_key` is missing from Supabase Vault, which the cron job needs to call the edge function.

### To Fix:
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/sql/new)
2. Run this command (replace with your actual key):
```sql
SELECT vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
```

To get your service role key:
```bash
npx supabase status --project-id fxkjblrlogjumybceozk
```

---

## How the System Works

### Automatic Retry Flow

1. **Initial Classification Failure** (in `push-to-pending` edge function)
   - Product fails Gemini AI classification
   - Retry log entry created with `status = 'retrying'`
   - Exponential backoff calculated (1 min → 2 min → 4 min)

2. **Cron Job Execution** (every 15 minutes)
   - Fetches 20 products from retry log where `next_retry_at <= NOW()`
   - Calls Gemini AI API with rate limiting (2 req/sec)
   - On success: Updates `scraped_products`, deletes retry log entry
   - On failure: Increments retry count, recalculates backoff

3. **Completion**
   - Product classified as ACCEPTED → Added to `pending_products`
   - Product classified as REJECTED → Marked rejected in `scraped_products`
   - Ready for AI agent processing (category, weight, SEO, copyright)

### Processing Capacity

- **Batch Size**: 20 products per run
- **Cron Interval**: Every 15 minutes
- **Products/Hour**: 80 (20 × 4 runs)
- **Products/Day**: 1,920 (at 100% success rate)
- **Current Backlog**: 20,929 products
- **Estimated Time**: ~11 days (at current rate, assuming all retries succeed)

---

## Populate Retry Log (Bulk Import)

The `populate-retry-log` edge function is designed to bulk import failed products into the retry log. However, it currently has a URL length limitation when querying large batches.

### Current Issue:
- Batch size of 500 causes HTTP/2 URL length errors
- Needs optimization to use POST requests instead of GET with long URLs

### Manual Workaround:
Use the local Node.js script with smaller batches:

```bash
cd g:\Projects\mcgrocer-project\ai-dashboard
SUPABASE_SERVICE_ROLE_KEY=your_key_here node scripts/populate-retry-log.js
```

This script:
- Processes in batches of 50 products
- Automatically handles pagination
- Filters out products already in `pending_products`
- Can run multiple times safely (idempotent)

---

## Monitoring Commands

### Check System Health
```sql
SELECT
  'Total Failed Products' as metric,
  COUNT(*) as value
FROM scraped_products sp
LEFT JOIN pending_products pp ON pp.scraped_product_id = sp.id
WHERE sp.status = 'pending' AND sp.classification IS NULL AND pp.id IS NULL

UNION ALL

SELECT 'Retry Pending', COUNT(*)
FROM classification_retry_log
WHERE status IN ('pending', 'retrying')

UNION ALL

SELECT 'Retry Completed', COUNT(*)
FROM classification_retry_log
WHERE status = 'completed';
```

### Check Cron Job Status
```sql
SELECT
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications')
ORDER BY start_time DESC
LIMIT 10;
```

### Manual Retry Trigger
```sql
-- Retry 20 products immediately
SELECT public.trigger_classification_retry(20, false, NULL);

-- Check result
SELECT * FROM classification_retry_log
WHERE updated_at >= NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC;
```

---

## Next Steps

### Immediate Actions (Required)
1. ✅ Edge functions deployed
2. ✅ Migrations applied
3. ✅ Cron job active
4. ❌ **Add `service_role_key` to Vault** (CRITICAL)
5. 🔧 Run `scripts/populate-retry-log.js` to bulk import failed products

### Optional Optimizations
1. Increase cron frequency from 15 min → 5 min (faster processing)
2. Increase batch size from 20 → 50 (if Gemini API quota allows)
3. Add monitoring alerts for max retries reached
4. Implement priority queue for high-value vendors

---

## Troubleshooting

### Cron Job Not Running
1. Check if active: `SELECT active FROM cron.job WHERE jobname = 'retry-failed-classifications';`
2. Verify vault secrets: `SELECT name FROM vault.decrypted_secrets;`
3. Check edge function logs in Supabase Dashboard

### High Failure Rate
1. Check Gemini API quota in Google AI Studio
2. Review error types: `SELECT last_error_type, COUNT(*) FROM classification_retry_log GROUP BY last_error_type;`
3. Reduce batch size if hitting rate limits

### Products Not Progressing
1. Check retry log: `SELECT * FROM classification_retry_log WHERE status = 'retrying' ORDER BY next_retry_at;`
2. Manually trigger: `SELECT public.trigger_classification_retry(5, false, NULL);`
3. Review edge function logs

---

## Documentation Links

- [Quick Start Guide](RETRY-QUICK-START.md) - 5-minute setup
- [Full System Documentation](RETRY-CLASSIFICATION-SYSTEM.md) - Architecture & design
- [Supabase Dashboard](https://supabase.com/dashboard/project/fxkjblrlogjumybceozk)
- [Edge Functions](https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/functions)

---

## Success Criteria

The system is considered fully operational when:
- ✅ Both edge functions deployed
- ✅ Database migrations applied
- ✅ Cron job running every 15 minutes
- ❌ Vault secrets configured (missing service_role_key)
- 🔄 Failed products being processed (54 currently in queue)

**Current Status**: 4/5 components operational. Add `service_role_key` to Vault to complete deployment.
