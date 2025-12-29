# Shopify Edge Functions - Complete Reference

This document provides a comprehensive overview of all Shopify-related Edge Functions used in the AI Dashboard. These functions integrate with Shopify's Admin API to manage blogs, articles, and products.

## Overview

The AI Dashboard includes 6 Shopify Edge Functions that enable the Blogger feature to create, manage, and publish blog content directly to the Shopify CMS.

### Function List

1. **shopify-blogs** - List all Shopify blogs
2. **shopify-blog-articles** - Search blog articles by topic
3. **shopify-product-search** - Search products (public API, no auth)
4. **shopify-published-blogs** - List draft/unpublished articles
5. **shopify-push-blog** - Create, update, or delete blog articles
6. **blog-preview** - Generate SEO-optimized HTML preview pages

## Architecture Overview

### API Types Used

- **GraphQL Admin API**: Used by most functions for modern, efficient querying
  - shopify-blogs
  - shopify-blog-articles
  - shopify-push-blog

- **REST Admin API**: Used when GraphQL limitations exist
  - shopify-published-blogs (GraphQL doesn't support `published_status` filtering)

- **Public Storefront API**: For unauthenticated product search
  - shopify-product-search

- **Direct Database Access**: For internal blog preview
  - blog-preview (reads from `blogger_blogs` table)

### Common Configuration

All Shopify API functions share:
- **Store URL**: `https://mcgrocer-com.myshopify.com`
- **API Version**: `2024-10`
- **CORS**: Enabled for all origins (`Access-Control-Allow-Origin: *`)

## Function Details

### 1. shopify-blogs

**Purpose**: List all available Shopify blogs with metadata

**Method**: `GET`

**Authentication**: Requires `SHOPIFY_API_KEY`

**Query Parameters**:
- `limit` (optional, default: 10) - Maximum blogs to return

**Response Example**:
```json
{
  "blogs": [
    {
      "id": "gid://shopify/Blog/74558931119",
      "title": "Coffee Guide",
      "handle": "coffee-guide",
      "commentPolicy": "MODERATE"
    }
  ],
  "total": 2
}
```

**Use Cases**:
- Blog selection UI in article creation wizard
- Getting blog IDs for article creation
- Blog management dashboards

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\shopify-blogs\README.md`

---

### 2. shopify-blog-articles

**Purpose**: Search for related blog articles by topic using GraphQL

**Method**: `GET`

**Authentication**: Requires `SHOPIFY_API_KEY`

**Query Parameters**:
- `topic` or `q` (required) - Search topic/query
- `limit` (optional, default: 5) - Maximum articles to return

**Response Example**:
```json
{
  "links": [
    {
      "title": "How to Choose the Best Coffee Beans",
      "url": "https://mcgrocer-com.myshopify.com/blogs/coffee-guide/how-to-choose-coffee-beans",
      "markdown": "[How to Choose the Best Coffee Beans](https://...)",
      "blog": {
        "id": "gid://shopify/Blog/74558931119",
        "title": "Coffee Guide",
        "handle": "coffee-guide"
      },
      "publishedAt": "2024-12-15T10:30:00Z",
      "tags": ["coffee", "guide", "brewing"]
    }
  ],
  "total": 5,
  "topic": "coffee"
}
```

**Key Features**:
- Returns markdown-formatted links for easy content insertion
- Searches across article titles, content, and tags
- Includes blog metadata for URL construction

**Use Cases**:
- AI content generation (finding related articles for internal linking)
- Content discovery and research
- Building article recommendation systems

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\shopify-blog-articles\README.md`

---

### 3. shopify-product-search

**Purpose**: Search Shopify products using public suggest API

**Method**: `GET`

**Authentication**: None required (public API)

**Query Parameters**:
- `query` or `q` (required) - Product search query
- `limit` (optional, default: 10) - Maximum products to return

**Response Example**:
```json
{
  "products": [
    {
      "title": "Organic Fair Trade Coffee Beans - Medium Roast",
      "url": "https://mcgrocer-com.myshopify.com/products/organic-coffee-beans-medium",
      "handle": "organic-coffee-beans-medium",
      "image_url": "https://cdn.shopify.com/s/files/1/...",
      "product_type": "Coffee & Tea"
    }
  ],
  "total": 2,
  "query": "coffee"
}
```

**Key Features**:
- Only function that doesn't require authentication
- Lean payload optimized for AI context
- Searches across titles, descriptions, tags, and SKUs

**Use Cases**:
- Blog product linking (finding products to mention in articles)
- AI content generation with product recommendations
- Product discovery for content strategy

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\shopify-product-search\README.md`

---

### 4. shopify-published-blogs

**Purpose**: List draft (unpublished) articles from Shopify

**Method**: `GET`

**Authentication**: Requires `SHOPIFY_API_KEY`

**Query Parameters**:
- `limit` (optional, default: 50) - Maximum articles to return
- `blog_id` (optional) - Filter by specific blog ID (numeric)

**Important Note**: Despite the name "published-blogs", this function returns UNPUBLISHED/DRAFT articles. This is because GraphQL doesn't support filtering by publication status, so the REST API is used with `published_status=unpublished`.

**Response Example**:
```json
{
  "articles": [
    {
      "id": "gid://shopify/Article/550839717903",
      "numericId": 550839717903,
      "title": "How to Brew Perfect Coffee at Home",
      "handle": "how-to-brew-perfect-coffee",
      "excerpt": "Discover the secrets to brewing barista-quality coffee...",
      "content": "<h2>Introduction</h2><p>Coffee brewing is an art...</p>",
      "url": "https://mcgrocer-com.myshopify.com/blogs/coffee-guide/...",
      "publishedAt": null,
      "createdAt": "2024-12-10T14:30:00Z",
      "updatedAt": "2024-12-15T09:45:00Z",
      "tags": ["coffee", "brewing", "guide"],
      "image": {
        "url": "https://cdn.shopify.com/...",
        "altText": "Coffee brewing setup"
      },
      "author": { "name": "McGrocer Team" },
      "blog": {
        "id": "gid://shopify/Blog/74558931119",
        "title": "Coffee Guide",
        "handle": "coffee-guide"
      },
      "status": "draft"
    }
  ],
  "total": 15
}
```

**Key Features**:
- Uses REST API (GraphQL limitation workaround)
- Auto-generates 200-character excerpts from content
- Fetches all blogs first to map titles and handles
- Returns both GraphQL Global IDs and numeric IDs

**Use Cases**:
- Draft article management dashboard
- Editorial review workflow
- Content pipeline tracking
- Blog-specific draft filtering

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\shopify-published-blogs\README.md`

---

### 5. shopify-push-blog

**Purpose**: Create, update, or delete Shopify blog articles via GraphQL

**Methods**: `POST`, `PUT`, `DELETE`

**Authentication**: Requires `SHOPIFY_API_KEY`

#### POST - Create Article

**Request Body**:
```json
{
  "blogId": "gid://shopify/Blog/74558931119",
  "title": "How to Brew Perfect Coffee at Home",
  "content": "<h2>Introduction</h2><p>Coffee brewing...</p>",
  "summary": "<p>Learn the secrets...</p>",
  "metaTitle": "Perfect Coffee Brewing Guide - McGrocer",
  "metaDescription": "Discover professional coffee brewing techniques...",
  "featuredImageUrl": "https://cdn.shopify.com/...",
  "featuredImageAlt": "Coffee brewing equipment",
  "author": "Sarah Mitchell",
  "tags": ["coffee", "brewing", "guide"],
  "publishedAt": null
}
```

**Required Fields**: `blogId`, `title`, `content`

#### PUT - Update Article

**Request Body**:
```json
{
  "articleId": "550839717903",
  "title": "Updated Title",
  "content": "<p>Updated content...</p>",
  ...
}
```

**Required Fields**: `articleId`

#### DELETE - Remove Article

**Request Body**:
```json
{
  "articleId": "550839717903"
}
```

**Response Example** (POST/PUT):
```json
{
  "success": true,
  "article": {
    "id": "gid://shopify/Article/550839717903",
    "title": "How to Brew Perfect Coffee at Home",
    "handle": "how-to-brew-perfect-coffee-at-home",
    "summary": "<p>Learn the secrets...</p>",
    "tags": ["coffee", "brewing", "guide"],
    "url": "https://mcgrocer-com.myshopify.com/blogs/coffee-guide/...",
    "publishedAt": null,
    "createdAt": "2024-12-18T10:30:00Z",
    "updatedAt": "2024-12-18T10:30:00Z",
    "blog": {
      "id": "gid://shopify/Blog/74558931119",
      "title": "Coffee Guide",
      "handle": "coffee-guide"
    },
    "metafields": [
      {
        "namespace": "global",
        "key": "title_tag",
        "value": "Perfect Coffee Brewing Guide - McGrocer"
      },
      {
        "namespace": "global",
        "key": "description_tag",
        "value": "Discover professional coffee brewing techniques..."
      }
    ],
    "status": "draft"
  }
}
```

**Key Features**:
- All articles created as DRAFT by default (`isPublished: false`)
- SEO metadata stored in metafields (`global.title_tag`, `global.description_tag`)
- Default author: "McGrocer Team"
- Automatic handle (URL slug) generation from title
- Supports featured images, tags, and custom summaries

**Important Notes**:
- Recent fix (commit 9abbadb) prevents duplicate blog creation
- POST requires `blogId` in GraphQL Global ID format
- PUT/DELETE require `articleId` as numeric ID
- Summary field is optional but recommended for blog listing pages

**Use Cases**:
- AI blog generation (creating articles from AI-generated content)
- Content publishing workflow (draft → review → publish)
- SEO optimization (updating meta tags)
- Article lifecycle management (full CRUD)

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\shopify-push-blog\README.md`

---

### 6. blog-preview

**Purpose**: Generate SEO-optimized HTML preview pages for blog articles

**Method**: `GET`

**Authentication**: Uses `SUPABASE_SERVICE_ROLE_KEY` (internal database access)

**URL Pattern**: `/blog-preview/{blog-id}`

**Response**: Returns fully-rendered HTML page (not JSON)

**Content-Type**: `text/html; charset=utf-8`

**Cache-Control**: `no-cache, no-store, must-revalidate`

**Key Features**:
- Comprehensive SEO meta tags (Open Graph, Twitter Card, etc.)
- Styled article content with preview banner
- SEO debug information table
- Mobile-responsive design
- Links to Yoast SEO Checker for validation

**HTML Page Structure**:
1. Sticky preview banner with Yoast SEO Checker link
2. Header with title, author, and publication date
3. Featured image (if available)
4. Rendered HTML content with proper typography
5. SEO debug panel showing metrics
6. Footer

**SEO Meta Tags Included**:
- Primary: title, description, keywords, author
- Open Graph: og:type, og:title, og:description, og:image, article:* tags
- Twitter Card: twitter:card, twitter:title, twitter:description, twitter:image
- Canonical URL: Self-referencing for SEO testing

**SEO Debug Panel Shows**:
- Title length (with character count)
- Description length (with character count)
- Primary keyword
- Author name
- Featured image presence
- Word count (HTML stripped)

**Database Access**:
Queries `blogger_blogs` table with join to `blogger_personas`:
```sql
SELECT
  id, title, content, meta_title, meta_description,
  featured_image_url, featured_image_alt, primary_keyword,
  created_at, updated_at,
  persona:blogger_personas(name, role)
FROM blogger_blogs
WHERE id = :blog_id
```

**Validation**:
- Blog ID must be valid UUID format
- Returns user-friendly error pages for all error conditions

**Use Cases**:
- SEO testing before publishing to Shopify
- Content preview with actual styling
- Yoast SEO analysis integration
- Social media preview testing
- Mobile responsiveness checking

**Workflow Integration**:
1. Create blog in database
2. Open preview URL in browser
3. Test with Yoast SEO Checker (click link in banner)
4. Update blog based on feedback
5. Re-preview (same URL, fresh data)
6. Push to Shopify when satisfied

**Related Documentation**: `g:\Projects\mcgrocer-project\ai-dashboard\supabase\functions\blog-preview\README.md`

---

## Workflow Diagrams

### Blog Creation Workflow

```
1. User creates blog in Blogger dashboard
   ↓
2. [shopify-blogs] - Get list of available blogs
   ↓
3. User selects blog and generates content
   ↓
4. [shopify-product-search] - Find products to link (optional)
   ↓
5. [shopify-blog-articles] - Find related articles for internal links
   ↓
6. [blog-preview] - Preview with SEO testing
   ↓
7. [shopify-push-blog POST] - Create draft article in Shopify
   ↓
8. [shopify-published-blogs] - Verify draft creation
   ↓
9. Manual publish in Shopify admin or future auto-publish
```

### Blog Update Workflow

```
1. [shopify-published-blogs] - List draft articles
   ↓
2. User selects article to edit
   ↓
3. User makes changes in dashboard
   ↓
4. [blog-preview] - Preview updated content
   ↓
5. [shopify-push-blog PUT] - Update existing article
   ↓
6. [blog-preview] - Final preview before publish
```

### Blog Deletion Workflow

```
1. [shopify-published-blogs] - List articles
   ↓
2. User selects article to delete
   ↓
3. [shopify-push-blog DELETE] - Remove from Shopify
   ↓
4. Confirmation and cleanup
```

## ID Format Reference

### GraphQL Global IDs (GIDs)
Used by GraphQL mutations and queries:
- Blog: `gid://shopify/Blog/74558931119`
- Article: `gid://shopify/Article/550839717903`

**When to use**:
- `shopify-push-blog` POST (blogId parameter)
- All GraphQL query responses

### Numeric IDs
Used by REST API and updates:
- Blog: `74558931119`
- Article: `550839717903`

**When to use**:
- `shopify-push-blog` PUT/DELETE (articleId parameter)
- `shopify-published-blogs` query parameter (blog_id)

### Conversion
Extract numeric ID from GID:
```javascript
const numericId = gid.split('/').pop();
// "gid://shopify/Article/550839717903" → "550839717903"
```

Build GID from numeric ID:
```javascript
const gid = `gid://shopify/Article/${numericId}`;
// "550839717903" → "gid://shopify/Article/550839717903"
```

## Environment Variables

### Required for All Shopify Functions (except shopify-product-search)
```
SHOPIFY_API_KEY=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to obtain**:
1. Log into Shopify admin
2. Go to Settings → Apps and sales channels
3. Develop apps → Create an app
4. Configure Admin API scopes:
   - `read_articles`
   - `write_articles`
   - `read_blogs`
   - `write_blogs`
5. Install app and copy Admin API access token

### Required for blog-preview
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Error Handling

All functions follow consistent error response format:

### Standard Error Response
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### GraphQL Error Response
```json
{
  "error": "GraphQL errors",
  "details": [
    {
      "message": "Field 'blogs' doesn't exist",
      "locations": [{ "line": 2, "column": 3 }]
    }
  ]
}
```

### Validation Error Response
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

## Testing

### cURL Examples

**List blogs**:
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/shopify-blogs?limit=10"
```

**Search articles**:
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/shopify-blog-articles?topic=coffee&limit=5"
```

**Search products** (no auth):
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/shopify-product-search?q=coffee"
```

**List drafts**:
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/shopify-published-blogs?limit=20"
```

**Create article**:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/shopify-push-blog" \
  -H "Content-Type: application/json" \
  -d '{
    "blogId": "gid://shopify/Blog/74558931119",
    "title": "Test Article",
    "content": "<p>Test content</p>",
    "tags": ["test"]
  }'
