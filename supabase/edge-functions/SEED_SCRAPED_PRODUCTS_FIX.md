# Seed Scraped Products Edge Function Fix

## Issue
The `seed-scraped-products` edge function was throwing a unique constraint error:
```
"duplicate key value violates unique constraint \"scraped_products_url_key\""
```

## Root Cause
The `scraped_products` table has two unique constraints:
1. Primary key on `id` column
2. Unique constraint on `url` column (`scraped_products_url_key`)

The original implementation used `onConflict: "id"` for upserts, which didn't properly handle the URL unique constraint when `update_existing: true` was set.

## Solution
Changed the upsert logic to use `url` as the conflict target instead of `id`:

### Key Changes:

1. **Renamed deduplication function**: Changed `deduplicateByGeneratedId()` to `deduplicateByUrl()` to better reflect its purpose and ensure URL-based deduplication

2. **Updated conflict resolution**: Changed the upsert operation from:
   ```typescript
   .upsert(batch, { onConflict: "id" })
   ```
   to:
   ```typescript
   .upsert(batch, {
     onConflict: "url",
     ignoreDuplicates: false  // We want to update, not ignore
   })
   ```

3. **Changed tracking mechanism**: Modified `getExistingIds()` to `getExistingUrls()` to fetch and track existing URLs instead of IDs

4. **Updated categorization logic**: The `categorizeProducts()` function now compares against existing URLs rather than existing IDs

## Behavior After Fix

### When `update_existing: false` (default)
- New products (URLs not in database) → **Inserted**
- Existing products (URLs already in database) → **Skipped**
- No constraint errors

### When `update_existing: true`
- New products (URLs not in database) → **Inserted**
- Existing products (URLs already in database) → **Updated** using URL as conflict key
- The existing record matched by URL is updated with new data
- No constraint errors

## Testing Recommendations

Test the following scenarios:

1. **Insert new products** with unique URLs:
   ```json
   {
     "products": [...],
     "update_existing": false
   }
   ```
   Expected: All products inserted successfully

2. **Update existing products** by URL:
   ```json
   {
     "products": [...],  // Products with URLs that already exist
     "update_existing": true
   }
   ```
   Expected: Existing records updated, no constraint errors

3. **Mixed scenario** (some new, some existing):
   ```json
   {
     "products": [...],  // Mix of new and existing URLs
     "update_existing": true
   }
   ```
   Expected: New products inserted, existing products updated

4. **Skip existing products**:
   ```json
   {
     "products": [...],  // Products with URLs that already exist
     "update_existing": false
   }
   ```
   Expected: All existing products skipped, count returned in stats

## Deployment
- **Function**: `seed-scraped-products`
- **Version**: 10
- **Deployed**: 2025-10-03
- **Status**: ACTIVE

## Documentation Reference
- [Supabase Upsert Documentation](https://supabase.com/docs/reference/javascript/upsert)
- Upsert with constraints uses `onConflict` parameter to specify which unique column to use for conflict resolution
