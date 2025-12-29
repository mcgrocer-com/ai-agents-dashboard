# Cleanup Old 3D Models

Automated cleanup function that removes outdated 3D model files from Supabase storage for products updated 7-14 days ago. This helps manage storage costs by deleting old GLB files that are no longer needed.

## Endpoint

`POST /functions/v1/cleanup-old-3d-models`

## Cron Schedule

**Weekly on Sunday at 2:00 AM UTC**

This function is designed to run automatically via Supabase cron jobs, but can also be triggered manually via POST request.

## Authentication

Requires Supabase service role key authentication via environment variables. The function uses the service role key to bypass Row Level Security (RLS) policies and access storage buckets.

## Request Body

```json
{}
```

**Note:** No parameters required. The function automatically finds and cleans up old 3D models based on the `updated_at` timestamp.

## Response

### Success (200) - Products Found and Cleaned

```json
{
  "success": true,
  "message": "Cleaned up 42 3D model files from 42 products",
  "stats": {
    "products_found": 42,
    "files_deleted": 42,
    "files_failed": 0,
    "database_updated": 42
  }
}
```

### Success (200) - No Products Found

```json
{
  "success": true,
  "message": "No products found for cleanup",
  "stats": {
    "products_found": 0,
    "files_deleted": 0,
    "files_failed": 0,
    "database_updated": 0
  }
}
```

### Error Responses

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to fetch products: [error message]"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for storage and database access |

## Cleanup Logic

### Product Selection Criteria
1. `glb_url` is not NULL
2. `glb_url` contains '3d-models' (ensures it's a 3D model file)
3. `updated_at` between 7-14 days ago
4. Maximum 1000 products per run

### Processing Steps
1. Fetch qualifying products from `pending_products` table
2. Extract file paths from storage URLs
3. Delete files from Supabase storage in batches of 100
4. Update database to set `glb_url = NULL` for cleaned products in batches of 100
5. 500ms delay between storage batches, 100ms between database batches
6. Return comprehensive stats on cleanup operation

### File Path Extraction
Converts full Supabase storage URLs to file paths:
```
Input:  https://xxx.supabase.co/storage/v1/object/public/product-files/3d-models/uuid/file.glb
Output: 3d-models/uuid/file.glb
```

## Examples

### cURL - Manual Trigger

```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-old-3d-models \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript/TypeScript - Manual Trigger

```typescript
const { data, error } = await supabase.functions.invoke('cleanup-old-3d-models', {
  body: {}
});

if (error) {
  console.error('Cleanup failed:', error);
} else {
  console.log(`Cleanup complete:
    - Products found: ${data.stats.products_found}
    - Files deleted: ${data.stats.files_deleted}
    - Files failed: ${data.stats.files_failed}
    - Database updated: ${data.stats.database_updated}
  `);
}
```

### Supabase Dashboard - Configure Cron

In Supabase Dashboard:
1. Go to Database → Cron Jobs
2. Create new cron job:

```sql
-- Run every Sunday at 2 AM UTC
select cron.schedule(
  'cleanup-old-3d-models',
  '0 2 * * 0',
  $$
  select net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-old-3d-models',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Python - Manual Trigger with Monitoring

```python
import requests
from datetime import datetime

def cleanup_old_3d_models():
    url = 'https://your-project.supabase.co/functions/v1/cleanup-old-3d-models'
    headers = {
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
    }

    print(f"[{datetime.now()}] Starting 3D model cleanup...")

    response = requests.post(url, headers=headers, json={})
    data = response.json()

    if data['success']:
        stats = data['stats']
        print(f"✓ Cleanup successful:")
        print(f"  - Products found: {stats['products_found']}")
        print(f"  - Files deleted: {stats['files_deleted']}")
        print(f"  - Files failed: {stats['files_failed']}")
        print(f"  - Database updated: {stats['database_updated']}")

        if stats['files_failed'] > 0:
            print(f"⚠ Warning: {stats['files_failed']} files failed to delete")
    else:
        print(f"✗ Cleanup failed: {data['error']}")

    return data

# Run cleanup
result = cleanup_old_3d_models()
```

## Related Functions

This function is part of the 3D model generation and management workflow:
- **3D model generation** - Creates GLB files and stores in Supabase storage
- **cleanup-old-3d-models** - Removes outdated GLB files (this function)

## Workflow Integration

### Typical 3D Model Lifecycle
1. Product is scraped/imported into `pending_products`
2. 3D model is generated and uploaded to storage
3. `glb_url` is set in database
4. Product is updated over time
5. **After 7-14 days**, this function cleans up old 3D model files
6. New 3D model can be generated if needed

### Why 7-14 Days Window?
- **7 days minimum**: Ensures models are old enough to be safely deleted
- **14 days maximum**: Prevents cleanup function from processing too many products at once
- **Rolling window**: Each weekly run cleans up products from the previous week

## Storage Cost Optimization

### Estimated Savings
- Average GLB file size: 2-5 MB
- 1000 products cleaned per week: 2-5 GB saved weekly
- Annual savings: 100-260 GB of storage

### Storage Bucket Structure
```
product-files/
  └── 3d-models/
      ├── uuid-1/
      │   └── model.glb
      ├── uuid-2/
      │   └── model.glb
      └── ...
```

## Performance Considerations

- **Batch processing**: 100 files per storage batch, 100 records per database batch
- **Rate limiting**: 500ms delay between storage batches, 100ms between database batches
- **Maximum products**: 1000 products per run (configurable via LIMIT)
- **Execution time**: ~30-60 seconds for 1000 products
- **Idempotent**: Safe to run multiple times (will find 0 products if already cleaned)

## Monitoring and Logging

The function logs detailed information at each step:
```
[Log] Starting 3D model cleanup...
[Log] Found 42 products with 3D models to clean up
[Log] Extracted 42 file paths
[Log] Batch 1: Deleted 42 files
[Log] DB batch 1: Updated 42 records
[Log] Total database records updated: 42
[Log] Cleanup complete: {stats}
```

## Error Recovery

### Partial Failures
- **Files failed to delete**: Logged but doesn't stop execution
- **Database update failures**: Logged per batch, other batches continue
- **Stats tracking**: Separate counters for deleted, failed, and updated

### Recovery Strategy
1. Function logs all errors with batch numbers
2. Failed files remain in storage with `glb_url` intact in database
3. Next run will attempt to clean up missed files (if still in 7-14 day window)
4. Manual intervention available via logs

## Important Warnings

- **Permanent deletion**: Files are permanently removed from storage (no recycle bin)
- **No rollback**: Once deleted, files cannot be recovered
- **Database integrity**: Always updates database after successful file deletion
- **Orphan prevention**: Sets `glb_url = NULL` to prevent orphaned database references

## Best Practices

1. **Monitor weekly runs**: Check logs for failed deletions
2. **Alert on high failure rates**: If `files_failed` > 10%, investigate
3. **Verify storage savings**: Monitor storage usage trends in Supabase dashboard
4. **Test before enabling cron**: Run manual trigger first to verify behavior
5. **Adjust time window**: Modify 7-14 day window based on your business needs
