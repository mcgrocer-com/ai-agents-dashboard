/**
 * Gemini AI Classification Service
 * Uses Google Gemini for UK medicine classification validation
 * Determines if products can be legally sold on McGrocer (non-pharmacy) website
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

/**
 * Custom error types for classification
 */
export class RetryableError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class QuotaExceededError extends RetryableError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Classification result interface
 */
export interface ClassificationResult {
  rejected: boolean;
  classification: 'not_medicine' | 'gsl' | 'pharmacy' | 'pom' | 'unclear';
  reason: string;
  confidence: number;
}

/**
 * System prompt for UK medicine classification
 * Focused on identifying regulated medicines vs everything else
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are a UK medicine classification expert. Your ONLY job is to determine if a product is a UK-regulated medicine.

WHAT IS A MEDICINE?
A product is a medicine if it meets ANY of these criteria:
- Contains active pharmaceutical ingredients (APIs) intended to treat, prevent, or diagnose disease
- Makes medicinal claims (e.g., "treats headaches", "reduces fever", "cures infection")
- Is a drug formulation requiring medical regulation (tablets, capsules, syrups with drug ingredients)
- Falls under UK Medicines Act 1968 or Human Medicines Regulations 2012

EVERYTHING ELSE IS NOT A MEDICINE.
This includes: food, drinks, cosmetics, personal care items, household products, electronics, toys, sex toys, wellness devices, dietary supplements without medicinal claims, vitamins, herbal products without medicinal claims.

IMPORTANT: Ignore category names like "Health & Medicines", "Sexual Health", "Medical Supplies" - these are just organizational labels. Focus ONLY on the product itself.

CLASSIFICATION CATEGORIES:

1. not_medicine - Product does NOT meet medicine criteria above
   → ACCEPTED

2. gsl (General Sales List) - Over-the-counter medicine safe for general retail
   Examples: Paracetamol 500mg (16 pack), Ibuprofen 200mg, antacids, basic cough medicines
   → ACCEPTED

3. pharmacy - Medicine requiring pharmacist supervision
   Examples: Stronger painkillers with codeine, certain allergy medications, emergency contraception
   → REJECTED

4. pom (Prescription Only Medicine) - Requires doctor's prescription
   Examples: Antibiotics, controlled substances, prescription-strength medications
   → REJECTED

5. unclear - Cannot confidently determine if product is medicine or what type
   → REJECTED (err on side of caution)

DECISION RULE:
- ACCEPTED = not_medicine OR gsl
- REJECTED = pharmacy OR pom OR unclear

DEFAULT STANCE: If unsure whether something is a medicine at all, classify as "not_medicine" with lower confidence. Only use "unclear" if you're certain it's a medicine but unsure which type.

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no code blocks):
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Brief explanation", "confidence": 0.95}

EXAMPLES:

Product: "Heinz Tomato Ketchup 460g"
Category: "Food & Drink"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Food condiment with no medicinal ingredients or claims", "confidence": 1.0}

Product: "Skins Touch The Wand G Spot Stimulator"
Category: "Health & Medicines > Sexual Health"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Sex toy device, no pharmaceutical ingredients or medicinal claims despite health category", "confidence": 0.98}

Product: "Fitbit Charge 5 Fitness Tracker"
Category: "Health & Wellness > Medical Devices"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Consumer electronics wellness device, not a regulated medicine", "confidence": 0.95}

Product: "Paracetamol 500mg Tablets 16 Pack"
Category: "Health & Medicines > Pain Relief"
{"result": "ACCEPTED", "classification": "gsl", "reason": "GSL medicine - paracetamol up to 16 pack is general sale", "confidence": 0.98}

Product: "Multivitamin Tablets 30 Day Supply"
Category: "Health & Wellness > Vitamins"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Dietary supplement without medicinal claims", "confidence": 0.90}

Product: "Nurofen Plus Tablets 32 Pack"
Category: "Health & Medicines > Pain Relief"
{"result": "REJECTED", "classification": "pharmacy", "reason": "Contains codeine - requires pharmacist supervision", "confidence": 0.98}

Product: "Amoxicillin 500mg Capsules"
Category: "Health & Medicines > Antibiotics"
{"result": "REJECTED", "classification": "pom", "reason": "Antibiotic - prescription only medicine", "confidence": 1.0}`;

/**
 * Fetch custom guidelines from database and append to base system prompt
 * @param supabase - Supabase client
 * @returns System prompt string with optional custom guidelines appended
 */
