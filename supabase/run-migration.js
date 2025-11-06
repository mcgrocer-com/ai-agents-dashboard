/**
 * Run Database Migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'NOT SET');
  console.error('SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'set' : 'NOT SET');
  process.exit(1);
}

console.log('Using key type:', process.env.SUPABASE_SERVICE_KEY ? 'SERVICE_KEY' : 'ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('📋 Running database migration...\n');

  const migrationPath = join(__dirname, 'migrations', '20251105000000_add_copyright_feedback_to_pending_products.sql');

  try {
    // Read the migration file
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('Migration SQL:');
    console.log('-'.repeat(60));
    console.log(migrationSQL);
    console.log('-'.repeat(60));
    console.log();

    // Execute the migration
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error.message);

      // Try alternative method using raw SQL execution
      console.log('\nTrying alternative execution method...');
      const lines = migrationSQL.split(';').filter(line => line.trim());

      for (const sql of lines) {
        if (sql.trim()) {
          console.log(`Executing: ${sql.trim().substring(0, 50)}...`);
          const { error: execError } = await supabase.rpc('exec_sql', {
            query: sql.trim() + ';'
          });

          if (execError) {
            console.error(`❌ Error: ${execError.message}`);
          } else {
            console.log('✅ Success');
          }
        }
      }
    } else {
      console.log('✅ Migration executed successfully!');
    }

    // Verify the column was added
    console.log('\n🔍 Verifying column addition...');
    const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'pending_products'
        AND column_name = 'copyright_feedback';
      `
    });

    if (schemaError) {
      console.log('⚠️  Cannot verify using information_schema, trying direct query...');

      // Try a direct query to check if the column exists
      const { error: testError } = await supabase
        .from('pending_products')
        .select('copyright_feedback')
        .limit(1);

      if (testError) {
        console.error('❌ Column verification failed:', testError.message);
      } else {
        console.log('✅ Column "copyright_feedback" exists and is accessible!');
      }
    } else if (schemaData && schemaData.length > 0) {
      console.log('✅ Column "copyright_feedback" verified in schema:');
      schemaData.forEach(col => {
        console.log(`  - Name: ${col.column_name}`);
        console.log(`  - Type: ${col.data_type}`);
        console.log(`  - Nullable: ${col.is_nullable}`);
        console.log(`  - Default: ${col.column_default || 'NULL'}`);
      });
    } else {
      console.log('⚠️  Column not found in schema');
    }

    // Show all columns in pending_products table
    console.log('\n📊 All columns in pending_products table:');
    console.log('-'.repeat(60));
    const { data: allColumns, error: allColsError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'pending_products'
        ORDER BY ordinal_position;
      `
    });

    if (allColsError) {
      console.log('⚠️  Cannot retrieve schema information');
    } else if (allColumns) {
      allColumns.forEach(col => {
        const marker = col.column_name === 'copyright_feedback' ? '✨ ' : '  ';
        console.log(`${marker}${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

runMigration();
