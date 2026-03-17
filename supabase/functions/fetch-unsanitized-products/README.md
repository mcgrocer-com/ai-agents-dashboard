# fetch-unsanitized-products

Fetches unsanitized products from `pending_products` for external AI agent processing.

A product is **unsanitized** when any of these agent statuses is not `'complete'`:
- `category_status`
- `weight_and_dimension_status`
- `seo_status`
- `faq_status`

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/fetch-unsanitized-products
```

## Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <SUPABASE_ANON_KEY>` |
| `Content-Type` | `application/json` |

## Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `batch_size` | integer | Yes | — | Number of products to fetch (must be > 0) |
| `mark_fetched` | boolean | No | `true` | If `true`, sets `fetched_at = NOW()` so products won't be returned again. If `false`, performs a read-only peek. |

## Examples

**Fetch and mark products (default):**
```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/fetch-unsanitized-products \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 25}'
```

**Peek without marking:**
```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/fetch-unsanitized-products \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 10, "mark_fetched": false}'
```

**Save response to file:**
```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/fetch-unsanitized-products \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 25, "mark_fetched": false}' \
  -o unsanitized_products.json
```

**Using Supabase JS client:**
```ts
const { data, error } = await supabase.functions.invoke(
  'fetch-unsanitized-products',
  { body: { batch_size: 25, mark_fetched: false } }
);
```

## Response

**Success (200):**
```json
{
  "success": true,
  "count": 25,
  "products": [ ... ]
}
```

**Validation error (400):**
```json
{
  "success": false,
  "error": "'batch_size' is required and must be a positive integer."
}
```

**Server error (500):**
```json
{
  "success": false,
  "error": "error message"
}
```
