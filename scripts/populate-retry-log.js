/**
 * One-time script to populate classification_retry_log for existing failed products
 *
 * This script finds products that failed classification before the retry system was deployed
 * and creates log entries so they can be picked up by the retry cron job.
 *
 * Run once: node scripts/populate-retry-log.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ||
                     process.env.VITE_SUPABASE_URL ||
                     'https://fxkjblrlogjumybceozk.supabase.co';

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                           process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('\nTo get your service role key, run:');
  console.error('  npx supabase status --project-id fxkjblrlogjumybceozk');
  console.error('\nOr set it temporarily:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_key_here node scripts/populate-retry-log.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Finding products with failed classifications...\n');

  // Step 1: Find products with classification = NULL and status = 'pending'
  const { data: failedProducts, error: queryError } = await supabase
    .from('scraped_products')
    .select('id, name, vendor, url')
    .eq('status', 'pending')
    .is('classification', null);

  if (queryError) {
    console.error('❌ Error querying scraped_products:', queryError);
    process.exit(1);
  }

  if (!failedProducts || failedProducts.length === 0) {
    console.log('✅ No failed products found');
    process.exit(0);
  }

  console.log(`📦 Found ${failedProducts.length} products with NULL classification`);

  // Step 2: Filter out products already in pending_products
  const productIds = failedProducts.map(p => p.id);
  const { data: pendingProducts, error: pendingError } = await supabase
    .from('pending_products')
    .select('scraped_product_id')
    .in('scraped_product_id', productIds);

  if (pendingError) {
    console.error('❌ Error querying pending_products:', pendingError);
    process.exit(1);
  }

  const pendingIds = new Set((pendingProducts || []).map(p => p.scraped_product_id));
  const productsNeedingRetry = failedProducts.filter(p => !pendingIds.has(p.id));

  console.log(`🚫 Filtered out ${failedProducts.length - productsNeedingRetry.length} products already in pending_products`);
  console.log(`📊 ${productsNeedingRetry.length} products need retry log entries\n`);

  if (productsNeedingRetry.length === 0) {
    console.log('✅ No log entries needed');
    process.exit(0);
  }

  // Step 3: Check if any log entries already exist
  const { data: existingLogs, error: logError } = await supabase
    .from('classification_retry_log')
    .select('scraped_product_id')
    .in('scraped_product_id', productsNeedingRetry.map(p => p.id));

  if (logError) {
    console.error('❌ Error querying classification_retry_log:', logError);
    process.exit(1);
  }

  const existingLogIds = new Set((existingLogs || []).map(log => log.scraped_product_id));
  const productsToLog = productsNeedingRetry.filter(p => !existingLogIds.has(p.id));

  if (existingLogIds.size > 0) {
    console.log(`⏭️ Skipping ${existingLogIds.size} products that already have log entries`);
  }

  if (productsToLog.length === 0) {
    console.log('✅ All products already have log entries');
    process.exit(0);
  }

  console.log(`📝 Creating ${productsToLog.length} retry log entries...\n`);

  // Step 4: Create log entries (retry immediately)
  const logEntries = productsToLog.map(product => ({
    scraped_product_id: product.id,
    retry_count: 0,
    status: 'retrying',
    last_error: 'Initial classification failed (before retry system deployment)',
    last_error_type: 'unknown',
    next_retry_at: new Date().toISOString(), // Retry immediately
    product_name: product.name,
    product_vendor: product.vendor,
  }));

  // Insert in batches of 50
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < logEntries.length; i += 50) {
    const batch = logEntries.slice(i, i + 50);

    const { data, error } = await supabase
      .from('classification_retry_log')
      .insert(batch);

    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / 50) + 1}:`, error.message);
      failed += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✓ Inserted batch ${Math.floor(i / 50) + 1}: ${batch.length} entries`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Total products found: ${failedProducts.length}`);
  console.log(`   Already in pending_products: ${failedProducts.length - productsNeedingRetry.length}`);
  console.log(`   Already have log entries: ${existingLogIds.size}`);
  console.log(`   New log entries created: ${inserted}`);
  console.log(`   Failed to create: ${failed}`);

  if (inserted > 0) {
    console.log('\n✅ Retry log populated successfully!');
    console.log('   The retry cron job will pick up these products in the next run (≤15 minutes)');
  }
}

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
