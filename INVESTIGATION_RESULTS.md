# Investigation Results: Missing pending_products Entries

## Summary
Out of 77 newly imported Chanel products, only 23 have pending_products entries. The remaining 54 products failed to be added to pending_products due to edge function failures.

---

## Root Cause Analysis

### The Classification Workflow
1. **Database Trigger**: When products are inserted into `scraped_products`, a database trigger calls the `push-to-pending` edge function via HTTP request
2. **Edge Function**: The edge function performs UK medicine classification using **Gemini AI**
3. **Classification Decision**:
   - **ACCEPTED** products (`not_medicine` or `gsl`) → Added to `pending_products`
   - **REJECTED** products (`pharmacy`, `pom`, or `unclear`) → Flagged in `scraped_products`, excluded from `pending_products`

### What Happened
```sql
-- Classification breakdown for today's Chanel imports:
Total products: 77
├── Classified as "not_medicine": 23 (ACCEPTED → added to pending_products) ✅
└── Not classified (NULL): 54 (FAILED → edge function errors) ❌
```

### Evidence from Logs
Between 09:48:20 UTC and 09:48:49 UTC (product import time):
- **23 successful requests** (HTTP 200) - These correspond to the 23 pending_products entries
- **54 failed requests** (HTTP 500) - These are the missing entries

The edge function errors occurred in rapid succession during bulk import, suggesting:
1. **Gemini API rate limiting** (429 errors)
2. **API quota exhaustion**
3. **Concurrent request overload**

---

## Data Verification

### Products WITH pending_products entries:
```sql
SELECT COUNT(*) FROM scraped_products s
JOIN pending_products p ON p.scraped_product_id = s.id
WHERE s.name LIKE '%Chanel%' AND s.created_at >= CURRENT_DATE;
-- Result: 23

-- All have classification = 'not_medicine', rejected = false
```

### Products WITHOUT pending_products entries:
```sql
SELECT COUNT(*) FROM scraped_products s
WHERE s.name LIKE '%Chanel%'
  AND s.created_at >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM pending_products p WHERE p.scraped_product_id = s.id
  );
-- Result: 54

-- All have classification = NULL, rejected = false
-- These are cosmetics, perfumes, beauty products that SHOULD be classified as "not_medicine"
```

### Sample of Unclassified Products:
1. `CHANEL Allure Eau de Parfum Spray` - Perfume
2. `CHANEL Coco Mademoiselle Eau de Parfum Twist and Spray` - Perfume
3. `CHANEL Les Beiges Healthy Glow Natural Eyeshadow Palette` - Cosmetics
4. `CHANEL Rouge Allure Velvet Nuit Blanche Limited Edition` - Lipstick
5. `CHANEL UV Essentiel Complete Protection UV SPF 50` - Sunscreen

All of these should be classified as `not_medicine` and ACCEPTED.

---

## Technical Details

### Database Trigger Configuration
```sql
-- Trigger: push-to-pending-on-insert
-- Event: INSERT on scraped_products
-- Action: HTTP POST to push-to-pending edge function
-- Timeout: 5000ms
```

### Edge Function Code Location
- Function: `push-to-pending` (version 47)
- Path: `supabase/functions/push-to-pending/index.ts`
- Classification module: `supabase/functions/_shared/gemini-classification.ts`

### Classification Logic
```typescript
// From edge function code:
// STEP 1: Classify product using Gemini AI
const classification = await classifyProduct(
  scrapedProduct.name || 'Unknown product',
  scrapedProduct.description || '',
  geminiApiKey,
  supabase
);

// STEP 2: Update scraped_products with classification results
// STEP 3: If product is REJECTED, do not create pending_products entry
// STEP 4: If product is ACCEPTED, create pending_products entry
```

---

## Impact Assessment

### Affected Products (54 total):
- **Vendor**: Harrods and John Lewis
- **Brand**: CHANEL cosmetics, perfumes, beauty products
- **Status**: All are in `scraped_products` with `status='pending'`
- **Classification**: NULL (failed to classify)
- **Business Impact**: These products won't be processed by AI agents (category, weight/dimension, SEO) because they're not in pending_products

### Processing Pipeline Blockage:
```
scraped_products (77 products)
    ↓ [Database Trigger]
push-to-pending Edge Function
    ↓ [Gemini AI Classification]
    ├── 23 ACCEPTED → pending_products ✅
    └── 54 FAILED (HTTP 500) → NOT in pending_products ❌
           ↓
    [Cannot proceed to AI agents for processing]
```

---

## Recommended Solutions

### Immediate Fix (Manual Retry)
Manually trigger classification for the 54 unclassified products:

```sql
-- Option 1: Update trigger to re-run classification
UPDATE scraped_products
SET updated_at = NOW()
WHERE name LIKE '%Chanel%'
  AND created_at >= CURRENT_DATE
  AND classification IS NULL;
-- This triggers the UPDATE event on push-to-pending

-- Option 2: Direct insert to pending_products (bypass classification)
-- Only recommended if you're CERTAIN these are cosmetics/non-medicine
INSERT INTO pending_products (
  scraped_product_id,
  url,
  vendor,
  breadcrumbs,
  product_id,
  category_status,
  weight_and_dimension_status,
  seo_status
)
SELECT
  s.id,
  s.url,
  s.vendor,
  s.breadcrumbs,
  s.product_id,
  'pending',
  'pending',
  'pending'
FROM scraped_products s
WHERE s.name LIKE '%Chanel%'
  AND s.created_at >= CURRENT_DATE
  AND s.classification IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM pending_products p WHERE p.scraped_product_id = s.id
  );
-- Also update classification in scraped_products
UPDATE scraped_products
SET
  classification = 'not_medicine',
  classification_reason = 'Manual override - Chanel cosmetics/beauty products',
  classification_confidence = 1.0,
  rejected = false
WHERE name LIKE '%Chanel%'
  AND created_at >= CURRENT_DATE
  AND classification IS NULL;
```

### Long-term Solutions

1. **Rate Limiting Protection**:
   - Add exponential backoff retry logic in edge function
   - Implement queuing for bulk imports
   - Use multiple Gemini API keys for load balancing

2. **Error Handling**:
   - Catch 500 errors and log detailed error messages
   - Retry failed classifications asynchronously
   - Add monitoring/alerting for classification failures

3. **Bulk Import Optimization**:
   - Implement batch classification API
   - Add delay between product inserts to avoid rate limits
   - Use edge function invoke with retry policy

4. **Gemini API Configuration**:
   - Review API quota limits
   - Upgrade to higher tier if needed
   - Implement fallback models (gemini-1.5-flash, gemini-1.5-pro)

---

## Files Affected
- `g:\Projects\mcgrocer-project\ai-dashboard\chanel_products_for_import.json` (77 products)
- Database tables: `scraped_products`, `pending_products`
- Edge function: `push-to-pending` (version 47)
- Classification module: `gemini-classification.ts`

---

## Next Steps
1. Decide on immediate fix approach (manual retry vs bypass)
2. Execute fix to add 54 products to pending_products
3. Implement long-term rate limiting protection
4. Monitor edge function errors for future imports
