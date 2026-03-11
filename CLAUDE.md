# McGrocer AI Agents Dashboard

## Project Overview

Internal dashboard for McGrocer to manage AI-powered product scraping, classification, and sync pipelines. Built with React 19 + Vite + TypeScript, backed by Supabase (auth, DB, edge functions) and integrated with ERPNext as the ERP system.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v7 (HashRouter)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **ERP Integration**: ERPNext REST API (erpnext.mcgrocer.com)
- **AI**: Google Gemini (`@google/genai`) for classification and content generation
- **UI**: Lucide icons, Headless UI, Recharts, SweetAlert2
- **3D**: React Three Fiber + Drei for 3D product rendering
- **File Processing**: mammoth (DOCX), pdfjs-dist (PDF), xlsx (Excel)
- **Database**: mysql2 + ssh2 for direct MariaDB/ERPNext DB access
- **Deployment**: GitHub Pages via GitHub Actions (CI/CD on push to main)
- **Dev server**: `npm run dev` on port 3005

## Project Structure

```
src/
  App.tsx              # Root router - all routes defined here
  pages/               # Page components (one per route)
    ScraperAgentPage   # Product scraping agent (primary)
    ClassificationAgentPage # AI classification agent
    CategoryAgentPage  # Category management agent
    WeightAgentPage    # Weight/dimension agent
    SeoAgentPage       # SEO optimization agent
    CopyrightAgentPage # Copyright checking agent
    FaqAgentPage       # FAQ generation agent
    AgentsPage         # Agent hub/overview
    AgentToolsPage     # Shared agent tools
    DashboardPage      # Main dashboard
    ProductDetailPage  # Single product view
    PinnedProductsPage # Pinned products view
    blogger/           # Blog management pages
    shopping-assistant/# Price comparison pages
  components/          # UI components organized by domain
    ui/                # Reusable primitives (Toast, buttons, etc.)
    layout/            # DashboardLayout, sidebar, header
    auth/              # ProtectedRoute
    agents/            # Shared agent components
    scraper/           # Scraper agent components
    classification/    # Classification agent components
    category/          # Category agent components
    products/          # Product display components
    blogger/           # Blog management components
    shopping-assistant/# Price comparison components
    dashboard/         # Dashboard widgets
    seo/               # SEO components
    warehouse/         # Warehouse/inventory components
    weight/            # Weight management components
    weight-dimension/  # Weight & dimension components
    common/            # Shared/generic components
    filters/           # Filter UI components
  services/            # Supabase API layer (one service per domain)
    products.service.ts       # Main product CRUD
    erpnext.service.ts        # ERPNext integration
    scraperProducts.service.ts# Scraper product operations
    classification.service.ts # Classification operations
    blacklist.service.ts      # Blacklist management
    agents.service.ts         # Agent management
    auth.service.ts           # Authentication
    realtime.service.ts       # Realtime subscriptions
    stats.service.ts          # Dashboard statistics
    mariadbProducts.service.ts# Direct MariaDB queries
    blogger/                  # Blog services (ai, content, shopify, SEO, etc.)
    shopping-assistant/       # Price comparison services (vendors, cart, accounts)
  hooks/               # Custom React hooks (useProducts, useAuth, etc.)
  types/               # TypeScript interfaces (database.ts is primary)
  lib/supabase/        # Supabase client config
supabase/functions/    # 36 Deno edge functions (deployed via Supabase CLI)
  _shared/             # Shared utilities
    erpnext-utils.ts          # ERPNext fetch/sync helpers (25KB)
    gemini-classification.ts  # Gemini AI classification logic (31KB)
    product-validation.ts     # Validation rules (21KB)
  classify-product/    # AI classification (UK compliance)
  push-to-pending/     # Push scraped products to pending queue
  on-demand-scraper-v2/# On-demand product scraping
  sync-completed-products-to-erpnext/  # Sync validated products to ERPNext
  push-products-to-erpnext/            # Push products to ERPNext
  shopify-*/           # Shopify blog integration (4 functions)
  ...                  # See supabase/functions/ for full list
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
- `supabase/functions/_shared/gemini-classification.ts` - Gemini AI classification logic
- `supabase/functions/_shared/product-validation.ts` - Product validation rules
- `vite.config.ts` - Vite config with proxy to ERPNext API
- `.github/workflows/deploy.yml` - CI/CD pipeline

## Environment Variables

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` - Supabase connection (required)
- `SHOPIFY_API_KEY` - Shopify integration for blog/product sync

## Commands

```bash
npm run dev          # Start dev server (port 3005)
npm run build        # TypeScript check + Vite build
npm run deploy       # Build + deploy to GitHub Pages
npm run test:e2e     # Run Playwright E2E tests
npm run test:erpnext # Test ERPNext connectivity
```

## Domain Concepts

- **Scraped Products**: Products scraped from vendor websites, stored in Supabase
- **Classification**: AI-powered UK medicine/compliance classification (approve/reject)
- **Blacklist**: Manual product exclusion from ERPNext sync
- **Pending Products**: Products queued for ERPNext sync
- **ERPNext Sync**: Push validated products to ERPNext ERP system
- **Validation**: Pre-sync validation rules (price > 0, required fields, etc.)
- **Agents**: Specialized AI agents (scraper, classification, category, weight, SEO, copyright, FAQ)
- **Sanitization**: A product that has been fully processed by all required agents — category, weight/dimension, and SEO — and optionally FAQ. A "sanitized" product is ready for ERPNext sync.

## Agent Delegation

**Always delegate to the appropriate subagent** rather than handling everything inline.

### Custom Project Agents (`.claude/agents/`)

| Agent | When to Use |
|-------|-------------|
| `frontend-developer` | Building/fixing React components, UI layouts, client-side state |
| `supabase-backend-expert` | Database schema, RLS policies, edge functions, Supabase config |
| `edge-function-reviewer` | Reviewing or debugging Supabase edge functions |
| `code-review-agent` | PR code reviews, quality assessment |
| `design-review-agent` | UI/UX review of frontend changes |
| `validation-gates` | Running tests, validating implementations |

### Built-in Subagents (via Agent tool `subagent_type`)

| Subagent | When to Use |
|----------|-------------|
| `documentation-manager` | **Updating CLAUDE.md or any documentation** — always delegate doc updates so the main agent stays focused |
| `task-executor` | Implementing specific tasks from task queue |
| `task-orchestrator` | Coordinating multi-task execution and dependencies |
| `context-engineer` | Designing system prompts, optimizing AI context |

**Key delegation rules:**
- After completing code changes, delegate documentation updates to `documentation-manager`
- After implementing features, delegate validation to `validation-gates`
- For frontend work, prefer `frontend-developer` subagent
- For Supabase/DB work, prefer `supabase-backend-expert` subagent
- For edge function changes, use `edge-function-reviewer` for review

## Skill Creation

When a task is **repetitive** (done 2+ times with similar steps) or **complex** (multi-step workflow that benefits from a documented process), create a reusable skill using `/skill-creator`. Store in `.claude/skills/`.

## Conventions

- Use TypeScript strict mode
- Tailwind for all styling (no CSS modules)
- Functional components only, hooks for state
- Services return `{ data, error }` pattern matching Supabase client
- Edge functions use Deno imports (not npm)
- Keep components focused - extract to sub-components when complex

## Hooks & Automation

- **PostToolUse**: ESLint auto-fix runs on all `.ts`/`.tsx` file edits
- **PreToolUse**: `.env` and lock files are protected from edits
