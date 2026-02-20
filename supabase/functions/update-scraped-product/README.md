# Update Scraped Product

Supabase Edge Function to update specific fields of scraped products using the product URL as the identifier.

## Overview

This endpoint allows you to update scraped product data by providing the product URL and the fields you want to update. It's designed for external integrations, webhooks, and automated processes that need to update product information.

## Endpoint

```
POST /functions/v1/update-scraped-product
```

## Authentication

Requires a valid Supabase API key in the `Authorization` header:

```
Authorization: Bearer <SUPABASE_ANON_KEY>
```

## Request Body

```typescript
{
  "url": string,        // Required: Product URL (identifier)
  "updates": {          // Required: Object containing fields to update
    [field: string]: any
  }
}
```

## Allowed Update Fields

The following fields can be updated:

### Basic Product Info
- `name` - Product name
- `price` - Current price
- `original_price` - Original/retail price
- `description` - Product description
- `stock_status` - Stock availability status
- `product_id` - Vendor product ID

### Media
- `main_image` - URL to main product image
- `images` - Array or object of product images

### Dimensions & Weight
- `weight` - Product weight
- `height` - Product height
- `width` - Product width
- `length` - Product length

### Categorization
- `category` - Product category
- `breadcrumbs` - Category breadcrumb trail
- `ean_code` - EAN/barcode

### Variants
- `variants` - Product variants object
- `variant_count` - Number of variants

## Fields NOT Allowed (Managed Internally)

The following fields are managed by internal processes and cannot be updated via this endpoint:
- AI/SEO fields: `ai_title`, `ai_description`
- Status fields: `status`, `pinned`, `rejected`
- Classification: `classification`, `classification_reason`, `classification_confidence`
- Blacklist: `blacklisted`, `blacklist_reason`
- Calculated fields: `volumetric_weight`

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "product": {
    // Full updated product object
  },
  "message": "Product updated successfully. Fields updated: name, price, stock_status"
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": "URL is required and must be a non-empty string"
}
```

```json
{
  "success": false,
  "error": "Updates object is required and must contain at least one field"
}
```

```json
{
  "success": false,
  "error": "No valid fields to update. Disallowed fields: created_at, id"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Product not found with the provided URL"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Database error: <error details>"
}
```

## Usage Examples

### cURL

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/update-scraped-product' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://vendor.com/products/example-product",
    "updates": {
      "price": 29.99,
      "stock_status": "in stock",
      "weight": 1.5
    }
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch(
  'https://<project-ref>.supabase.co/functions/v1/update-scraped-product',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://vendor.com/products/example-product',
      updates: {
        price: 29.99,
        stock_status: 'in stock',
        weight: 1.5,
        description: 'Updated product description'
      }
    })
  }
);

const result = await response.json();
console.log(result);
```

### Python

```python
import requests
import os

url = f"{os.getenv('SUPABASE_URL')}/functions/v1/update-scraped-product"
headers = {
    'Authorization': f"Bearer {os.getenv('SUPABASE_ANON_KEY')}",
    'Content-Type': 'application/json'
}
data = {
    'url': 'https://vendor.com/products/example-product',
    'updates': {
        'price': 29.99,
        'stock_status': 'in stock',
        'weight': 1.5
    }
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## Common Use Cases

### 1. Update Price and Stock Status

```json
{
  "url": "https://vendor.com/products/product-123",
  "updates": {
    "price": 19.99,
    "original_price": 24.99,
    "stock_status": "in stock"
  }
}
```

### 2. Update Product Information

```json
{
  "url": "https://vendor.com/products/product-123",
  "updates": {
    "name": "Updated Product Name",
    "description": "New product description with more details",
    "category": "Electronics > Accessories"
  }
}
```

### 3. Update Dimensions

```json
{
  "url": "https://vendor.com/products/product-123",
  "updates": {
    "weight": 2.5,
    "height": 10,
    "width": 15,
    "length": 20,
    "volumetric_weight": 3.0
  }
}
```

### 4. Update Product Variants

```json
{
  "url": "https://vendor.com/products/product-123",
  "updates": {
    "variants": {
      "color": ["Red", "Blue", "Green"],
      "size": ["S", "M", "L"]
    },
    "variant_count": 9
  }
}
```

## Notes

- The `url` field is used to identify the product and must exactly match the URL stored in the database
- The `updated_at` timestamp is automatically set to the current time on each update
- Only fields included in the `updates` object will be modified; other fields remain unchanged
- Attempting to update disallowed fields will result in a 400 error with a list of invalid fields
- The endpoint uses the service role key internally to ensure all updates are authorized

## Deployment

Deploy this function using the Supabase CLI:

```bash
supabase functions deploy update-scraped-product
```

Or use the deployment script:

```bash
node supabase/deploy-edge-function.js update-scraped-product
```

## Logs

Monitor function execution logs:

```bash
supabase functions logs update-scraped-product
```

## Security Considerations

- This endpoint requires authentication via the Supabase API key
- Only whitelisted fields can be updated to prevent unauthorized modifications
- The function validates all inputs before processing
- Uses service role key internally for database operations to ensure consistency
