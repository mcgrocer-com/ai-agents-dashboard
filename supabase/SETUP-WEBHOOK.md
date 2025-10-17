# Database Webhook Setup Guide

## Overview

The `push-to-pending` Edge Function automatically creates entries in `pending_products` table when new products are inserted into `scraped_products`. This requires a database webhook to be configured in the Supabase Dashboard.

## Quick Setup Steps

### 1. Deploy Edge Function ✅ (Already Done)
```bash
# Function already deployed as version 2
# Function ID: e4a46f84-92af-4742-bd98-2e6ab57a6bca
# Status: ACTIVE
```

### 2. Configure Database Webhook (Required)

Go to: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/database/webhooks

**Click "Create a new hook" and configure:**

| Setting | Value |
|---------|-------|
| **Name** | `push-to-pending-on-insert` |
| **Table** | `scraped_products` |
| **Events** | `INSERT` only ✅ |
| **Type** | HTTP Request |
| **Method** | POST |
| **URL** | `https://fxkjblrlogjumybceozk.supabase.co/functions/v1/push-to-pending` |

**HTTP Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4
Content-Type: application/json
```

### 3. Test the Webhook

Insert a test product:
```bash
curl -X POST \
  https://fxkjblrlogjumybceozk.supabase.co/functions/v1/seed-scraped-products \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4" \
  -H "X-API-Key: 1338480e917320390f08b590b9df4dd17a4faa0b8eddfb2d2465224358177769" \
  -H "Content-Type: application/json" \
  -d '[{
    "vendor": "test-webhook",
    "name": "Webhook Test Product",
    "url": "https://test.com/webhook-test",
    "price": 19.99,
    "description": "Testing webhook",
    "stock_status": "in stock",
    "images": ["test.jpg"],
    "main_image": "test.jpg",
    "product_id": "WEBHOOK-TEST",
    "original_price": 24.99,
    "timestamp": "2025-10-02T12:00:00Z"
  }]'
```

Verify in database:
```sql
SELECT * FROM pending_products WHERE vendor = 'test-webhook';
```

### 4. Monitor Webhook Activity

**View Logs:**
1. Go to Database → Webhooks
2. Click on `push-to-pending-on-insert`
3. Click **Invocations** tab
4. See delivery status, response codes, and timestamps

**View Edge Function Logs:**
1. Go to Edge Functions → `push-to-pending`
2. Click **Logs** tab
3. See function execution logs and errors

## How It Works

### Workflow
1. Product inserted into `scraped_products` (via seed-scraped-products endpoint)
2. Database webhook triggers automatically
3. Webhook sends POST request to `push-to-pending` Edge Function
4. Edge Function receives webhook payload
5. Maps `scraped_product` to `pending_product` schema
6. Inserts into `pending_products` table with default statuses
7. Returns success/failure response

### Data Flow
```
scraped_products (INSERT)
    ↓
Database Webhook
    ↓
push-to-pending Edge Function
    ↓
pending_products (INSERT)
    ↓
Agents process (category, weight, SEO)
```

### Default Values Set by Edge Function
- `category_status`: `'pending'`
- `weight_and_dimension_status`: `'pending'`
- `seo_status`: `'pending'`
- `erpnext_updated_at`: `null` (auto-set by database)
- `created_at`: `now()` (auto-set by database)

## Troubleshooting

### Webhook not firing
- Check webhook is enabled in Dashboard
- Verify events checkbox includes INSERT
- Check webhook URL is correct

### Function errors
- View Edge Function logs for error details
- Check service role key is set in environment
- Verify pending_products table schema matches

### Duplicate entries
- Edge Function handles duplicates gracefully
- Returns success even if pending product already exists
- Check foreign key constraints on `scraped_product_id`

## Security Notes

- Edge Function uses **service role key** (internal function)
- Webhook authenticates with **anon key**
- Function is not directly exposed to public (triggered by database only)
- Foreign key constraints prevent orphan pending products

## Related Files

- **Edge Function**: [supabase/functions/push-to-pending/index.ts](functions/push-to-pending/index.ts)
- **Documentation**: [supabase/functions/push-to-pending/README.md](functions/push-to-pending/README.md)
- **Original Python Script**: [scripts/push_to_pending.py](../scripts/push_to_pending.py)
