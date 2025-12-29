# Classification Retry System - Quick Start Guide

## TL;DR

This system automatically retries failed product classifications every 15 minutes. Failed products (classification = NULL) are retried up to 3 times with exponential backoff before giving up.

## 🚀 Quick Deploy (5 Minutes)

### 1. Deploy Edge Function
```bash
cd supabase
npm run deploy:retry
```

### 2. Store Secrets in Vault
Open Supabase SQL Editor and run:
```sql
SELECT vault.create_secret('https://fxkjblrlogjumybceozk.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY_HERE', 'service_role_key');
```

### 3. Apply Migrations
```bash
cd supabase
npm run migrate:retry
```

### 4. Verify Cron Job
```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'retry-failed-classifications';
```

✅ **Done!** System will now retry failed products every 15 minutes.

## 📊 Quick Monitoring

### Check Failed Products
```sql
-- How many products need retry?
SELECT COUNT(*)
FROM scraped_products sp
LEFT JOIN pending_products pp ON pp.scraped_product_id = sp.id
WHERE sp.status = 'pending'
  AND sp.classification IS NULL
  AND pp.id IS NULL;
```

### Check Retry Status
```sql
-- View retry statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries
FROM classification_retry_log
GROUP BY status;
```

### Check Recent Runs
```sql
-- Last 5 cron job runs
SELECT
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'retry-failed-classifications')
ORDER BY start_time DESC
LIMIT 5;
```

## 🔧 Quick Actions

### Manual Retry (Right Now)
```sql
-- Retry 20 products immediately
SELECT public.trigger_classification_retry(20, false, NULL);
```

### Force Retry (Ignore Max Attempts)
```sql
-- Force retry products that hit max retries
SELECT public.trigger_classification_retry(10, true, NULL);
```

### Retry Specific Vendor
```sql
-- Retry only Chanel products
SELECT public.trigger_classification_retry(20, false, 'chanel');
```

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

## ❓ Troubleshooting

### "No products retrying"
1. Check if cron job is active: `SELECT active FROM cron.job WHERE jobname = 'retry-failed-classifications';`
2. Check if there are failed products (see "Check Failed Products" above)
3. Check edge function logs in Supabase Dashboard

### "Products stuck at max retries"
Force retry: `SELECT public.trigger_classification_retry(10, true, NULL);`

### "High failure rate"
1. Check Gemini API quota in Google AI Studio
2. Reduce batch size: `SELECT public.trigger_classification_retry(5, false, NULL);`
3. Check error types: `SELECT last_error_type, COUNT(*) FROM classification_retry_log GROUP BY last_error_type;`

## 📈 Key Metrics

- **Batch Size**: 20 products per run
- **Cron Interval**: Every 15 minutes
- **Max Retries**: 3 attempts per product
- **Rate Limit**: 2 requests/second (500ms delay)
- **Backoff**: 1 min → 2 min → 4 min
- **Daily Capacity**: ~1,920 products (if all fail)

## 📚 Full Documentation

For detailed information, see [RETRY-CLASSIFICATION-SYSTEM.md](RETRY-CLASSIFICATION-SYSTEM.md)

## 🎯 Success Criteria

A product is successfully processed when:
1. ✅ Classification completed (ACCEPTED or REJECTED)
2. ✅ `scraped_products` updated with classification
3. ✅ If ACCEPTED: Entry created in `pending_products`
4. ✅ Ready for AI agent processing

## 🔍 Quick Health Check

```sql
-- Complete health check
SELECT
  'Total Failed Products' as metric,
  COUNT(*) as value
FROM scraped_products sp
LEFT JOIN pending_products pp ON pp.scraped_product_id = sp.id
WHERE sp.status = 'pending' AND sp.classification IS NULL AND pp.id IS NULL

UNION ALL

SELECT
  'Retry Pending',
  COUNT(*)
FROM classification_retry_log
WHERE status IN ('pending', 'retrying')

UNION ALL

SELECT
  'Retry Completed',
  COUNT(*)
FROM classification_retry_log
WHERE status = 'completed'

UNION ALL

SELECT
  'Max Retries Reached',
  COUNT(*)
FROM classification_retry_log
WHERE status = 'max_retries_reached'

UNION ALL

SELECT
  'Cron Job Active',
  CASE WHEN active THEN 1 ELSE 0 END
FROM cron.job
WHERE jobname = 'retry-failed-classifications';
```
