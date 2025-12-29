import dotenv from 'dotenv';
dotenv.config();

const token = process.env.ERPNEXT_AUTH_TOKEN || process.env.VITE_ERPNEXT_TOKEN;

// Check a product WITH price
const itemCode = 'PROD-00897'; // Harrods product with price 82.15

const url = `https://erpnext.mcgrocer.com/api/resource/Item/${itemCode}`;

const response = await fetch(url, {
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();

console.log('Item:', itemCode);
console.log('Item Name:', data.data.item_name);
console.log('\n=== Price Fields ===');
console.log('standard_rate:', data.data.standard_rate);
console.log('shopify_selling_rate:', data.data.shopify_selling_rate);
console.log('valuation_rate:', data.data.valuation_rate);
console.log('last_purchase_rate:', data.data.last_purchase_rate);

console.log('\n=== Supplier Items ===');
if (data.data.supplier_items && data.data.supplier_items.length > 0) {
  data.data.supplier_items.forEach((supplier, idx) => {
    console.log(`\nSupplier ${idx + 1}:`);
    console.log('  All fields:', Object.keys(supplier));
    console.log('  Supplier:', supplier.supplier);
    console.log('  Main Vendor:', supplier.main_vendor);
    console.log('  Custom Price:', supplier.custom_price);
    console.log('  Stock Status:', supplier.custom_stock_status);
    // Check for any price-related fields
    Object.keys(supplier).filter(k => k.toLowerCase().includes('price')).forEach(k => {
      console.log(`  ${k}:`, supplier[k]);
    });
  });
} else {
  console.log('No supplier items found!');
}

console.log('\n=== All Fields (searching for original/list price) ===');
Object.keys(data.data).filter(k =>
  k.toLowerCase().includes('price') ||
  k.toLowerCase().includes('original') ||
  k.toLowerCase().includes('list') ||
  k.toLowerCase().includes('msrp')
).forEach(k => {
  console.log(`${k}:`, data.data[k]);
});

console.log('\n=== Breadcrumbs & Category Fields ===');
Object.keys(data.data).filter(k =>
  k.toLowerCase().includes('breadcrumb') ||
  k.toLowerCase().includes('category')
).forEach(k => {
  console.log(`${k}:`, data.data[k]);
});

console.log('\n=== custom_website_breadcrumb ===');
console.log('Value:', data.data.custom_website_breadcrumb);
console.log('Type:', typeof data.data.custom_website_breadcrumb);
