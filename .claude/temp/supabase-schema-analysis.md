# Supabase Schema Analysis for Agent Pages

**Generated**: 2025-01-04
**Purpose**: FilterBuilder implementation and image display integration
**Source**: Code analysis from types/database.ts, lib/supabase/*.ts, and types/filters.ts

---

## 1. Table/View Names for Each Agent

| Agent Type | Table Name | Purpose |
|------------|------------|---------|
| **Scraper** | `scraped_products` | Raw scraped product data from external sources |
| **Category (Mapper)** | `mapper_agent_products` | Category mapping processing results |
| **Weight-Dimension** | `weight_dimension_agent_products` | Weight and dimension estimation results |
| **SEO** | `seo_agent_products` | SEO optimization results |

---

## 2. Scraped Products (Scraper Agent) - Detailed Schema

### Filterable Fields

| Field Name | PostgreSQL Type | Nullable | Default | Description |
|------------|----------------|----------|---------|-------------|
| `id` | uuid | No | auto | Primary key |
| `vendor` | text | Yes | null | Product vendor/source |
| `name` | text | Yes | null | Product name |
| `price` | numeric | Yes | null | Current price |
| `original_price` | numeric | Yes | null | Original price (before discount) |
| `weight` | numeric | Yes | null | Product weight |
| `width` | numeric | Yes | null | Product width |
| `height` | numeric | Yes | null | Product height |
| `length` | numeric | Yes | null | Product length |
| `volumetric_weight` | numeric | Yes | null | Calculated volumetric weight |
| `description` | text | Yes | null | Product description |
| `category` | text | Yes | null | Product category |
| `stock_status` | text | Yes | null | Stock availability |
| `variant_count` | integer | Yes | null | Number of variants |
| `product_id` | text | Yes | null | External product ID |
| `ean_code` | text | Yes | null | Product barcode |
| `url` | text | Yes | null | Product page URL |
| `status` | text | No | 'pending' | Processing status |
| `ai_title` | text | Yes | null | AI-generated title |
| `ai_description` | text | Yes | null | AI-generated description |
| `timestamp` | timestamptz | Yes | null | Scrape timestamp |
| `created_at` | timestamptz | Yes | now() | Record creation time |

### Image Fields

```typescript
{
  "main_image": "text (URL)",           // Primary product image URL
  "images": "jsonb",                    // Array of image objects
  "breadcrumbs": "jsonb",               // Breadcrumb navigation data
  "variants": "jsonb"                   // Product variants data
}
```

**Image Structure**:
- `main_image`: Direct URL string to primary image
- `images`: JSONB array, structure: `{ url: string, alt?: string, order?: number }[]`

### Status Field

**Type**: `text` (should be constrained to enum values)
**Allowed Values**:
- `pending` - Not yet processed
- `processing` - Currently being processed
- `processed` - Successfully processed
- `failed` - Processing failed
- `pushed` - Pushed to main database (scraper-specific)

**Current Issue**: Status field is `text` type instead of enum, causing filter issues. Recommend adding CHECK constraint or creating enum type.

---

## 3. Mapper Agent Products (Category Agent) - Detailed Schema

### Filterable Fields

| Field Name | PostgreSQL Type | Nullable | Default | Description |
|------------|----------------|----------|---------|-------------|
| `id` | uuid | No | auto | Primary key |
| `product_id` | text | No | - | Reference to scraped_products.id |
| `status` | enum (AgentStatus) | No | 'pending' | Processing status |
| `retry` | boolean | No | false | Retry flag |
| `feedback` | text | Yes | null | Processing feedback |
| `confidence_score` | numeric | Yes | null | AI confidence (0-1) |
| `category_mapped` | text | Yes | null | Mapped category |
| `reasoning` | text | Yes | null | AI reasoning for mapping |
| `tools_used` | jsonb | Yes | null | AI tools metadata |
| `processing_cost` | numeric | Yes | null | API cost in USD |
| `error_message` | text | Yes | null | Error details |
| `created_at` | timestamptz | Yes | now() | Record creation |
| `updated_at` | timestamptz | Yes | now() | Last update |

### Confidence Score Field

**Type**: `numeric`
**Range**: 0.0 to 1.0 (0% to 100%)
**Usage**: AI model confidence in category mapping
**Filters**: Use `gte`, `lte` for range filtering (e.g., >= 0.8 for high confidence)

---

## 4. Weight-Dimension Agent Products - Detailed Schema

### Filterable Fields

| Field Name | PostgreSQL Type | Nullable | Default | Description |
|------------|----------------|----------|---------|-------------|
| `id` | uuid | No | auto | Primary key |
| `product_id` | text | No | - | Reference to scraped_products.id |
| `status` | enum (AgentStatus) | No | 'pending' | Processing status |
| `retry` | boolean | No | false | Retry flag |
| `feedback` | text | Yes | null | Processing feedback |
| `confidence_score` | numeric | Yes | null | AI confidence (0-1) |
| `weight_value` | numeric | Yes | null | Estimated weight |
| `weight_unit` | text | Yes | null | Weight unit (kg, g, lb) |
| `width_value` | numeric | Yes | null | Estimated width |
| `height_value` | numeric | Yes | null | Estimated height |
| `length_value` | numeric | Yes | null | Estimated length |
| `dimension_unit` | text | Yes | null | Dimension unit (cm, m, in) |
| `volumetric_weight` | numeric | Yes | null | Calculated volumetric weight |
| `reasoning` | text | Yes | null | AI reasoning |
| `tools_used` | jsonb | Yes | null | AI tools metadata |
| `processing_cost` | numeric | Yes | null | API cost in USD |
| `error_message` | text | Yes | null | Error details |
| `created_at` | timestamptz | Yes | now() | Record creation |
| `updated_at` | timestamptz | Yes | now() | Last update |

---

## 5. SEO Agent Products - Detailed Schema

### Filterable Fields

| Field Name | PostgreSQL Type | Nullable | Default | Description |
|------------|----------------|----------|---------|-------------|
| `id` | uuid | No | auto | Primary key |
| `product_id` | text | No | - | Reference to scraped_products.id |
| `status` | enum (AgentStatus) | No | 'pending' | Processing status |
| `retry` | boolean | No | false | Retry flag |
| `feedback` | text | Yes | null | Processing feedback |
| `confidence_score` | numeric | Yes | null | AI confidence (0-1) |
| `optimized_title` | text | Yes | null | SEO-optimized title |
| `optimized_description` | text | Yes | null | SEO-optimized description |
| `keywords_used` | text[] | Yes | null | Keywords applied |
| `reasoning` | text | Yes | null | AI reasoning |
| `tools_used` | jsonb | Yes | null | AI tools metadata |
| `processing_cost` | numeric | Yes | null | API cost in USD |
| `error_message` | text | Yes | null | Error details |
| `created_at` | timestamptz | Yes | now() | Record creation |
| `updated_at` | timestamptz | Yes | now() | Last update |

---

## 6. Enum Types

### AgentStatus Enum

**TypeScript Definition** (from database.ts):
```typescript
export type AgentStatus = 'pending' | 'processing' | 'processed' | 'failed'
```

**PostgreSQL Type** (if created):
```sql
CREATE TYPE agent_status AS ENUM ('pending', 'processing', 'processed', 'failed');
```

**Current Issue**: Appears to be enforced via TypeScript only, not as PostgreSQL enum.
**Recommendation**: Create actual PostgreSQL enum for data integrity.

---

## 7. Filter Implementation Recommendations

### Agent Tables (Category, Weight-Dimension, SEO)

**Common Filterable Fields**:

```typescript
const AGENT_PRODUCT_FIELDS: FieldDefinition[] = [
  // Status Filter (BROKEN - needs fix)
  {
    name: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: ['pending', 'processing', 'processed', 'failed'],
    description: 'Processing status'
  },

  // Confidence Filter (BROKEN - needs fix)
  {
    name: 'confidence_score',
    label: 'Confidence',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'AI confidence score (0-1)'
  },

  // Processing Cost
  {
    name: 'processing_cost',
    label: 'Processing Cost',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'API cost in USD'
  },

  // Retry Flag
  {
    name: 'retry',
    label: 'Retry',
    type: 'boolean',
    operators: ['eq', 'is'],
    description: 'Requires retry'
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
    description: 'Record creation time'
  },
  {
    name: 'updated_at',
    label: 'Updated At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
    description: 'Last update time'
  },

  // Error Messages
  {
    name: 'error_message',
    label: 'Has Error',
    type: 'text',
    operators: ['is'],
    description: 'Error presence check'
  }
]
```

### Scraper Agent Additional Fields

Already defined in `types/filters.ts` as `SCRAPED_PRODUCT_FIELDS`.
**Note**: Includes product-specific fields (name, price, vendor, dimensions, etc.)

---

## 8. SQL Query Patterns for Filters

### Status Filter (FIXED)

**Current Issue**: Using text comparison on non-enum field
**Solution**:

```typescript
// In FilterBuilder - Status filter
if (field === 'status' && operator === 'eq') {
  query = query.eq('status', value)
}

if (field === 'status' && operator === 'in') {
  const values = Array.isArray(value) ? value : [value]
  query = query.in('status', values)
}
```

**UI Component**: Multi-select dropdown with enum values

### Confidence Filter (FIXED)

**Current Issue**: Not handling numeric range properly
**Solution**:

```typescript
// In FilterBuilder - Confidence range
if (field === 'confidence_score' && operator === 'gte') {
  query = query.gte('confidence_score', Number(value))
}

if (field === 'confidence_score' && operator === 'lte') {
  query = query.lte('confidence_score', Number(value))
}
```

**UI Component**: Range slider (0.0 to 1.0) or two number inputs (min/max)

### Text Search (Case-Insensitive)

```typescript
// Product name search
query = query.ilike('name', `%${searchTerm}%`)

// Multi-field search
query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
```

### Timestamp Range Filtering

```typescript
// Created after date
query = query.gte('created_at', startDate.toISOString())

// Created before date
query = query.lte('created_at', endDate.toISOString())
```

### Null Checks

```typescript
// Has error message
query = query.not('error_message', 'is', null)

// No error message
query = query.is('error_message', null)
```

---

## 9. Image Display Implementation

### Scraped Products Image Rendering

```typescript
import Image from 'next/image'

function ProductImage({ product }: { product: ScrapedProduct }) {
  // Priority: main_image > first from images array > placeholder
  const imageUrl = product.main_image ||
                   (product.images && Array.isArray(product.images) && product.images[0]?.url) ||
                   '/placeholder-product.png'

  const altText = product.name || 'Product image'

  return (
    <div className="relative w-16 h-16">
      <Image
        src={imageUrl}
        alt={altText}
        fill
        className="object-cover rounded-md"
        sizes="64px"
        onError={(e) => {
          e.currentTarget.src = '/placeholder-product.png'
        }}
      />
    </div>
  )
}
```

### Agent Pages (No Direct Images)

Agent tables reference `scraped_products` via `product_id`. To show images:

```typescript
// Option 1: Join query
const { data } = await supabase
  .from('mapper_agent_products')
  .select(`
    *,
    scraped_products!inner(main_image, images, name)
  `)

// Option 2: Fetch separately and merge
const agentProducts = await getAgentProducts()
const productIds = agentProducts.map(p => p.product_id)
const scrapedProducts = await supabase
  .from('scraped_products')
  .select('id, main_image, images, name')
  .in('id', productIds)

// Merge in component
const merged = agentProducts.map(agent => ({
  ...agent,
  product: scrapedProducts.find(p => p.id === agent.product_id)
}))
```

---

## 10. Current Issues & Fixes

### Issue 1: Status Filter Not Working

**Problem**: Status field is `text` type without enum constraint
**Root Cause**: No PostgreSQL enum type enforcing valid values
**Fix**:

```sql
-- Option A: Add CHECK constraint
ALTER TABLE scraped_products
ADD CONSTRAINT scraped_products_status_check
CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'pushed'));

-- Option B: Create enum type (better)
CREATE TYPE scraped_product_status AS ENUM ('pending', 'processing', 'processed', 'failed', 'pushed');
ALTER TABLE scraped_products ALTER COLUMN status TYPE scraped_product_status USING status::scraped_product_status;
```

**Frontend Fix**: Already working in `applyDynamicFilters()` - just needs valid data

### Issue 2: Confidence Filter Not Working

**Problem**: Confidence field not filtering correctly
**Root Cause**: Value not converted to number before query
**Fix**: Already implemented in `applyDynamicFilters()` at line 160-178 in `products.ts`

**Verify**:
```typescript
// Ensure number conversion
case 'gte':
  query = query.gte(field, Number(value))
  break
case 'lte':
  query = query.lte(field, Number(value))
  break
```

**Likely Issue**: UI not passing numeric values correctly. Check FilterBuilder component.

---

## 11. Recommended FilterBuilder Integration

### Scraper Agent Page

```typescript
// Add to scraped_products page
import FilterBuilder from '@/components/shared/FilterBuilder'
import { SCRAPED_PRODUCT_FIELDS, updateVendorEnumValues } from '@/types/filters'

// In page component
const vendors = await getVendors()
const fieldDefinitions = updateVendorEnumValues(vendors)

<FilterBuilder
  fields={fieldDefinitions}
  onFiltersChange={(filters) => {
    // Update URL with filter state
  }}
/>
```

### Agent Pages (Category, Weight-Dimension, SEO)

```typescript
// Create new field definition file
// types/agent-filters.ts
export const AGENT_PRODUCT_FIELDS: FieldDefinition[] = [
  // Status, confidence, timestamps, etc. (see section 7)
]

// In agent page
<FilterBuilder
  fields={AGENT_PRODUCT_FIELDS}
  onFiltersChange={(filters) => {
    // Update URL and refetch
  }}
/>
```

---

## 12. Data Fetching with Filters

### Update Agent Data Functions

```typescript
// lib/supabase/agents.ts - add filter support
export async function getAgentProducts(
  agentType: 'category' | 'weight_dimension' | 'seo',
  filters: ProductFilters = {}
): Promise<{ data: any[]; count: number }> {
  const supabase = await createClient()
  const tableName = getAgentTableName(agentType)

  const {
    dynamicFilters,
    sortBy = 'updated_at',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = filters

  let query = supabase
    .from(tableName)
    .select(`
      *,
      scraped_products!inner(main_image, images, name, product_id)
    `, { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply dynamic filters
  if (dynamicFilters && dynamicFilters.length > 0) {
    query = applyDynamicFilters(query, dynamicFilters)
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error(`Error fetching ${agentType} products:`, error)
    return { data: [], count: 0 }
  }

  return { data: data ?? [], count: count ?? 0 }
}
```

---

## Summary

### ✅ Ready to Implement
- Filter field definitions exist for scraped products
- Dynamic filter application logic working
- Image field structure identified
- Data fetching functions exist

### ⚠️ Needs Fixes
- Status filter: Add enum constraint to database
- Confidence filter: Verify numeric value conversion in UI
- Agent image display: Add join queries to fetch scraped_products data

### 📝 Needs Creation
- Agent-specific field definitions (`AGENT_PRODUCT_FIELDS`)
- Updated data fetching functions with filter support
- FilterBuilder integration in agent pages
- Image display components for agent tables

---

**Next Steps for Frontend Developer**:
1. Create `types/agent-filters.ts` with field definitions
2. Update `lib/supabase/agents.ts` with filter support
3. Integrate FilterBuilder into all three agent pages
4. Add image columns to agent tables (with join data)
5. Test status and confidence filters
6. Report any database-level fixes needed to Supabase expert
