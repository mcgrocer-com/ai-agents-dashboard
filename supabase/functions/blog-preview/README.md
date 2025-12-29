# Blog Preview

## Overview
Generates an SEO-optimized HTML preview of a blog post from the blogger_blogs table. Renders a fully-styled page with comprehensive Open Graph, Twitter Card, and structured meta tags for SEO testing with tools like Yoast SEO Checker.

## Endpoint
- **URL**: `/blog-preview/{blog-id}`
- **Method**: `GET`
- **Authentication**: None (verify_jwt is FALSE)

## Request

### URL Parameters
- `blog-id` (required): UUID of the blog post in blogger_blogs table

### Headers
None required.

### Example URLs
```
GET /blog-preview/a1b2c3d4-5678-90ab-cdef-1234567890ab
GET https://your-project.supabase.co/functions/v1/blog-preview/a1b2c3d4-5678-90ab-cdef-1234567890ab
```

## Response

### Success Response (200 OK)
Returns HTML page with:
- Comprehensive SEO meta tags (Open Graph, Twitter Card)
- Styled blog content with article structure
- SEO debug panel showing meta data details
- Preview banner with link to Yoast SEO Checker

#### Content-Type
```
text/html; charset=utf-8
```

#### Cache-Control
```
no-cache, no-store, must-revalidate
```

### Error Responses

#### 400 Bad Request - Missing Blog ID
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Blog ID Required</h1>
    <p>Please provide a blog ID in the URL: /blog-preview/{blog-id}</p>
  </body>
</html>
```

#### 400 Bad Request - Invalid UUID Format
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Invalid Blog ID</h1>
    <p>The provided blog ID is not a valid UUID format</p>
  </body>
</html>
```

#### 404 Not Found - Blog Not Found
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Blog Not Found</h1>
    <p>No blog found with ID: {blog-id}</p>
  </body>
</html>
```

#### 405 Method Not Allowed
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Method Not Allowed</h1>
    <p>Only GET requests are supported</p>
  </body>
</html>
```

#### 500 Internal Server Error
```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Server Error</h1>
    <p>{error message}</p>
  </body>
</html>
```

## Environment Variables
- `SUPABASE_URL` (required): Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (required): Service role key for database access

## Database Tables

### blogger_blogs (reads)
Fetches the following fields:
- `id`: Blog UUID
- `title`: Blog title
- `content`: HTML content of the blog post
- `meta_title`: SEO meta title (50-60 chars recommended)
- `meta_description`: SEO meta description (140-160 chars recommended)
- `featured_image_url`: URL of featured image (nullable)
- `featured_image_alt`: Alt text for featured image (nullable)
- `primary_keyword`: Primary SEO keyword (nullable)
- `created_at`: Publication timestamp
- `updated_at`: Last modified timestamp
- `persona`: Join to blogger_personas table

### blogger_personas (joins)
Fetches persona information:
- `name`: Author name (e.g., "Sarah Mitchell")
- `role`: Author role (e.g., "Technical Expert")

## HTML Page Structure

### Meta Tags
**Primary Meta Tags:**
- `<title>`: Meta title or fallback to title
- `<meta name="title">`: Same as title
- `<meta name="description">`: Meta description (or truncated content)
- `<meta name="keywords">`: Primary keyword (if set)
- `<meta name="author">`: Persona name or "McGrocer"

**Open Graph (Facebook):**
- `og:type`: "article"
- `og:title`: Meta title
- `og:description`: Meta description
- `og:image`: Featured image URL
- `og:site_name`: "McGrocer"
- `og:locale`: "en_GB"
- `og:url`: Canonical URL
- `article:published_time`: ISO 8601 timestamp
- `article:modified_time`: ISO 8601 timestamp
- `article:author`: Persona name

**Twitter Card:**
- `twitter:card`: "summary_large_image"
- `twitter:title`: Meta title
- `twitter:description`: Meta description
- `twitter:image`: Featured image URL
- `twitter:image:alt`: Featured image alt text

**Canonical URL:**
Self-referencing canonical URL pattern:
```
{SUPABASE_URL}/functions/v1/blog-preview/{blog-id}
```

### Page Layout
1. **Preview Banner**: Sticky purple gradient banner with link to Yoast SEO Checker
2. **Header**: Blog title, author, and publication date
3. **Featured Image**: Full-width responsive image (if available)
4. **Article Content**: Rendered HTML content with typography styles
5. **SEO Debug Panel**: Table showing meta data for testing
6. **Footer**: Simple footer text

### Styling
- Typography: System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- Line height: 1.7 for readability
- Color scheme: Slate grays (#0f172a, #334155, #64748b)
- Max content width: 800px
- Responsive: Mobile-first design
- Featured image: Max height 500px, object-fit: cover

### SEO Debug Panel
Shows real-time validation metrics:
- Title length (character count)
- Description length (character count)
- Primary keyword (or "Not set")
- Author name
- Featured image presence (Yes/No)
- Word count (calculated from stripped HTML)

## Helper Functions

### escapeHtml()
Escapes HTML entities for safe rendering:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#039;`

### stripHtml()
Removes HTML tags and normalizes whitespace for meta descriptions and word counts.

## CORS Support
Allows cross-origin requests from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Example Usage

### Direct Browser Access
```
https://your-project.supabase.co/functions/v1/blog-preview/a1b2c3d4-5678-90ab-cdef-1234567890ab
```

### cURL Request
```bash
curl https://your-project.supabase.co/functions/v1/blog-preview/a1b2c3d4-5678-90ab-cdef-1234567890ab
```

### JavaScript Fetch
```javascript
const blogId = 'a1b2c3d4-5678-90ab-cdef-1234567890ab';
const previewUrl = `https://your-project.supabase.co/functions/v1/blog-preview/${blogId}`;

// Open in new window
window.open(previewUrl, '_blank');

// Or fetch HTML
const response = await fetch(previewUrl);
const html = await response.text();
```

## SEO Testing Workflow
1. Generate blog post in Blogger dashboard
2. Copy blog preview URL from dashboard
3. Open preview in browser
4. Click "Yoast SEO Checker" link in banner
5. Paste preview URL into Yoast tool
6. Analyze SEO score and recommendations
7. Return to dashboard to adjust meta tags
8. Refresh preview to see changes

## Notes
- Preview pages are NOT cached (Cache-Control: no-cache)
- Always fetches latest blog data from database
- Generates self-referencing canonical URL for SEO testing
- Featured images are optional - layout adapts gracefully
- Word count excludes HTML tags for accurate content metrics
- Persona defaults to "McGrocer" if not set
- All timestamps use ISO 8601 format for structured data
