/**
 * Apply Migration via Supabase Management API
 * This attempts to execute the migration using direct HTTP requests
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function executeSQLViaAPI() {
  console.log('🚀 Attempting to execute migration via API...\n');

  const migrationPath = join(__dirname, 'migrations', '20251105000000_add_copyright_feedback_to_pending_products.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('Migration SQL:');
  console.log('-'.repeat(60));
  console.log(migrationSQL);
  console.log('-'.repeat(60));
  console.log();

  // Extract the project reference from the URL
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  console.log('Project Reference:', projectRef);

  // Try the pg/query endpoint (PostgREST)
  const endpoint = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

  console.log('Attempting to execute via:', endpoint);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response:', result);

    if (response.ok) {
      console.log('✅ Migration executed successfully!');
      return true;
    } else {
      console.log('❌ Migration failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

console.log('='.repeat(60));
console.log('Migration Application via API');
console.log('='.repeat(60));
console.log();
console.log('⚠️  Note: This requires the anon key to have DDL permissions');
console.log('   If this fails, you will need to:');
console.log('   1. Use the Supabase Dashboard SQL Editor, OR');
console.log('   2. Provide the SUPABASE_SERVICE_KEY in .env file');
console.log();

executeSQLViaAPI().then(success => {
  if (!success) {
    console.log();
    console.log('='.repeat(60));
    console.log('❌ API execution failed');
    console.log();
    console.log('Please apply the migration manually:');
    console.log('1. Go to: https://supabase.com/dashboard/project/' + process.env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0]);
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the migration SQL shown above');
    console.log('4. Then run: node supabase/verify-migration.js');
    console.log('='.repeat(60));
  }
  process.exit(success ? 0 : 1);
});
