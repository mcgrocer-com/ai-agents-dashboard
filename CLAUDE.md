# McGrocer AI Agents Dashboard

## Project Overview

Internal dashboard for McGrocer to manage AI-powered product scraping, classification, and sync pipelines. Built with React 19 + Vite + TypeScript, backed by Supabase (auth, DB, edge functions) and integrated with ERPNext as the ERP system.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7 (HashRouter)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **ERP Integration**: ERPNext REST API (erpnext.mcgrocer.com)
- **UI**: Lucide icons, Headless UI, Recharts, SweetAlert2
- **Deployment**: GitHub Pages via GitHub Actions (CI/CD on push to main)
- **Dev server**: `npm run dev` on port 3005

## Project Structure

```
src/
  App.tsx              # Root router - all routes defined here
  pages/               # Page components (one per route)
  components/          # UI components organized by domain
    ui/                # Reusable primitives (Toast, buttons, etc.)
    layout/            # DashboardLayout, sidebar, header
    auth/              # ProtectedRoute
    scraper/           # Scraper agent components
    classification/    # Classification agent components
    products/          # Product display components
    blogger/           # Blog management components
    shopping-assistant/# Price comparison components
  services/            # Supabase API layer (one service per domain)
  hooks/               # Custom React hooks (useProducts, useAuth, etc.)
  types/               # TypeScript interfaces (database.ts is primary)
  lib/supabase/        # Supabase client config
supabase/functions/    # Deno edge functions (deployed via Supabase CLI)
  _shared/             # Shared utilities (erpnext-utils.ts, gemini-classification.ts)
  push-to-pending/     # Push scraped products to pending queue
  sync-completed-products-to-erpnext/  # Sync validated products to ERPNext
  seed-scraped-products/               # Seed products from scraper
  update-scraped-product/              # Update individual product
  classify-product/    # AI classification (UK compliance)
  ...                  # 30+ edge functions
product-checker-api/   # Standalone Node.js scraper API with per-site extractors
```

## Key Patterns

- **Services pattern**: All Supabase queries go through `src/services/*.service.ts`. Import from `@/services`.
- **Path aliases**: `@/` maps to `src/` (configured in vite.config.ts and tsconfig)
- **Types**: Core DB types in `src/types/database.ts`. ScrapedProduct is the primary entity.
- **Edge functions**: Written in Deno/TypeScript, use shared utils from `_shared/`. Deployed with `supabase functions deploy <name>`.
- **Auth**: Supabase Auth with protected routes via `<ProtectedRoute />` wrapper.
- **Realtime**: Supabase realtime subscriptions for live dashboard updates.

## Important Files

- `src/types/database.ts` - All database interfaces (Product, ScrapedProduct, etc.)
- `src/services/products.service.ts` - Main product CRUD operations
- `src/services/erpnext.service.ts` - ERPNext integration service
- `src/pages/ScraperAgentPage.tsx` - Primary agent page with tabs (validation, blacklist, etc.)
- `supabase/functions/_shared/erpnext-utils.ts` - Shared ERPNext fetch/sync utilities
- `supabase/functions/_shared/product-validation.ts` - Product validation rules
- `vite.config.ts` - Vite config with proxy to ERPNext API
- `.github/workflows/deploy.yml` - CI/CD pipeline

## Environment Variables

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` - Supabase connection (required)
- `VITE_GEMINI_API_KEY` - Google Gemini for AI features
- `SHOPIFY_API_KEY` - Shopify integration for blog/product sync

## Commands

```bash
npm run dev          # Start dev server (port 3005)
npm run build        # TypeScript check + Vite build
npm run deploy       # Build + deploy to GitHub Pages
npm run test:e2e     # Run Playwright E2E tests
```

## Domain Concepts

- **Scraped Products**: Products scraped from vendor websites, stored in Supabase
- **Classification**: AI-powered UK medicine/compliance classification (approve/reject)
- **Blacklist**: Manual product exclusion from ERPNext sync
- **Pending Products**: Products queued for ERPNext sync
- **ERPNext Sync**: Push validated products to ERPNext ERP system
- **Validation**: Pre-sync validation rules (price > 0, required fields, etc.)

## Conventions

- Use TypeScript strict mode
- Tailwind for all styling (no CSS modules)
- Functional components only, hooks for state
- Services return `{ data, error }` pattern matching Supabase client
- Edge functions use Deno imports (not npm)
- Keep components focused - extract to sub-components when complex
