/**
 * Test script to verify Shopify API returns product images
 * Run with: node test-shopify-images.js
 */

const SUPABASE_URL = 'https://fxkjblrlogjumybceozk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4';
const SUPABASE_EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`;

async function testShopifyProductImages() {
  console.log('🔍 Testing Shopify API for product image URLs...\n');

  const testQueries = [
    'baby oil',
    'kitchen knives',
    'organic honey',
    'gluten free',
  ];

  let totalProducts = 0;
  let productsWithImages = 0;
  let productsWithoutImages = 0;

  for (const query of testQueries) {
    console.log(`\n📦 Searching for: "${query}"`);
    console.log('─'.repeat(60));

    try {
      const response = await fetch(
        `${SUPABASE_EDGE_FUNCTION_URL}/shopify-product-search?query=${encodeURIComponent(query)}&limit=5`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.products && Array.isArray(data.products)) {
        const products = data.products;
        console.log(`✅ Found ${products.length} products\n`);

        products.forEach((product, index) => {
          totalProducts++;
          const hasImage = product.image_url && product.image_url.length > 0;

          if (hasImage) {
            productsWithImages++;
          } else {
            productsWithoutImages++;
          }

          console.log(`${index + 1}. ${product.title}`);
          console.log(`   Handle: ${product.handle}`);
          console.log(`   URL: ${product.url}`);
          console.log(`   Image URL: ${hasImage ? '✅ ' + product.image_url : '❌ MISSING'}`);
          console.log(`   Price: ${product.price || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('❌ No products found or API returned error');
        console.log('Response:', JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error(`❌ Error searching for "${query}":`, error.message);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total products tested: ${totalProducts}`);
  console.log(`Products WITH images: ${productsWithImages} (${Math.round((productsWithImages / totalProducts) * 100)}%)`);
  console.log(`Products WITHOUT images: ${productsWithoutImages} (${Math.round((productsWithoutImages / totalProducts) * 100)}%)`);
  console.log('');

  if (productsWithImages > 0) {
    console.log('✅ SUCCESS: Shopify API returns product image URLs!');
  } else {
    console.log('⚠️  WARNING: No products with images found - check API implementation');
  }
}

// Run the test
testShopifyProductImages().catch(console.error);
