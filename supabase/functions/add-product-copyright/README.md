# Add Product Copyright

Adds products to the copyright agent queue by setting `copyright_status='pending'` in the `pending_products` table. This function supports adding either a single product or all products from a specific vendor.

## Endpoint

`POST /functions/v1/add-product-copyright`

## Authentication

Requires Supabase service role key authentication via environment variables. The function uses the service role key to bypass Row Level Security (RLS) policies.

## Request Body

```json
{
  "productId": "string (optional)",
  "vendor": "string (optional)"
}
```

**Note:** You must provide either `productId` OR `vendor`, but not both.

- `productId`: The `scraped_products.id` of a single product to add to the copyright queue
- `vendor`: The vendor name to reset copyright status for all their products

**Validation Rules:**
- Must provide exactly one of `productId` or `vendor`
- Cannot provide both fields
- Cannot use `vendor: "all"` (rejected with 400 error)
- Values are trimmed before processing

## Response

### Success (200)

```json
{
  "success": true,
  "message": "Successfully added product to copyright queue",
  "stats": {
    "updated_count": 1,
    "productId": "abc123"
  }
}
```

Or for vendor reset:

```json
{
  "success": true,
  "message": "Successfully reset copyright status for 25 products from Vendor Name",
  "stats": {
    "updated_count": 25,
    "vendor": "Vendor Name"
  }
}
```

### Error Responses

**400 Bad Request** - Missing or invalid parameters
```json
{
  "success": false,
  "error": "Missing required field: either productId or vendor must be provided"
}
```

**400 Bad Request** - Both parameters provided
```json
{
  "success": false,
  "error": "Only one of productId or vendor should be provided, not both"
}
```

**400 Bad Request** - Vendor "all" not allowed
```json
{
  "success": false,
  "error": "Cannot reset copyright for \"all\" vendors. Please select a specific vendor."
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

### Single Product (productId)
1. Checks if a `pending_product` record exists with `scraped_product_id = productId`
2. If exists: Updates `copyright_status = 'pending'`
3. If not exists: Creates new `pending_product` record with `copyright_status = 'pending'`

### Vendor Reset (vendor)
1. Updates all `pending_products` where `vendor = vendor` to set `copyright_status = 'pending'`
2. Returns count of updated records

## Examples

### cURL - Add Single Product

```bash
curl -X POST https://your-project.supabase.co/functions/v1/add-product-copyright \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "abc123"
  }'
```

### cURL - Reset Vendor Products

```bash
curl -X POST https://your-project.supabase.co/functions/v1/add-product-copyright \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "Acme Corporation"
  }'
```

### JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('add-product-copyright', {
  body: { productId: 'abc123' }
});

// Or for vendor reset
const { data, error } = await supabase.functions.invoke('add-product-copyright', {
  body: { vendor: 'Acme Corporation' }
});
```

## Related Functions

- **remove-product-from-copyright** - Removes a single product from the copyright queue
- **clear-copyright-queue** - Clears all pending products from the copyright queue

## Workflow Integration

This function is typically used in the copyright management workflow:
1. User selects products or vendors to add to copyright queue
2. This function sets `copyright_status='pending'`
3. Copyright agent processes pending products
4. Products are marked as 'approved' or 'rejected' by the agent
