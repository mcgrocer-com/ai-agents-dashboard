# Shopify Blog Articles

## Overview

Search for related blog articles by topic using Shopify's GraphQL Admin API. Returns article metadata with markdown-formatted links for easy content integration.

## Endpoint

- **URL**: `/shopify-blog-articles`
- **Method**: `GET`
- **Authentication**: Requires SHOPIFY_API_KEY environment variable

## Request

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `topic` or `q` | string | Yes | - | Search topic/query string for article search |
| `limit` | number | No | 5 | Maximum number of articles to return |

### Example Request

```bash
GET /shopify-blog-articles?topic=organic%20coffee&limit=10
```

## Response

### Success Response

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "links": [
    {
      "title": "The Benefits of Organic Coffee",
      "url": "https://mcgrocer-com.myshopify.com/blogs/news/benefits-of-organic-coffee",
      "markdown": "[The Benefits of Organic Coffee](https://mcgrocer-com.myshopify.com/blogs/news/benefits-of-organic-coffee)",
      "blog": {
        "id": "gid://shopify/Blog/74558931119",
        "title": "News",
        "handle": "news"
      },
      "publishedAt": "2024-12-01T10:30:00Z",
      "tags": ["coffee", "organic", "health"]
    }
  ],
  "total": 5,
  "topic": "organic coffee"
}
```

**Response Fields**:
- `links` (array): Array of article link objects
  - `title` (string): Article title
  - `url` (string): Full article URL
  - `markdown` (string): Pre-formatted markdown link
  - `blog` (object): Parent blog information
    - `id` (string): Blog GraphQL Global ID
    - `title` (string): Blog title
    - `handle` (string): Blog handle
  - `publishedAt` (string): ISO 8601 publication date
  - `tags` (array): Article tags
- `total` (number): Number of articles returned
- `topic` (string): The search topic used

### Error Responses

**Missing Topic Parameter** - `400 Bad Request`:
```json
{
  "error": "Topic parameter is required"
}
```

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
      "message": "Parse error",
      "locations": [{ "line": 2, "column": 5 }]
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
  articles(first: {limit}, query: "{topic}") {
    nodes {
      id
      title
      handle
      publishedAt
      tags
      blog {
        id
        title
        handle
      }
    }
  }
}
```

### URL Construction
Article URLs are constructed as:
```
{SHOPIFY_STORE_URL}/blogs/{blog.handle}/{article.handle}
```

## Example Usage

### JavaScript/TypeScript
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-blog-articles?topic=coffee&limit=5',
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
);
const data = await response.json();

// Use markdown links in content
data.links.forEach(link => {
  console.log(link.markdown); // [Title](URL)
});
```

### cURL
```bash
curl "https://your-project.supabase.co/functions/v1/shopify-blog-articles?q=organic%20tea&limit=10"
```

## CORS Support

This function supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Use Cases

- Finding related articles for internal linking
- Content research and topic exploration
- SEO optimization with contextual backlinks
- Building article recommendation systems
