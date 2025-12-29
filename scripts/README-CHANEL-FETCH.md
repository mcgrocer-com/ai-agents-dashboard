# Fetch Chanel Products from ERPNext

This script fetches full product details from ERPNext for the 112 filtered Chanel products and creates a JSON file matching the `scraped_products` table schema for import.

## Overview

The script performs the following operations:

1. Reads the filtered Chanel products from `product_that_contains_chanel_as_their_item_name_filtered.json`
2. For each product:
   - Attempts to fetch full details from ERPNext using the Item Code
   - If not found, searches by Product URL
   - Maps the ERPNext data to the `scraped_products` table schema
3. Outputs a complete JSON file ready for Supabase import

## Prerequisites

- Node.js 18 or higher
- Access to ERPNext API with valid authentication token
- Environment variables configured in `.env` file

## Environment Variables

Create or update your `.env` file in the project root:

```bash
ERPNEXT_BASE_URL=https://erpnext.mcgrocer.com
ERPNEXT_AUTH_TOKEN=your_token_here
```

## Usage

### Run the script

```bash
npm run fetch:chanel
```

### Alternative (direct execution)

```bash
node scripts/fetch-chanel-from-erpnext.js
```

## Output

The script generates `chanel_products_for_import.json` in the project root with the following structure:

```json
[
  {
    "id": "john-lewis-747277",
    "vendor": "John Lewis",
    "name": "CHANEL Les Beiges Healthy Glow Lip Balm",
    "price": 42.00,
    "original_price": 42.00,
    "weight": 0.05,
    "description": "A balm to hydrate and revive the natural lip colour...",
    "category": "Beauty",
    "stock_status": "in_stock",
    "images": ["https://erpnext.mcgrocer.com/files/image1.jpg"],
    "main_image": "https://erpnext.mcgrocer.com/files/image1.jpg",
    "variants": null,
    "variant_count": null,
    "product_id": "747277",
    "timestamp": "2025-12-22T16:30:00.000Z",
    "url": "https://www.johnlewis.com/...",
    "breadcrumbs": null,
    "ean_code": null,
    "status": "pending",
    "height": 10.5,
    "width": 3.2,
    "length": 3.2,
    "volumetric_weight": 0.0021
  }
]
```

## Field Mapping

### From Filtered JSON
- `Item Code` → `product_id`
- `Item Name` → `name` (fallback if ERPNext data unavailable)
- `Description` → `description` (fallback if ERPNext data unavailable)
- `Product URL (Supplier Items)` → `url`
- `Vendor (Supplier Items)` → `vendor`

### From ERPNext API (`/api/resource/Item/{itemCode}`)
- `data.item_name` → `name`
- `data.web_long_description` or `data.description` → `description`
- `data.standard_rate` → `price` and `original_price`
- `data.weight_per_unit` → `weight`
- `data.custom_height` → `height`
- `data.custom_width` → `width`
- `data.custom_length` → `length`
- `data.item_group` → `category`
- `data.image` → `main_image`
- `data.images[]` → `images`

### Calculated Fields
- `id`: Generated from vendor and item code (e.g., `john-lewis-747277`)
- `volumetric_weight`: Calculated as `(height × width × length) / 5000`
- `timestamp`: Current timestamp
- `status`: Default `"pending"`
- `stock_status`: Default `"in_stock"`

## API Endpoints Used

### 1. Get Item by Code
```
GET /api/resource/Item/{itemCode}
```

### 2. Search Item by URL
```
POST /api/method/frappe.desk.reportview.get
Body: {
  "doctype": "Item",
  "fields": ["name"],
  "filters": [["Item Supplier", "custom_product_url", "=", url]]
}
```

## Processing Details

- **Batch Size**: 10 products per batch
- **Delay**: 500ms between batches to avoid rate limiting
- **Total Products**: 112 Chanel products
- **Estimated Time**: ~6-7 minutes (112 products / 10 per batch × 0.5s delay)

## Error Handling

- If ERPNext API returns an error, the product is still mapped using the filtered JSON data
- Missing ERPNext data is logged as a warning (⚠) but does not stop processing
- Products without ERPNext data will have `null` values for fields not in the filtered JSON

## Import to Supabase

After running the script, import the generated JSON:

### Option 1: Using Supabase Dashboard
1. Go to Supabase Dashboard → Table Editor → `scraped_products`
2. Click "Insert" → "Insert row"
3. Use bulk import or API

### Option 2: Using Supabase CLI
```bash
supabase db seed --project-ref your-project-ref --file chanel_products_for_import.json
```

### Option 3: Using SQL
```sql
-- Example for single product
INSERT INTO scraped_products (
  id, vendor, name, price, original_price, weight,
  description, category, stock_status, images, main_image,
  product_id, timestamp, url, status, height, width, length, volumetric_weight
) VALUES (
  'john-lewis-747277',
  'John Lewis',
  'CHANEL Les Beiges Healthy Glow Lip Balm',
  42.00,
  42.00,
  0.05,
  'A balm to hydrate...',
  'Beauty',
  'in_stock',
  '["https://erpnext.mcgrocer.com/files/image1.jpg"]'::jsonb,
  'https://erpnext.mcgrocer.com/files/image1.jpg',
  '747277',
  '2025-12-22T16:30:00.000Z'::timestamptz,
  'https://www.johnlewis.com/...',
  'pending',
  10.5,
  3.2,
  3.2,
  0.0021
);
```

## Troubleshooting

### Issue: "ERPNEXT_AUTH_TOKEN environment variable not set"
**Solution**: Ensure your `.env` file contains the `ERPNEXT_AUTH_TOKEN` variable

### Issue: "Input file not found"
**Solution**: Ensure `product_that_contains_chanel_as_their_item_name_filtered.json` exists in the project root

### Issue: Rate limiting errors
**Solution**: Increase the `DELAY_MS` constant in the script (e.g., from 500ms to 1000ms)

### Issue: ERPNext API connection errors
**Solution**:
- Check that `ERPNEXT_BASE_URL` is correct
- Verify the auth token is valid
- Ensure you have network access to the ERPNext server

## Next Steps

After generating and importing the JSON file:

1. **Verify Data**: Review the imported products in Supabase
2. **Run Agents**: Process products through category, weight/dimension, SEO, and copyright agents
3. **Push to ERPNext**: Use the dashboard to push completed products back to ERPNext with enriched data
4. **Monitor**: Check the agent processing summary for statistics

## Files

- **Script**: `scripts/fetch-chanel-from-erpnext.js`
- **TypeScript Version**: `scripts/fetch-chanel-from-erpnext.ts`
- **Input**: `product_that_contains_chanel_as_their_item_name_filtered.json`
- **Output**: `chanel_products_for_import.json`
- **Package Script**: `npm run fetch:chanel`

## Related Documentation

- [ERPNext API Documentation](https://frappeframework.com/docs/user/en/api)
- [Supabase Import Guide](https://supabase.com/docs/guides/database/import-data)
- [scraped_products Table Schema](../supabase/migrations/)
