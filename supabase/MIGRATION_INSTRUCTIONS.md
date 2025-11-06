# Database Migration Instructions

## Migration: Add copyright_feedback Column to pending_products Table

**Migration File:** `supabase/migrations/20251105000000_add_copyright_feedback_to_pending_products.sql`

**Status:** Not yet applied (as of verification)

---

## Why This Migration is Needed

The `copyright_feedback` column was missing from the `pending_products` table. This column is used to store optional feedback/guidance for copyright agent retry attempts, similar to the other feedback columns (seo_feedback, weight_dimension_feedback, mapper_feedback).

---

## Option 1: Apply via Supabase Dashboard (Recommended)

This is the safest and most straightforward method.

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk
   - Log in with your Supabase credentials

2. **Navigate to SQL Editor**
   - In the left sidebar, click on "SQL Editor"
   - Click on "+ New query" to create a new SQL query

3. **Copy and Paste the Migration SQL**
   ```sql
   -- Add copyright_feedback field to pending_products table
   -- This field was missing from the original feedback fields migration

   ALTER TABLE pending_products
   ADD COLUMN IF NOT EXISTS copyright_feedback TEXT;

   COMMENT ON COLUMN pending_products.copyright_feedback IS 'Optional feedback/guidance for copyright agent retry attempts';
   ```

4. **Execute the Query**
   - Click the "Run" button or press Ctrl+Enter (Cmd+Enter on Mac)
   - You should see a success message

5. **Verify the Migration**
   - Run the verification script from the project root:
     ```bash
     cd G:\Projects\mcgrocer-project\ai-dashboard
     node supabase/verify-migration.js
     ```
   - You should see: "✅ SUCCESS: Column "copyright_feedback" exists and is accessible!"

---

## Option 2: Apply via Supabase CLI

If you prefer using the command line, install the Supabase CLI first.

### Steps:

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Link to Your Project**
   ```bash
   cd G:\Projects\mcgrocer-project\ai-dashboard
   supabase link --project-ref fxkjblrlogjumybceozk
   ```
   - You'll be prompted to enter your Supabase password

3. **Apply the Migration**
   ```bash
   supabase db push
   ```
   - This will apply all pending migrations

4. **Verify the Migration**
   ```bash
   node supabase/verify-migration.js
   ```

---

## Option 3: Apply with Service Key (Programmatic)

If you have access to the Supabase service key (also called service_role key):

### Steps:

1. **Get the Service Key**
   - Go to: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/settings/api
   - Copy the "service_role" key (starts with "eyJ...")
   - **⚠️ IMPORTANT:** This key has full admin access - keep it secret!

2. **Add to .env File**
   ```bash
   echo "SUPABASE_SERVICE_KEY=your_service_role_key_here" >> .env
   ```

3. **Run the Migration Script**
   ```bash
   node supabase/run-migration.js
   ```

4. **Remove the Service Key from .env**
   - For security, remove the service key after use:
   ```bash
   # Edit .env and remove the SUPABASE_SERVICE_KEY line
   ```

---

## Verification

After applying the migration using any method above, verify it was successful:

```bash
cd G:\Projects\mcgrocer-project\ai-dashboard
node supabase/verify-migration.js
```

**Expected Output:**
```
============================================================
Migration Verification Tool
============================================================

🔍 Verifying migration...

Testing if copyright_feedback column exists...
✅ SUCCESS: Column "copyright_feedback" exists and is accessible!

============================================================
✅ MIGRATION VERIFIED SUCCESSFULLY
============================================================
```

---

## Troubleshooting

### Error: "permission denied for table pending_products"

**Cause:** You're using the anon key which doesn't have DDL permissions.

**Solution:** Use Option 1 (Dashboard) or Option 3 (Service Key)

### Error: "column already exists"

**Cause:** The migration has already been applied.

**Solution:** Run the verification script to confirm the column exists:
```bash
node supabase/verify-migration.js
```

### Error: "table pending_products does not exist"

**Cause:** The pending_products table hasn't been created yet.

**Solution:** Apply any pending migrations for the pending_products table first.

---

## Migration File Details

**File Location:** `G:\Projects\mcgrocer-project\ai-dashboard\supabase\migrations\20251105000000_add_copyright_feedback_to_pending_products.sql`

**SQL Content:**
```sql
-- Add copyright_feedback field to pending_products table
-- This field was missing from the original feedback fields migration

ALTER TABLE pending_products
ADD COLUMN IF NOT EXISTS copyright_feedback TEXT;

COMMENT ON COLUMN pending_products.copyright_feedback IS 'Optional feedback/guidance for copyright agent retry attempts';
```

**Column Details:**
- **Name:** copyright_feedback
- **Type:** TEXT
- **Nullable:** Yes (NULL allowed)
- **Purpose:** Store optional feedback/guidance for copyright agent retry attempts

---

## Next Steps After Migration

Once the migration is successfully applied:

1. ✅ The `copyright_feedback` column will be available in the `pending_products` table
2. ✅ The CopyrightAgentPage can read and write to this column
3. ✅ Users can provide feedback when retrying copyright analysis
4. ✅ The feedback will be stored and can be used to improve retry attempts

---

## Helper Scripts

The following scripts are available in the `supabase/` directory:

- **run-migration.js** - Attempts to run the migration (requires service key)
- **verify-migration.js** - Verifies if the migration has been applied
- **apply-migration-via-api.js** - Attempts to apply via REST API (usually fails without permissions)

All scripts can be run with:
```bash
cd G:\Projects\mcgrocer-project\ai-dashboard
node supabase/<script-name>.js
```
