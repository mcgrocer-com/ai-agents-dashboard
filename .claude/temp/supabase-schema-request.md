# Supabase Schema Analysis Request

**Agent**: supabase-backend-expert
**Requester**: frontend-developer (via delegate command)
**Priority**: High
**Context**: FilterBuilder implementation for agent pages

## Objective

Analyze the Supabase database schema to enable implementation of advanced filtering and image displays on three agent pages (scraper, category, weight-dimension).

## Required Analysis

### 1. Table/View Identification
Identify the correct table or view names for:
- **Scraper agent data** (likely `scraped_products` or similar)
- **Category agent data** (likely `category_products` or similar)
- **Weight-dimension agent data** (likely `weight_dimension_products` or similar)

### 2. Filterable Fields Inventory
For **each** agent's table/view, document ALL filterable fields:

#### Status Fields
- Exact field name (e.g., `status`, `processing_status`, `scraper_status`)
- PostgreSQL type (enum, varchar, text)
- All allowed values (pending, processing, completed, failed, etc.)
- Is it nullable?

#### Confidence Fields
- Exact field name (e.g., `confidence`, `confidence_score`, `ai_confidence`)
- PostgreSQL type (numeric, float, int, varchar)
- Range constraints (0-1, 0-100, etc.)
- Is it nullable?

#### Timestamp Fields
- `created_at`
- `updated_at`
- `processed_at`
- `scraped_at`
- Any other date/time fields
- Type and timezone handling

#### Product Information Fields
- `product_id`
- `product_name` / `title`
- `sku`
- `barcode` / `upc`
- `brand`
- `category`
- Any other product identifiers

#### Agent-Specific Fields
- Fields unique to each agent's processing
- Custom metadata or processing flags

### 3. Detailed Field Type Information
For each filterable field, provide:
```json
{
  "field_name": "status",
  "postgres_type": "enum",
  "enum_type_name": "product_status",
  "nullable": false,
  "default_value": "pending",
  "check_constraints": [],
  "description": "Current processing status of the product"
}
```

### 4. Image Field Structure
Analyze all image-related fields:
- **main_image**: Type, format, storage location (Supabase Storage? URL?)
- **images**: Array type? JSONB? Structure?
- **Image URL patterns**: How to construct full URLs?
- **Image metadata**: Any fields for alt text, dimensions, file size?

Example structure:
```json
{
  "main_image": {
    "field_name": "main_image",
    "type": "text",
    "format": "URL or storage path",
    "example": "https://..."
  },
  "images": {
    "field_name": "images",
    "type": "jsonb",
    "structure": "[{url: string, alt: string, order: number}]",
    "example": "[...]"
  }
}
```

### 5. Enum Type Documentation
List all ENUM types with their values:
```sql
CREATE TYPE product_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high');
```

For each enum:
- Type name
- All possible values (in order if applicable)
- Which tables/fields use it

### 6. Filter Implementation Guide
For each field, recommend:
- **UI Component**: dropdown, multiselect, range slider, text search, date range
- **SQL Pattern**: Exact query pattern for filtering
  ```sql
  -- Example for status filter
  WHERE status = ANY($1::product_status[])

  -- Example for confidence range
  WHERE confidence >= $1 AND confidence <= $2

  -- Example for text search
  WHERE product_name ILIKE '%' || $1 || '%'
  ```
- **Special Handling**: Case-insensitive, array operations, JSON queries, etc.

### 7. Current Implementation Review
Check the existing filter implementations:
- Review `frontend/lib/supabase/products.ts` to see current filter patterns
- Identify why status and confidence filters are broken
- Suggest fixes based on actual schema

## Deliverable Format

Please provide a structured document (JSON or Markdown) with:

```markdown
# Supabase Schema Analysis for Agent Pages

## 1. Table/View Names
- Scraper: `table_name`
- Category: `table_name`
- Weight-Dimension: `table_name`

## 2. Scraper Agent Fields
### Filterable Fields
| Field Name | Type | Nullable | Default | Values/Constraints |
|------------|------|----------|---------|-------------------|
| status | enum | No | 'pending' | pending, processing, completed, failed |
...

### Image Fields
...

## 3. Category Agent Fields
...

## 4. Weight-Dimension Agent Fields
...

## 5. Enum Types
...

## 6. Filter Implementation Recommendations
...

## 7. Current Issues & Fixes
- **Status Filter**: Currently broken because...
- **Confidence Filter**: Currently broken because...
```

## Tools to Use
- `mcp__supabase-mcp__list_tables` - Get all tables
- `mcp__supabase-mcp__execute_sql` - Query schema information
- `mcp__supabase-mcp__generate_typescript_types` - Get type definitions
- Any other Supabase MCP tools as needed

## Success Criteria
- ✅ All three agent tables/views identified
- ✅ Complete field inventory with exact types
- ✅ All enum values documented
- ✅ Image field structure clearly explained
- ✅ Filter implementation patterns provided
- ✅ Broken filter issues diagnosed and solutions provided

---

**Note**: This analysis will be used by the frontend-developer agent to implement FilterBuilder integration and fix broken filters on the agent pages.