async function getSystemPrompt(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('agent_resource')
      .select('content')
      .eq('agent_type', 'classification')
      .eq('resource_type', 'guideline')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.content) {
      console.log('[Classification] No custom guidelines found, using base system prompt only');
      return CLASSIFICATION_SYSTEM_PROMPT;
    }

    console.log('[Classification] Appending custom guidelines to base system prompt');
    // Append custom guidelines to the base system prompt
    return `${CLASSIFICATION_SYSTEM_PROMPT}

ADDITIONAL GUIDELINES:
${data.content}`;
  } catch (error) {
    console.error('[Classification] Error fetching custom guidelines:', error);
    return CLASSIFICATION_SYSTEM_PROMPT;
  }
}

/**
 * Available Gemini models in order of preference for fallback
 * Ordered by cost (cheapest first)
 */
export const GEMINI_MODELS = [
  'gemini-flash-lite-latest',       // Cheapest, lightweight
  'gemini-flash-latest',            // Low cost, fast
  'gemini-2.0-flash-exp',           // Experimental (free/low cost)
  'gemini-2.5-pro'                  // Most expensive fallback
] as const;

/**
 * Classify a product using Gemini AI
 * @param productName - Name of the product
 * @param productDescription - Description of the product
 * @param apiKey - Gemini API key (from environment)
 * @param supabaseClient - Optional Supabase client for fetching custom guidelines to append
 * @param modelName - Optional model name (defaults to first in GEMINI_MODELS)
 * @param productCategory - Optional category to help with classification
 * @returns Classification result
 */
export async function classifyProduct(
  productName: string,
  productDescription: string,
  apiKey: string,
  supabaseClient?: any,
  modelName: string = GEMINI_MODELS[0],
  productCategory?: string
): Promise<ClassificationResult> {
  try {
    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName
    });

    console.log(`[Classification] Using model: ${modelName}`);

    // Get system prompt (base prompt + optional custom guidelines appended)
    const systemPrompt = supabaseClient
      ? await getSystemPrompt(supabaseClient)
      : CLASSIFICATION_SYSTEM_PROMPT;

    // Build user prompt
    const categoryLine = productCategory ? `\nProduct category: ${productCategory}\n` : '';
    const userPrompt = `Product name: ${productName}
${categoryLine}
Product description: ${productDescription || 'No description provided'}

Classify this product according to UK medicine regulations and return the JSON result.`;

    // Generate classification
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);

    const responseText = result.response.text().trim();

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to parse classification response: ${responseText}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (!parsed.result || !parsed.classification || !parsed.reason) {
      throw new Error(`Invalid classification response structure: ${JSON.stringify(parsed)}`);
    }

    // Map result to rejected boolean
    const rejected = parsed.result === 'REJECTED';

    // Normalize classification
    const classification = parsed.classification.toLowerCase() as ClassificationResult['classification'];

    // Validate classification value
    const validClassifications: ClassificationResult['classification'][] = [
      'not_medicine', 'gsl', 'pharmacy', 'pom', 'unclear'
    ];
    if (!validClassifications.includes(classification)) {
      throw new Error(`Invalid classification value: ${classification}`);
    }

    // Get confidence (default to 0.8 if not provided)
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;

    return {
      rejected,
      classification,
      reason: parsed.reason,
      confidence: Math.min(Math.max(confidence, 0), 1) // Clamp between 0 and 1
    };

  } catch (error) {
    console.error('[Classification] Error:', error);

    // Check if this is a retryable error
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Quota exceeded errors (429) - should be retried by caller
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      throw new QuotaExceededError(errorMessage);
    }

    // Server errors (5xx) - should be retried by caller
    if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503') || errorMessage.includes('504')) {
      throw new RetryableError(errorMessage, 500);
    }

    // Network/timeout errors - should be retried by caller
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('fetch failed')) {
      throw new RetryableError(errorMessage);
    }

    // For all other errors (parsing, validation, etc.), reject as unclear
    // This is the conservative approach for genuine classification failures
    console.warn('[Classification] Non-retryable error, marking as unclear:', errorMessage);
    return {
      rejected: true,
      classification: 'unclear',
      reason: `Classification failed: ${errorMessage}`,
      confidence: 0
    };
  }
}

/**
 * Batch classify multiple products
 * @param products - Array of products to classify
 * @param apiKey - Gemini API key
 * @returns Array of classification results
 */
export async function classifyProductsBatch(
  products: Array<{ name: string; description: string }>,
  apiKey: string
): Promise<ClassificationResult[]> {
  const results = await Promise.all(
    products.map(product =>
      classifyProduct(product.name, product.description, apiKey)
    )
  );
  return results;
}
