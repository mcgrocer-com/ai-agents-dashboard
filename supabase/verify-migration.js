/**
 * Verify Database Migration
 * This script verifies that the copyright_feedback column exists in pending_products table
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');

  try {
    // Try to query the copyright_feedback column
    console.log('Testing if copyright_feedback column exists...');
    const { data, error } = await supabase
      .from('pending_products')
      .select('id, copyright_feedback')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('❌ MIGRATION NOT APPLIED: Column "copyright_feedback" does not exist');
        console.log('\nTo apply the migration, please:');
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Run the following SQL:\n');
        console.log('------------------------------------------------------------');
        console.log('ALTER TABLE pending_products');
        console.log('ADD COLUMN IF NOT EXISTS copyright_feedback TEXT;');
        console.log('');
        console.log('COMMENT ON COLUMN pending_products.copyright_feedback IS');
        console.log("'Optional feedback/guidance for copyright agent retry attempts';");
        console.log('------------------------------------------------------------');
        return false;
      } else {
        console.error('❌ Error:', error.message);
        return false;
      }
    }

    console.log('✅ SUCCESS: Column "copyright_feedback" exists and is accessible!');
    console.log('\nQuery result:');
    if (data && data.length > 0) {
      console.log(`- Found ${data.length} record(s)`);
      console.log('- Sample record:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('- No records in table (this is okay)');
    }

    // Try to insert a test value
    console.log('\n📝 Testing write permissions...');
    const testId = 'test-migration-' + Date.now();
    const { error: insertError } = await supabase
      .from('pending_products')
      .insert({
        id: testId,
        copyright_feedback: 'Test feedback from migration verification'
      });

    if (insertError) {
      if (insertError.message.includes('copyright_feedback')) {
        console.log('⚠️  Column exists but cannot write (this might be expected due to constraints)');
        console.log('   Error:', insertError.message);
      } else {
        console.log('ℹ️  Cannot insert test record (likely due to other required fields)');
        console.log('   This is expected and does not indicate a problem with the migration');
      }
    } else {
      console.log('✅ Successfully wrote test value to copyright_feedback column');

      // Clean up test record
      await supabase.from('pending_products').delete().eq('id', testId);
      console.log('✅ Cleaned up test record');
    }

    return true;

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

console.log('='.repeat(60));
console.log('Migration Verification Tool');
console.log('='.repeat(60));
console.log();

verifyMigration().then(success => {
  console.log();
  console.log('='.repeat(60));
  if (success) {
    console.log('✅ MIGRATION VERIFIED SUCCESSFULLY');
  } else {
    console.log('❌ MIGRATION VERIFICATION FAILED');
  }
  console.log('='.repeat(60));
  process.exit(success ? 0 : 1);
});
