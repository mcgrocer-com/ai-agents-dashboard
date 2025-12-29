# Price Comparison

Advanced product price comparison function that searches across multiple UK retailers using Serper Search API, AI verification with Gemini, and availability checking. Results are cached with TTL to reduce API costs.

## Endpoint

`POST /functions/v1/price-comparison`

## Authentication

No authentication required for the function itself, but it requires environment variables to be configured in Supabase Edge Functions.

## Request Body

```json
{
  "query": "Johnson's Baby Oil 300ml",
  "limit": 5,
  "bypass_cache": false
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Product search query |
| limit | number | No | 5 | Maximum number of results to return |
| bypass_cache | boolean | No | false | Skip cache lookup and force fresh search |

## Response

### Success (200)

```json
{
  "success": true,
  "products": [
    {
      "product_name": "Johnson's Baby Oil 300ml",
      "price": 3.49,
      "currency": "GBP",
      "source_url": "https://www.boots.com/johnsons-baby-oil-300ml-10001533",
      "vendor": "Boots",
      "confidence": 0.9
    },
    {
      "product_name": "Johnson's Baby Oil 300ml",
      "price": 3.75,
      "currency": "GBP",
      "source_url": "https://www.superdrug.com/baby/baby-skincare/baby-oil/johnsons-baby-oil-300ml",
      "vendor": "Superdrug",
      "confidence": 0.9
    }
  ],
  "metadata": {
    "query": "Johnson's Baby Oil 300ml",
    "limit": 5,
    "results_count": 2,
    "execution_time": 2.345,
    "method": "parallel-vendor-search-v15",
    "timestamp": "2025-12-18T10:30:00.000Z",
    "cache_hit": false
  },
  "debug": {
    "priority_results": 8,
    "after_dedup": 6,
    "fallback_results": 0,
    "after_fallback": 6,
    "before_ai": 6,
    "after_ai": 4,
    "suspicious_count": 1,
    "after_verification": 2,
    "vendors_before_ai": ["Boots: £3.49", "Superdrug: £3.75", ...]
  }
}
```

### Cache Hit Response (200)

```json
{
  "success": true,
  "products": [...],
  "metadata": {
    "query": "Johnson's Baby Oil 300ml",
    "limit": 5,
    "results_count": 2,
    "execution_time": 0.045,
    "method": "parallel-vendor-search-v15",
    "timestamp": "2025-12-18T10:25:00.000Z",
    "cache_hit": true,
    "cache_age_seconds": 120
  },
  "debug": {
    "cache_hit": true,
    "hit_count": 3
  }
}
```

### Error Responses

- **400**: Bad Request - Missing or invalid query parameter
- **405**: Method Not Allowed - Only POST requests accepted
- **500**: Internal Server Error - API keys not configured or search failed

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | Yes | Google Gemini API key for AI verification |
| SERPER_API_KEY | Yes | Serper Search API key for product search and scraping |
| SUPABASE_URL | Yes | Supabase project URL for caching |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key for database access |

## Examples

### cURL - Basic Search

```bash
curl -X POST https://your-project.supabase.co/functions/v1/price-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Johnson'\''s Baby Oil 300ml",
    "limit": 5
  }'
```

### cURL - Bypass Cache

```bash
curl -X POST https://your-project.supabase.co/functions/v1/price-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Kendamil Organic Infant Formula",
    "limit": 10,
    "bypass_cache": true
  }'
```

### JavaScript - With Fetch

```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/price-comparison', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Johnson\'s Baby Oil 300ml',
    limit: 5
  })
});

