# MCGrocer AI Dashboard - Frontend Documentation

Comprehensive documentation for the React/TypeScript frontend application.

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Key Features](#key-features)
6. [Configuration](#configuration)
7. [Component Organization](#component-organization)
8. [Services Layer](#services-layer)
9. [State Management](#state-management)
10. [Routing](#routing)
11. [Styling & Design System](#styling--design-system)
12. [Development Guidelines](#development-guidelines)

## Overview

The MCGrocer AI Dashboard is a modern React application built with TypeScript and Vite. It provides a comprehensive interface for managing AI-powered e-commerce workflows including product scraping, category mapping, SEO optimization, blog content generation, and shopping assistant automation.

**Live Demo**: [https://mcgrocer-com.github.io/ai-agents-dashboard/](https://mcgrocer-com.github.io/ai-agents-dashboard/)

## Tech Stack

### Core Technologies
- **React 19.0.0** - UI library with latest features
- **TypeScript 5.7.2** - Type-safe JavaScript
- **Vite 6.0.11** - Fast build tool and dev server
- **React Router DOM 7.9.4** - Client-side routing

### UI & Styling
- **Tailwind CSS 3.4.15** - Utility-first CSS framework
- **@tailwindcss/typography** - Typography plugin for prose content
- **Lucide React 0.454.0** - Icon library
- **Headless UI 2.2.9** - Unstyled, accessible UI components

### Backend Integration
- **Supabase JS 2.45.4** - Database, auth, and realtime subscriptions
- **SWR 2.3.6** - Data fetching and caching library

### AI & Data Processing
- **Google Gemini AI** - Content generation via @google/genai 1.31.0
- **Browserbase Stagehand 3.0.3** - Browser automation
- **Recharts 2.12.7** - Data visualization charts

### File Processing
- **XLSX (SheetJS)** - Excel file parsing
- **Mammoth 1.11.0** - DOCX file conversion
- **PDF.js 5.4.449** - PDF document parsing

### Form & Data
- **Date-fns 4.1.0** - Date manipulation
- **Zod 3.25.67** - Schema validation
- **SweetAlert2 11.26.3** - Beautiful modals and alerts
- **Clsx 2.1.1** - Conditional CSS class utilities

### 3D Visualization
- **Three.js 0.180.0** - 3D graphics library
- **React Three Fiber 9.3.0** - React renderer for Three.js
- **React Three Drei 10.7.6** - Useful helpers for R3F

### Database Connections
- **MySQL2 3.15.2** - MariaDB connection for ERP integration
- **SSH2 1.17.0** - Secure shell for remote database access

### Development Tools
- **ESLint 9.14.0** - Code linting
- **Playwright 1.55.1** - E2E testing
- **PostCSS 8.4.49** - CSS transformations
- **Autoprefixer 10.4.20** - Vendor prefix automation

## Project Structure

```
ai-dashboard/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── agents/         # Agent-specific components
│   │   ├── auth/           # Authentication components
│   │   ├── blogger/        # Blog content generation
│   │   ├── category/       # Category hierarchy
│   │   ├── classification/ # Product classification
│   │   ├── common/         # Shared generic components
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── filters/        # Advanced filtering UI
│   │   ├── layout/         # Layout components
│   │   ├── products/       # Product management
│   │   ├── scraper/        # Web scraping UI
│   │   ├── seo/            # SEO optimization
│   │   ├── shopping-assistant/  # Shopping automation
│   │   ├── ui/             # Base UI primitives
│   │   ├── warehouse/      # Warehouse data management
│   │   └── weight-dimension/    # Weight/dimension extraction
│   │
│   ├── pages/              # Route page components
│   │   ├── blogger/        # Blog feature pages
│   │   └── shopping-assistant/  # Shopping assistant pages
│   │
│   ├── services/           # Business logic & API clients
│   │   ├── blogger/        # Blog service layer
│   │   └── shopping-assistant/  # Shopping assistant services
│   │
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript type definitions
│   ├── lib/                # Utility libraries
│   │   ├── supabase/       # Supabase client config
│   │   ├── mariadb/        # MariaDB client config
│   │   └── utils/          # Helper functions
│   │
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles
│
├── public/                 # Static assets
├── supabase/              # Backend (Edge Functions, migrations)
├── docs/                  # Infrastructure documentation
├── .env.example           # Environment variables template
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── CLAUDE.md              # AI development guidelines
└── FRONTEND.md            # This file
```

## Architecture

### Application Flow

```
User → App.tsx → Routes → ProtectedRoute → DashboardLayout → Page Components
                                                ↓
                                          Custom Hooks
                                                ↓
                                            Services
                                                ↓
                                    Supabase / External APIs
```

### Design Patterns

#### 1. Service Layer Pattern
All business logic is encapsulated in service classes that return consistent `ServiceResponse<T>` objects:

```typescript
interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}
```

#### 2. Custom Hooks Pattern
React hooks encapsulate data fetching, state management, and side effects:

```typescript
// Example: useProducts hook
export function useProducts(filters: ProductFilters) {
  const { data, error, isLoading, mutate } = useSWR(
    ['products', filters],
    () => productsService.getProducts(filters)
  );
  return { products, error, loading, refresh: mutate };
}
```

#### 3. Component Composition
Complex UIs are built from smaller, focused components following Single Responsibility Principle:

- Container components handle data fetching
- Presentational components handle rendering
- Maximum 100 lines per component file

## Key Features

### 1. Dashboard Overview
**Route**: `/dashboard`
**Components**: `DashboardPage.tsx`, `LiveMetrics`, `AgentStatusCard`, `ProcessingQueue`, `RecentActivity`

Real-time dashboard with:
- Live metrics cards with shimmer loading states
- Agent status monitoring (Category, Weight, SEO, Copyright)
- Processing queue visualization
- Recent activity feed with realtime updates
- Job queue management

### 2. Product Scraper Agent
**Route**: `/scraper-agent`
**Services**: `scraperProducts.service.ts`, `products.service.ts`

Features:
- Web scraping from multiple vendors
- Product data extraction (name, price, images, variants)
- Dynamic filtering with advanced filter builder
- Vendor statistics
- Stock status tracking
- Pin/unpin products for quick access

### 3. AI Agent Pipeline

#### Category Mapper
**Route**: `/agents/category`
- AI-powered category classification
- Confidence scoring
- Manual override capability
- Bulk classification

#### Weight & Dimension Extractor
**Route**: `/agents/weight`
- Intelligent weight extraction from product data
- Dimension calculation (L×W×H)
- Volumetric weight computation
- Confidence indicators
- 3D model viewer for products

#### SEO Optimizer
**Route**: `/agents/seo`
- Keyword research and suggestions
- Meta title/description generation
- SEO score calculation (0-100)
- Readability analysis
- Keyword density tracking

#### Copyright Detector
**Route**: `/agents/copyright`
- Brand copyright detection
- Trademark violation checks
- Image rights verification

#### Classification Agent
**Route**: `/agents/classification`
- UK medicine compliance checking
- Product classification (General Sale, Pharmacy, Prescription)
- Rejection workflows

### 4. Blogger (AI Blog Content Generator)
**Routes**: `/blogger`, `/blogger/create`, `/blogger/:id`
**Services**: `blogger/blogs.service.ts`, `blogger/ai.service.ts`, `blogger/shopify.service.ts`

Full-featured AI blog creation platform:

**9-Step Wizard**:
1. Topic Input - Define blog subject
2. Persona Selection - Choose writer voice (6 personas)
3. Template Selection - Pick content structure (9 templates)
4. Keyword Research - AI-powered keyword suggestions
5. Meta Data - SEO-optimized titles and descriptions
6. Content Preview - AI-generated markdown/HTML
7. SEO Optimization - Score tracking and improvements
8. Product Linking - Shopify product integration
9. Final Preview - Publish or save as draft

**Features**:
- E-E-A-T compliant content generation
- Google Gemini AI integration
- Shopify CMS publishing
- Image rehosting to Supabase Storage
- Auto-save to localStorage
- SEO score breakdown
- Readability metrics (Flesch Reading Ease)
- Tag management
- Featured images with alt text

### 5. Shopping Assistant
**Routes**: `/shopping-assistant/queue`, `/shopping-assistant/credentials`, `/shopping-assistant/prices`
**Services**: `shopping-assistant/cart-queue.service.ts`, `shopping-assistant/vendors.service.ts`

Automated shopping cart management:
- Multi-vendor account management
- Cart queue automation with Browserbase
- Price comparison across vendors
- Account credential storage (encrypted in Supabase)
- Migration history tracking
- Vendor performance analytics

### 6. Agent Tools
**Route**: `/agent-tools`
- Warehouse data upload (Excel/CSV)
- Batch operations
- Data import/export utilities

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key

# Shopify Admin API
SHOPIFY_API_KEY=your_shopify_admin_api_key

# MariaDB (ERP Integration)
VITE_MARIADB_HOST=your_mariadb_host
VITE_MARIADB_USER=your_mariadb_user
VITE_MARIADB_PASSWORD=your_mariadb_password
VITE_MARIADB_DATABASE=your_mariadb_database
```

### Vite Configuration

**File**: `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/ai-agents-dashboard/',  // GitHub Pages deployment
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Import alias
    },
  },
  server: {
    port: 3005,
    proxy: {
      '/api': {
        target: 'https://erpnext.mcgrocer.com',
        changeOrigin: true,
      },
    },
  },
});
```

### Tailwind CSS Configuration

**File**: `tailwind.config.js`

Custom design tokens:
- **Primary colors**: Blue scale (50-950)
- **Secondary colors**: Gray scale (50-950)
- **Custom animations**: `pulse-slow`, `slide-in`, `fade-in`, `shimmer`
- **Typography plugin**: Prose styling for blog content

## Component Organization

### UI Primitives (`src/components/ui/`)

Base components used throughout the app:

- **LoadingSpinner** - Animated spinner for loading states
- **StatusBadge** - Colored badges for status display
- **ConfidenceBadge** - Confidence score visualization
- **Pagination** - Page navigation with SWR integration
- **Dialog** - Modal dialog wrapper
- **ConfirmationDialog** - Yes/No confirmation prompts
- **Toast** - Notification messages
- **LiveIndicator** - Pulsing dot for realtime status
- **ShimmerLoader** - Skeleton loading placeholder
- **RetryButton** - Retry failed operations
- **AdvancedFilterButton** - Filter panel trigger
- **Model3DViewer** - Three.js product visualization

### Feature Components

Organized by feature domain:

**Blogger** (`src/components/blogger/`):
- BlogWizard, PersonaSelector, TemplateSelector
- ContentEditor (Markdown + HTML preview)
- SeoOptimizer, KeywordResearch
- ProductSelector, BlogCard, BlogList

**Products** (`src/components/products/`):
- ProductTabs (Overview, Category, Weight, SEO, Copyright, Variants, Raw Data)
- ProductHeader, AgentProductCard
- EditProductDialog, PriceComparisonDialog

**Dashboard** (`src/components/dashboard/`):
- StatCard, LiveMetrics, AgentStatusCard
- ProcessingQueue, RecentActivity
- JobQueueManager

## Services Layer

### Core Services (`src/services/`)

**Authentication** (`auth.service.ts`):
```typescript
class AuthService {
  signIn(credentials): Promise<AuthResponse>
  signUp(credentials): Promise<AuthResponse>
  signOut(): Promise<{ error: Error | null }>
  getSession()
  getUser()
  onAuthStateChange(callback)
  resetPassword(email)
  updatePassword(newPassword)
}
```

**Products** (`products.service.ts`):
```typescript
class ProductsService {
  getProducts(filters): Promise<{ products, count, error }>
  getProductById(id): Promise<{ product, error }>
  getPendingProducts(filters)
  getProductWithAgentData(productId)
  getVendors(): Promise<{ vendors, error }>
  updateBasicProductInfo(id, updates)
  deleteProduct(id)
  togglePinProduct(id, pinned)
  getPinnedProducts(filters)
}
```

**Agents** (`agents.service.ts`):
```typescript
class AgentsService {
  triggerAgent(params: TriggerAgentParams)
  retryAgent(params: RetryAgentParams)
  getAgentMetrics(agentType)
  getPendingForAgent(agentType)
  getFailedForAgent(agentType)
}
```

**Real-time** (`realtime.service.ts`):
- Supabase real-time subscriptions
- Change event handlers for scraped_products, pending_products
- Optimized update batching

### Blogger Services (`src/services/blogger/`)

- **blogs.service.ts** - CRUD for blog posts
- **personas.service.ts** - Writer persona management
- **templates.service.ts** - Blog template management
- **keywords.service.ts** - Keyword research caching
- **ai.service.ts** - External API integration (keyword research, content generation)
- **shopify.service.ts** - Shopify GraphQL API integration
- **seo-validator.service.ts** - SEO score calculation
- **gemini-content.service.ts** - Google Gemini AI content generation
- **images.service.ts** - Image rehosting to Supabase Storage
- **file-parser.service.ts** - Context file parsing (TXT, JSON, CSV, XLSX, PDF, DOCX)

### Shopping Assistant Services (`src/services/shopping-assistant/`)

- **vendors.service.ts** - Vendor management
- **accounts.service.ts** - Vendor account credentials
- **cart-queue.service.ts** - Cart automation queue
- **price-comparison.service.ts** - Multi-vendor price comparison

## State Management

### SWR for Data Fetching

The application uses **SWR (Stale-While-Revalidate)** for efficient data fetching and caching:

```typescript
import useSWR from 'swr';

function useProducts(filters: ProductFilters) {
  const { data, error, isLoading, mutate } = useSWR(
    ['products', filters],
    () => productsService.getProducts(filters),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    products: data?.products || [],
    count: data?.count || 0,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}
```

**Benefits**:
- Automatic caching and deduplication
- Background revalidation
- Optimistic updates
- Error retry logic
- Focus/network reconnection handling

### Local State Management

- **React useState** - Component-local state
- **localStorage** - Persistent state (wizard auto-save, user preferences)
- **Supabase Realtime** - Server-driven state synchronization

### Custom Hooks (`src/hooks/`)

**Authentication**:
- `useAuth()` - Current user, sign in/out methods

**Products**:
- `useProducts(filters)` - Product list with filters
- `useProduct(id)` - Single product detail
- `usePendingProducts()` - Products in agent queue
- `useVendors()` - Vendor list

**Agents**:
- `useAgentMetrics()` - Agent performance metrics
- `useTriggerAgent()` - Trigger agent processing
- `useRetryAgent()` - Retry failed agent tasks

**Dashboard**:
- `useDashboardMetrics()` - Overview statistics
- `useVendorStats()` - Vendor analytics
- `useRecentActivity()` - Activity feed

**Realtime**:
- `useRealtime()` - Subscribe to database changes
- `useDashboardRealtime()` - Dashboard-specific realtime
- `useAgentRealtime()` - Agent-specific realtime

**Scraper**:
- `useScraperProducts(filters)` - Scraped product data
- `useStockStatuses()` - Stock status options

**User**:
- `useUserPreferences()` - User settings and preferences

## Routing

### Route Structure

**Public Routes**:
- `/login` - Authentication page

**Protected Routes** (require authentication):
- `/dashboard` - Main dashboard
- `/scraper-agent` - Product scraper
- `/scraper-agent/:id` - Product detail
- `/agents` - Agent overview
- `/agents/category` - Category mapper
- `/agents/weight` - Weight & dimension extractor
- `/agents/seo` - SEO optimizer
- `/agents/copyright` - Copyright detector
- `/agents/classification` - Classification agent
- `/blogger` - Blog dashboard
- `/blogger/create` - Create blog wizard
- `/blogger/:id` - View blog
- `/blogger/:id/edit` - Edit blog wizard
- `/shopping-assistant` - Queue monitor (default)
- `/shopping-assistant/queue` - Cart queue
- `/shopping-assistant/prices` - Price comparison
- `/shopping-assistant/credentials` - Account management
- `/shopping-assistant/vendors/:vendorId` - Vendor detail
- `/agent-tools` - Utility tools
- `/admin` - Admin panel

### Route Protection

**File**: `src/components/auth/ProtectedRoute.tsx`

```typescript
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

### Navigation

**Sidebar Navigation** (`src/components/layout/DashboardLayout.tsx`):

- **Home**: Dashboard overview
- **Agents Section**:
  - Scraper
  - Category
  - Weight
  - SEO
  - Copyright
  - Classification
  - Blogger
  - Shopping Assistant
- **Tools Section**:
  - Agent Tools

## Styling & Design System

### Tailwind CSS

Utility-first CSS framework with custom configuration:

**Color System**:
- `primary-*` - Brand blue colors (50-950)
- `secondary-*` - Neutral grays (50-950)
- Semantic colors: `green`, `red`, `yellow`, `orange`, `purple`

**Spacing Scale**: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

**Typography**:
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- Line height: 1.5-1.7 for readability
- Font sizes: `text-xs` to `text-4xl`

**Border Radius**:
- `rounded` - 4px (inputs, buttons)
- `rounded-lg` - 8px (cards)
- `rounded-xl` - 12px (modals)
- `rounded-full` - 9999px (pills, avatars)

### Custom Animations

**Defined in `tailwind.config.js`**:

```javascript
animation: {
  'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'slide-in': 'slideIn 0.3s ease-out',
  'fade-in': 'fadeIn 0.5s ease-in',
  'shimmer': 'shimmer 2s linear infinite',
}
```

**Usage**:
- `animate-pulse-slow` - Live indicators
- `animate-slide-in` - Drawer/sidebar entrance
- `animate-fade-in` - Content reveal
- `animate-shimmer` - Skeleton loading states

### Responsive Design

Mobile-first approach with breakpoints:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Example**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop */}
</div>
```

### Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Focus States**: Clear focus rings on all focusable elements
- **ARIA Labels**: Proper labeling for screen readers
- **Color Contrast**: WCAG AA compliant (4.5:1 for text)
- **Semantic HTML**: Proper heading hierarchy, button/link distinction

## Development Guidelines

### Code Quality Standards

**From CLAUDE.md**:

1. **File Length**: Maximum 500 lines per file
2. **Function Length**: Maximum 50 lines per function
3. **Component Length**: Maximum 100 lines per component
4. **Line Length**: Maximum 100 characters per line

### Design Principles

1. **KISS (Keep It Simple, Stupid)**: Choose straightforward solutions
2. **YAGNI (You Aren't Gonna Need It)**: Implement only what's needed
3. **Single Responsibility**: One purpose per function/component
4. **Dependency Inversion**: Depend on abstractions, not implementations
5. **Fail Fast**: Check errors early, raise exceptions immediately

### Component Best Practices

**Presentational Component Example**:
```typescript
interface Props {
  title: string;
  status: 'pending' | 'complete' | 'failed';
  onRetry?: () => void;
}

export function StatusCard({ title, status, onRetry }: Props) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <StatusBadge status={status} />
      {status === 'failed' && onRetry && (
        <RetryButton onClick={onRetry} />
      )}
    </div>
  );
}
```

**Container Component Example**:
```typescript
export function ProductListContainer() {
  const [filters, setFilters] = useState<ProductFilters>({});
  const { products, loading, error, refresh } = useProducts(filters);

  if (error) return <ErrorMessage error={error} onRetry={refresh} />;
  if (loading) return <ShimmerLoader count={5} />;

  return (
    <ProductList
      products={products}
      onFilterChange={setFilters}
      onRefresh={refresh}
    />
  );
}
```

### TypeScript Guidelines

1. **Explicit Types**: Always define prop types and function return types
2. **Avoid `any`**: Use `unknown` or proper types instead
3. **Utility Types**: Leverage `Partial<T>`, `Pick<T>`, `Omit<T>`
4. **Type Guards**: Use type narrowing for conditional logic

**Type Definition Example**:
```typescript
// src/types/blogger.ts
export interface BloggerBlog {
  id: string;
  title: string;
  content: string;
  status: BlogStatus;
  created_at: string;
}

export type BlogStatus = 'draft' | 'published' | 'archived';

export interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}
```

### Error Handling

**Service Layer Pattern**:
```typescript
export async function createBlog(blog: CreateBlogInput): Promise<ServiceResponse<Blog>> {
  try {
    const { data, error } = await supabase
      .from('blogger_blogs')
      .insert(blog)
      .select()
      .single();

    if (error) {
      console.error('Error creating blog:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { data: null, error: error as Error, success: false };
  }
}
```

### Performance Optimization

1. **Code Splitting**: Dynamic imports for large features
2. **Memoization**: Use `React.memo`, `useMemo`, `useCallback` appropriately
3. **Lazy Loading**: Images and components load on demand
4. **Debouncing**: Search inputs and filter changes
5. **Pagination**: Load data in chunks, not all at once
6. **SWR Caching**: Prevent unnecessary API calls

**Example - Debounced Search**:
```typescript
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 500);

  return () => clearTimeout(timer);
}, [search]);

const { products } = useProducts({ search: debouncedSearch });
```

### Testing

**E2E Testing with Playwright**:

```bash
npm run test:e2e           # Run all tests
npm run test:e2e:ui        # Open Playwright UI
npm run test:e2e:headed    # Run with browser visible
```

## Build & Deployment

### Development Server

```bash
npm run dev    # Start dev server on http://localhost:3005
```

### Production Build

```bash
npm run build  # TypeScript compilation + Vite build → dist/
```

### GitHub Pages Deployment

```bash
npm run deploy # Build and deploy to gh-pages branch
```

**Deployment Configuration** (in `package.json`):
```json
{
  "homepage": "https://mcgrocer-com.github.io/ai-agents-dashboard",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "npx gh-pages -d dist"
  }
}
```

## External API Integrations

### 1. Supabase
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Email/password, session management
- **Real-time**: Live subscriptions to database changes
- **Storage**: Image hosting for blog featured images

### 2. Railway API (Blog Service)
**Base URL**: `https://mcgrocer-shopify-api.vercel.app`

