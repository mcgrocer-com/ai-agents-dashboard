/**
 * Test: Compare results with and without "article" modifier
 */

const username = "U0000325993";
const password = "PW_1204851d9672b739805dbbe7da71cc1f5";
const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

const testQuery = async (query, label) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${label}`);
  console.log(`Query: "${query}"`);
  console.log('='.repeat(60));

  const response = await fetch('https://scraper-api.decodo.com/v2/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`
    },
    body: JSON.stringify({
      target: 'google_search',
      query: query,
      parse: true,
      limit: 10,
      geo: 'United Kingdom',
      locale: 'en-gb',
      device_type: 'desktop'
    })
  });

  const data = await response.json();

  if (data.results?.[0]?.content?.results?.results?.organic) {
    const organicResults = data.results[0].content.results.results.organic;

    console.log(`\nFound ${organicResults.length} results:\n`);

    organicResults.slice(0, 5).forEach((result) => {
      const domain = new URL(result.url).hostname.replace('www.', '');
      const isArticle = domain.includes('telegraph') ||
                        domain.includes('guru') ||
                        domain.includes('seriouseats') ||
                        domain.includes('blog') ||
                        domain.includes('article');

      console.log(`${result.pos}. ${result.title}`);
      console.log(`   Domain: ${domain} ${isArticle ? '📰' : '🛒'}`);
      console.log(`   URL: ${result.url.substring(0, 60)}...`);
      console.log('');
    });
  }
};

const runComparison = async () => {
  const baseKeyword = 'best kitchen knives';

  await testQuery(baseKeyword, 'ORIGINAL QUERY');
  await testQuery(`${baseKeyword} article`, 'WITH "ARTICLE"');
  await testQuery(`${baseKeyword} blog`, 'WITH "BLOG"');
  await testQuery(`${baseKeyword} review`, 'WITH "REVIEW"');
};

runComparison().catch(console.error);
