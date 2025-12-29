# Shopify Published Blogs

## Overview

Fetches DRAFT (unpublished) articles from Shopify using the REST Admin API. Despite the function name, this endpoint returns unpublished/draft articles by filtering with `published_status=unpublished`. It provides comprehensive article metadata including content, images, tags, and blog information.

## Endpoint

- **URL**: `/shopify-published-blogs`
- **Method**: `GET`
- **Authentication**: Requires SHOPIFY_API_KEY environment variable

## Request

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 50 | Maximum number of draft articles to return |
| `blog_id` | string | No | - | Filter articles by specific blog ID (numeric ID, not GID) |

### Example Request

```bash
GET /shopify-published-blogs?limit=20
GET /shopify-published-blogs?blog_id=74558931119&limit=10
```

## Response

### Success Response

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "articles": [
    {
      "id": "gid://shopify/Article/123456789",
      "numericId": 123456789,
      "title": "How to Brew Perfect Coffee",
      "handle": "how-to-brew-perfect-coffee",
      "excerpt": "Learn the essential techniques for brewing the perfect cup of coffee every time. From water temperature to grind size, we cover it all...",
      "content": "<p>Full HTML content...</p>",
      "url": "https://mcgrocer-com.myshopify.com/blogs/news/how-to-brew-perfect-coffee",
      "publishedAt": null,
      "createdAt": "2024-12-15T10:30:00Z",
      "updatedAt": "2024-12-15T14:20:00Z",
      "tags": ["coffee", "brewing", "guide"],
      "image": {
        "url": "https://cdn.shopify.com/s/files/1/...",
        "altText": "Coffee brewing equipment"
      },
      "author": {
        "name": "McGrocer Team"
      },
      "blog": {
        "id": "gid://shopify/Blog/74558931119",
        "title": "News",
        "handle": "news"
      },
      "status": "draft"
    }
  ],
  "total": 15
}
```

**Response Fields**:
- `articles` (array): Array of draft article objects
  - `id` (string): GraphQL Global ID format
  - `numericId` (number): Numeric article ID
  - `title` (string): Article title
  - `handle` (string): Article handle (slug)
  - `excerpt` (string): Auto-generated excerpt (first 200 chars of text content)
  - `content` (string): Full HTML content (body_html)
  - `url` (string): Full article URL
  - `publishedAt` (string|null): Publication date (null for drafts)
  - `createdAt` (string): Creation timestamp
  - `updatedAt` (string): Last update timestamp
  - `tags` (array): Article tags
  - `image` (object|null): Featured image
    - `url` (string): Image URL
    - `altText` (string): Image alt text
  - `author` (object): Article author
    - `name` (string): Author name
  - `blog` (object): Parent blog information
    - `id` (string): Blog GraphQL Global ID
    - `title` (string): Blog title
    - `handle` (string): Blog handle
  - `status` (string): Always "draft" for this endpoint
- `total` (number): Number of draft articles returned

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
  "error": "Shopify API error: 404",
  "details": "Not Found"
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

### API Endpoints Used

1. **Fetch Blogs** (for mapping blog IDs to titles/handles):
   ```
   GET {SHOPIFY_STORE_URL}/admin/api/{SHOPIFY_API_VERSION}/blogs.json
   ```

2. **Fetch Draft Articles**:
   - All blogs: `GET {SHOPIFY_STORE_URL}/admin/api/{SHOPIFY_API_VERSION}/articles.json?published_status=unpublished&limit={limit}`
   - Specific blog: `GET {SHOPIFY_STORE_URL}/admin/api/{SHOPIFY_API_VERSION}/blogs/{blog_id}/articles.json?published_status=unpublished&limit={limit}`

### Why REST API Instead of GraphQL?
GraphQL does not support filtering articles by `published_status`, so this function uses the REST API with the `published_status=unpublished` filter to retrieve draft articles.

### Excerpt Generation
The function automatically generates a 200-character excerpt from the article's HTML content by:
1. Stripping all HTML tags
2. Taking the first 200 characters of text
3. Adding "..." if content exceeds 200 characters

## Example Usage

### JavaScript/TypeScript
```typescript
// Fetch all draft articles
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-published-blogs?limit=50'
);
const data = await response.json();
console.log(`Found ${data.total} draft articles`);

// Fetch drafts for a specific blog
const blogResponse = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-published-blogs?blog_id=74558931119&limit=20'
);
const blogData = await blogResponse.json();
```

### cURL
```bash
# All draft articles
curl "https://your-project.supabase.co/functions/v1/shopify-published-blogs?limit=30"

# Draft articles for specific blog
curl "https://your-project.supabase.co/functions/v1/shopify-published-blogs?blog_id=74558931119&limit=10"
```

## CORS Support

This function supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Use Cases

- Listing unpublished/draft blog articles for review
- Managing content workflow for draft articles
- Retrieving article details for editing before publication
- Monitoring unpublished content in the Blogger feature
