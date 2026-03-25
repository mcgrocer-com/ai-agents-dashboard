# disable-products-in-erpnext

## Overview
Enables or disables products in ERPNext by calling the custom `disable_items` API endpoint. Used to toggle product visibility in the ERP system without deleting items.

## Endpoint
- **URL**: `/disable-products-in-erpnext`
- **Method**: POST
- **Authentication**: Supabase Auth (anon key or service role)

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Body
```json
{
  "urls": [
    "https://vendor.com/product-1",
    "https://vendor.com/product-2"
  ],
  "action": "disable"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| urls | string[] | Yes | Array of product URLs to enable/disable |
| action | string | No | `"disable"` (default) or `"enable"` |

## Response

### Success (200)
```json
{
  "success": true,
  "data": { /* ERPNext API response */ }
}
```

### Error - Missing URLs (400)
```json
{
  "success": false,
  "error": "urls array is required and cannot be empty"
}
```

### Error - Invalid Action (400)
```json
{
  "success": false,
  "error": "action must be 'enable' or 'disable'"
}
```

### Error - ERPNext API Failure
```json
{
  "success": false,
  "error": "ERPNext API error (500): <error details>"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| ERPNEXT_BASE_URL | No | ERPNext URL (default: `https://erpnext.mcgrocer.com`) |
| ERPNEXT_AUTH_TOKEN | Yes | ERPNext API authentication token |

## ERPNext API
Calls `mcgrocer_customization.apis.item.disable_items` with the provided URLs and action.

## Related Functions
- **handle-deleted-products** — Uses this function to disable deleted products in ERPNext
- **push-products-to-erpnext** — Pushes new products to ERPNext
- **sync-completed-products-to-erpnext** — Syncs completed products to ERPNext
