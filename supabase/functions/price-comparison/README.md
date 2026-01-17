# Price Comparison

Advanced product price comparison function that searches across multiple UK retailers using Serper Search API, AI verification with Gemini, and availability checking. Results are cached with TTL to reduce API costs.

**Current Version:** v24

## Endpoint

`POST /functions/v1/price-comparison`

## Authentication

No authentication required for the function itself, but it requires environment variables to be configured in Supabase Edge Functions.

## Request Body

```json
{
  "query": "PlayStation 5",
  "description": "Sony PlayStation 5 Console Disc Edition CFI-1215A",
  "limit": 5,
  "bypass_cache": false
}
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Product name to search |
| description | string | No | "" | Additional details for AI matching (model numbers, variants, sizes) |
| limit | number | No | 5 | Maximum number of results to return |
| bypass_cache | boolean | No | false | Skip cache lookup and force fresh search |

## Response

### Success (200)

```json
{
  "success": true,
  "products": [
    {
      "product_name": "Heinz Beanz In Tomato Sauce 415G",
      "price": 1.40,
      "currency": "GBP",
      "source_url": "https://www.tesco.com/groceries/en-GB/products/252261477",
      "vendor": "Tesco",
      "confidence": 0.9,
      "availability": "In Stock"
    },
    {
      "product_name": "Heinz Baked Beans",
      "price": 1.40,
      "currency": "GBP",
      "source_url": "https://www.waitrose.com/ecom/products/heinz-baked-beans/019025-9181-9182",
      "vendor": "Waitrose",
      "confidence": 0.9,
      "availability": "Unsure"
    }
  ],
  "metadata": {
    "query": "Heinz Baked Beans",
    "description": "Heinz Baked Beans in Tomato Sauce 415g tin",
    "limit": 5,
    "results_count": 2,
    "execution_time": 42.03,
    "method": "comprehensive-blocklist-v22",
    "timestamp": "2026-01-01T10:30:00.000Z",
    "cache_hit": false,
    "used_fallback_key": false
  },
  "debug": {
    "priority_results": 30,
    "after_dedup": 12,
    "scraped_count": 12,
    "with_json_ld": 10,
    "before_ai": 12,
    "after_ai": 6,
    "filtered_low_confidence": 1,
    "fallback_results": 0,
    "vendors_before_ai": ["Tesco: £1.4", "Waitrose: £1.4", "Morrisons: £2.75", ...]
  }
}
```

### Cache Hit Response (200)

```json
{
  "success": true,
  "products": [...],
  "metadata": {
    "query": "Heinz Baked Beans",
    "description": null,
    "limit": 5,
    "results_count": 5,
    "execution_time": 0.045,
    "method": "comprehensive-blocklist-v22",
    "timestamp": "2026-01-01T10:25:00.000Z",
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

## Product Result Fields

| Field | Type | Description |
|-------|------|-------------|
| product_name | string | Product title/name from JSON-LD or search |
| price | number | Price as a number (not string) |
| currency | string | Currency code (always "GBP") |
| source_url | string | Product page URL |
| vendor | string | Vendor/retailer name |
| confidence | number | AI confidence score (0.7-0.9) |
| availability | string | Stock status: "In Stock", "Out of Stock", or "Unsure" |

## Availability Detection

Availability is extracted from JSON-LD schema data with a fallback mechanism:

1. **AI extraction** (primary) - AI reads JSON-LD and returns availability
2. **JSON-LD fallback** (secondary) - If AI fails, directly parse `offers.availability`
3. **Default** - If both fail, return "Unsure"

| JSON-LD Value | Maps To |
|---------------|---------|
| `InStock`, `in_stock`, `https://schema.org/InStock` | In Stock |
| `PreOrder`, `BackOrder`, `LimitedAvailability` | In Stock |
| `OutOfStock`, `out_of_stock`, `SoldOut` | Out of Stock |
| `Discontinued` | Out of Stock |
| Missing/unclear | Unsure |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | Yes | Google Gemini API key for AI verification |
| SERPER_API_KEY_PRICE_COMPARISON | Yes* | Primary Serper API key for price comparison |
| SERPER_API_KEY | Yes* | Fallback Serper API key (used when primary is exhausted) |
| SUPABASE_URL | Yes | Supabase project URL for caching |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key for database access |

*At least one Serper key is required. If both are configured, the function automatically falls back to the secondary key when the primary is exhausted.

## Serper API Key Fallback

The function supports automatic failover between Serper API keys:

1. Attempts search with `SERPER_API_KEY_PRICE_COMPARISON` (primary)
2. If primary returns "Not enough credits" error, switches to `SERPER_API_KEY` (fallback)
3. Response metadata includes `used_fallback_key: true` when fallback was used

## Examples

### cURL - Basic Search

```bash
curl -X POST https://your-project.supabase.co/functions/v1/price-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "query": "PlayStation 5",
    "limit": 5
  }'
```

### cURL - With Description (Recommended)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/price-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "query": "PlayStation 5",
    "description": "Sony PlayStation 5 Console Disc Edition CFI-1215A",
    "limit": 5
  }'
```

### cURL - Bypass Cache

```bash
curl -X POST https://your-project.supabase.co/functions/v1/price-comparison \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Heinz Baked Beans",
    "description": "Heinz Baked Beans in Tomato Sauce 415g tin",
    "limit": 5,
    "bypass_cache": true
  }'