const data = await response.json();
console.log('Best price:', data.products[0]);
```

## Priority Vendors

The function searches these vendors first (17 priority UK retailers):

- Aptamil (aptaclub.co.uk)
- Argos (argos.co.uk)
- ASDA (asda.com)
- Boots (boots.com)
- Costco UK (costco.co.uk)
- Harrods (harrods.com)
- Holland & Barrett (hollandandbarrett.com)
- John Lewis (johnlewis.com)
- Kendamil (kendamil.com)
- Lidl (lidl.co.uk)
- Lush (lush.com)
- McGrocer Direct (mcgrocer.com)
- M&S (marksandspencer.com)
- Ocado (ocado.com)
- Orientalmart (orientalmart.co.uk)
- Sainsbury's (sainsburys.co.uk)
- Superdrug (superdrug.com)

If priority vendors don't return enough results, the function performs a broader UK market search.

## Algorithm Flow

1. **Parallel Vendor Search**: Searches all 17 priority vendors simultaneously using query format: `"{product} {vendor} product page"`

2. **Deduplication**: Removes duplicate results from the same vendor, keeping the best match

3. **Category Page Filtering**: Automatically filters out category/listing pages, ensuring only product pages are returned

4. **AI Verification**: Uses Gemini 2.0 Flash Lite to:
   - Verify products match the user query
   - Remove incorrect variants or accessories
   - Mark suspicious prices (unrealistically low, extracted from shipping text, etc.)
   - Calculate confidence scores (0.7-0.9)
   - Sort by price

5. **Availability Checking**: For products marked as suspicious:
   - Scrapes product pages using Serper Scrape API
   - Extracts JSON-LD structured data
   - Validates availability status
   - Updates actual prices if available
   - Removes discontinued/out-of-stock products

6. **Fallback Search**: If verified results are below the limit:
   - Performs broader UK market search
   - Applies same AI verification and availability checking
   - Adds unique vendors to results

7. **Caching**: Stores results in `price_comparison_cache` table:
   - Cache key: normalized query + limit
   - TTL: 2 hours (configurable)
   - Tracks hit count for monitoring

## Category Page Detection

The function automatically filters out these category page patterns:

- `/c/` (Superdrug category pages)
- `/category/`, `/categories/`
- `/browse/`
- `/shop/` (except `/shop/product/`)
- `/s?`, `/s/` (search results)
- `/search`
- `/collection/`, `/collections/`
- Amazon node IDs without product ASINs

## Caching

### Cache Key

Queries are normalized for cache lookup:
- Lowercase
- Trimmed
- Collapsed whitespace
- Combined with limit parameter

Example: `"Johnson's  Baby Oil"` → `"johnson's baby oil"`

### Cache Table Schema

Stored in `price_comparison_cache` table:

```typescript
{
  query_normalized: string,    // Normalized query (cache key)
  query_original: string,       // Original user query
  limit_requested: number,      // Results limit
  results: ProductResult[],     // Cached results
  metadata: object,             // Metadata (execution time, timestamp, etc.)
  expires_at: timestamp,        // Expiration timestamp
  hit_count: number,            // Number of cache hits
  created_at: timestamp,        // Cache creation time
  updated_at: timestamp         // Last update time
}
```

### Cache TTL

Default: **2 hours** (`DEFAULT_CACHE_TTL_HOURS`)

## Debug Information

The `debug` object provides insights into the search process:

| Field | Description |
|-------|-------------|
| priority_results | Number of results from priority vendors |
| after_dedup | Results after vendor deduplication |
| fallback_results | Results from fallback search |
| after_fallback | Total results after fallback |
| before_ai | Results before AI verification |
| after_ai | Results after AI verification |
| suspicious_count | Number of products marked suspicious |
| after_verification | Results after availability checking |
| vendors_before_ai | List of vendors with prices before AI |

## Product Result Fields

| Field | Type | Description |
|-------|------|-------------|
| product_name | string | Product title/name |
| price | number | Price as a number (not string) |
| currency | string | Currency code (always "GBP") |
| source_url | string | Product page URL |
| vendor | string | Vendor/retailer name |
| confidence | number | AI confidence score (0.7-0.9) |

## Performance

- **Cold search**: 2-5 seconds (no cache)
- **Cache hit**: 30-100ms
- **API calls per search**:
  - Priority vendors: 17 parallel Serper searches
  - AI verification: 1 Gemini call
  - Suspicious verification: 1-5 Serper scrape calls
  - Fallback: 1 additional Serper search (if needed)

## Related Functions

- **check-api-key-health**: Tests Serper and Gemini API keys
- **decodo-proxy**: Alternative scraping solution
- **fetch-vendor-products**: Fetches products from internal database

## Notes

- All searches are configured for UK market (`gl: 'gb'`, `google.co.uk`)
- Suspicious prices are automatically verified to prevent false positives
- Cache reduces API costs and improves response times
- Results are sorted by price (lowest first)
- CORS is enabled for all origins
- Function uses Gemini 2.0 Flash Lite for cost-effective AI verification
- Category pages are filtered out to ensure only product pages are returned
