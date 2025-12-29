# reset-agent-completed

## Overview

Resets agent processing status from 'complete' back to 'pending' for all products or filtered by vendor. This allows re-processing products through specific AI agents (SEO or copyright agents) after they have already been marked as complete.

## Endpoint

- **URL**: `/reset-agent-completed`
- **Method**: `POST`
- **Authentication**: JWT Required (Supabase Auth)

## Request

### Headers

```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Body

```json
{
  "agentType": "seo" | "copyright",
  "vendor": "optional_vendor_name"
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agentType` | string | Yes | Type of agent to reset. Must be one of: `seo`, `copyright` |
| `vendor` | string | No | Optional vendor name to filter products. If omitted, resets all products for the agent type |

## Response

### Success Response

**Status Code**: `200 OK`

```json
{
  "success": true,
  "message": "Successfully reset 42 products from complete to pending for vendor_name",
  "stats": {
    "reset_count": 42
  }
}
```

### Error Responses

**Status Code**: `400 Bad Request`

```json
{
  "success": false,
  "error": "Invalid agent type. Must be one of: seo, copyright"
}
```

**Status Code**: `405 Method Not Allowed`

```json
{
  "success": false,
  "error": "Method not allowed. Use POST."
}
```

**Status Code**: `500 Internal Server Error`

```json
{
  "success": false,
  "error": "Error message describing the issue"
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for admin operations | Yes |

## Database Tables

### pending_products

This function updates the status columns in the `pending_products` table:

| Agent Type | Status Column Updated |
|------------|----------------------|
| `seo` | `seo_status` |
| `copyright` | `copyright_status` |

**Update Operation**: Sets status from `'complete'` to `'pending'` for matching products.

## Agent Status Column Mapping

```typescript
const agentStatusColumns: Record<AgentType, string> = {
  seo: 'seo_status',
  copyright: 'copyright_status',
}
```

## Example Usage

### Reset all SEO completed products

```bash
curl -X POST https://your-project.supabase.co/functions/v1/reset-agent-completed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "seo"
  }'
```

### Reset copyright completed products for specific vendor

```bash
curl -X POST https://your-project.supabase.co/functions/v1/reset-agent-completed \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentType": "copyright",
    "vendor": "bestway"
  }'
```

### JavaScript/TypeScript Example

```typescript
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/reset-agent-completed',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentType: 'seo',
      vendor: 'bestway', // Optional
    }),
  }
);

const result = await response.json();
console.log(`Reset ${result.stats.reset_count} products`);
```

## Use Cases

1. **Bulk Re-processing**: Reset all products to re-run AI agents with updated algorithms
2. **Vendor-Specific Updates**: Reset products from a specific vendor after data corrections
3. **Agent Tuning**: Re-process products after adjusting agent prompts or logic
4. **Quality Control**: Re-run agents on previously processed products for validation

## Related Functions

- **manual-push-to-pending**: Manually push products to pending queue with agent data preservation
- **classify-product**: AI agent for product classification
- **add-product-copyright**: Add product to copyright validation queue
- **remove-product-from-copyright**: Remove product from copyright validation queue

## Notes

- This function requires authentication via Supabase JWT
- Only products with status `'complete'` are affected
- The function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security policies
- Returns exact count of products reset using Supabase's count feature
- CORS is enabled for all origins with preflight support (`Access-Control-Allow-Origin: *`)
- Status update is atomic - all matching products updated in single transaction
- Console logs include agent type and vendor filter information for debugging
- Agent type validation prevents invalid status column updates
