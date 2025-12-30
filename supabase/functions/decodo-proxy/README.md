# Decodo Proxy

Proxy function for the Decodo scraping and web unblocker API. Supports web scraping, Google Search SERP data, Google Suggest keyword research, and image proxying with Base64 encoding.

## Endpoint

`POST /functions/v1/decodo-proxy`

## Authentication

Uses Basic Authentication with Decodo credentials configured via environment variables. No additional authentication required from clients.

## Request Body

### Web Scraping Mode

```json
{
  "url": "https://example.com/product-page",
  "headless": "html",
  "device_type": "desktop"
}
```

### Google Search SERP Mode

```json
{
  "target": "google_search",
  "query": "baby oil products",
  "parse": true,
  "google_tbs": "qdr:w"
}
```

### Google Suggest (Keyword Research) Mode

```json
{
  "target": "google_suggest",
  "query": "baby oil",
  "parse": false
}
```

### Image Proxy Mode

```json
{
  "proxy_image": true,
  "url": "https://example.com/image.jpg"
}
```

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Conditional | Target URL for web scraping or image proxy |
| target | string | No | Target type: `google_search` or `google_suggest` |
| query | string | Conditional | Search query for SERP or keyword research |
| headless | string | No | Rendering mode: `html` (default) or `browser` |
| device_type | string | No | Device type: `desktop` (default) or `mobile` |
| parse | boolean | No | Whether to parse results (default: true for SERP, false for keywords) |
| google_tbs | string | No | Date filter: `qdr:h` (hour), `qdr:d` (day), `qdr:w` (week), `qdr:m` (month), `qdr:y` (year) |
| proxy_image | boolean | No | Enable image proxy mode |

## Response

### Web Scraping Success (200)

```json
{
  "html": "<html>...</html>",
  "success": true
}
```

### Google Search SERP Success (200)

When `parse: true`:
```json
{
  "results": {
    "organic": [
      {
        "pos": 1,
        "url": "https://example.com/page",
        "title": "Page Title",
        "desc": "Page description from search results..."
      }
    ],
    "paid": [...],
    "knowledge_graph": {...},
    "related_searches": [...]
  },
  "parse": true
}
```

### Google Suggest (Keyword Research) Success (200)

When `parse: false` (default for keyword research):
```json
{
  "results": [
    {
      "content": "[[\"baby oil\",[\"baby oil\",\"baby oil for skin\",\"baby oil for hair\",\"baby oil uses\",\"baby oil for adults\"],[],{\"google:suggestsubtypes\":[[],[],[],[],[]]},{\"google:suggestrelevance\":[1250,601,600,554,553]}]]"
    }
  ]
}
```

**Response Structure Breakdown:**

The `content` field contains a JSON array with this structure:
```javascript
[
  "original query",           // [0] - The search query
  ["suggestion1", "..."],     // [1] - Array of keyword suggestions (up to 10)
  [],                         // [2] - Empty (descriptions, not used)
  { "google:suggestsubtypes": [...] },  // [3] - Suggestion metadata
  { "google:suggestrelevance": [...] }  // [4] - RELEVANCE SCORES (0-1250)
]
```

**Extracting Keywords with Relevance Scores:**
```javascript
const data = JSON.parse(response.results[0].content);
const keywords = data[0][1];           // Array of keyword suggestions
const relevanceScores = data[0][4]?.['google:suggestrelevance'] || [];

// Map keywords with their relevance scores
const keywordsWithScores = keywords.map((keyword, index) => ({
  keyword,
  relevance: relevanceScores[index] || 0,  // Score 0-1250 (higher = more relevant)
  // Convert to difficulty: higher relevance = lower difficulty
  difficulty: Math.round(100 - (relevanceScores[index] / 12.5))
}));

// Example output:
// [
//   { keyword: "baby oil", relevance: 1250, difficulty: 0 },
//   { keyword: "baby oil for skin", relevance: 601, difficulty: 52 },
//   { keyword: "baby oil for hair", relevance: 600, difficulty: 52 }
// ]
```

**Relevance Score Interpretation:**
| Score Range | Meaning | Difficulty |
|-------------|---------|------------|
| 1000-1250 | Very high relevance (trending/popular) | Low (0-20) |
| 600-999 | High relevance | Medium (20-50) |
| 300-599 | Moderate relevance | Medium-High (50-75) |
| 0-299 | Lower relevance | High (75-100) |

When `parse: true`:
```json
{
  "results": {
    "suggestions": [
      "baby oil",
      "baby oil for skin",
      "baby oil for hair",
      "baby oil uses"
    ]
  },
  "parse": true
}
```

### Image Proxy Success (200)

```json
{
  "success": true,
  "mimeType": "image/jpeg",
  "data": "base64-encoded-image-data",
  "size": 123456
}
```

### Error Responses

