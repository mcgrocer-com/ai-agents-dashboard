# Shopify Push Blog

## Overview

Create, update, or delete blog articles in Shopify using the GraphQL Admin API. This function handles the complete blog article lifecycle with support for SEO metafields, featured images, tags, and summaries. All created articles are set as DRAFT by default.

## Endpoint

- **URL**: `/shopify-push-blog`
- **Methods**: `POST`, `PUT`, `DELETE`
- **Authentication**: Requires SHOPIFY_API_KEY environment variable

## Request

### POST - Create New Article

Creates a new draft article in Shopify.

**Request Body**:
```json
{
  "blogId": "gid://shopify/Blog/74558931119",
  "title": "How to Brew Perfect Coffee",
  "content": "<p>Full HTML content of the article...</p>",
  "summary": "<p>Optional excerpt for listing pages...</p>",
  "metaTitle": "Perfect Coffee Brewing Guide | McGrocer",
  "metaDescription": "Learn essential coffee brewing techniques with our comprehensive guide",
  "featuredImageUrl": "https://cdn.shopify.com/s/files/1/...",
  "featuredImageAlt": "Coffee brewing equipment on counter",
  "author": "McGrocer Team",
  "tags": ["coffee", "brewing", "guide"],
  "publishedAt": null
}
```

**Required Fields**:
- `blogId` (string): Shopify blog GraphQL Global ID
- `title` (string): Article title
- `content` (string): Article content (HTML format)

**Optional Fields**:
- `summary` (string): Article excerpt/summary (HTML)
- `metaTitle` (string): SEO meta title (stored in global.title_tag metafield)
- `metaDescription` (string): SEO meta description (stored in global.description_tag metafield)
- `featuredImageUrl` (string): Featured image URL
- `featuredImageAlt` (string): Featured image alt text
- `author` (string): Author name (defaults to "McGrocer Team")
- `tags` (array): Article tags
- `publishedAt` (string|null): Publication date (null creates draft)

### PUT - Update Existing Article

Updates an existing article.

**Request Body**:
```json
{
  "articleId": "123456789",
  "title": "Updated Title",
  "content": "<p>Updated content...</p>",
  "summary": "<p>Updated summary...</p>",
  "metaTitle": "Updated Meta Title",
  "metaDescription": "Updated meta description",
  "featuredImageUrl": "https://...",
  "featuredImageAlt": "Updated alt text",
  "author": "Updated Author",
  "tags": ["updated", "tags"]
}
```

**Required Fields**:
- `articleId` (string): Numeric article ID (not GID)

**Optional Fields**: Same as POST request (except blogId)

### DELETE - Delete Article

Deletes an article from Shopify.

**Request Body**:
```json
{
  "articleId": "123456789"
}
```

**Required Fields**:
- `articleId` (string): Numeric article ID (not GID)

## Response

