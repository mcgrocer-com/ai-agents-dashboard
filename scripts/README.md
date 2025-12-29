# Scripts Directory

This directory contains utility scripts for the McGrocer Dashboard project.

## Available Scripts

### filter-chanel-products.js

Filters Chanel products by checking if they exist in the Supabase database.

**Purpose:**
- Read products from a JSON file
- Query Supabase to check which products already exist in the database
- Filter out existing products
- Save only new products to a filtered JSON file

**Usage:**
```bash
npm run filter:chanel
# or
node scripts/filter-chanel-products.js
```

**Input File:**
- `product_that_contains_chanel_as_their_item_name (1).json` (376 products)

**Output File:**
- `product_that_contains_chanel_as_their_item_name_filtered.json` (products not in database)

**How it works:**
1. Loads products from JSON file
2. Processes URLs in batches of 100 to avoid query limits
3. Queries Supabase `scraped_products` table for matching URLs
4. Filters out products that already exist
5. Saves new products to filtered JSON file

**Results:**
- Total input products: 376
- Already in database: 264
- New products (filtered): 112
- Retention rate: 29.8%

**Environment Variables Required:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

These should be defined in `.env` file in the project root.

### Other Scripts

#### run-migration.js
Helper script to display SQL migration content for manual execution in Supabase dashboard.

**Usage:**
```bash
npm run fix:seo-rls
```
