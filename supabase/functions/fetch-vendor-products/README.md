# Fetch Vendor Products

Secure API endpoint for fetching scraped product data from the database, filtered by vendor. Supports custom API key authentication with permission-based access control, pagination, and field selection.

## Endpoint

`POST /functions/v1/fetch-vendor-products`

## Authentication

**Required**: Custom API key authentication via `X-API-Key` header.

The API key must have `select` permission on the `scraped_products` table.

## Request Body

### Paginated Mode

```json
{
  "vendor": "boots",
  "fields": ["title", "price", "url", "image_url"],
  "page": 1,
  "page_size": 100
}
```

### Fetch All Mode

```json
{
  "vendor": "boots",
  "fields": ["title", "price", "url", "image_url"]
}
```

## Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| vendor | string | Yes | - | Vendor name (case-insensitive, trimmed) |
| fields | string[] | Yes | - | Array of field names to return |
| page | number | No | - | Page number (starts from 1) |
| page_size | number | No | 1000 | Number of results per page (max: 10000) |

## Response

### Paginated Mode Success (200)

```json
{
  "success": true,
  "data": [
    {
      "title": "Johnson's Baby Oil 300ml",
      "price": 3.49,
      "url": "https://www.boots.com/johnsons-baby-oil-300ml-10001533",
      "image_url": "https://example.com/image.jpg",
      "variance": null
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 100,
    "total_count": 1523,
    "total_pages": 16
  }
}
```

### Fetch All Mode Success (200)

```json
{
  "success": true,
  "data": [
    {
      "title": "Johnson's Baby Oil 300ml",
      "price": 3.49,
      "url": "https://www.boots.com/johnsons-baby-oil-300ml-10001533",
      "image_url": "https://example.com/image.jpg",
      "variance": null
    }
  ],
  "metadata": {
    "total_count": 1523,
    "vendor": "boots",
    "fields": ["title", "price", "url", "image_url"]
  }
}
```

### Error Responses

- **400**: Bad Request - Invalid or missing parameters
- **401**: Unauthorized - Missing or invalid API key
- **403**: Forbidden - API key lacks permission to read products
- **405**: Method Not Allowed - Only POST requests accepted
- **500**: Internal Server Error - Database error or unexpected failure

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key for database access |

## Examples

### cURL - Paginated Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-vendor-products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-custom-api-key-here" \
  -d '{
    "vendor": "boots",
    "fields": ["title", "price", "url", "image_url"],
    "page": 1,
    "page_size": 100
  }'
```

### cURL - Fetch All Products

```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-vendor-products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-custom-api-key-here" \
  -d '{
    "vendor": "boots",
    "fields": ["title", "price", "url", "description", "category"]
  }'
```

### JavaScript - Paginated Fetch

```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/fetch-vendor-products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-custom-api-key-here'
  },
  body: JSON.stringify({
    vendor: 'boots',
    fields: ['title', 'price', 'url'],
    page: 1,
    page_size: 50
  })
});

const data = await response.json();
console.log(`Page 1 of ${data.pagination.total_pages}`);
console.log(`Total products: ${data.pagination.total_count}`);
```

### JavaScript - Fetch All Products

```javascript
const response = await fetch('https://your-project.supabase.co/functions/v1/fetch-vendor-products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-custom-api-key-here'
  },
  body: JSON.stringify({
    vendor: 'boots',
    fields: ['title', 'price', 'url', 'category']
  })
});

