/**
 * Vendor URL Pattern Learning Utilities
 *
 * Shared module for learning and retrieving vendor-specific URL patterns.
 * Used by both price-comparison (integrated) and learn-vendor-patterns (standalone).
 */

import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ResearchResult {
  productPatterns: string[];
  confidenceScore: number;
  sampleSize: number;
  exampleProductUrls: string[];
  productCount: number;
  notes: string;
}

export interface VendorPatterns {
  domain: string;
  vendor_name: string;
  product_patterns: string[];
  learning_status: 'pending' | 'learned' | 'failed';
  confidence_score: number;
  sample_size: number;
  example_product_urls: string[];
  research_notes: string;
}

/**
 * Get vendor patterns from database
 */
export async function getVendorPatterns(
  supabase: SupabaseClient,
  domain: string
): Promise<VendorPatterns | null> {
  const { data, error } = await supabase
    .from('vendor_url_patterns')
    .select('*')
    .eq('domain', domain)
    .eq('learning_status', 'learned')
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Research vendor URL patterns using Serper + AI
 */
export async function researchVendorPatterns(
  serperKey: string,
  geminiKey: string,
  domain: string,
  userQuery?: string
): Promise<ResearchResult> {
  console.log(`[Research] Starting research for domain: ${domain}${userQuery ? ` with query: "${userQuery}"` : ''}`);

  // Multi-strategy search: Try different queries to find actual product pages
  const searchStrategies = [
    // Strategy 0: Use actual user query (most context-aware, highest relevance)
    ...(userQuery ? [{ query: `site:${domain} ${userQuery}`, name: 'user-query' }] : []),

    // Strategy 1: Target "add to bag" pages (highest precision for e-commerce)
    { query: `site:${domain} "add to bag" OR "add to cart"`, name: 'add-to-bag' },

    // Strategy 2: Pages with prices and buy actions
    { query: `site:${domain} (price OR buy) -category -categories -collection`, name: 'price-buy' },

    // Strategy 3: Fallback to current approach
    { query: `site:${domain} product`, name: 'product' }
  ];

  let searchData: any = null;
  let finalUrls: string[] = [];
  let strategyUsed = '';

  // Try each strategy until we get sufficient URLs
  for (const strategy of searchStrategies) {
    console.log(`[Research] Trying strategy "${strategy.name}": ${strategy.query}`);

    const searchRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: strategy.query,
        gl: 'gb',
        location: 'United Kingdom',
        num: 50
      })
    });

    if (!searchRes.ok) {
      console.warn(`[Research] Strategy "${strategy.name}" failed: ${searchRes.status}`);
      continue;
    }

    searchData = await searchRes.json();
    const urls = (searchData.organic || [])
      .map((item: any) => item.link)
      .filter((url: string) => url && new URL(url).hostname.includes(domain));

    console.log(`[Research] Strategy "${strategy.name}" found ${urls.length} URLs`);

    // Prioritize URLs that have prices in Serper response (strong signal of product pages)
    const urlsWithPrices = (searchData.organic || [])
      .filter((item: any) => item.price != null && item.link)
      .map((item: any) => item.link)
      .filter((url: string) => new URL(url).hostname.includes(domain));

    // Combine: price URLs first, then others
    finalUrls = [
      ...urlsWithPrices,
      ...urls.filter((url: string) => !urlsWithPrices.includes(url))
    ].slice(0, 50);

    console.log(`[Research] ${urlsWithPrices.length} URLs have prices (likely products)`);

    // If we have enough URLs, use this strategy
    if (finalUrls.length >= 10) {
      strategyUsed = strategy.name;
      console.log(`[Research] Using strategy "${strategy.name}" (${finalUrls.length} URLs)`);
      break;
    }
  }

  if (finalUrls.length < 3) {
    throw new Error(`Insufficient URLs found for ${domain} (need at least 3, got ${finalUrls.length})`);
  }

  console.log(`[Research] Final sample: ${finalUrls.length} URLs (strategy: ${strategyUsed})`);
  const urls = finalUrls;

  // Step 2: Use AI to analyze URL patterns - STRICT PRODUCT-ONLY APPROACH
  const prompt = `You are an E-commerce URL Pattern Analyst specializing in product page detection.

YOUR MISSION: Extract regex patterns that match ONLY single-product pages (one item for sale). Exclude ALL category/collection/listing pages.

CRITICAL RULES - READ CAREFULLY:
1. BE CONSERVATIVE: When in doubt, DO NOT include the pattern. Better to miss some products than include ANY category pages.
2. REQUIRE PRODUCT-SPECIFIC IDENTIFIERS: Product URLs must contain unique identifiers (SKU, product ID, or long unique slug).
3. REJECT BROAD PATTERNS: Patterns matching generic paths like "/mens", "/womens", "/sale" are NEVER product pages.
4. VERIFY EACH PATTERN: Before including a pattern, verify it appears ONLY on product pages, never on category pages.

PRODUCT PAGE INDICATORS (URLs must have these):
- Numeric product IDs or SKUs (e.g., /product-name-12345, /item/98765)
- Long unique slugs with specific product attributes (e.g., /lianora-scarf-sailor-stripe-red)
- Paths containing: /product/, /item/, /pd/, /p/ followed by unique identifier
- Deep paths with specific product characteristics

CATEGORY PAGE RED FLAGS (automatically exclude URLs with these):
- Pagination indicators: ?page=, /page/2, ?p=
- Filter/sort parameters: ?filter=, ?sort=, ?category=
- Broad categorical terms: /mens, /womens, /sale, /new-arrivals, /brands
- Plural category names: /dresses, /shoes, /coats-jackets
- Collection paths: /collections/, /categories/, /browse/
- Short generic paths with no unique identifier

URLs TO ANALYZE (${urls.length} samples):
${urls.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n')}

YOUR TASK:
1. Examine each URL carefully
2. Classify as PRODUCT (single item) or CATEGORY/OTHER (multiple items or uncertain)
3. Extract ONLY patterns that appear on confirmed product pages
4. Include product-specific characteristics (IDs, unique slugs) in patterns
5. Count how many product vs category URLs you identified

RESPOND IN THIS EXACT JSON FORMAT:
{
  "productPatterns": ["regex1", "regex2"],
  "exampleProductUrls": ["url1", "url2", "url3"],
  "productCount": 8,
  "confidenceScore": 0.9,
  "notes": "Brief explanation: What makes these product URLs unique? What identifiers did you find?"
}

PATTERN REQUIREMENTS:
- Use simple, readable regex (escape special chars: \\-, \\., \\/)
- Focus on URL path structure, ignore query parameters
- Patterns must include product-specific elements (IDs, unique slugs)
- Confidence score 0.0-1.0 based on pattern uniqueness and identifier clarity
- If unable to find clear product-specific patterns, return confidence < 0.5

REMEMBER: False negatives (missing products) are acceptable. False positives (including categories) are NOT. Be strict.`;

  console.log(`[Research] Calling AI for pattern analysis...`);

  const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000
      }
    })
  });

  if (!aiRes.ok) {
    throw new Error(`Gemini API failed: ${aiRes.status}`);
  }

  const aiData = await aiRes.json();
  const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain valid JSON');
  }

  const result = JSON.parse(jsonMatch[0]);

  console.log(`[Research] AI identified ${result.productCount || 0} product URLs`);

  return {
    productPatterns: result.productPatterns || [],
    confidenceScore: result.confidenceScore || 0.5,
    sampleSize: urls.length,
    exampleProductUrls: result.exampleProductUrls || [],
    productCount: result.productCount || 0,
    notes: result.notes || ''
  };
}

