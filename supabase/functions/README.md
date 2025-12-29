# Supabase Edge Functions

This directory contains all Supabase Edge Functions for the MCGrocer AI Dashboard.

## Table of Contents

- [Overview](#overview)
- [Core Functions](#core-functions)
- [Classification Functions](#classification-functions)
- [ERPNext Sync Functions](#erpnext-sync-functions)
- [Shopify Functions](#shopify-functions)
- [Utility Functions](#utility-functions)
- [Shared Code](#shared-code)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Overview

Edge Functions are serverless functions that run on Supabase's edge infrastructure. They handle:
- Product classification and validation
- ERPNext integration and sync
- Shopify blog and product operations
- Price comparison across retailers
- API health monitoring

---

## Core Functions

### [`price-comparison`](./price-comparison/README.md)
**Price Comparison across UK Retailers**

Searches multiple UK retailers to find product prices using Serper API.

- **Method**: `POST`
- **Body**: `{ query: string, limit?: number, bypass_cache?: boolean }`
- **Features**:
  - Parallel vendor search across 17+ priority UK retailers
  - AI-powered result verification using Gemini
  - Suspicious price detection and scraping verification
  - Result caching with 2-hour TTL
  - Category page filtering

**Environment Variables**:
- `SERPER_API_KEY_PRICE_COMPARISON` - Dedicated Serper API key
- `GEMINI_API_KEY` - Google Gemini for AI verification

---

### [`check-api-key-health`](./check-api-key-health/README.md)
**API Key Health Monitoring**

Tests the health of all external API keys used by AI agents.

- **Method**: `POST`
- **Body**: `{ keyType: string }`
- **Supported Key Types**:
  - `serper-key` - Web search API (sanitisation)
  - `serper-key-price-comparison` - Price comparison API
  - `openai-vision` - OpenAI GPT-4 Vision
  - `category-key` - Gemini for category agent
  - `weight-and-dimension-key` - Gemini for weight agent
  - `seo-agent-key` - Gemini for SEO agent
  - `supabase-key` - Database connection
  - `decodo-key` - Google Suggest keyword research

Results are stored in `agent_tools` table for dashboard display.

---

## Classification Functions

### [`classify-product`](./classify-product/README.md)
**UK Medicine Classification API**

Stateless API for classifying products according to UK medicine regulations.

- **Method**: `POST`
- **Body**: `{ products: [{ productId, title, description }] }`
- **Returns**: Classification results with rejection status
- **Classifications**:
  - `not_medicine` - Safe to sell
  - `gsl` - General Sale List (safe)
  - `pharmacy` - Pharmacy only (rejected)
  - `pom` - Prescription only (rejected)
  - `unclear` - Cannot determine (rejected)

**Features**:
- Batch processing (10 products at a time)
- Exponential backoff with model fallback
- Rate limiting (500ms between batches)

---

### [`retry-failed-classifications`](./retry-failed-classifications/README.md)
**Retry Queue Processor**

Processes products that failed initial classification.

- **Method**: `POST`
- **Body**: `{ batchSize?: number, vendor?: string }`
- **Trigger**: Scheduled via pg_cron (every 15 minutes)
- **Features**:
  - Reads from `classification_retry_log` table
  - Exponential backoff (1min, 2min, 4min, 8min...)
  - Retries indefinitely until success
  - Duplicate prevention in `pending_products`

---

### [`push-to-pending`](./push-to-pending/README.md)
**Webhook: Scraped Products to Pending Queue**

Database webhook triggered on `scraped_products` table changes.

- **Trigger**: INSERT/UPDATE/DELETE on `scraped_products`
- **Actions**:
  - **INSERT**: Classifies product, creates `pending_products` entry if accepted
  - **UPDATE**: Checks completion status, marks for ERPNext sync
  - **DELETE**: Removes from `pending_products`

Creates retry log entries on classification failures.

---

### [`populate-retry-log`](./populate-retry-log/README.md)
**Bulk Retry Log Population**

Populates `classification_retry_log` with unclassified products for retry processing.

---

## ERPNext Sync Functions

### [`sync-completed-products-to-erpnext`](./sync-completed-products-to-erpnext/README.md)
**Cron: Push Completed Products to ERPNext**

Main sync job for pushing processed products to ERPNext.

- **Trigger**: Scheduled via pg_cron (every 15 minutes)
- **Method**: `POST`
- **Body**: `{ batchSize?: number, apiBatchSize?: number, vendor?: string }`
- **Flow**:
  1. Validate and reset invalid agent statuses
  2. Query products with all agents complete (category, weight, SEO)
  3. Process UK medicine classification validation
  4. Push to Production ERPNext (required)
  5. Push to Staging ERPNext (optional, non-blocking)
  6. Verify items in ERPNext
  7. Sync agent data back to `scraped_products`

**Dual-Write Pattern**:
- Production: `ERPNEXT_AUTH_TOKEN` (required)
- Staging: `ERPNEXT_AUTH_TOKEN_STAGING` (optional)

---

### [`push-products-to-erpnext`](./push-products-to-erpnext/README.md)
**Manual ERPNext Push**

Manually push specific products to ERPNext.

---

### [`resync-product-to-erpnext`](./resync-product-to-erpnext/README.md)
**Single Product Resync**

Force resync a single product to ERPNext.

---

### [`resync-vendor-to-erpnext`](./resync-vendor-to-erpnext/README.md)
**Vendor-Wide Resync**

Resync all products from a specific vendor to ERPNext.

---

## Shopify Functions

See [SHOPIFY_FUNCTIONS.md](./SHOPIFY_FUNCTIONS.md) for detailed documentation.

### [`shopify-blogs`](./shopify-blogs/README.md)
List all blogs from Shopify.

### [`shopify-blog-articles`](./shopify-blog-articles/README.md)
List articles for a specific blog.

### [`shopify-published-blogs`](./shopify-published-blogs/README.md)
Get published blog articles.

### [`shopify-push-blog`](./shopify-push-blog/README.md)
Publish or update a blog article to Shopify.

### [`shopify-product-search`](./shopify-product-search/README.md)
Search Shopify products for blog linking.

### [`blog-preview`](./blog-preview/README.md)
Generate blog preview HTML.

---

## Utility Functions

### [`add-product-copyright`](./add-product-copyright/README.md)
Add a product to the copyright detection queue.

### [`remove-product-from-copyright`](./remove-product-from-copyright/README.md)
Remove a product from copyright detection queue.

### [`clear-copyright-queue`](./clear-copyright-queue/README.md)
Clear entire copyright detection queue.

### [`cleanup-old-3d-models`](./cleanup-old-3d-models/README.md)
Clean up old 3D model files from storage.

### [`add-to-cart`](./add-to-cart/README.md)
Shopping assistant cart automation.

### [`decodo-proxy`](./decodo-proxy/README.md)
Proxy for Decodo Google Suggest API.

### [`fetch-vendor-products`](./fetch-vendor-products/README.md)
Fetch products from a specific vendor.

### [`manual-push-to-pending`](./manual-push-to-pending/README.md)
Manually push products to pending queue.

### [`reset-agent-completed`](./reset-agent-completed/README.md)
Reset agent completion status for reprocessing.

### [`seed-scraped-products`](./seed-scraped-products/README.md)
Seed test data into scraped_products.

### [`scrape-article`](./scrape-article/README.md)
Scrape article content from URLs for blogger.

---

## Shared Code

### [`_shared/`](./_shared/README.md)
Shared utilities used across multiple functions:

- **`gemini-classification.ts`** - UK medicine classification using Gemini AI
- **`erpnext-utils.ts`** - ERPNext API integration utilities

---

## Environment Variables

Required environment variables for edge functions:

```bash
# Supabase (auto-injected)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=

# Google Gemini AI
GEMINI_API_KEY=

# Serper API (Web Search)
SERPER_API_KEY=
SERPER_API_KEY_PRICE_COMPARISON=

# OpenAI
OPENAI_API_KEY=

# ERPNext
ERPNEXT_BASE_URL=https://erpnext.mcgrocer.com
ERPNEXT_AUTH_TOKEN=
ERPNEXT_AUTH_TOKEN_STAGING=

# Shopify
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=

# Decodo
DECODO_USERNAME=
DECODO_PASSWORD=
```

---

## Deployment

### Deploy All Functions
```bash
npx supabase functions deploy
```

### Deploy Single Function
```bash
npx supabase functions deploy <function-name>
```

### Set Secrets
```bash
npx supabase secrets set KEY_NAME=value
```

### View Logs
```bash
npx supabase functions logs <function-name>
```

---

## Database Tables Used

| Table | Description |
|-------|-------------|
| `scraped_products` | Raw scraped product data |
| `pending_products` | Products in AI agent queue |
| `classification_retry_log` | Failed classification retry queue |
| `price_comparison_cache` | Cached price comparison results |
| `agent_tools` | API key health status |
| `blogger_blogs` | Blog content and metadata |

---

## Related Documentation

- [SHOPIFY_FUNCTIONS.md](./SHOPIFY_FUNCTIONS.md) - Detailed Shopify function docs
- [FRONTEND.md](../../FRONTEND.md) - Frontend architecture
- [README.md](../../README.md) - Project overview

---

**Last Updated**: 2025-12-29
