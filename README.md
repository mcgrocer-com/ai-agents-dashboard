# MCGrocer AI Agents Dashboard

A real-time dashboard for monitoring and managing AI agents for the MCGrocer e-commerce platform.

## Live Demo

🚀 **[View Live Dashboard](https://mcgrocer-com.github.io/ai-agents-dashboard/)**

## Documentation

### Internal Documentation
- **[FRONTEND.md](./FRONTEND.md)** - Complete frontend architecture, components, services, and development guidelines
- **[Blogger](./docs/BLOGGER.md)** - AI-powered blog content generator (architecture, services, output)
- **[Edge Functions](./supabase/functions/README.md)** - Supabase Edge Functions documentation (27+ functions)
- **[Shopify Functions](./supabase/functions/SHOPIFY_FUNCTIONS.md)** - Shopify-specific edge functions
- **[Tunnel Maintenance](./docs/TUNNEL-MAINTENANCE.md)** - Infrastructure documentation
- **README.md** (this file) - Quick start and overview

### AI Agent Documentation
The AI agents that process product data. External agents are maintained in a separate repository.

| Agent | Description | Documentation |
|-------|-------------|---------------|
| **Blogger Agent** | AI-powered blog content generation with E-E-A-T compliance | [README](./docs/BLOGGER.md) |
| **Category Agent** | AI-powered product categorization with multi-level taxonomy mapping | [README](https://github.com/mcgrocer-com/mcgrocer-sanitisation-agents/blob/master/mcgrocer/category-agent/README.md) |
| **Weight & Dimension Agent** | Intelligent extraction of product weight, dimensions, and packaging info | [README](https://github.com/mcgrocer-com/mcgrocer-sanitisation-agents/blob/master/mcgrocer/weight-dimension-agent/README.md) |
| **SEO Agent** | SEO optimization with keyword research, meta generation, and content scoring | [README](https://github.com/mcgrocer-com/mcgrocer-sanitisation-agents/blob/master/mcgrocer/seo_agent/README.md) |
| **Copyright Agent** | Brand and trademark violation detection for product listings | [README](https://github.com/mcgrocer-com/mcgrocer-sanitisation-agents/blob/master/mcgrocer/copyright_agent/README.md) |

> **Note**: External agents (Category, Weight & Dimension, SEO, Copyright) are in a private repository. Contact the development team for access.

## Features

### AI Agent Pipeline
- **Scraper Agent** - Web scraping from multiple vendors with dynamic filtering
- **Category Mapper** - AI-powered product categorization with confidence scoring
- **Weight & Dimension Extractor** - Intelligent extraction with 3D visualization
- **SEO Optimizer** - Keyword research, meta generation, and SEO scoring
- **Copyright Detector** - Brand and trademark violation detection
- **Classification Agent** - UK medicine compliance checking

### Blog Content Generator (Blogger)
- **9-Step Wizard** - Guided blog creation with AI assistance
- **6 Writer Personas** - E-E-A-T compliant content generation
- **9 Blog Templates** - How-to, Listicle, Product Review, etc.
- **Shopify Integration** - Direct publishing to Shopify CMS
- **SEO Optimization** - Real-time scoring and readability metrics
- **Image Management** - Auto-rehosting to Supabase Storage

### Shopping Assistant
- **Multi-Vendor Automation** - Cart management across vendors
- **Price Comparison** - Real-time price tracking
- **Account Management** - Secure credential storage
- **Browserbase Integration** - Headless browser automation

### Additional Tools
- Real-time dashboard with live metrics
- Product detail views with agent data
- **Price Comparison** - Compare prices across UK retailers (Serper API)
- Warehouse data upload (Excel/CSV)
- Advanced filtering and search
- Pin/unpin products for quick access

## Tech Stack

### Frontend
- **React 19** + **TypeScript 5.7**
- **Vite 6** - Fast build tool
- **Tailwind CSS 3.4** - Utility-first styling
- **React Router 7** - Client-side routing
- **SWR 2.3** - Data fetching and caching

### Backend & Services
- **Supabase** - PostgreSQL database, auth, realtime, storage
- **MariaDB** - ERP integration (ERPNext)
- **Google Gemini AI** - Content generation
- **Shopify GraphQL API** - Product catalog and blog publishing

### Data & Visualization
- **Recharts** - Charts and analytics
- **Three.js** - 3D product visualization
- **XLSX/PDF.js/Mammoth** - File parsing

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Environment variables configured

### Installation

```bash
# Clone the repository
git clone https://github.com/mcgrocer-com/ai-agents-dashboard.git
cd ai-agents-dashboard

# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Edit .env with your credentials
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_GEMINI_API_KEY
# - SHOPIFY_API_KEY

# Start development server
npm run dev
```

Visit `http://localhost:3005` to view the dashboard.

### Build for Production

```bash
# Build the application
npm run build

# Preview production build locally
npm run preview

# Deploy to GitHub Pages
npm run deploy
```

## Project Structure

```
ai-dashboard/
├── src/
│   ├── components/     # React components (UI, features)
│   ├── pages/          # Route page components
│   ├── services/       # Business logic and API clients
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript definitions
│   ├── lib/            # Utility libraries (Supabase, MariaDB)
│   └── App.tsx         # Root component
├── supabase/           # Backend (Edge Functions, migrations)
├── public/             # Static assets
├── docs/               # Infrastructure documentation
│   ├── BLOGGER.md      # Blogger feature documentation
│   └── TUNNEL-MAINTENANCE.md
├── FRONTEND.md         # Frontend documentation
└── package.json        # Dependencies
```

## Development

### Available Scripts

```bash
npm run dev          # Start dev server (port 3005)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run test:e2e     # Run Playwright E2E tests
npm run deploy       # Deploy to GitHub Pages
```

### Code Quality Guidelines

- Maximum **500 lines** per file
- Maximum **50 lines** per function
- Maximum **100 lines** per component
- Follow **KISS** and **YAGNI** principles
- Single Responsibility Principle
- Comprehensive TypeScript types

## Key Technologies

### Authentication
Supabase Auth with email/password and session management.

### Real-time Updates
Supabase Realtime for live dashboard metrics and product updates.

### State Management
- **SWR** for server state (API data)
- **React hooks** for local state
- **localStorage** for persistence (wizard auto-save, preferences)

### API Integration
- Supabase PostgreSQL database
- Railway API for blog generation
- Shopify GraphQL for product/blog sync
- ERPNext REST API for inventory

## Features in Detail

### Dashboard Page
- Live metrics with real-time updates
- Agent status cards (Category, Weight, SEO, Copyright)
- Processing queue visualization
- Recent activity feed
- Job queue management

### Product Management
- Advanced filtering with dynamic filter builder
- Multi-column sorting
- Pin/unpin for quick access
- Detailed product view with tabs (Overview, Category, Weight, SEO, Copyright, Variants)
- **Price Comparison** - Compare prices across UK retailers from product detail page
- ERPNext sync status tracking

### Blogger Feature
Complete AI-powered blog creation platform with:
- Topic-based content generation
- Writer persona selection
- Template-based structure
- Keyword research integration
- SEO optimization tools
- Shopify CMS publishing
- Product linking
- Image management

### Shopping Assistant
Automated cart management with:
- Vendor account credentials (secure storage)
- Cart queue automation via Browserbase
- Price comparison across vendors
- Migration tracking
- Vendor analytics

## Environment Variables

Required environment variables (see `.env.example`):

```bash
VITE_SUPABASE_URL=            # Supabase project URL
VITE_SUPABASE_ANON_KEY=       # Supabase anonymous key
VITE_GEMINI_API_KEY=          # Google Gemini AI key
SHOPIFY_API_KEY=              # Shopify Admin API key
VITE_MARIADB_HOST=            # MariaDB host (optional)
VITE_MARIADB_USER=            # MariaDB user (optional)
VITE_MARIADB_PASSWORD=        # MariaDB password (optional)
VITE_MARIADB_DATABASE=        # MariaDB database (optional)
```

## Troubleshooting

### Build Issues
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Authentication Issues
- Clear browser localStorage and cookies
- Verify Supabase project is active
- Check environment variables

### Real-time Not Working
- Ensure Supabase Realtime is enabled for tables
- Check Row Level Security (RLS) policies
- Verify subscription cleanup in components

See [FRONTEND.md](./FRONTEND.md) for detailed troubleshooting.

## Contributing

1. Create feature branch from `main`
2. Follow code quality guidelines (see Development section)
3. Test changes locally
4. Submit pull request with clear description

## License

Proprietary - MCGrocer Internal Tool

## Support

For questions or support, contact the development team.
