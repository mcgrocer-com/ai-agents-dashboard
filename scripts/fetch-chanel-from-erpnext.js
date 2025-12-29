/**
 * Fetch full product details from ERPNext for Chanel products
 * and create a JSON file matching the scraped_products table schema.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const ERPNEXT_BASE_URL = process.env.ERPNEXT_BASE_URL || process.env.VITE_ERPNEXT_BASE_URL || 'https://erpnext.mcgrocer.com';
const ERPNEXT_AUTH_TOKEN = process.env.ERPNEXT_AUTH_TOKEN || process.env.VITE_ERPNEXT_TOKEN;
const INPUT_FILE = path.join(__dirname, '..', 'product_that_contains_chanel_as_their_item_name_filtered.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'chanel_products_for_import.json');
const BATCH_SIZE = 10;
const DELAY_MS = 500; // Delay between batches to avoid rate limiting

// ============================================================================
// Helper Functions
// ============================================================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHtml(html) {
  if (!html) return null;
  // Remove HTML tags and clean up
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/None$/, '')
    .trim() || null;
}

function generateProductId(vendor, itemCode) {
  return `${vendor.toLowerCase().replace(/\s+/g, '-')}-${itemCode}`;
}

function calculateVolumetricWeight(height, width, length) {
  if (!height || !width || !length) return null;
  // Volumetric weight formula: (H x W x L) / 5000
  return (height * width * length) / 5000;
}

// ============================================================================
// ERPNext API Functions
// ============================================================================

async function fetchItemFromERPNext(itemCode) {
  if (!ERPNEXT_AUTH_TOKEN) {
    throw new Error('ERPNEXT_AUTH_TOKEN environment variable not set');
  }

  try {
    const url = `${ERPNEXT_BASE_URL}/api/resource/Item/${itemCode}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${ERPNEXT_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch item ${itemCode}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching item ${itemCode}:`, error);
    return null;
  }
}

async function searchItemByUrl(url) {
  if (!ERPNEXT_AUTH_TOKEN || !url) {
    return null;
  }

  try {
    const searchUrl = `${ERPNEXT_BASE_URL}/api/method/frappe.desk.reportview.get`;

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ERPNEXT_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctype: 'Item',
        fields: ['name'],
        filters: [['Item Supplier', 'custom_product_url', '=', url]],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const keys = result.message?.keys || [];
    const values = result.message?.values?.[0] || [];
    const nameIndex = keys.indexOf('name');

    return nameIndex >= 0 ? values[nameIndex] : null;
  } catch (error) {
    console.error(`Error searching item by URL ${url}:`, error);
    return null;
  }
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapToScrapedProduct(filteredProduct, erpnextData) {
  // Get vendor from filtered JSON first, then fall back to ERPNext supplier_items
  let vendor = filteredProduct['Vendor (Supplier Items)'];
  if (!vendor || vendor.trim() === '') {
    // Try to get vendor from ERPNext supplier_items (main vendor)
    const mainSupplier = erpnextData?.data?.supplier_items?.find(s => s.main_vendor === 1);
    vendor = mainSupplier?.supplier || erpnextData?.data?.supplier_items?.[0]?.supplier || 'Unknown';
  }

  const productUrl = filteredProduct['Product URL (Supplier Items)'];
  const itemCode = filteredProduct['Item Code'];

  // Generate unique ID based on vendor and item code
  const id = generateProductId(vendor, itemCode);

  // Extract data from ERPNext if available
  const name = erpnextData?.data?.item_name || filteredProduct['Item Name'];

  // Use raw_html_description for full HTML, or fallback to description
  const description = erpnextData?.data?.raw_html_description ||
                     erpnextData?.data?.web_long_description ||
                     erpnextData?.data?.description ||
                     filteredProduct['Description'] || null;

  // Get price from supplier_items or shopify_selling_rate or standard_rate
  let price = null;
  if (erpnextData?.data?.supplier_items && erpnextData.data.supplier_items.length > 0) {
    const mainSupplier = erpnextData.data.supplier_items.find(s => s.main_vendor === 1);
    price = mainSupplier?.custom_price || erpnextData.data.supplier_items[0].custom_price;
  }
  if (!price) {
    price = erpnextData?.data?.shopify_selling_rate || erpnextData?.data?.standard_rate || null;
  }

  const weight = erpnextData?.data?.weight_per_unit || erpnextData?.data?.weight || null;
  const height = erpnextData?.data?.custom_height || erpnextData?.data?.height || null;
  const width = erpnextData?.data?.custom_width || erpnextData?.data?.width || null;
  const length = erpnextData?.data?.custom_length || erpnextData?.data?.length || null;
  const volumetricWeight = calculateVolumetricWeight(height, width, length);

  // Extract images
  const images = erpnextData?.data?.images?.map(img => img.image_path) || [];
  const mainImage = erpnextData?.data?.image || images[0] || null;

  // Parse breadcrumbs (stored as Python-style array string in ERPNext)
  let breadcrumbs = null;
  if (erpnextData?.data?.custom_website_breadcrumb) {
    try {
      let breadcrumbStr = erpnextData.data.custom_website_breadcrumb;
      if (typeof breadcrumbStr === 'string') {
        // Convert Python-style single quotes to JSON double quotes
        breadcrumbStr = breadcrumbStr.replace(/'/g, '"');
        const parsed = JSON.parse(breadcrumbStr);
        breadcrumbs = Array.isArray(parsed) ? parsed : null;
      } else if (Array.isArray(breadcrumbStr)) {
        breadcrumbs = breadcrumbStr;
      }
    } catch (e) {
      // If parsing fails, leave as null
      console.log(`  Warning: Failed to parse breadcrumbs for item`);
      breadcrumbs = null;
    }
  }

  // Use custom categories if available, otherwise fall back to item_group
  const category = erpnextData?.data?.custom_category2 ||
                   erpnextData?.data?.custom_category1 ||
                   erpnextData?.data?.item_group || null;

  // Map to scraped_products schema
  const scrapedProduct = {
    id,
    vendor,
    name,
    price,
    original_price: price, // Same as price for now
    weight,
    description,
    category,
    stock_status: 'in_stock', // Default value
    images: images.length > 0 ? images : null,
    main_image: mainImage,
    variants: null,
    variant_count: null,
    product_id: itemCode,
    timestamp: new Date().toISOString(),
    url: productUrl || null,
    breadcrumbs,
    ean_code: null,
    status: 'pending',
    height,
    width,
    length,
    volumetric_weight: volumetricWeight,
  };

  return scrapedProduct;
}

// ============================================================================
// Main Processing
// ============================================================================

async function processBatch(products, startIndex, batchSize) {
  const batch = products.slice(startIndex, startIndex + batchSize);
  const results = [];

  console.log(`Processing batch ${Math.floor(startIndex / batchSize) + 1}...`);

  for (const product of batch) {
    const itemCode = product['Item Code'];
    const productUrl = product['Product URL (Supplier Items)'];

    console.log(`  Fetching ${itemCode}...`);

    // Try to fetch from ERPNext
    let erpnextData = await fetchItemFromERPNext(itemCode);

    // If not found by item code, try searching by URL
    if (!erpnextData && productUrl) {
      console.log(`  Item ${itemCode} not found, searching by URL...`);
      const foundItemCode = await searchItemByUrl(productUrl);
      if (foundItemCode) {
        console.log(`  Found item by URL: ${foundItemCode}`);
        erpnextData = await fetchItemFromERPNext(foundItemCode);
      }
    }

    // Map to scraped_products schema
    const scrapedProduct = mapToScrapedProduct(product, erpnextData);
    results.push(scrapedProduct);

    if (erpnextData) {
      console.log(`  ✓ Mapped ${itemCode}`);
    } else {
      console.log(`  ⚠ Mapped ${itemCode} (ERPNext data not found)`);
    }
  }

  return results;
}

async function main() {
  console.log('='.repeat(80));
  console.log('Fetch Chanel Products from ERPNext');
  console.log('='.repeat(80));
  console.log('');

  // Check for auth token
  if (!ERPNEXT_AUTH_TOKEN) {
    console.error('ERROR: ERPNEXT_AUTH_TOKEN environment variable not set');
    console.error('Please set the ERPNEXT_AUTH_TOKEN in your .env file');
    process.exit(1);
  }

  // Read input file
  console.log(`Reading input file: ${INPUT_FILE}`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const filteredProducts = JSON.parse(
    fs.readFileSync(INPUT_FILE, 'utf-8')
  );

  console.log(`Found ${filteredProducts.length} products to process`);
  console.log(`ERPNext Base URL: ${ERPNEXT_BASE_URL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Delay between batches: ${DELAY_MS}ms`);
  console.log('');

  // Process in batches
  const allResults = [];
  const totalBatches = Math.ceil(filteredProducts.length / BATCH_SIZE);

  for (let i = 0; i < filteredProducts.length; i += BATCH_SIZE) {
    const batchResults = await processBatch(filteredProducts, i, BATCH_SIZE);
    allResults.push(...batchResults);

    console.log(`Progress: ${allResults.length}/${filteredProducts.length} products processed`);
    console.log('');

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < filteredProducts.length) {
      await delay(DELAY_MS);
    }
  }

  // Write output file
  console.log('');
  console.log(`Writing output to: ${OUTPUT_FILE}`);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(allResults, null, 2),
    'utf-8'
  );

  // Calculate statistics
  const withErpnextData = allResults.filter(p => p.name !== null).length;
  const withoutErpnextData = allResults.length - withErpnextData;

  console.log('');
  console.log('='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total products processed: ${allResults.length}`);
  console.log(`Products with ERPNext data: ${withErpnextData}`);
  console.log(`Products without ERPNext data: ${withoutErpnextData}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log('');
  console.log('✓ Done!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Review the output file to verify the data');
  console.log('2. Import the JSON into the scraped_products table using Supabase');
}

// Run main function
main().catch(error => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