const data = await response.json();
console.log(`Fetched ${data.metadata.total_count} products`);
```

### Pagination Loop Example

```javascript
async function fetchAllPages(apiKey, vendor, pageSize = 1000) {
  const allProducts = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const response = await fetch('https://your-project.supabase.co/functions/v1/fetch-vendor-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        vendor,
        fields: ['title', 'price', 'url'],
        page_size: pageSize,
        page: currentPage
      })
    });

    const result = await response.json();
    allProducts.push(...result.data);
    totalPages = result.pagination.total_pages;
    currentPage++;

    console.log(`Fetched page ${currentPage - 1}/${totalPages}`);

  } while (currentPage <= totalPages);

  return allProducts;
}
```

## Authentication Flow

1. **API Key Extraction**: Function reads `X-API-Key` header
2. **Key Verification**: Calls `verify_api_key` RPC function in Supabase
3. **Permission Check**: Validates API key has `select` permission on `scraped_products` table
4. **Request Processing**: If authorized, executes database query

## Data Transformation

The function automatically transforms the `variants` field to `variance` in the response:

```javascript
// Database field
variants: {...}

// API response field
variance: {...}
```

This transformation is applied to all returned products to maintain consistency with external API clients.

## Pagination

### Determining Mode

- **Paginated Mode**: If `page` OR `page_size` is provided
- **Fetch All Mode**: If neither `page` nor `page_size` is provided

### Page Calculation

- Pages start from 1 (not 0)
- Default page size: 1000
- Maximum page size: 10000
- Total pages calculated as: `Math.ceil(total_count / page_size)`

### Fetch All Behavior

When fetching all products (no pagination parameters):

1. Queries total count from database
2. Fetches data in internal batches of 1000 records
3. Continues until all records are fetched
4. Returns complete dataset with metadata (no pagination object)

**Warning**: Fetch all mode can return large datasets. Use pagination for better performance.

## Field Selection

### Supported Fields

Any field from the `scraped_products` table, including:

- `title`: Product title
- `price`: Product price (number)
- `url`: Product page URL
- `image_url`: Product image URL
- `description`: Product description
- `category`: Product category
- `vendor`: Vendor name
- `variants` (returned as `variance`): Product variants
- Plus any other fields in the table schema

### Automatic Fields

The `variants` field is automatically included in the query if not explicitly requested, ensuring the `variance` transformation is available for all responses.

## Validation

The function validates:

- **Vendor**: Must be a non-empty string
- **Fields**: Must be a non-empty array of strings
- **Page Size**: Must be positive number ≤ 10000
- **Page**: Must be positive number ≥ 1
- **API Key**: Must be present, valid, and have correct permissions

## Error Messages

### 400 Bad Request

```json
{
  "success": false,
  "error": "Missing or invalid 'vendor' field. Must be a non-empty string."
}
```

```json
{
  "success": false,
  "error": "Missing or invalid 'fields' field. Must be a non-empty array of strings."
}
```

```json
{
  "success": false,
  "error": "'page_size' cannot exceed 10000."
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing X-API-Key header. Custom API key is required."
}
```

```json
{
  "success": false,
  "error": "Invalid or expired API key."
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "API key does not have permission to read products."
}
```

## Performance Considerations

- **Pagination**: Recommended for large datasets
- **Field Selection**: Only request fields you need to reduce response size
- **Batch Size**: Internal batch size is 1000 records (not configurable)
- **Indexing**: Database queries are indexed on `vendor` field for fast filtering

## Database Schema

The function queries the `scraped_products` table with the following key fields:

```sql
CREATE TABLE scraped_products (
  id UUID PRIMARY KEY,
  vendor TEXT,
  title TEXT,
  price NUMERIC,
  url TEXT,
  image_url TEXT,
  description TEXT,
  category TEXT,
  variants JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## API Key Management

API keys are managed through the `api_keys` table and verified using the `verify_api_key` RPC function. Keys must have:

- Valid (not expired)
- Active status
- `select` permission on `scraped_products` table

See database migrations for API key table schema and RPC function definition.

## Related Functions

- **check-api-key-health**: Health check for API keys (uses different key types)
- **price-comparison**: Compares prices across vendors using external search
- **decodo-proxy**: Web scraping proxy for external sites

## Notes

- CORS is enabled for all origins
- Vendor names are case-insensitive and trimmed
- The `variants` → `variance` transformation is applied to all responses
- Fetch all mode continues until all records are retrieved, even if batches return fewer results
- API key permissions are checked on every request
- Database errors return 500 status with error details
