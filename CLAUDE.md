# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure

- **CLAUDE.md** (this file) - AI development guidelines and feature documentation
- **FRONTEND.md** - Comprehensive frontend architecture documentation
- **README.md** - Project overview and quick start guide



## Core Development Philosophy

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

### YAGNI (You Aren't Gonna Need It)

Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

### Design Principles

- **Dependency Inversion**: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- **Open/Closed Principle**: Software entities should be open for extension but closed for modification.
- **Single Responsibility**: Each function, class, and module should have one clear purpose.
- **Fail Fast**: Check for potential errors early and raise exceptions immediately when issues occur.

## 🧱 Code Structure & Modularity

### File and Function Limits

- **Never create a file longer than 500 lines of code**. If approaching this limit, refactor by splitting into modules.
- **Functions should be under 50 lines** with a single, clear responsibility.
- **Classes should be under 100 lines** and represent a single concept or entity.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
- **Line length should be max 100 characters** (ESLint configured)


## UI/UX Design Principles

### Core Design Philosophy
- **Users First**: Prioritize user needs, workflows, and ease of use in every design decision
- **Meticulous Craft**: Aim for precision, polish, and high quality in every UI element
- **Speed & Performance**: Design for fast load times and responsive interactions
- **Simplicity & Clarity**: Strive for clean, uncluttered interface with clear labels
- **Focus & Efficiency**: Help users achieve goals quickly with minimal friction
- **Consistency**: Maintain uniform design language across the entire dashboard
- **Accessibility (WCAG AA)**: Ensure color contrast, keyboard navigation, screen reader support

### Design System
- **Color Palette**: Primary brand color + neutrals scale (5-7 grays) + semantic colors (success, error, warning, info)
- **Typography**: Clean sans-serif (Inter/system-ui), modular scale (H1-H4, body sizes), generous line-height (1.5-1.7)
- **Spacing**: 8px base unit, use multiples (4px, 8px, 12px, 16px, 24px, 32px)
- **Border Radii**: Small (4-6px for inputs/buttons), Medium (8-12px for cards/modals)
- **CSS Methodology**: Tailwind CSS utility-first approach

### Interaction Design
- **Micro-interactions**: Subtle animations (150-300ms) with ease-in-out easing
- **Loading States**: Skeleton screens for pages, spinners for component actions
- **Feedback**: Immediate and clear visual feedback for all user actions
- **Keyboard Navigation**: All interactive elements keyboard accessible with clear focus states


## Specialized Subagents

This project uses specialized AI subagents for specific domains. Claude Code should **proactively** invoke these agents when working on related tasks:


### Supabase Backend Expert (`supabase-backend-expert`)
**When to use:**
- Database schema design, table creation, or migrations
- Implementing Row Level Security (RLS) policies
- Creating or deploying Supabase Edge Functions
- Setting up authentication, real-time subscriptions, or storage buckets
- Security audits or performance optimization for database queries
- Any Supabase-specific operations (must use MCP tools)

**Example triggers:**
- User mentions "Supabase", "database", "RLS", "edge function"
- Working in `supabase/` directory or with database migrations
- API endpoint changes that affect database schema
- Security or performance concerns with data access


## Feature Documentation

### Price Comparison Feature

The Price Comparison feature allows users to compare product prices across multiple UK retailers directly from the product detail page.

#### Components
- **`PriceComparisonDialog.tsx`** (`src/components/products/`): Modal dialog displaying price comparison results
- **`ProductHeader.tsx`**: Contains "Compare Prices" button that triggers the dialog

#### How It Works
1. User clicks "Compare Prices" button below the price label on product detail page
2. Dialog opens and calls `price-comparison` Edge Function via Supabase
3. Edge Function uses dedicated Serper API key (`serper-key-price-comparison`) to search for product prices
4. Results show lowest price, vendor name, product name, and link to retailer site
5. Best price is highlighted with "Best Price" badge

#### Backend
- **Edge Function**: `supabase/functions/price-comparison/`
- **API Tool**: `serper-key-price-comparison` (visible in Agent Tools page)
- **Migration**: `20251229000002_add_serper_price_comparison_tool.sql`

#### UI Features
- Loading state with spinner while fetching prices
- Error handling with retry button
- Summary showing: Results Found, Lowest Price, Search Time
- Sorted results with best price first (green highlight)
- External links to retailer websites
- Debug information collapsible section
- Responsive design with max-height scrolling

---

### Blogger Feature (AI-Powered Blog Content Generation)

The Blogger feature enables users to create high-quality, E-E-A-T compliant blog content using AI-powered generation with persona-based writing styles.

