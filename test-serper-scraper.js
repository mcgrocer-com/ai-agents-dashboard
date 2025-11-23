/**
 * Test script for Serper Article Scraper
 * Tests full article content extraction
 */

// Configuration
const SERPER_API_KEY = process.env.SERPER_API_KEY || "9f0a01e261b57a2578329a7a5c084d8670fb603b";

// Test URLs
const TEST_URLS = [
  'https://www.medicalnewstoday.com/articles/baby-oil-as-lube',
  'https://www.healthline.com/health/beauty-skin-care/baby-oil-on-face',
  'https://en.wikipedia.org/wiki/Baby_oil'
];

/**
 * Scrape article content using Serper API
 */
async function scrapeArticle(url) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Scraping: ${url}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const response = await fetch('https://scrape.serper.dev', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Serper API Error:', errorData);
      return;
    }

    const data = await response.json();

    // Display raw response structure
    console.log('📦 Raw Response Keys:');
    console.log(Object.keys(data).join(', '));
    console.log('');

    // Extract key data
    const title = data.title || 'No title';
    const text = data.text || '';
    const headings = data.headings || [];
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    // Display summary
    console.log('📊 ARTICLE SUMMARY');
    console.log(`${'─'.repeat(80)}`);
    console.log(`Title: ${title}`);
    console.log(`Word Count: ${wordCount.toLocaleString()} words`);
    console.log(`Headings Count: ${headings.length}`);
    console.log(`Text Length: ${text.length.toLocaleString()} characters`);
    console.log('');

    // Display headings
    if (headings.length > 0) {
      console.log('📑 HEADINGS STRUCTURE:');
      console.log(`${'─'.repeat(80)}`);
      headings.slice(0, 15).forEach((heading, index) => {
        console.log(`${index + 1}. ${heading}`);
      });
      if (headings.length > 15) {
        console.log(`... and ${headings.length - 15} more headings`);
      }
      console.log('');
    }

    // Display text preview
    console.log('📄 TEXT CONTENT PREVIEW (First 500 characters):');
    console.log(`${'─'.repeat(80)}`);
    console.log(text.substring(0, 500));
    if (text.length > 500) {
      console.log(`\n... (${(text.length - 500).toLocaleString()} more characters)`);
    }
    console.log('');

    // Analyze content quality
    console.log('✅ CONTENT QUALITY ANALYSIS:');
    console.log(`${'─'.repeat(80)}`);
    console.log(`Has Title: ${title !== 'No title' ? '✓ YES' : '✗ NO'}`);
    console.log(`Has Text: ${text.length > 0 ? '✓ YES' : '✗ NO'}`);
    console.log(`Has Headings: ${headings.length > 0 ? '✓ YES' : '✗ NO'}`);
    console.log(`Word Count > 100: ${wordCount > 100 ? '✓ YES' : '✗ NO'}`);
    console.log(`Word Count > 500: ${wordCount > 500 ? '✓ YES' : '✗ NO'}`);
    console.log(`Word Count > 1000: ${wordCount > 1000 ? '✓ YES' : '✗ NO'}`);

    const isUseful = text.length > 500 && wordCount > 100;
    console.log(`\n${isUseful ? '✅ Content is USEFUL for competitive analysis' : '⚠️  Content may be TOO SHORT for deep analysis'}`);

    // Check if content is truncated or ellipsized
    console.log('\n🔍 TRUNCATION CHECK:');
    console.log(`${'─'.repeat(80)}`);
    const hasEllipsis = text.includes('...') && text.lastIndexOf('...') > text.length - 100;
    const endsAbruptly = !text.trim().match(/[.!?]$/);
    console.log(`Ends with ellipsis: ${hasEllipsis ? '⚠️  YES' : '✓ NO'}`);
    console.log(`Ends abruptly (no punctuation): ${endsAbruptly ? '⚠️  YES' : '✓ NO'}`);
    console.log(`Likely complete: ${!hasEllipsis && !endsAbruptly ? '✓ YES' : '⚠️  NO'}`);

    return {
      url,
      title,
      wordCount,
      headingsCount: headings.length,
      textLength: text.length,
      isUseful,
      isComplete: !hasEllipsis && !endsAbruptly,
    };

  } catch (error) {
    console.error('❌ Error scraping article:', error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * Run tests for all URLs
 */
async function runAllTests() {
  console.log('\n🚀 Starting Serper Article Scraper Test');
  console.log('Testing full article content extraction\n');

  const results = [];

  for (const url of TEST_URLS) {
    const result = await scrapeArticle(url);
    if (result) {
      results.push(result);
    }

    // Wait between requests to avoid rate limiting
    if (TEST_URLS.indexOf(url) < TEST_URLS.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next request...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL TEST SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r !== null).length;
  const avgWordCount = results.reduce((sum, r) => sum + r.wordCount, 0) / successful;
  const avgHeadingsCount = results.reduce((sum, r) => sum + r.headingsCount, 0) / successful;
  const usefulArticles = results.filter(r => r.isUseful).length;
  const completeArticles = results.filter(r => r.isComplete).length;

  console.log(`Total URLs tested: ${TEST_URLS.length}`);
  console.log(`Successful scrapes: ${successful}`);
  console.log(`Average word count: ${Math.round(avgWordCount).toLocaleString()} words`);
  console.log(`Average headings count: ${Math.round(avgHeadingsCount)}`);
  console.log(`Useful articles (>100 words): ${usefulArticles} (${Math.round(usefulArticles/successful*100)}%)`);
  console.log(`Complete articles: ${completeArticles} (${Math.round(completeArticles/successful*100)}%)`);

  console.log('\n✅ CONCLUSION:');
  if (successful === TEST_URLS.length && usefulArticles > 0) {
    console.log('✓ Serper scraper is WORKING and returns full article content!');
    console.log('✓ Ready for integration with Gemini AI agent');
  } else if (successful > 0) {
    console.log('⚠️  Serper scraper is partially working');
    console.log(`⚠️  ${TEST_URLS.length - successful} URL(s) failed to scrape`);
  } else {
    console.log('✗ Serper scraper is NOT working');
    console.log('✗ Check API key and connectivity');
  }

  console.log('');
}

/**
 * Test single URL if provided via command line
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Test single URL from command line
    const url = args[0];
    await scrapeArticle(url);
  } else {
    // Run all tests
    await runAllTests();
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
