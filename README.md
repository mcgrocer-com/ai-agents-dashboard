# McGrocer AI Agents Dashboard

Internal dashboard for managing McGrocer's AI-powered product scraping, classification, and sync pipelines. Coordinates specialized AI agents that process products from vendor websites through to ERPNext ERP system publication.

**Live Dashboard:** [mcgrocer-com.github.io/ai-agents-dashboard](https://mcgrocer-com.github.io/ai-agents-dashboard)

## What It Does

1. **Scrapes** products from UK retailer websites (Tesco, Sainsbury's, Boots, Ocado, etc.)
2. **Classifies** products for UK medicine compliance using Gemini AI (POM, P, GSL)
3. **Enriches** products through specialized AI agents (category, weight/dimensions, SEO, FAQ)
4. **Syncs** validated products to ERPNext ERP system
5. **Generates** AI-powered blog content with Shopify CMS integration
6. **Compares** prices across UK retailers for shopping assistant features

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v7 (HashRouter) |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| ERP | ERPNext REST API (`erpnext.mcgrocer.com`) |
| AI | Google Gemini (`@google/genai`) |
| UI | Lucide icons, Headless UI, Recharts, SweetAlert2 |
| 3D | React Three Fiber + Drei |
| Deployment | GitHub Pages via GitHub Actions |

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Supabase project with environment variables configured

### Setup

```bash
git clone https://github.com/mcgrocer-com/ai-agents-dashboard.git
cd ai-agents-dashboard
npm install
```

Create `.env` at the project root:

```bash
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Commands

```bash
npm run dev          # Start dev server (port 3005)
npm run build        # TypeScript check + Vite production build
npm run deploy       # Build + deploy to GitHub Pages
npm run test:e2e     # Run Playwright E2E tests
npm run test:erpnext # Test ERPNext connectivity
```

## Architecture

```
                    ┌─────────────────────────┐
                    │     React Frontend      │
                    │  (GitHub Pages - SPA)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       Supabase          │
                    │  Auth │ DB │ Realtime   │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼──────────┐ ┌────▼────────┐ ┌───────▼───────┐
   │   37 Edge Functions │ │  Gemini AI  │ │    ERPNext    │
   │  (Deno/TypeScript)  │ │ (Classify,  │ │  (ERP Sync)   │
   │                     │ │  Generate)  │ │               │
   └─────────────────────┘ └─────────────┘ └───────────────┘
```

## AI Agents

| Agent | Purpose | Status Flow |
|-------|---------|-------------|
| **Scraper** | Scrapes product data from vendor websites | URL -> Scraped Product |
| **Classification** | UK medicine compliance (approve/reject) | Scraped -> Classified |
| **Category** | AI-assigned product categories and breadcrumbs | Pending -> Categorized |
| **Weight & Dimension** | Extracts weight, height, width, length | Pending -> Measured |
| **SEO** | Generates AI titles, descriptions, meta tags | Pending -> SEO Optimized |
| **FAQ** | Generates product FAQs | Pending -> FAQ Complete |
| **Copyright** | Checks for copyright/trademark issues | Queue-based |

A product is considered **"sanitized"** when all required agents (category, weight, SEO) have completed processing. Sanitized products are eligible for ERPNext sync.

## Project Structure

```
src/
  pages/               # Page components (one per route)
  components/          # UI components organized by domain
  services/            # Supabase API layer (one service per domain)
  hooks/               # Custom React hooks
  types/               # TypeScript interfaces (database.ts is primary)
  lib/supabase/        # Supabase client config
supabase/
  functions/           # 37 Deno edge functions
    _shared/           # Shared utilities (classification, ERPNext, validation)
  migrations/          # Database migrations
docs/                  # Detailed feature documentation
```

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [docs/BLOGGER.md](docs/BLOGGER.md) | AI-powered blog content generator: 6-step wizard, personas, templates, SEO grading, Shopify integration |

### Supabase & Edge Functions

| Document | Description |
|----------|-------------|
| [supabase/functions/README.md](supabase/functions/README.md) | Master index of all 37 edge functions with descriptions, environment variables, and deployment instructions |
| [supabase/functions/_shared/README.md](supabase/functions/_shared/README.md) | Shared utilities: Gemini classification, ERPNext integration, product validation |
| [supabase/functions/SHOPIFY_FUNCTIONS.md](supabase/functions/SHOPIFY_FUNCTIONS.md) | Detailed Shopify edge function documentation |
| [supabase/SETUP-WEBHOOK.md](supabase/SETUP-WEBHOOK.md) | Database webhook setup for the `push-to-pending` pipeline |
| [supabase/APPLY_MIGRATION_NOW.md](supabase/APPLY_MIGRATION_NOW.md) | Migration guide for pending schema changes |

### Edge Function READMEs

Every edge function has its own README with endpoint details, request/response schemas, and environment variables. See the [Edge Functions Index](supabase/functions/README.md) for the full list, or browse individual functions:

<details>
<summary>Core & Classification Functions</summary>

| Function | README |
|----------|--------|
| classify-product | [README](supabase/functions/classify-product/README.md) |
| classify-unclassified-products | [README](supabase/functions/classify-unclassified-products/README.md) |
| retry-failed-classifications | [README](supabase/functions/retry-failed-classifications/README.md) |
| push-to-pending | [README](supabase/functions/push-to-pending/README.md) |
| populate-retry-log | [README](supabase/functions/populate-retry-log/README.md) |
| price-comparison | [README](supabase/functions/price-comparison/README.md) |
| check-api-key-health | [README](supabase/functions/check-api-key-health/README.md) |

</details>

<details>
<summary>ERPNext Sync Functions</summary>

| Function | README |
|----------|--------|
| sync-completed-products-to-erpnext | [README](supabase/functions/sync-completed-products-to-erpnext/README.md) |
| push-products-to-erpnext | [README](supabase/functions/push-products-to-erpnext/README.md) |
| resync-product-to-erpnext | [README](supabase/functions/resync-product-to-erpnext/README.md) |
| resync-vendor-to-erpnext | [README](supabase/functions/resync-vendor-to-erpnext/README.md) |
| disable-products-in-erpnext | [README](supabase/functions/disable-products-in-erpnext/README.md) |

</details>

<details>
<summary>Shopify & Blogger Functions</summary>

| Function | README |
|----------|--------|
| shopify-blogs | [README](supabase/functions/shopify-blogs/README.md) |
| shopify-blog-articles | [README](supabase/functions/shopify-blog-articles/README.md) |
| shopify-published-blogs | [README](supabase/functions/shopify-published-blogs/README.md) |
| shopify-push-blog | [README](supabase/functions/shopify-push-blog/README.md) |
| shopify-product-search | [README](supabase/functions/shopify-product-search/README.md) |
| blog-preview | [README](supabase/functions/blog-preview/README.md) |
| scrape-article | [README](supabase/functions/scrape-article/README.md) |
| decodo-proxy | [README](supabase/functions/decodo-proxy/README.md) |

</details>

<details>
<summary>Scraper & Product Functions</summary>

| Function | README |
|----------|--------|
| on-demand-scraper-v2 | [README](supabase/functions/on-demand-scraper-v2/README.md) |
| on-demand-learn-patterns | [README](supabase/functions/on-demand-learn-patterns/README.md) |
| on-demand-sync-cache | [README](supabase/functions/on-demand-sync-cache/README.md) |
| seed-scraped-products | [README](supabase/functions/seed-scraped-products/README.md) |
| fetch-vendor-products | [README](supabase/functions/fetch-vendor-products/README.md) |
| update-scraped-product | [README](supabase/functions/update-scraped-product/README.md) |
| handle-deleted-products | [README](supabase/functions/handle-deleted-products/README.md) |
| export-validation-errors | [README](supabase/functions/export-validation-errors/README.md) |
| manual-push-to-pending | [README](supabase/functions/manual-push-to-pending/README.md) |

</details>

<details>
<summary>Utility Functions</summary>

| Function | README |
|----------|--------|
| get-api-key | [README](supabase/functions/get-api-key/README.md) |
| add-product-copyright | [README](supabase/functions/add-product-copyright/README.md) |
| remove-product-from-copyright | [README](supabase/functions/remove-product-from-copyright/README.md) |
| clear-copyright-queue | [README](supabase/functions/clear-copyright-queue/README.md) |
| reset-agent-completed | [README](supabase/functions/reset-agent-completed/README.md) |
| cleanup-old-3d-models | [README](supabase/functions/cleanup-old-3d-models/README.md) |
| add-to-cart | [README](supabase/functions/add-to-cart/README.md) |

</details>

### Troubleshooting & Fixes

| Document | Description |
|----------|-------------|
| [supabase/edge-functions/SEED_SCRAPED_PRODUCTS_FIX.md](supabase/edge-functions/SEED_SCRAPED_PRODUCTS_FIX.md) | Fix for seed-scraped-products unique constraint errors |

### Context & Reference

| Document | Description |
|----------|-------------|
| [shopping-assistant-context/prd.md](shopping-assistant-context/prd.md) | Product Requirements Document for the Shopping Assistant feature |
| [classification-agent-context/](classification-agent-context/) | Classification prompt references (long and short versions) |

## Environment Variables

```bash
# Required - Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Required for Edge Functions
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
GEMINI_API_KEY=
ERPNEXT_AUTH_TOKEN=

# Optional
SHOPIFY_API_KEY=                  # Shopify blog integration
ERPNEXT_AUTH_TOKEN_STAGING=       # Staging ERPNext (dual-write)
SERPER_API_KEY=                   # Web search (sanitisation agents)
SERPER_API_KEY_PRICE_COMPARISON=  # Price comparison
OPENAI_API_KEY=                   # OpenAI Vision
DECODO_USERNAME= / DECODO_PASSWORD= # Keyword research
VITE_RUNPOD_API_URL=              # Stagehand scraper fallback
```

## Deployment

The dashboard auto-deploys to GitHub Pages on push to `main` via [GitHub Actions](.github/workflows/deploy.yml).

Edge functions are deployed separately:

```bash
npx supabase functions deploy              # Deploy all
npx supabase functions deploy <name>       # Deploy single function
npx supabase secrets set KEY=value         # Set secrets
```

## Database

Primary tables:

| Table | Purpose |
|-------|---------|
| `scraped_products` | Raw scraped product data from vendors |
| `pending_products` | Products in AI agent processing queue |
| `classification_retry_log` | Failed classification retry queue |
| `price_comparison_cache` | Cached price comparison results |
| `agent_tools` | API key health status |
| `blogger_blogs` | Blog content and metadata |
| `blogger_personas` | Writer personas for blog generation |
| `blogger_templates` | Blog post templates |
| `blogger_keywords` | Cached keyword research data |
| `scraped_articles_cache` | Cached competitor article scrapes |

Migrations are in [`supabase/migrations/`](supabase/migrations/).

## License

Private - Internal use only.
