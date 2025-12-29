# Shopify Blogs

## Overview

Fetches all blogs from Shopify using the GraphQL Admin API. Returns blog metadata including ID, title, handle, and comment policy.

## Endpoint

- **URL**: `/shopify-blogs`
- **Method**: `GET`
- **Authentication**: Requires SHOPIFY_API_KEY environment variable

## Request

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 10 | Maximum number of blogs to return (GraphQL first parameter) |

### Example Request

```bash
GET /shopify-blogs?limit=20
```

## Response

### Success Response

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "blogs": [
    {
      "id": "gid://shopify/Blog/74558931119",
      "title": "News",
      "handle": "news",
      "commentPolicy": "MODERATE"
    },
    {
      "id": "gid://shopify/Blog/74558931120",
      "title": "Recipes",
      "handle": "recipes",
      "commentPolicy": "DISABLED"
    }
  ],
  "total": 2
}
```

**Response Fields**:
- `blogs` (array): Array of blog objects
  - `id` (string): GraphQL Global ID (gid://shopify/Blog/{numeric_id})
  - `title` (string): Blog title
  - `handle` (string): Blog handle (slug)
  - `commentPolicy` (string): Comment policy (MODERATE, DISABLED, etc.)
- `total` (number): Number of blogs returned

### Error Responses

**Missing API Key** - `500 Internal Server Error`:
```json
{
  "error": "Internal server error",
  "message": "SHOPIFY_API_KEY environment variable not set"
}
```

**Shopify API Error** - `4xx/5xx`:
```json
{
  "error": "Shopify API error: 401",
  "details": "Unauthorized"
}
```

**GraphQL Errors** - `400 Bad Request`:
```json
{
  "error": "GraphQL errors",
  "details": [
    {
      "message": "Field 'blogs' doesn't exist on type 'QueryRoot'",
      "locations": [{ "line": 2, "column": 3 }]
    }
  ]
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

**Required**:
- **SHOPIFY_API_KEY**: Shopify Admin API access token

**Hardcoded**:
- **SHOPIFY_STORE_URL**: `https://mcgrocer-com.myshopify.com`
- **SHOPIFY_API_VERSION**: `2024-10`

## Implementation Details

### API Endpoint Used
- Shopify GraphQL Admin API: `{SHOPIFY_STORE_URL}/admin/api/{SHOPIFY_API_VERSION}/graphql.json`
- Authentication: `X-Shopify-Access-Token` header

### GraphQL Query
```graphql
query {
  blogs(first: {limit}) {
    nodes {
      id
      title
      handle
      commentPolicy
    }
  }
}
```

## Example Usage

### JavaScript/TypeScript
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-blogs?limit=10',
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
const data = await response.json();
console.log(`Found ${data.total} blogs:`, data.blogs);
```

### cURL
```bash
curl "https://your-project.supabase.co/functions/v1/shopify-blogs?limit=5"
```

## CORS Support

This function supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Use Cases

- Listing available blogs for blog article creation
- Selecting target blog for new articles in the Blogger feature
- Blog management and organization