```

**Preview blog**:
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/blog-preview/a1b2c3d4-5678-90ab-cdef-1234567890ab"
```

## SEO Best Practices

### Meta Title
- Length: 50-60 characters (optimal)
- Include primary keyword
- Add brand name at end
- Example: `Perfect Coffee Brewing Guide - McGrocer`

### Meta Description
- Length: 140-160 characters (optimal)
- Compelling call-to-action
- Include primary keyword naturally
- Example: `Discover professional coffee brewing techniques, from bean selection to water temperature. Expert tips for home baristas.`

### Content Structure
- Single H1 (article title)
- H2 for main sections
- H3 for subsections
- Proper paragraph spacing
- Lists for scanability
- Internal links to related articles
- External links to products

### Image Optimization
- Always include alt text
- Use descriptive file names
- Proper image dimensions
- CDN-hosted images preferred
- Featured image recommended

## Troubleshooting

### Common Issues

**"SHOPIFY_API_KEY environment variable not set"**
- Ensure environment variable is set in Supabase Edge Function settings
- Verify variable name matches exactly

**"GraphQL errors" or "Field doesn't exist"**
- Check API version compatibility (currently 2024-10)
- Verify field names in GraphQL query
- Check Shopify API changelog for breaking changes

**"Validation errors: Title can't be blank"**
- Ensure all required fields are provided
- Check for empty strings (not just null)
- Verify content is properly formatted HTML

