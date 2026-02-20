# On-Demand Sync Cache

Syncs live price and availability data from `price_comparison_cache` back into `scraped_products`, keeping the product catalog up to date with real-world pricing.

## How It Works

```
price_comparison_cache (last_updated IS NULL)
  |
  +- For each cached product result:
  |   +- Skip if availability = "Unsure"
  |   +- Skip if extraction_method = "cached" (prevents double-markup)
  |   |
  |   +- Normalize URL (strip query params)
  |   +- Match against scraped_products by URL
  |   |
  |   +- Update scraped_products:
  |   |   +- original_price = vendor price
  |   |   +- price = vendor price + dynamic markup
  |   |   +- stock_status = "in stock" / "out of stock"
  |   |   +- scraper_updated_at = now
  |   |
  |   +- Reset pending_products for ERPNext re-sync:
  |       +- erpnext_updated_at = null
  |       +- sync_full_product = true
  |
  +- Mark cache entry as processed (last_updated = now)
```

## Price Markup Rules

Markup is applied dynamically based on the vendor's cost price:

| Cost Range | Markup |
|-----------|--------|
| 500+ | 20% |
| 300 - 499.99 | 30% |
| 200 - 299.99 | 35% |
| 100 - 199.99 | 40% |
| 30 - 99.99 | 55% |
| 20 - 29.99 | 60% |
| 10 - 19.99 | 70% |
| 1 - 9.99 | 75% |
| 0.99 | 90% |

Both `original_price` (vendor cost) and `price` (marked up) are stored on `scraped_products`.

## Schedule

Runs via pg_cron every 15 minutes. Processes up to 50 unprocessed cache entries per run.

## API

```
POST /functions/v1/on-demand-sync-cache
Content-Type: application/json

{ "batchSize": 50 }   // optional, default 50
```

### Response
```json
{
  "success": true,
  "message": "Processed 3 cache entries, updated 8 products",
  "stats": {
    "cache_entries_processed": 3,
    "products_checked": 15,
    "products_matched": 10,
    "products_updated": 8,
    "pending_products_triggered": 5,
    "products_skipped_no_match": 3,
    "products_skipped_unsure": 2,
    "errors": 0
  },
  "duration_ms": 1240
}
```

## Key Design Decisions

- **Skips `cached` results**: Products with `extraction_method: "cached"` already have markup applied from a previous sync cycle. Re-processing would cause double-markup.
- **Skips `Unsure` availability**: Only syncs definitive stock status ("In Stock" / "Out of Stock").
- **URL normalization**: Strips query params (tracking IDs, session tokens) for reliable matching.
- **`last_updated` reset**: When on-demand-scraper-v2 upserts a cache entry, it resets `last_updated` to `null` so this function picks up the fresh results.
- **ERPNext re-sync**: Resets `erpnext_updated_at` to null and sets `sync_full_product = true` so the ERPNext cron sends updated price + stock_status.

## Data Flow

```
User searches -> on-demand-scraper-v2 -> writes cache (last_updated = null)
                                          |
on-demand-sync-cache (cron) -------------+
  |
  +- Updates scraped_products (price + stock + scraper_updated_at)
  +- Resets pending_products for ERPNext sync (erpnext_updated_at = null, sync_full_product = true)
  +- Marks cache entry processed (last_updated = now)
                                          |
on-demand-scraper-v2 (next search) ------+
  +- Reads scraper_updated_at as freshness check (7-day TTL)
      -> Fresh products skip scraping, stale ones re-scrape
```

## Related

- **`on-demand-scraper-v2/`** -- Writes to `price_comparison_cache`, reads `scraper_updated_at` for freshness
- **`scraped_products` table** -- Target for price/stock updates
- **`pending_products` table** -- Touched to trigger ERPNext sync
- **`price_comparison_cache` table** -- Source of live pricing data
