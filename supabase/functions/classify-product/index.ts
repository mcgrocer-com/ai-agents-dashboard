/**
 * Classify Product Edge Function
 *
 * Simple stateless API for UK medicine classification.
 * Receives products, classifies them, returns results.
 *
 * POST /classify-product
 * Body: {
 *   products: [
 *     { productId: "123", title: "Product Name", description: "...", category: "Optional Category" },
 *     ...
 *   ]
 * }
 *
 * Fields:
 * - productId: Required - Unique identifier for the product
 * - title: Required - Product name/title
 * - description: Optional - Product description
 * - category: Optional - Product category (helps improve classification accuracy)
 *
 * Returns: {
 *   success: true,
 *   results: [
 *     { productId: "123", rejected: false, reason: "..." },
 *     ...
 *   ]
 * }
 */

import {
  classifyProduct,
  RetryableError,
  QuotaExceededError,
  GEMINI_MODELS
} from '../_shared/gemini-classification.ts'

/**
 * Retry a classification with exponential backoff and model fallback
 * @param fn - Function to retry (receives model name as parameter)
 * @param maxRetries - Maximum number of retries (default: 3, limited by available models)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
async function retryWithBackoff<T>(
  fn: (modelName: string) => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  const actualMaxRetries = Math.min(maxRetries, GEMINI_MODELS.length - 1);

  for (let attempt = 0; attempt <= actualMaxRetries; attempt++) {
    try {
      // Use a different model for each retry attempt
      const modelName = GEMINI_MODELS[attempt];
      console.log(`[Retry] Attempt ${attempt + 1}/${actualMaxRetries + 1} using model: ${modelName}`);

      return await fn(modelName);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's not a retryable error
      if (!(error instanceof RetryableError)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === actualMaxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      console.log(`[Retry] Failed with ${lastError.name}, retrying in ${Math.round(delay)}ms with next model...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  console.error(`[Retry] All ${actualMaxRetries + 1} attempts failed across different models`);
  throw lastError;
}

interface ProductInput {
  productId: string
  title: string
  description?: string
  category?: string
}

interface ProductResult {
  productId: string
  rejected: boolean
  reason: string
  error?: {
    message: string
    retryable: boolean
  }
}

// Configuration for batch processing
const BATCH_SIZE = 10 // Process 10 products at a time (optimized for Gemini Tier 2: 1500 RPM)
const BATCH_DELAY_MS = 500 // 500ms delay between batches

/**
 * Process products in sequential batches to avoid rate limits
 */
async function processInBatches(
  products: ProductInput[],
  processor: (product: ProductInput) => Promise<ProductResult>
): Promise<ProductResult[]> {
  const results: ProductResult[] = []

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(products.length / BATCH_SIZE)

    console.log(`[Classify] Processing batch ${batchNum}/${totalBatches} (${batch.length} products)`)

    // Process batch concurrently (small batch)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    // Add delay between batches (except for last batch)
    if (i + BATCH_SIZE < products.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  return results
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const body = await req.json()
    const products: ProductInput[] = body.products

    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: provide products array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Classify] Processing ${products.length} products in batches of ${BATCH_SIZE}`)

    // Classify products in sequential batches to avoid rate limits
    const results = await processInBatches(products, async (product) => {
      // Log product details for debugging
      console.log(`[Classify] Product: ${product.productId} | Title: "${product.title}" | Category: "${product.category || 'N/A'}"`)

      try {
        const classification = await retryWithBackoff(
          (modelName) => classifyProduct(
            product.title || 'Unknown',
            product.description || '',
            geminiApiKey,
            undefined, // No supabase client
            modelName,  // Model name from retry logic
            product.category // Optional category for better classification
          ),
          3, // Max 3 retries (will use up to 4 different models)
          1000 // 1 second base delay
        )

        // Log classification result
        console.log(`[Classify] Result: ${product.productId} → ${classification.classification} (${classification.rejected ? 'REJECTED' : 'ACCEPTED'}) | Confidence: ${classification.confidence} | Reason: "${classification.reason}"`)

        return {
          productId: product.productId,
          rejected: classification.rejected,
          reason: classification.reason
        }
      } catch (error) {
        // If all retries failed, return error but don't mark as rejected
        // This allows the caller to retry the entire batch later
        const errorMessage = error instanceof Error ? error.message : String(error)
        const isQuotaError = error instanceof QuotaExceededError

        console.error(`[Classify] Failed to classify product ${product.productId}:`, errorMessage)

        return {
          productId: product.productId,
          rejected: false, // Don't mark as rejected on API errors
          reason: '',
          error: {
            message: isQuotaError ? 'API quota exceeded. Please try again later.' : errorMessage,
            retryable: error instanceof RetryableError
          }
        }
      }
    })

    const accepted = results.filter(r => !r.rejected && !r.error).length
    const rejected = results.filter(r => r.rejected).length
    const errored = results.filter(r => r.error).length

    console.log(`[Classify] Completed: ${accepted} accepted, ${rejected} rejected, ${errored} errored`)

    // If all products errored with retryable errors, return 503 to indicate retry
    const allRetryable = errored === results.length && results.every(r => r.error?.retryable)

    if (allRetryable) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'All classifications failed with retryable errors. Please try again later.',
          error_type: 'quota_exceeded',
          results
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Classify] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
