# APPLY MIGRATION - Quick Guide

## ⚠️ IMPORTANT: Migration Not Yet Applied

The `copyright_feedback` column does NOT exist in the `pending_products` table yet.

---

## 🚀 QUICK START - Apply Migration in 3 Steps

### Step 1: Open Supabase Dashboard

Click this link (or copy to browser):
```
https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/sql/new
```

### Step 2: Copy & Paste This SQL

```sql
ALTER TABLE pending_products
ADD COLUMN IF NOT EXISTS copyright_feedback TEXT;

COMMENT ON COLUMN pending_products.copyright_feedback IS 'Optional feedback/guidance for copyright agent retry attempts';
```

### Step 3: Click "Run" Button

The migration will execute immediately.

---

## ✅ Verify Migration Was Applied

After running the SQL in the dashboard, verify it worked:

```bash
cd G:\Projects\mcgrocer-project\ai-dashboard
node supabase/verify-migration.js
```

**Expected output:**
```
✅ SUCCESS: Column "copyright_feedback" exists and is accessible!
```

---

## 📋 What This Migration Does

- **Adds column:** `copyright_feedback` (TEXT, nullable)
- **To table:** `pending_products`
- **Purpose:** Store user feedback for copyright agent retries
- **Safe:** Uses `IF NOT EXISTS` so it won't fail if already applied

---

## 🔍 Current Status

**Migration File:**
- Location: `G:\Projects\mcgrocer-project\ai-dashboard\supabase\migrations\20251105000000_add_copyright_feedback_to_pending_products.sql`
- Status: ❌ NOT YET APPLIED (verified on 2025-11-05)

**Database:**
- Project: fxkjblrlogjumybceozk
- URL: https://fxkjblrlogjumybceozk.supabase.co
- Table: `pending_products`
- Missing column: `copyright_feedback`

---

## 🛠️ Alternative Methods

If you can't access the Supabase Dashboard:

### Method A: Use Service Key

1. Get service key from: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/settings/api
2. Add to `.env` file: `SUPABASE_SERVICE_KEY=your_key_here`
3. Run: `node supabase/run-migration.js`
4. Remove service key from `.env` for security

### Method B: Use Supabase CLI

```bash
# Install CLI
npm install -g supabase

# Link project
supabase link --project-ref fxkjblrlogjumybceozk

# Apply migration
supabase db push
```

---

## ❓ Need Help?

See detailed instructions in: `supabase/MIGRATION_INSTRUCTIONS.md`