/**
 * Learn and save vendor patterns (integrated version)
 * Returns patterns immediately after learning
 */
export async function learnVendorPatternsSync(
  supabase: SupabaseClient,
  serperKey: string,
  geminiKey: string,
  domain: string,
  vendorName?: string,
  userQuery?: string
): Promise<VendorPatterns> {
  console.log(`[LearnSync] Learning patterns for: ${domain}`);

  // Check if already learning or learned
  const existing = await getVendorPatterns(supabase, domain);
  if (existing) {
    console.log(`[LearnSync] Patterns already exist for ${domain}`);
    return existing;
  }

  // Mark as pending
  await supabase
    .from('vendor_url_patterns')
    .upsert({
      domain,
      vendor_name: vendorName || domain.split('.')[0],
      learning_status: 'pending'
    }, { onConflict: 'domain' });

  // Research patterns with user query context
  const result = await researchVendorPatterns(serperKey, geminiKey, domain, userQuery);

  // Save learned patterns
  const dataToSave = {
    domain,
    vendor_name: vendorName || domain.split('.')[0],
    product_patterns: result.productPatterns,
    learning_status: 'learned' as const,
    learned_at: new Date().toISOString(),
    confidence_score: result.confidenceScore,
    sample_size: result.sampleSize,
    example_product_urls: result.exampleProductUrls,
    research_notes: result.notes
  };

  console.log(`[LearnSync] Saving patterns for ${domain}`);

  const { data: saved, error: saveError } = await supabase
    .from('vendor_url_patterns')
    .upsert(dataToSave, { onConflict: 'domain' })
    .select()
    .single();

  if (saveError) {
    console.error(`[LearnSync] Failed to save patterns:`, saveError);

    // Mark as failed
    await supabase
      .from('vendor_url_patterns')
      .update({
        learning_status: 'failed',
        research_notes: saveError.message
      })
      .eq('domain', domain);

    throw new Error(`Failed to save patterns: ${saveError.message}`);
  }

  console.log(`[LearnSync] Successfully learned patterns for ${domain} (confidence: ${result.confidenceScore})`);

  return saved;
}

/**
 * Get or learn vendor patterns (convenience function)
 * Used by integrated endpoints
 */
export async function getOrLearnPatterns(
  supabase: SupabaseClient,
  serperKey: string,
  geminiKey: string,
  domain: string,
  vendorName?: string,
  userQuery?: string
): Promise<VendorPatterns> {
  // Try to get existing patterns
  const existing = await getVendorPatterns(supabase, domain);

  if (existing) {
    console.log(`[GetOrLearn] Using existing patterns for ${domain}`);
    return existing;
  }

  // Learn new patterns with user query context
  console.log(`[GetOrLearn] No patterns found for ${domain}, learning...`);
  return await learnVendorPatternsSync(supabase, serperKey, geminiKey, domain, vendorName, userQuery);
}
