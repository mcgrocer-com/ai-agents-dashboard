/**
 * Filter Chanel products by checking if they exist in Supabase database
 *
 * This script:
 * 1. Reads products from JSON file
 * 2. Queries Supabase for existing product URLs
 * 3. Filters out products that already exist
 * 4. Saves filtered results to new JSON file
 *
 * Usage:
 *   node scripts/filter-chanel-products.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '..', '.env') });

// Configuration - Using environment variables that should be available
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  console.error('   or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n');
  process.exit(1);
}

/**
 * Main filtering function
 */
async function filterChanelProducts() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Filter Chanel Products by Database Existence                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✓ Connected to Supabase\n');

    // Read JSON file
    const inputFilePath = resolve(
      __dirname,
      '..',
      'product_that_contains_chanel_as_their_item_name (1).json'
    );

    console.log(`📖 Reading products from JSON file...`);
    console.log(`   ${inputFilePath}`);
    const fileContent = await readFile(inputFilePath, 'utf-8');
    const products = JSON.parse(fileContent);
    console.log(`   ✓ Loaded ${products.length} products\n`);

    // Query Supabase - we'll check each URL individually to avoid query limits
    console.log('🔍 Checking which products exist in Supabase...');
    const existingUrls = new Set();

    // Process in batches to avoid query size limits
    const batchSize = 100;
    const totalBatches = Math.ceil(products.length / batchSize);

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const urlsToCheck = batch.map(p => p['Product URL (Supplier Items)']);
      const batchNum = Math.floor(i / batchSize) + 1;

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `);

      const { data: existingProducts, error } = await supabase
        .from('scraped_products')
        .select('url')
        .in('url', urlsToCheck);

      if (error) {
        throw new Error(`Supabase query error: ${error.message}`);
      }

      // Add found URLs to the set
      existingProducts?.forEach(p => existingUrls.add(p.url));
      console.log(`✓ (${existingProducts?.length || 0} found)`);
    }

    console.log(`   ✓ Total products found in database: ${existingUrls.size.toLocaleString()}\n`);

    // Filter products - keep only those NOT in database
    console.log('🔄 Filtering products...');
    const newProducts = products.filter((product) => {
      const productUrl = product['Product URL (Supplier Items)'];
      return !existingUrls.has(productUrl);
    });

    const existingCount = products.length - newProducts.length;
    console.log(`   ✓ Products already in database: ${existingCount}`);
    console.log(`   ✓ Products NOT in database: ${newProducts.length}\n`);

    // Save filtered results
    const outputFilePath = resolve(
      __dirname,
      '..',
      'product_that_contains_chanel_as_their_item_name_filtered.json'
    );

    console.log('💾 Saving filtered products...');
    await writeFile(
      outputFilePath,
      JSON.stringify(newProducts, null, 2),
      'utf-8'
    );
    console.log(`   ✓ Saved to: ${outputFilePath}\n`);

    // Summary statistics
    console.log('═════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═════════════════════════════════════════════════════════════');
    console.log(`  Total input products:     ${products.length.toLocaleString()}`);
    console.log(`  Already in database:      ${existingCount.toLocaleString()}`);
    console.log(`  New products (filtered):  ${newProducts.length.toLocaleString()}`);
    console.log(`  Retention rate:           ${((newProducts.length / products.length) * 100).toFixed(1)}%`);
    console.log('═════════════════════════════════════════════════════════════\n');

    console.log('✅ Filtering completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
filterChanelProducts()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
