/**
 * Update No7/Liz products on Supabase using seed-scraped-products endpoint
 *
 * Usage: node update-boots-products.js <API_KEY>
 */

import fs from 'fs';
import https from 'https';

const SUPABASE_URL = 'https://fxkjblrlogjumybceozk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/seed-scraped-products`;

// Get API key from command line
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Usage: node update-boots-products.js <API_KEY>');
  process.exit(1);
}

// Read products from JSON file
const rawProducts = JSON.parse(
  fs.readFileSync('G:/Projects/mcgrocer-project/ai-dashboard/no7_liz_products.json', 'utf8')
);

console.log(`Loaded ${rawProducts.length} products from JSON file`);

// Transform products to match seed-scraped-products schema
function transformProduct(p) {
  // Parse original images - handle double-encoded JSON
  let images = [];
  try {
    if (p.images) {
      // Handle double-encoded JSON string
      let parsed = p.images;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      images = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (e) {
    console.warn(`Failed to parse images for ${p.name}:`, e.message);
    images = [p.main_image];
  }

  // Use original description field
  const description = p.description || '<p>No description available</p>';

  // Use original main_image
  const mainImage = p.main_image;

  return {
    vendor: p.vendor || 'boots',
    name: p.name,
    url: p.url,
    price: parseFloat(p.price) || 0,
    description: description,
    stock_status: p.stock_status || 'in stock',
    images: images,
    main_image: mainImage,
    product_id: String(p.product_id),
    original_price: parseFloat(p.price) || 0,
    timestamp: p.updated_at || new Date().toISOString(),
    // Optional fields
    weight: p.weight || 0,
    height: p.height || 0,
    width: p.width || 0,
    length: p.length || 0,
    category: p.category || null,
    breadcrumbs: p.breadcrumbs ? JSON.parse(p.breadcrumbs) : null,
  };
}

// Transform all products
const transformedProducts = rawProducts.map(transformProduct);

console.log(`Transformed ${transformedProducts.length} products`);

// Validate a sample
const sample = transformedProducts[0];
console.log('\nSample transformed product:');
console.log('- vendor:', sample.vendor);
console.log('- name:', sample.name);
console.log('- price:', sample.price, typeof sample.price);
console.log('- stock_status:', sample.stock_status);
console.log('- product_id:', sample.product_id);
console.log('- images count:', sample.images.length);
console.log('- description length:', sample.description.length);

// Send to endpoint
const requestBody = JSON.stringify({
  products: transformedProducts,
  update_existing: true  // Update existing products
});

console.log(`\nSending ${transformedProducts.length} products to Supabase...`);
console.log(`Request body size: ${(requestBody.length / 1024).toFixed(2)} KB`);

const url = new URL(ENDPOINT);
const options = {
  hostname: url.hostname,
  port: 443,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'X-API-Key': API_KEY,
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\nResponse status: ${res.statusCode}`);
    try {
      const response = JSON.parse(data);
      console.log('\nResponse:', JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('\nRaw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
});

req.write(requestBody);
req.end();