**"Blog Not Found" in preview**
- Verify blog ID is correct UUID format
- Check blog exists in `blogger_blogs` table
- Ensure database connection is working

**Duplicate blog creation**
- Recent fix in commit 9abbadb addresses this
- Use PUT to update, not POST
- Check for existing article before creating

## Performance Considerations

### Rate Limiting
Shopify Admin API has rate limits:
- GraphQL: Cost-based (varies by query complexity)
- REST: 2 requests/second (leaky bucket algorithm)

**Recommendations**:
- Cache blog lists (rarely change)
- Batch operations when possible
- Implement exponential backoff on rate limit errors

### Optimization Tips
- Use GraphQL for multiple resources (single request)
- Limit query fields to only what's needed
- Use REST API `published_status` filter for drafts
- Cache product search results (doesn't require auth)

## Related Features

### Blogger Feature Integration
These Edge Functions power the Blogger feature:
- **BlogWizard.tsx**: Uses all 6 functions in 9-step workflow
- **BloggerDashboardPage.tsx**: Lists drafts via `shopify-published-blogs`
- **ProductSelector.tsx**: Searches products via `shopify-product-search`
- **SeoOptimizer.tsx**: Previews via `blog-preview`

### Database Tables
- `blogger_blogs` - Main blog storage
- `blogger_personas` - Writer personas
- `blogger_templates` - Blog templates
- `blogger_keywords` - Cached keyword research
- `blogger_blog_products` - Product links

## Future Enhancements

Potential improvements:
1. Auto-publish support (set `publishedAt` to schedule)
2. Bulk article operations (create/update multiple)
3. Image upload to Shopify CDN
4. Rich text editor integration
5. SEO score calculation (client-side)
6. A/B testing meta tags
7. Analytics integration

## Additional Resources

- Shopify GraphQL Admin API: https://shopify.dev/docs/api/admin-graphql
- Shopify REST Admin API: https://shopify.dev/docs/api/admin-rest
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Yoast SEO Checker: https://yoast.com/tools/seo-checker/

## Support

For issues or questions:
1. Check individual function README files for detailed documentation
2. Review recent git commits for bug fixes
3. Verify environment variables are correctly set
4. Test with cURL to isolate issues
5. Check Supabase Edge Function logs for errors