Endpoints:
- `POST /blogs/keywords/{topic}` - Keyword research
- `POST /meta-data/generate` - Meta title/description generation
- `POST /advanced-blog/generate` - Blog content generation (GPT-4/Claude 3)
- `POST /blogs/products/search` - Shopify product search
- `POST /blogs/publish` - Publish to Shopify CMS

### 3. Shopify Admin API
**GraphQL API** for:
- Blog article creation/update/delete
- Product catalog queries
- Image management

### 4. ERPNext API
**REST API** at `https://erpnext.mcgrocer.com` for:
- Product synchronization
- Inventory management
- Item code mapping

### 5. Google Gemini AI
**Google Generative AI** for:
- Blog content generation
- Content refinement
- Context-aware writing

### 6. Browserbase
**Browser automation platform** for:
- Shopping cart automation
- Multi-vendor cart management
- Headless browser orchestration

## Debugging & Troubleshooting

### Common Issues

**1. Supabase Connection Errors**
- Check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Verify Supabase project is active
- Check browser console for CORS errors

**2. Real-time Updates Not Working**
- Ensure Supabase realtime is enabled for tables
- Check RLS policies allow SELECT for authenticated users
- Verify subscription cleanup in `useEffect` return

**3. Build Errors**
- Run `npm install` to ensure all dependencies are installed
- Clear `node_modules` and `dist`, then reinstall
- Check TypeScript errors: `npm run build`

