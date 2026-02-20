# On-Demand Scraper V2

Production price comparison endpoint using ScraperAPI for both Google search and web scraping.

## Full Pipeline

```
                         +----------------------------------+
                         |     on-demand-learn-patterns      |
                         |     (cron: every 15 min)          |
                         |                                   |
                         |  Picks up "pending" domains from  |
                         |  vendor_url_patterns, fetches     |
                         |  sitemaps, learns product/category |
                         |  URL regex patterns               |
                         +----------+-----------------------+
                                    | writes learned patterns
                                    v
+-------------+    +-------------------------------+    +--------------------------+
|   User      |--->|     on-demand-scraper-v2       |--->|  price_comparison_cache   |
|   Search    |    |                                |    |  (2h TTL)                |
+-------------+    |  1. Check cache                |    +------------+-------------+
                   |  2. Google search + DB search   |                 |
                   |  3. Load learned patterns       |                 | last_updated IS NULL
                   |  4. Filter URLs (product vs     |                 v
                   |     category via patterns)      |    +--------------------------+
                   |  5. AI verify products          |    | on-demand-sync-cache     |
                   |  6. Scrape for prices           |    | (cron: every 15 min)     |
                   |  7. Currency validation (GBP)   |    |                          |
                   |  8. Cache results               |    |  Syncs live prices back  |
                   |  9. Queue unknown domains       |    |  to scraped_products     |
                   |     as "pending"                |    |  with markup applied     |
                   +---------------+----------------+    +------------+-------------+
                                   |                                   |
                                   | queues unknown domains            | updates price,
                                   v                                   | stock_status,
                         +------------------+                         | scraper_updated_at
                         | vendor_url_       |                         v
                         | patterns table    |              +----------------------+
                         | (pending -> learned|              |   scraped_products   |
                         |  via cron)        |              |   (product catalog)  |
                         +------------------+              +----------+-----------+
                                                                      |
                                                           v2 reads scraper_updated_at
                                                           for freshness (7-day TTL)
                                                           Fresh = skip scraping
```

## Architecture (single request)

```
Request (query, limit)
  |
  +- Cache check --> hit? return cached results
  |
  +- Parallel:
  |   +- Google search (ScraperAPI, num=100, single query)
  |   +- DB search (scraped_products via trigram similarity)
  |
  +- Lazy pattern loading
  |   +- Extract domains from search results -> query only those from vendor_url_patterns
  |
  +- URL filtering
  |   +- Blocked domains removed
  |   +- Category pages rejected (learned + static patterns)
  |   +- Multipack mismatches filtered
  |   +- Priority vendors (Tesco, Sainsbury's, etc.) sorted first
  |
  +- AI verification (Gemini flash-lite, batched)
  |   +- DB matches with high similarity -> auto-approved
  |   +- Google results -> verified against query
  |
  +- Deduplication (one result per vendor)
  |
  +- Batch scraping (ScraperAPI, 8 concurrent)
  |   +- JSON-LD extraction (preferred, with GBP currency validation)
  |   +- AI extraction fallback (Gemini 3 flash-preview)
  |   +- SPA detection with retry (render=true)
  |
  +- Sort by price, apply limit
  |
  +- Cache write (last_updated = null) -> return results
```

## Pipeline Components

### 1. on-demand-scraper-v2 (this function)

The main endpoint. Searches Google + DB, verifies products with AI, scrapes prices, and returns results.

- **Trigger**: HTTP POST from the frontend
- **Writes to**: `price_comparison_cache`
- **Reads from**: `scraped_products`, `vendor_url_patterns`
- **Queues to**: `vendor_url_patterns` (unknown domains as `pending`)

### 2. on-demand-learn-patterns (cron: every 15 min)

Learns product vs category URL patterns from vendor sitemaps. When v2 encounters an unknown domain, it queues it as `pending`. This cron picks it up, fetches the sitemap, and algorithmically generates regex patterns.

- **Trigger**: pg_cron (`*/15 * * * *`)
- **Reads from**: `vendor_url_patterns` where `learning_status = 'pending'`
- **Writes to**: `vendor_url_patterns` (product_patterns, category_patterns, learning_status)
- **Processes**: Up to 20 domains per run with 65s hard timeout per domain
- **See**: [`on-demand-learn-patterns/README.md`](../on-demand-learn-patterns/README.md)

