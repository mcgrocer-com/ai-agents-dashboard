import dotenv from 'dotenv';
dotenv.config();

const token = process.env.ERPNEXT_AUTH_TOKEN || process.env.VITE_ERPNEXT_TOKEN;
const items = ['PROD-00897', '716367', '747427'];

for (const itemCode of items) {
  const url = `https://erpnext.mcgrocer.com/api/resource/Item/${itemCode}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  console.log('Item:', itemCode);
  console.log('  custom_website_breadcrumb:', data.data.custom_website_breadcrumb);
  console.log('  Type:', typeof data.data.custom_website_breadcrumb);
  if (data.data.custom_website_breadcrumb) {
    console.log('  Parsed:', JSON.parse(data.data.custom_website_breadcrumb));
  }
  console.log('  custom_category1:', data.data.custom_category1);
  console.log('  custom_category2:', data.data.custom_category2);
  console.log('  item_group:', data.data.item_group);
  console.log('');
}
