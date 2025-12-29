import dotenv from 'dotenv';
dotenv.config();

const token = process.env.ERPNEXT_AUTH_TOKEN || process.env.VITE_ERPNEXT_TOKEN;
const itemCode = 'PROD-00897';

const url = `https://erpnext.mcgrocer.com/api/resource/Item/${itemCode}`;
const response = await fetch(url, {
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();

console.log('=== Description Fields from ERPNext ===\n');

console.log('1. web_long_description:');
console.log(data.data.web_long_description);
console.log('\n---\n');

console.log('2. description:');
console.log(data.data.description);
console.log('\n---\n');

console.log('3. original_description:');
console.log(data.data.original_description);
console.log('\n---\n');

console.log('4. raw_html_description:');
console.log(data.data.raw_html_description);
