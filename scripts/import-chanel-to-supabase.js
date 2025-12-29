/**
 * Import Chanel products to Supabase scraped_products table
 *
 * This script reads the generated chanel_products_for_import.json file
 * and inserts the products into the Supabase database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const INPUT_FILE = path.join(__dirname, '..', 'chanel_products_for_import.json');
const BATCH_SIZE = 100; // Supabase can handle larger batches

// ============================================================================
// Main Import Function
// ============================================================================

async function importToSupabase() {
  console.log('='.repeat(80));
  console.log('Import Chanel Products to Supabase');
  console.log('='.repeat(80));
  console.log('');

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: Missing Supabase credentials in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  // Read input file
  console.log(`Reading input file: ${INPUT_FILE}`);
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ ERROR: Input file not found: ${INPUT_FILE}`);
    console.error('Please run "npm run fetch:chanel" first to generate the import file.');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Found ${products.length} products to import`);
  console.log('');

  // Check for existing products
  console.log('Checking for existing products...');
  const productIds = products.map(p => p.id);
  const { data: existingProducts, error: checkError } = await supabase
    .from('scraped_products')
    .select('id')
    .in('id', productIds);

  if (checkError) {
    console.error('❌ Error checking existing products:', checkError);
    process.exit(1);
  }

  const existingIds = new Set(existingProducts?.map(p => p.id) || []);
  console.log(`Found ${existingIds.size} existing products`);
  console.log('');

  // Separate new and existing products
  const newProducts = products.filter(p => !existingIds.has(p.id));
  const existingProductsToUpdate = products.filter(p => existingIds.has(p.id));

  console.log(`Products to insert: ${newProducts.length}`);
  console.log(`Products to update: ${existingProductsToUpdate.length}`);
  console.log('');

  // Ask for confirmation
  console.log('='.repeat(80));
  console.log('CONFIRMATION REQUIRED');
  console.log('='.repeat(80));
  console.log(`This will INSERT ${newProducts.length} new products`);
  console.log(`This will UPDATE ${existingProductsToUpdate.length} existing products`);
  console.log('');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Insert new products one-by-one to handle duplicates gracefully
  let insertedCount = 0;
  let skippedCount = 0;
  let insertErrors = [];

  if (newProducts.length > 0) {
    console.log('Inserting new products (one-by-one to skip duplicates)...');
    for (let i = 0; i < newProducts.length; i++) {
      const product = newProducts[i];
      const { data, error } = await supabase
        .from('scraped_products')
        .insert(product)
        .select();

      if (error) {
        // Check if it's a duplicate key error
        if (error.code === '23505') {
          skippedCount++;
          if (skippedCount % 10 === 0) {
            console.log(`  ⊘ Skipped ${skippedCount} duplicates (${i + 1}/${newProducts.length})`);
          }
        } else {
          console.error(`❌ Error inserting product ${product.id}:`, error.message);
          insertErrors.push({ id: product.id, error });
        }
      } else {
        insertedCount++;
        if (insertedCount % 10 === 0) {
          console.log(`  ✓ Inserted ${insertedCount} products (${i + 1}/${newProducts.length})`);
        }
      }
    }
    console.log(`  ✓ Finished: ${insertedCount} inserted, ${skippedCount} duplicates skipped`);
  }

  // Update existing products in batches
  let updatedCount = 0;
  let updateErrors = [];

  if (existingProductsToUpdate.length > 0) {
    console.log('');
    console.log('Updating existing products...');
    for (const product of existingProductsToUpdate) {
      const { error } = await supabase
        .from('scraped_products')
        .update({
          vendor: product.vendor,
          name: product.name,
          price: product.price,
          original_price: product.original_price,
          weight: product.weight,
          description: product.description,
          category: product.category,
          stock_status: product.stock_status,
          images: product.images,
          main_image: product.main_image,
          variants: product.variants,
          variant_count: product.variant_count,
          product_id: product.product_id,
          timestamp: product.timestamp,
          url: product.url,
          breadcrumbs: product.breadcrumbs,
          ean_code: product.ean_code,
          height: product.height,
          width: product.width,
          length: product.length,
          volumetric_weight: product.volumetric_weight,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (error) {
        console.error(`❌ Error updating product ${product.id}:`, error);
        updateErrors.push({ id: product.id, error });
      } else {
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`  ✓ Updated ${updatedCount}/${existingProductsToUpdate.length} products`);
        }
      }
    }
    if (updatedCount > 0) {
      console.log(`  ✓ Finished updating ${updatedCount} products`);
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(80));
  console.log('Import Summary');
  console.log('='.repeat(80));
  console.log(`Total products processed: ${products.length}`);
  console.log(`Successfully inserted: ${insertedCount}`);
  console.log(`Duplicates skipped: ${skippedCount}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Insert errors: ${insertErrors.length}`);
  console.log(`Update errors: ${updateErrors.length}`);
  console.log('');

  if (insertErrors.length > 0 || updateErrors.length > 0) {
    console.log('Errors:');
    insertErrors.forEach(err => {
      console.log(`  Batch ${err.batch}: ${err.error.message}`);
    });
    updateErrors.forEach(err => {
      console.log(`  Product ${err.id}: ${err.error.message}`);
    });
    console.log('');
  }

  console.log('✓ Import completed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify products in Supabase dashboard');
  console.log('2. Create pending_products entries for AI agent processing');
  console.log('3. Run AI agents (category, weight, SEO, copyright)');
  console.log('='.repeat(80));
}

// Run import
importToSupabase().catch(error => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
