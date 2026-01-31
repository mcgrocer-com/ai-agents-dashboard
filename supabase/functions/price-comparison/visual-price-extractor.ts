/**
 * Visual Price Extraction using ScreenshotOne + Gemini Vision
 *
 * Extracts prices and availability status from product page screenshots
 * when JSON-LD or HTML parsing fails.
 */

export interface VisualExtractionResult {
  price: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'pre_order' | 'unknown';
  confidence: number;
  notes: string;
}

/**
 * Take screenshot of URL using ScreenshotOne API
 */
async function takeScreenshot(
  url: string,
  screenshotApiKey: string
): Promise<string> {
  const screenshotUrl = new URL('https://api.screenshotone.com/take');
  screenshotUrl.searchParams.set('url', url);
  screenshotUrl.searchParams.set('access_key', screenshotApiKey);
  screenshotUrl.searchParams.set('full_page', 'false');
  screenshotUrl.searchParams.set('viewport_width', '1920');
  screenshotUrl.searchParams.set('viewport_height', '1080');
  screenshotUrl.searchParams.set('device_scale_factor', '1');
  screenshotUrl.searchParams.set('format', 'jpg');
  screenshotUrl.searchParams.set('image_quality', '80');
  screenshotUrl.searchParams.set('cache', 'false');

  console.log(`[VisualExtract] Taking screenshot: ${url}`);

  const response = await fetch(screenshotUrl.toString());

  if (!response.ok) {
    throw new Error(`Screenshot failed: ${response.status} ${response.statusText}`);
  }

  // Convert to base64 for Gemini Vision API
  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  return base64;
}

/**
 * Extract price and availability from screenshot using Gemini Vision
 */
async function analyzeScreenshot(
  base64Image: string,
  productUrl: string,
  geminiApiKey: string
): Promise<VisualExtractionResult> {
  const prompt = `You are a price extraction specialist analyzing a product page screenshot.

TASK: Extract the product price and availability status from this e-commerce product page.

CRITICAL RULES:
1. PRICE EXTRACTION:
   - Look for the MAIN product price (usually largest, most prominent)
   - Ignore crossed-out "was" prices or comparison prices
   - Common locations: near "Add to Bag", below product name, in price section
   - Extract numeric value only (e.g., "£95.00" → 95.00)
   - If multiple prices (e.g., size variants), extract the first/default price

2. AVAILABILITY EXTRACTION:
   - Look for: "Add to Bag", "Add to Cart", "Buy Now", "In Stock"
   - "Out of Stock", "Sold Out", "Unavailable" → out_of_stock
   - "Pre-order", "Coming Soon" → pre_order
   - If add-to-cart button is visible and active → in_stock
   - If no clear signals → unknown

3. CONFIDENCE SCORING:
   - 1.0: Price clearly visible in standard location, availability explicit
   - 0.8: Price visible but in unusual location, availability inferred
   - 0.6: Price found but ambiguous (multiple prices visible)
   - 0.4: Price uncertain, availability unclear
   - 0.2: Very difficult to extract, low confidence

PRODUCT URL (for context): ${productUrl}

RESPOND IN THIS EXACT JSON FORMAT:
{
  "price": 95.00,
  "currency": "GBP",
  "availability": "in_stock",
  "confidence": 0.9,
  "notes": "Price found below product title. Add to Bag button visible and active."
}

If you cannot find a price, return:
{
  "price": 0,
  "currency": "GBP",
  "availability": "unknown",
  "confidence": 0.0,
  "notes": "Could not locate price on page."
}`;

  console.log(`[VisualExtract] Analyzing screenshot with Gemini Vision`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini Vision API failed: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini response did not contain valid JSON');
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    price: result.price || 0,
    currency: result.currency || 'GBP',
    availability: result.availability || 'unknown',
    confidence: result.confidence || 0,
    notes: result.notes || ''
  };
}

/**
 * Extract price and availability from product URL using visual analysis
 */
export async function extractPriceVisually(
  productUrl: string,
  screenshotApiKey: string,
  geminiApiKey: string
): Promise<VisualExtractionResult> {
  try {
    // Step 1: Take screenshot
    const base64Image = await takeScreenshot(productUrl, screenshotApiKey);

    // Step 2: Analyze with Gemini Vision
    const result = await analyzeScreenshot(base64Image, productUrl, geminiApiKey);

    console.log(`[VisualExtract] Extracted: £${result.price} (${result.availability}, confidence: ${result.confidence})`);

    return result;
  } catch (error) {
    console.error(`[VisualExtract] Failed for ${productUrl}:`, error);

    return {
      price: 0,
      currency: 'GBP',
      availability: 'unknown',
      confidence: 0,
      notes: `Visual extraction failed: ${error.message}`
    };
  }
}

/**
 * Process multiple products in parallel (with rate limiting)
 */
export async function extractPricesVisually(
  productUrls: string[],
  screenshotApiKey: string,
  geminiApiKey: string,
  maxConcurrent: number = 3
): Promise<Map<string, VisualExtractionResult>> {
  const results = new Map<string, VisualExtractionResult>();

  // Process in batches to avoid rate limits
  for (let i = 0; i < productUrls.length; i += maxConcurrent) {
    const batch = productUrls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(url =>
        extractPriceVisually(url, screenshotApiKey, geminiApiKey)
          .then(result => ({ url, result }))
      )
    );

    for (const { url, result } of batchResults) {
      results.set(url, result);
    }
  }

  return results;
}