### 3. on-demand-sync-cache (cron: every 15 min)

Syncs live prices from cache results back into the `scraped_products` catalog with dynamic markup applied. This keeps the catalog fresh without requiring the scraper to re-visit every product.

- **Trigger**: pg_cron
- **Reads from**: `price_comparison_cache` where `last_updated IS NULL`
- **Writes to**: `scraped_products` (price with markup, original_price, stock_status, scraper_updated_at)
- **Also touches**: `pending_products` (resets `erpnext_updated_at` + sets `sync_full_product` to trigger ERPNext re-sync)
- **Skips**: `cached` extraction_method (prevents double-markup), `Unsure` availability
- **See**: [`on-demand-sync-cache/README.md`](../on-demand-sync-cache/README.md)

### Data Freshness Loop

```
v2 scrapes live price -> writes to cache (last_updated = null)
  -> sync cron picks up -> updates scraped_products.scraper_updated_at
    -> next v2 search reads scraper_updated_at (7-day freshness)
      -> fresh products skip scraping (saves ScraperAPI credits)
        -> stale products get re-scraped -> cycle repeats
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Main endpoint -- search, verify, scrape, cache |
| `vendor-url-patterns.ts` | Static vendor URL patterns + learned pattern matching (`isProductPageUrl`, `checkVendorUrlPattern`) |
| `blocked-domains.ts` | Domains to exclude from results (marketplaces, aggregators, social media) |

## API

### Request
```
POST /functions/v1/on-demand-scraper-v2
Content-Type: application/json

{
  "query": "Arla Organic Milk 1L",
  "description": "",          // optional, aids AI verification
  "limit": 5,                 // 1-20, default 5
  "bypass_cache": false        // skip cache read
}
```

### Response
```json
{
  "success": true,
  "products": [
    {
      "product_name": "Arla Organic Free Range Milk 1L",
      "price": 1.55,
      "currency": "GBP",
      "source_url": "https://www.tesco.com/groceries/...",
      "vendor": "Tesco",
      "confidence": 0.95,
      "availability": "In Stock",
      "extraction_method": "json-ld"
    }
  ],
  "metadata": {
    "total_found": 12,
    "verified": 8,
    "returned": 5,
    "timing_ms": 4200,
    "sources": { "db": 3, "google": 9 },
    "cache_hit": false
  }
}
```

## Env Vars

| Variable | Purpose |
|----------|---------|
| `SCRAPER_API_KEY` | ScraperAPI -- Google search + web scraping |
| `GEMINI_API_KEY` | Google Gemini -- AI verification + price extraction |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Gemini Models

| Constant | Model | Used For |
|----------|-------|----------|
| `GEMINI_FAST` | `gemini-2.0-flash-lite` | Product verification, availability checks |
| `GEMINI_SMART` | `gemini-3-flash-preview` | Price extraction from HTML (when JSON-LD absent) |

## Key Features

- **Single Google search**: One `num=100` query instead of multiple paginated searches
- **Currency validation**: JSON-LD `priceCurrency` checked -- rejects non-GBP prices (prevents geo-redirect issues like iHerb serving NGN)
- **Lazy pattern loading**: Only loads learned patterns for domains found in search results (not all 400+)
- **O(1) domain lookup**: Map-based pattern matching instead of iterating all entries
- **Pre-compiled RegExp**: Regex patterns compiled once on load, reused per URL check
- **Multipack filtering**: Detects pack-size mismatches (e.g. query "1L" vs result "6x1L")
- **SPA retry**: Detects JavaScript-only shells and retries with `render=true`
- **Deadline-aware scraping**: Stops starting new scrapes when approaching the 150s gateway timeout
- **Domain queuing**: Unknown domains auto-queued to `vendor_url_patterns` as `pending` for the `on-demand-learn-patterns` cron
- **2-hour cache**: Results cached in `price_comparison_cache` table with `last_updated = null` reset for sync pickup

## Database Tables

| Table | Role |
|-------|------|
| `price_comparison_cache` | Query result cache (2h TTL). Sync cron reads where `last_updated IS NULL`. |
| `scraped_products` | Product catalog. Source for DB search, target for sync price updates. |
| `vendor_url_patterns` | Static + learned URL patterns. Unknown domains queued as `pending`. |
| `pending_products` | ERPNext sync queue. Touched by sync cron when prices update. |
