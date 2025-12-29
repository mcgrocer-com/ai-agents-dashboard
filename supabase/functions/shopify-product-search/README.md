# Shopify Product Search

## Overview

Search Shopify products using the public search suggest API. This endpoint does not require JWT authentication and uses Shopify's public storefront search API to find products based on a query string.

## Endpoint

- **URL**: `/shopify-product-search`
- **Method**: `GET`
- **Authentication**: None (verify_jwt is FALSE)

## Request

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` or `q` | string | Yes | - | Search query string for product search |
| `limit` | number | No | 10 | Maximum number of products to return |

### Example Request

```bash
GET /shopify-product-search?q=organic%20coffee&limit=5
```

## Response

### Success Response

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "products": [
    {
      "title": "Organic Coffee Beans",
      "url": "https://mcgrocer-com.myshopify.com/products/organic-coffee-beans",
      "handle": "organic-coffee-beans",
      "image_url": "https://cdn.shopify.com/s/files/1/...",
      "product_type": "Coffee"
    }
  ],
  "total": 5,
  "query": "organic coffee"
}
```

**Response Fields**:
- `products` (array): Array of product objects
  - `title` (string): Product title
  - `url` (string): Full product URL
  - `handle` (string): Product handle (slug)
  - `image_url` (string): Featured image URL
  - `product_type` (string): Product type/category
- `total` (number): Number of products returned
- `query` (string): The search query used

### Error Responses

**Missing Query Parameter** - `400 Bad Request`:
```json
{
  "error": "Query parameter is required"
}
```

**Shopify API Error** - `4xx/5xx`:
```json
{
  "error": "Shopify API error: 404",
  "details": "..."
}
```

**Internal Server Error** - `500 Internal Server Error`:
```json
{
  "error": "Internal server error",
  "message": "Error message details"
}
```

## Environment Variables

- **SHOPIFY_STORE_URL**: Hardcoded to `https://mcgrocer-com.myshopify.com`

## Implementation Details

### API Endpoint Used
- Shopify Search Suggest API: `{SHOPIFY_STORE_URL}/search/suggest.json`
- Resource type: `product`
- Public API (no authentication required)

### Response Transformation
The function transforms Shopify's nested response structure (`rawData.resources.results.products`) into a simplified format suitable for AI context and frontend consumption.

## Example Usage

### JavaScript/TypeScript
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-product-search?q=coffee&limit=10'
);
const data = await response.json();
console.log(`Found ${data.total} products:`, data.products);
```

### cURL
```bash
curl "https://your-project.supabase.co/functions/v1/shopify-product-search?query=organic%20tea&limit=5"
```

## CORS Support

This function supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
