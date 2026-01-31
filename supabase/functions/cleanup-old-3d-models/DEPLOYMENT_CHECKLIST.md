# Deployment Checklist for cleanup-old-3d-models

Use this checklist to ensure safe deployment without making mistakes.

## Pre-Deployment Checklist

### 1. Code Review
- [ ] Review `index.ts` for correctness
- [ ] Verify Storage API is used (NOT SQL for deletion)
- [ ] Check batch size is set to 100 (Supabase limit)
- [ ] Confirm time window is 7-14 days
- [ ] Validate error handling is in place

### 2. Environment Setup
- [ ] Deno is installed (`deno --version`)
- [ ] `.env` file exists in `functions/` directory
- [ ] `SUPABASE_URL` is set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (not anon key!)
- [ ] Can connect to Supabase project

### 3. Run Tests
```bash
cd supabase/functions/cleanup-old-3d-models
./test.sh
```

- [ ] TEST 1: URL path extraction - ✅ PASS
- [ ] TEST 2: Database query - ✅ PASS
- [ ] TEST 3: URL validation - ✅ PASS
- [ ] TEST 4: Storage bucket - ✅ PASS
- [ ] TEST 5: Storage API access - ✅ PASS
- [ ] TEST 6: Time window logic - ✅ PASS
- [ ] TEST 7: Batch processing - ✅ PASS
- [ ] TEST 8: Database access - ✅ PASS
- [ ] All tests passed: ✅ (8/8)

### 4. Verify Query Results
If tests show products will be affected:
- [ ] Number of products is reasonable (not 0, not 30,000)
- [ ] Sample URLs look correct (contain '3d-models')
- [ ] Updated dates are in expected range (7-14 days ago)

## Deployment Steps

### 5. Deploy Function
```bash
npx supabase functions deploy cleanup-old-3d-models
```

- [ ] Deployment succeeded
- [ ] Function appears in dashboard
- [ ] No errors in deployment logs

### 6. Manual Test (CRITICAL)
Test with limited scope first:

```bash
# Trigger manually to test
curl -X POST https://fxkjblrlogjumybceozk.supabase.co/functions/v1/cleanup-old-3d-models \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

- [ ] Function executes successfully
- [ ] Returns valid JSON response
- [ ] Stats show reasonable numbers
- [ ] Check storage: files actually deleted
- [ ] Check database: glb_url set to NULL

### 7. Verify Cleanup Results
```sql
-- Check storage objects were deleted
SELECT COUNT(*) FROM storage.objects
WHERE bucket_id = 'product-files'
AND name LIKE '3d-models/%';

-- Check database was updated
SELECT COUNT(*) FROM pending_products
WHERE glb_url IS NULL;
```

- [ ] Storage files reduced
- [ ] Database records updated
- [ ] No orphaned files (verify with support if unsure)

### 8. Enable Cron Schedule
Only after manual test succeeds!

```bash
# Enable cron via CLI
npx supabase functions schedule cleanup-old-3d-models --cron "0 2 * * 0"
```

OR via Dashboard:
- [ ] Go to Edge Functions → cleanup-old-3d-models
- [ ] Enable cron schedule
- [ ] Set schedule to: `0 2 * * 0`
- [ ] Save configuration

### 9. Set Up Monitoring
- [ ] Add function to monitoring dashboard
- [ ] Set up alerts for failures
- [ ] Document expected weekly statistics
- [ ] Add to operations runbook

### 10. Documentation
- [ ] Update main README with cron job info
- [ ] Document in team wiki/Notion
- [ ] Add to maintenance schedule
- [ ] Inform team about automated cleanup

## Post-Deployment Monitoring

### First Week
- [ ] Day 1: Check function ran successfully
- [ ] Day 1: Verify logs show no errors
- [ ] Day 1: Confirm storage reduced
- [ ] Week 1: Review weekly execution
- [ ] Week 1: Verify expected cleanup volume

### Monthly Review
- [ ] Review total storage freed
- [ ] Check error rates
- [ ] Verify time window still appropriate
- [ ] Adjust if needed

## Rollback Plan

If something goes wrong:

1. **Immediate**: Disable cron schedule
   ```bash
   # Via Dashboard: Edge Functions → cleanup-old-3d-models → Disable cron
   ```

2. **Assess**: Check logs for errors
   ```bash
   npx supabase functions logs cleanup-old-3d-models --tail
   ```

3. **Fix**: Update code and redeploy
   ```bash
   npx supabase functions deploy cleanup-old-3d-models
   ```

4. **Re-test**: Run manual test again

## Common Issues

### Files Not Deleted
- **Cause**: Using SQL instead of Storage API
- **Fix**: Verify `storage.from().remove()` is used in code
- **Test**: Run test script to validate

### Too Many Files
- **Cause**: Time window too wide
- **Fix**: Adjust date filter in query
- **Test**: Check query results before deployment

### Orphaned Files
- **Cause**: Database updated but storage deletion failed
- **Fix**: Contact Supabase support for cleanup
- **Prevent**: Always use Storage API, check batch results

### Permission Errors
- **Cause**: Wrong API key (anon instead of service role)
- **Fix**: Use `SUPABASE_SERVICE_ROLE_KEY`
- **Test**: Verify in .env file

## Sign-Off

- [ ] All tests passed
- [ ] Manual test successful
- [ ] Monitoring set up
- [ ] Team notified
- [ ] Deployment documented

**Deployed by**: _____________
**Date**: _____________
**Sign-off**: _____________

---

**Remember**:
- ✅ Always test before deploying
- ✅ Use Storage API, never SQL for file deletion
- ✅ Test manually before enabling cron
- ✅ Monitor first execution closely