#### Architecture

**Database Schema** (5 tables in `supabase/migrations/20251118000001_create_blogger_tables.sql`):
- `blogger_personas`: 6 deeply-developed writer personas with expertise and context data
- `blogger_templates`: 9 blog templates with structured content sections
- `blogger_keywords`: Cached keyword research data with search volume and competition metrics
- `blogger_blogs`: Main blog posts with metadata, content, SEO scores, and Shopify integration
- `blogger_blog_products`: Many-to-many relationship for Shopify product links in blogs

**Service Layer** (`src/services/blogger/`):
- `personas.service.ts`: CRUD for writer personas
- `templates.service.ts`: CRUD for blog templates
- `keywords.service.ts`: Keyword research caching
- `blogs.service.ts`: Comprehensive blog management with filtering, pagination, stats
- `ai.service.ts`: External API wrapper for keyword research, meta generation, content generation, SEO scoring
- `shopify.service.ts`: Shopify product search and blog publishing integration

**External API**: Uses Railway API at `https://mcgrocer-shopify-api.vercel.app` for:
- Keyword research (`/blogs/keywords/{topic}`)
- Meta data generation (`/meta-data/generate`)
- Blog content generation (`/advanced-blog/generate`) using OpenAI GPT-4 Turbo or Anthropic Claude 3
- Shopify product search and CMS publishing

**UI Components** (`src/components/blogger/`):
- `BlogWizard.tsx`: Multi-step form container with progress tracking
- `PersonaSelector.tsx`: Grid selection for 6 writer personas
- `TemplateSelector.tsx`: Grid selection for 9 blog templates
- `KeywordResearch.tsx`: Keyword input and AI-powered suggestions
- `ContentEditor.tsx`: Markdown editor with live HTML preview
- `SeoOptimizer.tsx`: Meta title/description editor with character counts and SEO scores
- `ProductSelector.tsx`: Shopify product search and selection
- `BlogCard.tsx`: Blog list item with status badges and actions
- `BlogPreview.tsx`: Full blog preview with metadata
- `BlogList.tsx`: Grid/list view with loading and empty states

**Pages** (`src/pages/blogger/`):
- `BloggerCreatePage.tsx`: 9-step wizard for blog creation with auto-save to localStorage
- `BloggerDashboardPage.tsx`: Blog listing with filtering, search, stats, and actions
- `BloggerDetailPage.tsx`: Single blog view with publish/unpublish/archive/delete actions

#### 9-Step Blog Creation Wizard
1. **Topic Input**: Enter blog topic
2. **Persona Selection**: Choose from 6 writer personas (Technical Expert, Lifestyle Blogger, etc.)
3. **Template Selection**: Choose from 9 blog templates (How-to, Listicle, Product Review, etc.)
4. **Keyword Research**: AI-powered keyword suggestions with search volume, competition, intent
5. **Meta Data**: Generate SEO-optimized title and description (50-60 chars, 140-160 chars)
6. **Content Preview**: AI-generated blog content in Markdown and HTML
7. **SEO Optimization**: Fine-tune meta tags, view SEO score (0-100) and readability score (0-100)
8. **Images & Links**: Search and add Shopify products to link in content
9. **Final Preview**: Review complete blog and publish to Shopify or save as draft

#### Key Features
- **Auto-save**: Wizard state persists to localStorage every 1 second
- **SEO Scoring**: Client-side calculation based on title length, keyword density, content structure
- **Readability Scoring**: Flesch Reading Ease approximation for content accessibility
- **Shopify Integration**: Direct publishing to Shopify CMS with product linking
- **Status Management**: Draft, Published, Archived states with status tracking
- **Filtering & Search**: Dashboard supports status filtering and full-text search
- **Duplicate & Delete**: Quick actions for blog management
- **Responsive Design**: Mobile-first approach with Tailwind CSS utilities

#### Navigation
- Route: `/blogger` (Dashboard)
- Route: `/blogger/create` (Create wizard)
- Route: `/blogger/:id` (View detail)
- Route: `/blogger/:id/edit` (Edit wizard)
- Sidebar: "Blogger" navigation item in Agents section with PenTool icon

#### Development Guidelines
- **Component Size**: All components under 100 lines following KISS principle
- **Service Pattern**: Consistent ServiceResponse<T> wrapper for error handling
- **TypeScript Types**: Comprehensive type system in `src/types/blogger.ts`
- **Error Handling**: Try-catch blocks with console.error logging
- **Accessibility**: WCAG AA compliance with keyboard navigation and ARIA labels