### Success Response - POST/PUT

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "success": true,
  "article": {
    "id": "gid://shopify/Article/123456789",
    "title": "How to Brew Perfect Coffee",
    "handle": "how-to-brew-perfect-coffee",
    "summary": "<p>Optional excerpt...</p>",
    "tags": ["coffee", "brewing", "guide"],
    "url": "https://mcgrocer-com.myshopify.com/blogs/news/how-to-brew-perfect-coffee",
    "publishedAt": null,
    "createdAt": "2024-12-18T10:30:00Z",
    "updatedAt": "2024-12-18T10:30:00Z",
    "blog": {
      "id": "gid://shopify/Blog/74558931119",
      "title": "News",
      "handle": "news"
    },
    "metafields": [
      {
        "namespace": "global",
        "key": "title_tag",
        "value": "Perfect Coffee Brewing Guide | McGrocer"
      },
      {
        "namespace": "global",
        "key": "description_tag",
        "value": "Learn essential coffee brewing techniques"
      }
    ],
    "status": "draft"
  }
}
```

### Success Response - DELETE

**Status Code**: `200 OK`

**Response Body**:
```json
{
  "success": true,
  "deletedArticleId": "gid://shopify/Article/123456789"
}
```

### Error Responses

**Missing Required Fields** - `400 Bad Request`:
```json
{
  "error": "blogId, title, and content are required"
}
```
```json
{
  "error": "articleId is required"
}
```
```json
{
  "error": "articleId is required for updates"
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
      "message": "Blog not found",
      "path": ["articleCreate"]
    }
  ]
}
```

**Validation Errors** - `400 Bad Request`:
```json
{
  "error": "Validation errors",
  "details": [
    {
      "field": ["title"],
      "message": "Title can't be blank"
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

### GraphQL Mutations

**Create Article**:
```graphql
mutation {
  articleCreate(
    article: {
      blogId: "{blogId}"
      title: "{title}"
      body: "{content}"
      summary: "{summary}"
      author: { name: "{author}" }
      image: { url: "{url}", altText: "{alt}" }
      tags: ["{tag1}", "{tag2}"]
      metafields: [
        { namespace: "global", key: "title_tag", value: "{metaTitle}", type: "single_line_text_field" }
        { namespace: "global", key: "description_tag", value: "{metaDescription}", type: "multi_line_text_field" }
      ]
      isPublished: false
    }
  ) {
    article { ... }
    userErrors { field, message }
  }
}
```

**Update Article**:
```graphql
mutation {
  articleUpdate(
    id: "gid://shopify/Article/{articleId}"
    article: { ... }
  ) {
    article { ... }
    userErrors { field, message }
  }
}
```

**Delete Article**:
```graphql
mutation {
  articleDelete(id: "gid://shopify/Article/{articleId}") {
    deletedArticleId
    userErrors { field, message }
  }
}
```

### SEO Metafields
SEO data is stored in Shopify metafields:
- **Title Tag**: `namespace: "global"`, `key: "title_tag"`, `type: "single_line_text_field"`
- **Description Tag**: `namespace: "global"`, `key: "description_tag"`, `type: "multi_line_text_field"`

### Default Values
- `author`: Defaults to "McGrocer Team" if not provided
- `isPublished`: Always `false` (creates drafts)

## Example Usage

### JavaScript/TypeScript

**Create Article**:
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-push-blog',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blogId: 'gid://shopify/Blog/74558931119',
      title: 'How to Brew Perfect Coffee',
      content: '<p>Full article content...</p>',
      summary: '<p>Short summary...</p>',
      metaTitle: 'Perfect Coffee Guide | McGrocer',
      metaDescription: 'Learn to brew perfect coffee',
      tags: ['coffee', 'guide']
    })
  }
);
const data = await response.json();
console.log('Created article:', data.article.url);
```

**Update Article**:
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-push-blog',
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId: '123456789',
      title: 'Updated Title',
      content: '<p>Updated content...</p>'
    })
  }
);
```

**Delete Article**:
```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/shopify-push-blog',
  {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId: '123456789'
    })
  }
);
```

### cURL

**Create**:
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/shopify-push-blog" \
  -H "Content-Type: application/json" \
  -d '{
    "blogId": "gid://shopify/Blog/74558931119",
    "title": "Test Article",
    "content": "<p>Content</p>",
    "tags": ["test"]
  }'
```

**Update**:
```bash
curl -X PUT "https://your-project.supabase.co/functions/v1/shopify-push-blog" \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": "123456789",
    "title": "Updated Title"
  }'
```

**Delete**:
```bash
curl -X DELETE "https://your-project.supabase.co/functions/v1/shopify-push-blog" \
  -H "Content-Type: application/json" \
  -d '{"articleId": "123456789"}'
```

## CORS Support

This function supports CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Use Cases

- Creating blog articles from the Blogger feature
- Publishing AI-generated content to Shopify
- Updating existing articles with new content or SEO metadata
- Managing blog article lifecycle (create, update, delete)
- SEO optimization with custom meta tags
- Draft workflow management before publication