```

### JavaScript - With Supabase Client

```javascript
const { data, error } = await supabase.functions.invoke('price-comparison', {
  body: {
    query: 'PlayStation 5',
    description: 'Sony PlayStation 5 Console Disc Edition',
    limit: 5
  }
});

if (data.success) {
  console.log('Best price:', data.products[0]);
  console.log('Availability:', data.products[0].availability);
}
```

## Priority Vendors

The function searches these 25 priority UK retailers first:

| Vendor | Domain |
|--------|--------|
| Aptamil | aptaclub.co.uk |
| Argos | argos.co.uk |
| ASDA | asda.com |
| Boots | boots.com |
| CafePod | cafepod.com |
| Coca-Cola | coca-cola.co.uk |
| Costco UK | costco.co.uk |
| Harrods | harrods.com |
| HiPP | hipp.co.uk |
| Holland & Barrett | hollandandbarrett.com |
| Iceland | iceland.co.uk |
| John Lewis | johnlewis.com |
| Kendamil | kendamil.com |
| LEGO | lego.com |
| Lidl | lidl.co.uk |
| Lush | lush.com |
| Morrisons | morrisons.com |
| M&S | marksandspencer.com |
| Next | next.co.uk |
| Ocado | ocado.com |
| Orientalmart | orientalmart.co.uk |
| Sainsbury's | sainsburys.co.uk |
| Superdrug | superdrug.com |
| Tesco | tesco.com |
| Waitrose | waitrose.com |

If priority vendors don't return enough results, the function performs a broader UK market search.

## Blocked Domains

The function blocks 105+ comparison sites, aggregators, and marketplaces to ensure only direct retailer results are returned. Categories include:

- **Price comparison sites**: PriceRunner, PriceSpy, Idealo, Google Shopping, etc.
- **Deal/voucher sites**: HotUKDeals, VoucherCodes, Groupon, etc.
- **Cashback sites**: TopCashback, Quidco, etc.
- **Marketplaces**: Amazon, eBay, OnBuy, etc.
- **Tech comparers**: TechRadar, Which?, Trusted Reviews, etc.
- **Grocery comparers**: Trolley.co.uk, MySupermarket, etc.

See `blocked-domains.ts` for the full list.

## Algorithm Flow

1. **Parallel Vendor Search**: Searches all 26 priority vendors simultaneously using query format: `"{product} {vendor} product page"`

2. **Deduplication**: Removes duplicate results from the same vendor, keeping the best match

3. **Domain Filtering**: Removes results from blocked comparison/marketplace sites

4. **Scraping**: Scrapes all results to extract raw JSON-LD structured data

5. **AI Verification (Parallel)**: Uses Gemini 2.0 Flash Lite to verify each product independently:
   - Verifies products match the user query
   - Uses description field for precise matching (model numbers, variants)
   - Removes incorrect variants or accessories
   - Extracts actual product name and price from JSON-LD
   - Extracts availability status from JSON-LD
   - Calculates confidence scores (0.7-0.9)

6. **Confidence Filtering**: Removes products with confidence below 90%

7. **Fallback Search**: If verified results are below the limit:
   - Performs broader UK market search
   - Applies same scraping and AI verification
   - Adds unique vendors to results

8. **Sorting & Limiting**: Sorts by price (lowest first) and limits to requested count

9. **Caching**: Stores results in `price_comparison_cache` table

## URL Pattern Validation

The function uses a two-layer URL validation system to filter out category/brand pages BEFORE expensive scraping and AI calls.

### Vendor-Specific Patterns (`vendor-url-patterns.ts`)

27 vendors have defined URL patterns:

```typescript
// Example: Harrods
'harrods.com': {
  productPatterns: [/\/en-[a-z]{2}\/p\//i],      // /en-gb/p/product-name
  categoryPatterns: [/\/en-[a-z]{2}\/designers\//i]  // /en-gb/designers/brand
}
```

**Validation Logic:**
1. If URL matches a `categoryPattern` → **REJECT** (not a product page)
2. If URL matches a `productPattern` → **ACCEPT** (is a product page)
3. If no pattern matches → fall back to generic detection

### Generic Category Detection

For non-priority vendors, the function uses pattern-based detection:

- `/c/` (Superdrug category pages)
- `/category/`, `/categories/`
- `/browse/`
- `/shop/` (except `/shop/product/`)
- `/s?`, `/s/` (search results)
- `/search`
- `/collection/`, `/collections/`
- `/designers/`, `/brands/`, `/brand/`
- `/shop-by-brand/`, `/shop-by/`, `/shopping/`
- Short brand-only paths (e.g., `/paige/` with no numbers)
- Amazon node IDs without product ASINs

## Caching

### Cache Key

Queries are normalized for cache lookup:
- Lowercase
- Trimmed
- Collapsed whitespace
- Combined with limit parameter

Example: `"Johnson's  Baby Oil"` -> `"johnson's baby oil"`

### Cache Table Schema

Stored in `price_comparison_cache` table:

```typescript
{
  query_normalized: string,    // Normalized query (cache key)
  query_original: string,      // Original user query
  limit_requested: number,     // Results limit
  results: ProductResult[],    // Cached results
  metadata: object,            // Metadata (execution time, timestamp, etc.)
  expires_at: timestamp,       // Expiration timestamp
  hit_count: number,           // Number of cache hits
  created_at: timestamp,       // Cache creation time
  updated_at: timestamp        // Last update time
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
| scraped_count | Number of URLs scraped |
| with_json_ld | Results with JSON-LD data |
| before_ai | Results before AI verification |
| after_ai | Results after AI verification |
| filtered_low_confidence | Results removed for low confidence |
| fallback_results | Results from fallback search |
| vendors_before_ai | List of vendors with prices before AI |

## Performance

- **Cold search**: 10-45 seconds (depends on results count)
- **Cache hit**: 30-100ms
- **API calls per search**:
  - Priority vendors: Up to 26 parallel Serper searches
  - Scraping: 1 Serper scrape per result
  - AI verification: 1 Gemini call per result (parallel)
  - Fallback: 1 additional Serper search (if needed)

## Version History

### v24 (Current)
- Removed price requirement from broader search filter
- Broader search now scrapes ALL valid product page URLs (not just ones with Serper price data)
- Fixes issue where fashion/specialty retailers don't expose structured prices in search results
- Scraper extracts prices from JSON-LD for these retailers
- Enables price comparison for non-grocery retailers (fashion, boutiques, specialty stores)

### v23
- Added vendor URL pattern validation for 27 retailers
- Fast regex pre-filter catches category pages BEFORE expensive scraping/AI calls
- Product/category URL templates per vendor in `vendor-url-patterns.ts`
- Added fashion retailers: the-dressingroom.com, trilogystores.co.uk
- Enhanced generic category detection for short brand-only paths
- Excluded own company (mcgrocer.com) from comparison results

### v22
- Added optional `description` field for precise AI matching
- Added `availability` field to product results ("In Stock", "Out of Stock", "Unsure")
- Availability extraction with JSON-LD fallback when AI fails
- Description included in metadata for logging

### v21
- Expanded blocked domains from 14 to 105+ sites
- Organized blocklist by category in separate file
- Added deal/voucher, cashback, tech/electronics, grocery comparers

### v20
- Added Serper API key fallback support
- `used_fallback_key` in metadata when fallback is used

## Related Functions

- **check-api-key-health**: Tests Serper and Gemini API keys
- **decodo-proxy**: Alternative scraping solution
- **fetch-vendor-products**: Fetches products from internal database

## Notes

- All searches are configured for UK market (`gl: 'gb'`, `google.co.uk`)
- Results are sorted by price (lowest first)
- CORS is enabled for all origins
- Function uses Gemini 2.0 Flash Lite for cost-effective AI verification
- Category pages are filtered out to ensure only product pages are returned
- Use `description` parameter for better matching accuracy with specific products
