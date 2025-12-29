# Add to Cart Queue - ERPNext Integration

## Overview
Receives cart requests from ERPNext and queues them for automated add-to-cart processing. The queue processor picks up pending items and uses browser automation to add products to vendor carts. Auto-creates vendors if not found in the database (for UK vendors fallback from ERPNext).

## Endpoint
- **URL**: `/add-to-cart`
- **Method**: `POST`
- **Authentication**: None (uses service role key internally)

## Request

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "product_url": "string (required)",
  "vendor": "string (required)",
  "quantity": "number (optional, default: 1)",
  "product_name": "string (optional)",
  "product_data": "object (optional)"
}
```

#### Field Descriptions
- `product_url`: Full URL of the product to add to cart. Must be a valid URL.
- `vendor`: Vendor name (e.g., "tesco", "sainsburys"). Case-insensitive.
- `quantity`: Number of items to add to cart. Defaults to 1.
- `product_name`: Optional product name for display purposes.
- `product_data`: Additional product metadata. Automatically includes quantity and source.

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "queue_id": "uuid",
  "message": "Product queued for automated add to {vendor}",
  "vendor_created": false
}
```

#### Fields
- `queue_id`: UUID of the created cart queue entry
- `message`: Human-readable status message
- `vendor_created`: Boolean indicating if vendor was auto-created (true) or already existed (false)

### Special Case: Manual Required (200 OK)
If vendor requires captcha:
```json
{
  "success": true,
  "queue_id": "uuid",
  "message": "Product queued for manual add ({vendor} requires captcha)",
  "vendor_created": false
}
```

### Error Responses

#### 400 Bad Request - Missing product_url
```json
{
  "success": false,
  "error": "Missing required field: product_url"
}
```

#### 400 Bad Request - Missing vendor
```json
{
  "success": false,
  "error": "Missing required field: vendor"
}
```

#### 400 Bad Request - Invalid URL
```json
{
  "success": false,
  "error": "Invalid product_url: must be a valid URL"
}
```

#### 400 Bad Request - Automation not supported
```json
{
  "success": false,
  "error": "Vendor \"{vendor}\" does not support automation. Manual add required."
}
```

#### 405 Method Not Allowed
```json
{
  "success": false,
  "error": "Method not allowed. Use POST."
}
```

#### 500 Internal Server Error - Vendor creation failed
```json
{
  "success": false,
  "error": "Failed to auto-create vendor \"{vendor}\": {details}"
}
```

#### 500 Internal Server Error - General error
```json
{
  "success": false,
  "error": "error message"
}
```

## Environment Variables
- `SUPABASE_URL` (required): Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (required): Service role key for bypassing RLS

## Database Tables

### cart_queue (writes)
Cart queue entries with the following fields:
- `id`: Auto-generated UUID
- `user_id`: Fixed system user ID (00000000-0000-0000-0000-000000000000)
- `vendor_id`: Foreign key to vendors table
- `product_url`: URL of product to add
- `product_name`: Optional product name
- `product_data`: JSONB containing quantity, source, and custom metadata
- `status`: Initial status ('pending' or 'manual_required' based on captcha requirement)
- `attempts`: Initialized to 0
- `max_attempts`: Set to 3

### vendors (reads/writes)
Vendor information:
- `id`: Primary key
- `name`: Vendor name (searched case-insensitive)
- `domain`: Extracted from product URL for new vendors
- `can_automate`: Boolean flag for automation support
- `requires_captcha`: Boolean flag for captcha requirement
- `login_url`, `cart_url`, `selectors`: Nullable automation config
- `is_prioritized`: Boolean, set to false for auto-created vendors
- `rate_limit_daily`: Set to 50 for auto-created vendors

## Auto-Creation Logic
When a vendor is not found:
1. Extracts domain from product URL (removes 'www.' prefix)
2. Creates vendor with default automation-friendly settings:
   - `can_automate`: true
   - `requires_captcha`: false
   - `is_prioritized`: false
   - `rate_limit_daily`: 50
3. Returns `vendor_created: true` in response

## Queue Status Logic
- **pending**: Normal queue status for automated processing (vendor does not require captcha)
- **manual_required**: Set when `vendor.requires_captcha` is true

## System User
Uses a fixed UUID for all cart queue entries:
```
00000000-0000-0000-0000-000000000000
```

## Example Usage

### Basic Request
```bash
curl -X POST https://your-project.supabase.co/functions/v1/add-to-cart \
  -H "Content-Type: application/json" \
  -d '{
    "product_url": "https://www.tesco.com/groceries/en-GB/products/123456",
    "vendor": "tesco",
    "quantity": 2,
    "product_name": "Tesco Milk 2L"
  }'
```

### Response
```json
{
  "success": true,
  "queue_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "message": "Product queued for automated add to Tesco",
  "vendor_created": false
}
```

### Auto-Creation Example
Request for unknown vendor:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/add-to-cart \
  -H "Content-Type: application/json" \
  -d '{
    "product_url": "https://www.waitrose.com/shop/product/123",
    "vendor": "waitrose"
  }'
```

Response:
```json
{
  "success": true,
  "queue_id": "b2c3d4e5-6789-01bc-def1-234567890abc",
  "message": "Product queued for automated add to waitrose",
  "vendor_created": true
}
```

## CORS Support
Allows cross-origin requests from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

## Queue Processing

The queue is processed by a separate automation worker (not part of this edge function):

- **Pending**: Ready for automated processing
- **Processing**: Currently being added by worker
- **Complete**: Successfully added to cart
- **Failed**: Max attempts reached without success
- **Manual Required**: Vendor requires captcha or manual intervention

## Related Functions

- **fetch-vendor-products**: Fetch products from vendor websites
- **resync-product-to-erpnext**: Sync product data back to ERPNext
- **push-products-to-erpnext**: Push completed products to ERPNext

## Integration with ERPNext

This function is designed to work with ERPNext shopping cart integration:

1. ERPNext sends cart requests to this edge function
2. Products are queued in Supabase `cart_queue` table
3. Browser automation worker picks up pending items
4. Worker uses Playwright/Puppeteer to add products to vendor carts
5. Status updates are synced back to ERPNext

## Notes
- This function is designed for integration with ERPNext
- All requests use a single system user ID (non-multi-tenant): `00000000-0000-0000-0000-000000000000`
- Queue processor (separate service) handles the actual browser automation
- Vendor auto-creation enables flexible fallback for UK vendors not yet in database
- Domain extraction removes 'www.' prefix for consistency
- Vendor name matching is case-insensitive using PostgreSQL's `ilike`
- URL validation uses JavaScript's URL constructor
- Quantity defaults to 1 if not provided
- Product data is stored as JSONB for flexible metadata with automatic source tracking
- Maximum retry attempts is hardcoded to 3
- CORS is enabled for all origins with preflight support