**4. Authentication Issues**
- Clear browser localStorage and cookies
- Verify Supabase auth settings
- Check email confirmation settings

### Browser DevTools

**React DevTools**:
- Install React DevTools extension
- Inspect component props and state
- Profile performance bottlenecks

**Network Tab**:
- Monitor API requests
- Check request/response payloads
- Verify authentication headers

**Console**:
- Service logs use `console.error()` for errors
- Search for specific service: `[Blog Service]`, `[Products Service]`

## Contributing

### Workflow

1. Create feature branch from `main`
2. Follow code quality standards from CLAUDE.md
3. Test changes locally
4. Submit pull request with clear description
5. Ensure CI/CD checks pass

### Commit Messages

Follow conventional commits:
- `feat: add shopping cart price comparison`
- `fix: resolve blog image upload issue`
- `docs: update frontend architecture guide`
- `refactor: simplify product filter logic`
- `style: improve responsive layout on mobile`

## Future Enhancements

Potential improvements:
- [ ] Dark mode support
- [ ] Multi-language internationalization (i18n)
- [ ] Offline mode with service workers
- [ ] Advanced analytics dashboard
- [ ] Real-time collaboration features
- [ ] Mobile app (React Native)
- [ ] Webhook integrations
- [ ] Advanced A/B testing framework

## Resources

### Documentation
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [SWR Docs](https://swr.vercel.app)

### Related Documentation
- `CLAUDE.md` - AI development guidelines
- `README.md` - Project overview
- `supabase/` - Backend documentation

## License

Proprietary - MCGrocer Internal Tool

---

**Last Updated**: 2025-12-29

For questions or support, contact the development team.
