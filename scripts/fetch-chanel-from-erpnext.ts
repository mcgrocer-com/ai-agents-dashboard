/**
 * Fetch full product details from ERPNext for Chanel products
 * and create a JSON file matching the scraped_products table schema.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

interface FilteredProduct {
  'Item Code': string;
  'Description': string;
  'Item Name': string;
  'Default Unit of Measure': string;
  'Product URL (Supplier Items)': string;
  'Vendor (Supplier Items)': string;
}

interface ERPNextItemResponse {
  data: {
    name: string;
    item_code: string;
    item_name: string;
    description?: string;
    image?: string;
    standard_rate?: number;
    stock_uom?: string;
    weight_per_unit?: number;
    weight_uom?: string;
    item_group?: string;
    brand?: string;
    supplier_items?: Array<{
      supplier: string;
      supplier_part_no?: string;
      custom_product_url?: string;
    }>;
    custom_height?: number;
    custom_width?: number;
    custom_length?: number;
    web_long_description?: string;
    images?: Array<{
      image_path: string;
    }>;
  };
}

interface ScrapedProduct {
  id: string;
  vendor: string | null;
  name: string | null;
  price: number | null;
  original_price: number | null;
  weight: number | null;
  description: string | null;
  category: string | null;
  stock_status: string | null;
  images: string[] | null;
  main_image: string | null;
  variants: any | null;
  variant_count: number | null;
  product_id: string | null;
  timestamp: string | null;
  url: string | null;
  breadcrumbs: any | null;
  ean_code: string | null;
  status: string;
  height: number | null;
  width: number | null;
  length: number | null;
  volumetric_weight: number | null;
}

// ============================================================================
// Configuration
// ============================================================================

const ERPNEXT_BASE_URL = process.env.ERPNEXT_BASE_URL || 'https://erpnext.mcgrocer.com';
const ERPNEXT_AUTH_TOKEN = process.env.ERPNEXT_AUTH_TOKEN;
const INPUT_FILE = 'product_that_contains_chanel_as_their_item_name_filtered.json';
const OUTPUT_FILE = 'chanel_products_for_import.json';
const BATCH_SIZE = 10;
const DELAY_MS = 500; // Delay between batches to avoid rate limiting

// ============================================================================
// Helper Functions
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanHtml(html: string | undefined): string | null {
  if (!html) return null;
  // Remove HTML tags and clean up
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/None$/, '')
    .trim() || null;
}

function generateProductId(vendor: string, itemCode: string): string {
  return `${vendor.toLowerCase().replace(/\s+/g, '-')}-${itemCode}`;
}

function calculateVolumetricWeight(
  height: number | null,
  width: number | null,
  length: number | null
): number | null {
  if (!height || !width || !length) return null;
  // Volumetric weight formula: (H x W x L) / 5000
  return (height * width * length) / 5000;
}

// ============================================================================
// ERPNext API Functions
// ============================================================================

async function fetchItemFromERPNext(itemCode: string): Promise<ERPNextItemResponse | null> {
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
    return data as ERPNextItemResponse;
  } catch (error) {
    console.error(`Error fetching item ${itemCode}:`, error);
    return null;
  }
}

async function searchItemByUrl(url: string): Promise<string | null> {
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

function mapToScrapedProduct(
  filteredProduct: FilteredProduct,
  erpnextData: ERPNextItemResponse | null
): ScrapedProduct {
  const vendor = filteredProduct['Vendor (Supplier Items)'] || 'Unknown';
  const productUrl = filteredProduct['Product URL (Supplier Items)'];
  const itemCode = filteredProduct['Item Code'];

  // Generate unique ID based on vendor and item code
  const id = generateProductId(vendor, itemCode);

  // Extract data from ERPNext if available
  const name = erpnextData?.data?.item_name || filteredProduct['Item Name'];
  const description = cleanHtml(
    erpnextData?.data?.web_long_description ||
    erpnextData?.data?.description ||
    filteredProduct['Description']
  );

  const price = erpnextData?.data?.standard_rate || null;
  const weight = erpnextData?.data?.weight_per_unit || null;
  const height = erpnextData?.data?.custom_height || null;
  const width = erpnextData?.data?.custom_width || null;
  const length = erpnextData?.data?.custom_length || null;
  const volumetricWeight = calculateVolumetricWeight(height, width, length);

  // Extract images
  const images = erpnextData?.data?.images?.map(img => img.image_path) || [];
  const mainImage = erpnextData?.data?.image || images[0] || null;

  // Map to scraped_products schema
  const scrapedProduct: ScrapedProduct = {
    id,
    vendor,
    name,
    price,
    original_price: price, // Same as price for now
    weight,
    description,
    category: erpnextData?.data?.item_group || null,
    stock_status: 'in_stock', // Default value
    images: images.length > 0 ? images : null,
    main_image: mainImage,
    variants: null,
    variant_count: null,
    product_id: itemCode,
    timestamp: new Date().toISOString(),
    url: productUrl || null,
    breadcrumbs: null,
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

async function processBatch(
  products: FilteredProduct[],
  startIndex: number,
  batchSize: number
): Promise<ScrapedProduct[]> {
  const batch = products.slice(startIndex, startIndex + batchSize);
  const results: ScrapedProduct[] = [];

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
    process.exit(1);
  }

  // Read input file
  const inputPath = path.join(process.cwd(), INPUT_FILE);
  console.log(`Reading input file: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const filteredProducts: FilteredProduct[] = JSON.parse(
    fs.readFileSync(inputPath, 'utf-8')
  );

  console.log(`Found ${filteredProducts.length} products to process`);
  console.log('');

  // Process in batches
  const allResults: ScrapedProduct[] = [];
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
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  console.log('');
  console.log(`Writing output to: ${outputPath}`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(allResults, null, 2),
    'utf-8'
  );

  console.log('');
  console.log('='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total products processed: ${allResults.length}`);
  console.log(`Output file: ${outputPath}`);
  console.log('');
  console.log('✓ Done!');
}

// Run main function
main().catch(error => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
