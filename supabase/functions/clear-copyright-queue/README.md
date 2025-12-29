# Clear Copyright Queue

Clears the entire copyright agent queue by setting `copyright_status=NULL` for all products with `copyright_status='pending'`. This bulk operation removes all pending products from the copyright processing queue.

## Endpoint

`POST /functions/v1/clear-copyright-queue`

## Authentication

Requires Supabase service role key authentication via environment variables. The function uses the service role key to bypass Row Level Security (RLS) policies.

## Request Body

```json
{}
```

**Note:** No parameters required. The function clears all pending products.

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Successfully cleared 150 products from copyright queue",
  "stats": {
    "cleared_count": 150
  }
}
```

If no pending products found:

```json
{
  "success": true,
  "message": "Successfully cleared 0 products from copyright queue",
  "stats": {
    "cleared_count": 0
  }
}
```

### Error Responses

**405 Method Not Allowed** - Non-POST request
```json
{
  "success": false,
  "error": "Method not allowed. Use POST."
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Database error message or internal error description"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for bypassing RLS |

## Database Behavior

1. Finds all `pending_products` records where `copyright_status = 'pending'`
2. Updates all matching records to set `copyright_status = NULL`
3. Returns the count of updated records
4. Uses exact count to track how many products were cleared

## Examples

### cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/clear-copyright-queue \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('clear-copyright-queue', {
  body: {}
});

if (error) {
  console.error('Failed to clear queue:', error);
} else {
  console.log(`Cleared ${data.stats.cleared_count} products from queue`);
}
```

### Python

```python
import requests

response = requests.post(
    'https://your-project.supabase.co/functions/v1/clear-copyright-queue',
    headers={
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
    },
    json={}
)

data = response.json()
print(f"Cleared {data['stats']['cleared_count']} products")
```

### Bash Script with Error Handling

```bash
#!/bin/bash

SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

response=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/clear-copyright-queue" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$response" | jq '.'

# Check if successful
if echo "$response" | jq -e '.success' > /dev/null; then
  count=$(echo "$response" | jq -r '.stats.cleared_count')
  echo "Successfully cleared $count products from copyright queue"
else
  echo "Error clearing queue"
  exit 1
fi
```

## Related Functions

- **add-product-copyright** - Adds products to the copyright queue (single or by vendor)
- **remove-product-from-copyright** - Removes a single product from the copyright queue

## Workflow Integration

This function is typically used in the copyright management workflow:
1. Admin decides to clear the entire copyright queue
2. This function sets `copyright_status=NULL` for all pending products
3. Queue is now empty and ready for new products
4. Previously pending products can be re-added using `add-product-copyright`

## Use Cases

- Emergency queue clearing when copyright agent has issues
- Resetting the queue before bulk import operations
- Clearing queue before changing copyright validation rules
- Testing and development workflow resets
- Scheduled maintenance operations

## Important Warnings

- **This operation affects all pending products** - There is no undo
- **No confirmation dialog** - The operation executes immediately
- **Idempotent** - Safe to call multiple times (will return cleared_count: 0 if queue is already empty)
- **Does not affect approved/rejected products** - Only clears products with `copyright_status='pending'`

## Performance Considerations

- Operation is relatively fast, even with large queues
- Uses single UPDATE query with WHERE clause filtering
- No pagination needed as it's a single bulk operation
- Returns exact count using `count: 'exact'` option
