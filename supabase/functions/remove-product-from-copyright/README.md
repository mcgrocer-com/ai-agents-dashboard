# Remove Product from Copyright

Removes a specific product from the copyright agent queue by setting `copyright_status=NULL` in the `pending_products` table. This effectively dequeues the product so it will not be processed by the copyright agent.

## Endpoint

`POST /functions/v1/remove-product-from-copyright`

## Authentication

Requires Supabase service role key authentication via environment variables. The function uses the service role key to bypass Row Level Security (RLS) policies.

## Request Body

```json
{
  "productId": "string (required)"
}
```

- `productId`: The `pending_products.id` of the product to remove from the copyright queue

**Note:** The `productId` is trimmed before processing.

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Successfully removed product from copyright queue",
  "productId": "abc123"
}
```

### Error Responses

**400 Bad Request** - Missing productId
```json
{
  "success": false,
  "error": "Missing required field: productId"
}
```

**404 Not Found** - Product does not exist
```json
{
  "success": false,
  "error": "Product not found with ID: abc123"
}
```

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

1. Updates the `pending_products` record where `id = productId`
2. Sets `copyright_status = NULL`
3. Returns the updated record's `id` if successful
4. Returns 404 if no matching record found

## Examples

### cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/remove-product-from-copyright \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "abc123"
  }'
```

### JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('remove-product-from-copyright', {
  body: { productId: 'abc123' }
});

if (error) {
  console.error('Failed to remove product:', error);
} else {
  console.log('Product removed:', data.productId);
}
```

### Python

```python
import requests

response = requests.post(
    'https://your-project.supabase.co/functions/v1/remove-product-from-copyright',
    headers={
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
    },
    json={'productId': 'abc123'}
)

data = response.json()
print(data)
```

## Related Functions

- **add-product-copyright** - Adds products to the copyright queue (single or by vendor)
- **clear-copyright-queue** - Clears all pending products from the copyright queue

## Workflow Integration

This function is typically used in the copyright management workflow:
1. User views products in the copyright queue
2. User decides to remove a specific product from the queue
3. This function sets `copyright_status=NULL` for that product
4. Product is no longer processed by the copyright agent
5. User can re-add the product later using `add-product-copyright`

## Use Cases

- Manually dequeue products that should not be processed
- Remove products that were added by mistake
- Cancel pending copyright checks for specific items
- Clean up queue before bulk operations