- **400**: Bad Request - Invalid parameters or non-image content type
- **500**: Internal Server Error - Decodo API error or proxy failure
- **502/503**: Gateway Error - Upstream service issues (automatically retried)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DECODO_USERNAME | Yes | Decodo API username |
| DECODO_PASSWORD | Yes | Decodo API password |

## Examples

### cURL - Web Scraping

```bash
curl -X POST https://your-project.supabase.co/functions/v1/decodo-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.boots.com/johnsons-baby-oil-300ml-10001533",
    "headless": "html",
    "device_type": "desktop"
  }'
```

### cURL - Google Search SERP

```bash
curl -X POST https://your-project.supabase.co/functions/v1/decodo-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "target": "google_search",
    "query": "baby oil boots",
    "parse": true,
    "google_tbs": "qdr:w"
  }'
```

### cURL - Google Suggest Keywords

```bash
curl -X POST https://your-project.supabase.co/functions/v1/decodo-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "target": "google_suggest",
    "query": "baby oil",
    "parse": false
  }'
```

### cURL - Image Proxy

```bash
curl -X POST https://your-project.supabase.co/functions/v1/decodo-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "proxy_image": true,
    "url": "https://example.com/product-image.jpg"
  }'
```

## Features

### Retry Logic

- Automatically retries failed requests up to 2 times
- Uses exponential backoff (1s, 2s)
- Retries on 502/503 gateway errors
- Retries on fetch exceptions

### Image Proxy

- Fetches images with proper user agent and referer headers
- Validates content type is an image
- Converts to Base64 in 32KB chunks to avoid call stack overflow
- Returns mime type and file size metadata

### Google Search Configuration

- Geo-location: UK (`gl: 'uk'`)
- Google domain: `google.co.uk`
- Host language: English (`hl: 'en'`)
- Supports date filtering via `google_tbs` parameter

## Response Structure

### Web Scraping

The function extracts HTML from Decodo's nested JSON response:
```javascript
data.results[0].content  // HTML string
```

If results array is missing or empty, falls back to raw response.

### Google Search SERP

Returns parsed search results with organic listings, paid ads, knowledge graph, and related searches when `parse: true`.

### Google Suggest (Keyword Research)

- `parse: false` (default): Returns raw Google autocomplete response with relevance scores
- `parse: true`: Returns parsed `suggestions` array directly (without scores)

**Response array structure** (when `parse: false`):
- `[0]` - Original query string
- `[1]` - Keyword suggestions array (up to 10)
- `[2]` - Empty descriptions array
- `[3]` - Suggestion subtypes metadata
- `[4]` - **`google:suggestrelevance`** - Relevance scores (0-1250)

**Extracting keywords with scores:**
```javascript
const parsed = JSON.parse(response.results[0].content);
const keywords = parsed[0][1];  // ["baby oil", "baby oil for skin", ...]
const scores = parsed[0][4]?.['google:suggestrelevance'] || [];  // [1250, 601, 600, ...]
```

See [ai.service.ts](../../src/services/blogger/ai.service.ts) `researchKeywords()` for implementation example.

### Image Proxy

Returns Base64-encoded image data with metadata:
- `mimeType`: Image content type (e.g., `image/jpeg`)
- `data`: Base64-encoded image data
- `size`: File size in bytes

## Retry Sequence

```
Attempt 1: Immediate
Attempt 2: After 1000ms delay
Attempt 3: After 2000ms delay
```

## Decodo API Integration

### API Endpoint
```
https://scraper-api.decodo.com/v2/scrape
```

### Authentication
Basic Authentication using base64-encoded credentials:
```
Authorization: Basic {base64(username:password)}
```

## CORS Support

Allows cross-origin requests from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Logging

Console logs for debugging:
- `[Decodo Proxy] Proxying image: {url}`
- `[Decodo Proxy] Image proxied: {size}KB`
- `[Decodo Proxy] Image fetch failed: {status}`
- `[Decodo Proxy] Request: {target} - {query/url}`
- `[Decodo Proxy] Making request with body: {json}`
- `[Decodo Proxy] Scrape response received`
- `[Decodo Proxy] Extracted HTML from results[0].content: {bytes} bytes`
- `[Decodo Proxy] Got {status}, retrying in {delay}ms`
- `[Decodo Proxy] Error: {status} - {details}`

## Related Functions

- **check-api-key-health**: Tests Decodo API credentials
- **price-comparison**: May use Decodo for scraping product pages
- **Blogger feature**: Could use Google Suggest for keyword research

## Notes

- Decodo credentials are stored securely in environment variables
- Image proxy prevents CORS issues when loading images from external sources
- The function handles chunked Base64 encoding for large images
- Retry logic helps handle transient network issues
- Google Search is configured for UK market by default
- Maximum retries: 2 (total 3 attempts)
- Base delay: 1000ms with exponential backoff
