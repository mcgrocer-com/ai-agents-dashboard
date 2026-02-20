# On-Demand Learn Patterns

Learns product vs category URL regex patterns from vendor sitemaps. When `on-demand-scraper-v2` encounters an unknown domain in search results, it queues it as `pending` in `vendor_url_patterns`. This function picks up pending domains, fetches their sitemaps, and algorithmically generates regex patterns.

## How It Works

```
vendor_url_patterns (learning_status = 'pending')
  |
  +- For each pending domain:
  |   |
  |   +- Step 1: Discover sitemaps
  |   |   +- Fetch robots.txt, parse Sitemap: lines
  |   |   +- Fallback: try /sitemap.xml, /sitemap_index.xml
  |   |
  |   +- Step 2: Fetch & parse sitemap XML
  |   |   +- Regex-based <loc> extraction
  |   |   +- Handle sitemap indexes (max 20 sub-sitemaps)
  |   |   +- Support .gz sitemaps (DecompressionStream)
  |   |   +- Cap at 10,000 URLs total
  |   |
  |   +- Step 3: Parse URLs into segments
  |   |   +- Filter out images, PDFs, feeds, static assets
  |   |   +- Extract path, segments, depth
  |   |
  |   +- Step 4: Algorithmic clustering
  |   |   +- SKU/ID detection (CS12345, p1931726, hex IDs)
  |   |   +- Path keyword detection (/products/, /category/)
  |   |   +- Depth + slug analysis
  |   |   +- Named sub-sitemap hints (product-sitemap, category-sitemap)
  |   |
  |   +- Step 5: Generate regex patterns
  |   |   +- Structural patterns, not individual URL matches
  |   |   +- Compatible with RegExp(pattern, 'i').test(fullUrl)
  |   |
  |   +- Step 6: Upsert to vendor_url_patterns
  |       +- learning_status = 'learned', confidence_score, sample_size
  |       +- Up to 10 example URLs for product/category
  |       +- On failure: learning_status = 'failed' with error in research_notes
  |
  +- Skip domains already learned (unless force=true)
```

## Fetch Strategy

Fetching sitemaps uses a 3-tier fallback approach:

1. **Bot User-Agent** -- standard request with bot UA
2. **Browser User-Agent** -- if bot UA returns 403/429, retry with browser-like UA
3. **ScraperAPI** -- if both UAs blocked, proxy through ScraperAPI (standard, then ultra_premium)

This handles WAF-protected sites (e.g., Boots, Superdrug) that block direct bot access.

## Pattern Types

### Product Patterns
| Type | Example URL | Regex |
|------|------------|-------|
| CS-prefix SKU | `/slug/CS00566316.html` | `\/[\w%-]+\/CS\d{5,}\.html?\/?$` |
| C-prefix SKU | `/slug/C080033165.html` | `\/[\w%-]+\/C\d{5,}\.html?\/?$` |
| p-prefix ID | `/slug/p1931726` | `\/p\d{5,}\/?$` |
| Numeric ID | `/slug/80104490` | `\/[\w%-]+\/\d{5,}\/?$` |
| Hex ID | `/slug/a1b2c3d4e5f6` | `\/[\w%-]+\/[a-f0-9]{8,}\/?$` |
| Hyphen-numeric | `/-10350329` | `\/-\d{5,}\/?$` |
| Slug-ending numeric | `/product-name-10002476` | `\/[\w-]+-\d{5,}\/?$` |
| Path keyword | `/products/slug` | `\/products\/[\w%-]+` |

### Category Patterns
| Type | Example URL | Regex |
|------|------------|-------|
| c-prefix ID | `/c100000180066` | `\/c\d{5,}\/?$` |
| Short numeric | `/slug/210` | `\/[\w-]+\/\d{1,4}(-\w+)?\/?$` |
| Path keyword | `/category/slug` | `\/category(\/\|$)` |

## Schedule

Runs via pg_cron every 15 minutes. Processes up to 20 pending domains per run.

## API

### Cron mode (process pending domains)
```
POST /functions/v1/on-demand-learn-patterns
Content-Type: application/json

{ "mode": "process_pending", "limit": 20 }
```

### Single domain
```
POST /functions/v1/on-demand-learn-patterns
Content-Type: application/json

{ "domain": "clarins.co.uk" }
```

### Multiple domains
```
POST /functions/v1/on-demand-learn-patterns
Content-Type: application/json

{ "domains": ["clarins.co.uk", "boots.com"], "force": true }
```

### Response
```json
{
  "success": true,
  "results": [{
    "domain": "clarins.co.uk",
    "success": true,
    "sitemapUrl": "https://www.clarins.co.uk/sitemap_UK.xml",
    "stats": {
      "urls_found": 178,
      "products_detected": 31,
      "categories_detected": 83
    },
    "patterns": {
      "product": ["\\/[\\w%-]+\\/(CS?\\d{5,}|\\d{8,})(\\.html)?$"],
      "category": ["\\/[\\w-]+\\/\\d{1,4}(-\\w+)?\\/?$"]
    },
    "confidence": 0.92
  }],
  "summary": { "total": 1, "learned": 1, "failed": 0, "skipped": 0, "execution_time_ms": 3400 }
}
```

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `PER_DOMAIN_TIMEOUT_MS` | 60s | Max time per domain |
| `FETCH_TIMEOUT_MS` | 15s | HTTP fetch timeout |
| `MAX_SITEMAP_URLS` | 10,000 | URL cap per domain |
| `MAX_SUB_SITEMAPS` | 20 | Max sub-sitemaps to fetch |
| `FUNCTION_DEADLINE_MS` | 140s | Stop starting new domains before gateway timeout |

## Env Vars

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SCRAPER_API_KEY` | ScraperAPI -- fallback for WAF-blocked sitemaps |

## Compatibility

Patterns are stored as **string arrays in JSONB** on `vendor_url_patterns`. They are consumed by:

- `checkVendorUrlPattern()` in `on-demand-scraper-v2/vendor-url-patterns.ts` -- compiles with `new RegExp(pattern, 'i')` and tests against full URL
- `loadLearnedPatterns()` in `on-demand-scraper-v2/index.ts` -- reads `domain, product_patterns, category_patterns` where `learning_status='learned'`

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No sitemap found | `failed` + note |
| Empty sitemap | `failed` + note |
| < 10 URLs | Proceed with lower confidence (0.5x) |
| .gz sitemaps | DecompressionStream with 10MB limit |
| Already learned + no `force` | Skipped |
| No clear product/category separation | `failed` (0 confidence) |
| WAF-blocked sitemap | ScraperAPI fallback (standard -> ultra_premium) |
| Nested sitemap indexes | Recursed one level deep |
| Gateway timeout approaching | Stops starting new domains at 140s |

## Related

- **`on-demand-scraper-v2/`** -- Queues unknown domains as `pending`, reads learned patterns for URL filtering
- **`vendor_url_patterns` table** -- Source of pending domains, target for learned patterns
