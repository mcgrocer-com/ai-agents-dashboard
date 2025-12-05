import https from 'https';

const SUPABASE_URL = 'https://fxkjblrlogjumybceozk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjIyODksImV4cCI6MjA3NDI5ODI4OX0.TWAthI6QVavOB6ZZd68-_YgxkY_TQoS5ulS2E3-JGo4';

const url = new URL(`${SUPABASE_URL}/rest/v1/scraped_products?vendor=eq.boots&select=main_image,url,name`);

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'GET',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const products = JSON.parse(data);

    const withCopyright = products.filter(p => p.main_image && p.main_image.includes('/copyright_0.png'));
    const withoutCopyright = products.filter(p => p.main_image && !p.main_image.includes('/copyright_0.png'));

    console.log('=== Boots Products Main Image Report ===\n');
    console.log('Total boots products:', products.length);
    console.log('With /copyright_0.png:', withCopyright.length);
    console.log('Without /copyright_0.png (original images):', withoutCopyright.length);

    if (withCopyright.length > 0) {
      console.log('\n--- Products with copyright images ---');
      withCopyright.forEach(p => {
        console.log(`- ${p.name}`);
        console.log(`  URL: ${p.url}`);
        console.log(`  main_image: ${p.main_image}`);
      });
    }
  });
});

req.on('error', err => console.error('Error:', err.message));
req.end();
