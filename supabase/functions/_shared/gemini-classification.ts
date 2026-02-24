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
  classification: 'not_medicine' | 'gsl' | 'pharmacy' | 'pom' | 'unclear' | 'cbd' | 'tobacco' | 'fresh_perishable' | 'medical_device';
  reason: string;
  confidence: number;
}

// ============================================================================
// Keyword Pre-Filter: Deterministic classification for obvious products
// Skips Gemini API call entirely for high-confidence matches
// ============================================================================

/** Known tobacco/cigarette brand names (case-insensitive matching) */
const TOBACCO_BRANDS = [
  // Cigarette brands (UK market)
  'benson & hedges', 'benson and hedges', 'mayfair', 'sterling', 'silk cut',
  'marlboro', 'pall mall', 'richmond', 'sovereign', 'players', 'embassy',
  'jps', 'rothmans', 'lambert & butler', 'lambert and butler', 'regal',
  'royals', 'camel', 'lucky strike', 'chesterfield', 'dunhill', 'winston',
  'kent', 'l&m', 'vogue', 'sobranie', 'davidoff', 'parliament',
  'gauloises', 'gitanes', 'the king',
  // Cigarillo brands
  'royal dutch',
  // Heated tobacco brands
  'terea', 'heets', 'iqos',
  // Vape/e-cigarette brands
  'elf bar', 'elfbar', 'lost mary', 'ske crystal', 'vampire vape',
  'edge vape', 'nordic spirit',
  // Note: 'blu' matched via separate check (too short for substring), 'niquitin' is NRT medicine not tobacco
];

/** Unambiguous tobacco product terms - these alone confirm tobacco */
const TOBACCO_PRODUCT_TERMS = [
  'cigarette', 'cigarettes', 'cigarillo', 'cigarillos', 'cigar',
  'rolling tobacco', 'tobacco sticks', 'heated tobacco',
  'superkings', 'superking',
];

/** Packaging patterns that confirm tobacco when combined with a brand */
const TOBACCO_PACKAGING_TERMS = [
  '100 per pack', '20 per pack', '10 per pack',
  '100 pack', '20 pack', '10 pack',
  'ks multipack', 'multipack 100', 'multipack',
  '100s', '20s', '10s',
  'kingsize', 'king size',
  '20 cigarettes', '10 cigarettes',
];

/** Brands that are exclusively vape/e-cigarette companies - no packaging term needed */
const VAPE_ONLY_BRANDS = [
  'elf bar', 'elfbar', 'lost mary', 'ske crystal', 'vampire vape',
  'edge vape', 'nordic spirit',
];

/** Vape/e-cigarette terms - unambiguous */
const VAPE_TERMS = [
  'vape liquid', 'vape pod', 'vape pods', 'vape kit', 'vape refill', 'vape juice',
  'e-liquid', 'e liquid', 'e-cigarette', 'e cigarette',
  'disposable vape', 'nicotine pouch', 'nicotine pouches',
  'nicotine salt', 'nic salt',
];

/** CBD product terms */
const CBD_TERMS = [
  'cbd oil', 'cbd spray', 'cbd capsule', 'cbd capsules',
  'cbd gummies', 'cbd drops', 'cbd vape', 'cbd edible', 'cbd edibles',
  'cbd balm', 'cbd cream', 'cbd serum', 'cbd tea',
  'cbd kombucha', 'cbd drink', 'cbd tincture', 'cbd patch',
  'cannabidiol',
];

/** Context words that indicate non-tobacco use of "tobacco" (fragrance, candles, etc.) */
const TOBACCO_FRAGRANCE_EXCLUSIONS = [
  'candle', 'perfume', 'parfum', 'fragrance', 'cologne', 'scent',
  'aftershave', 'diffuser', 'incense', 'air freshener', 'room spray',
  'body spray', 'eau de', 'edp', 'edt',
];

/** Context words that indicate hemp seed (food) not CBD */
const HEMP_FOOD_EXCLUSIONS = [
  'hemp seed', 'hemp protein', 'hemp heart', 'hemp flour', 'hemp milk',
];

/** IVD (In-Vitro Diagnostic) and pregnancy test terms - customs restricted */
const IVD_TERMS = [
  'pregnancy test', 'pregnancy testing', 'pregnancy kit',
  'ovulation test', 'ovulation kit', 'fertility test', 'fertility kit',
  'hcg test', 'hcg strip',
  'blood glucose test', 'blood glucose monitor', 'blood glucose meter',
  'glucose test strip', 'glucose strips', 'glucose meter',
  'cholesterol test', 'cholesterol kit',
  'drug test', 'drug testing kit', 'drug screening',
  'urine test strip', 'urine analysis', 'urine dipstick',
  'rapid test kit', 'rapid antigen test', 'lateral flow test', 'lateral flow',
  'covid test', 'covid-19 test', 'coronavirus test',
  'hiv test', 'hiv testing', 'hiv self-test',
  'blood typing', 'blood type test',
  'ketone test', 'ketone strip',
  'diagnostic test kit', 'diagnostic kit',
  'self-test kit', 'self-testing kit', 'home test kit', 'home testing kit',
  'in vitro diagnostic', 'in-vitro diagnostic', 'ivd test',
  'lancet', 'lancets', 'blood lancet',
  'test cassette', 'test cartridge',
  'clearblue', 'first response',
];

/** Exclusions - products that mention IVD terms in non-IVD context */
const IVD_EXCLUSIONS = [
  'test drive', 'test match', 'pregnancy pillow', 'pregnancy vitamin',
  'pregnancy book', 'pregnancy journal', 'pregnancy support',
];

// NOTE: Fresh/perishable pre-filter removed — too many false positives
// (e.g. "carrot" matching baby food, "potato" matching soup, "butter" matching biscuits).
// Gemini AI now handles all fresh_perishable classification with full product context.

/**
 * Deterministic pre-filter for obvious tobacco/CBD products.
 * Returns a ClassificationResult if high-confidence match found, null otherwise.
 * When null is returned, the caller should fall through to Gemini AI.
 */
export function preClassifyProduct(
  productName: string,
): ClassificationResult | null {
  const nameLower = productName.toLowerCase();

  // --- TOBACCO PRE-FILTER ---

  // Exclusion: skip if product is clearly a fragrance/candle with "tobacco" as a scent note
  const isFragranceContext = TOBACCO_FRAGRANCE_EXCLUSIONS.some(term => nameLower.includes(term));

  if (!isFragranceContext) {
    // Rule 1: Unambiguous tobacco product terms (e.g. "Cigarettes", "Rolling Tobacco")
    for (const term of TOBACCO_PRODUCT_TERMS) {
      if (nameLower.includes(term)) {
        console.log(`[Classification] Pre-filter TOBACCO match: product term "${term}" in "${productName}"`);
        return {
          rejected: true,
          classification: 'tobacco',
          reason: `Pre-filter: product name contains tobacco/cigarette term "${term}"`,
          confidence: 0.99,
        };
      }
    }

    // Rule 2: Tobacco brand + packaging pattern
    for (const brand of TOBACCO_BRANDS) {
      if (nameLower.includes(brand)) {
        for (const pkg of TOBACCO_PACKAGING_TERMS) {
          if (nameLower.includes(pkg)) {
            console.log(`[Classification] Pre-filter TOBACCO match: brand "${brand}" + packaging "${pkg}" in "${productName}"`);
            return {
              rejected: true,
              classification: 'tobacco',
              reason: `Pre-filter: tobacco brand "${brand}" with packaging pattern "${pkg}"`,
              confidence: 0.98,
            };
          }
        }
      }
    }

    // Rule 3: Vape-only brands (e.g. Elf Bar, Lost Mary) - unambiguous without packaging terms
    for (const brand of VAPE_ONLY_BRANDS) {
      if (nameLower.includes(brand)) {
        console.log(`[Classification] Pre-filter TOBACCO match: vape brand "${brand}" in "${productName}"`);
        return {
          rejected: true,
          classification: 'tobacco',
          reason: `Pre-filter: known vape/e-cigarette brand "${brand}"`,
          confidence: 0.98,
        };
      }
    }

    // Rule 4: Vape/e-cigarette terms
    for (const term of VAPE_TERMS) {
      if (nameLower.includes(term)) {
        console.log(`[Classification] Pre-filter TOBACCO match: vape term "${term}" in "${productName}"`);
        return {
          rejected: true,
          classification: 'tobacco',
          reason: `Pre-filter: product name contains vape/e-cigarette term "${term}"`,
          confidence: 0.98,
        };
      }
    }

    // Rule 5: Short brand names requiring word-boundary matching (avoid false positives)
    // "blu" would false-match "blue", so we use regex word boundary
    const shortBrandPatterns = [
      { pattern: /\bblu\b/i, brand: 'blu' },
    ];
    for (const { pattern, brand } of shortBrandPatterns) {
      if (pattern.test(productName)) {
        // Still require a packaging term or vape-related context
        const hasVapeContext = VAPE_TERMS.some(t => nameLower.includes(t))
          || TOBACCO_PACKAGING_TERMS.some(t => nameLower.includes(t))
          || nameLower.includes('mg') || nameLower.includes('ml');
        if (hasVapeContext) {
          console.log(`[Classification] Pre-filter TOBACCO match: short brand "${brand}" with vape context in "${productName}"`);
          return {
            rejected: true,
            classification: 'tobacco',
            reason: `Pre-filter: vape brand "${brand}" with product context`,
            confidence: 0.98,
          };
        }
      }
    }
  }

  // --- CBD PRE-FILTER ---

  // Exclusion: hemp seed/protein products are food, not CBD
  const isHempFood = HEMP_FOOD_EXCLUSIONS.some(term => nameLower.includes(term));

  if (!isHempFood) {
    for (const term of CBD_TERMS) {
      if (nameLower.includes(term)) {
        console.log(`[Classification] Pre-filter CBD match: term "${term}" in "${productName}"`);
        return {
          rejected: true,
          classification: 'cbd',
          reason: `Pre-filter: product name contains CBD term "${term}"`,
          confidence: 0.98,
        };
      }
    }
  }

  // --- IVD / PREGNANCY TEST PRE-FILTER ---

  // Exclusion: skip if product uses IVD terms in non-diagnostic context
  const isIvdExcluded = IVD_EXCLUSIONS.some(term => nameLower.includes(term));

  if (!isIvdExcluded) {
    for (const term of IVD_TERMS) {
      if (nameLower.includes(term)) {
        console.log(`[Classification] Pre-filter MEDICAL_DEVICE match: IVD term "${term}" in "${productName}"`);
        return {
          rejected: true,
          classification: 'medical_device',
          reason: `Pre-filter: In-Vitro Diagnostic (IVD) product - customs restricted, cannot be shipped "${term}"`,
          confidence: 0.98,
        };
      }
    }
  }

  // Fresh/perishable detection is handled entirely by Gemini AI (no pre-filter)
  // to avoid false positives on generic food terms like "carrot", "potato", "butter"

  // No pre-filter match - fall through to Gemini AI
  return null;
}

/**
 * System prompt for UK medicine classification
 * Focused on identifying regulated medicines vs everything else
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are a UK medicine classification expert. Your ONLY job is to determine if a product is a UK-regulated medicine.

WHAT IS A MEDICINE?
A product is a medicine if it meets ALL of these criteria:
- It is a SUBSTANCE or CHEMICAL FORMULATION (tablets, capsules, syrups, creams, liquids, patches containing drug ingredients)
- Contains active pharmaceutical ingredients (APIs) intended to treat, prevent, or diagnose disease
- Falls under UK Medicines Act 1968 or Human Medicines Regulations 2012

WHAT IS NOT A MEDICINE?
Medical DEVICES and electronic health devices are NOT medicines, even if they make health or treatment claims. Devices work through physical/mechanical/electrical means, NOT through pharmacological, immunological, or metabolic action. Examples of ACCEPTED devices: tDCS headsets, TENS machines, blood pressure monitors, insulin pumps, hearing aids, nebulisers, thermometers, fitness trackers, pulse oximeters.

EXCEPTION - In-Vitro Diagnostic (IVD) products and pregnancy test kits ARE restricted (see medical_device category below). These cannot be shipped internationally as customs will block them. IVD products include: pregnancy tests, ovulation tests, blood glucose test strips/monitors, cholesterol test kits, drug test kits, rapid antigen/lateral flow tests, HIV self-tests, urine test strips, diagnostic test cassettes, lancets for blood sampling.

Also NOT medicines: food, drinks, cosmetics, personal care items, household products, electronics, toys, sex toys, dietary supplements without medicinal claims, vitamins, herbal products without medicinal claims.

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

6. cbd - Product containing CBD (Cannabidiol), hemp extract with CBD, or cannabis oil
   These products require FSA Novel Food authorization and have age restrictions (18+).
   Examples: CBD Oil 500mg, Hemp Extract CBD Capsules, CBD Gummies, CBD Vape Liquid, Cannabidiol Drops
   IMPORTANT: Hemp seed oil (without CBD) is a food product → classify as not_medicine
   → REJECTED

7. tobacco - Tobacco, vaping, e-cigarette, or nicotine products
   These products are age-restricted (18+) and regulated under the Tobacco and Related Products Regulations 2016.
   Examples: Cigarettes, rolling tobacco, e-cigarettes, vape kits, vape liquid/e-liquid, nicotine pouches, nicotine patches (NRT), heated tobacco devices, cigars, pipe tobacco
   IMPORTANT: Nicotine Replacement Therapy (NRT) products like nicotine gum/patches that are licensed medicines should be classified as gsl or pharmacy instead
   → REJECTED

8. fresh_perishable - Fresh, chilled, frozen, or perishable products
   These products require cold chain logistics and cannot be sold through our ambient/room-temperature supply chain.
   Examples: Fresh meat (chicken, beef, pork, lamb), fresh fish, dairy (milk, cream, cheese, yoghurt, eggs, butter), fresh fruit and vegetables, chilled ready meals, fresh sandwiches, frozen food, ice cream, fresh bread/bakery items, fresh pasta, fresh juice, salad bags
   IMPORTANT: Shelf-stable versions (canned, dried, UHT, long-life, ambient) should NOT be classified as fresh_perishable - classify as not_medicine instead
   → REJECTED

9. medical_device - In-Vitro Diagnostic (IVD) products, pregnancy test kits, and related diagnostic medical devices
   These products are regulated under the UK Medical Devices Regulations and CANNOT be shipped internationally (customs will block them).
   Examples: Pregnancy tests (Clearblue, First Response), ovulation test kits, blood glucose monitors/test strips, cholesterol test kits, drug testing kits, rapid antigen/lateral flow tests (COVID, flu), HIV self-test kits, urine test strips/dipsticks, blood lancets, diagnostic test cassettes/cartridges, ketone test strips, blood typing kits
   IMPORTANT: Non-IVD medical devices like TENS machines, blood pressure monitors, hearing aids, thermometers, fitness trackers should be classified as not_medicine (they are ACCEPTED)
   → REJECTED

DECISION RULE:
- ACCEPTED = not_medicine OR gsl
- REJECTED = pharmacy OR pom OR unclear OR cbd OR tobacco OR fresh_perishable OR medical_device

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

Product: "Flow tDCS Headset for Depression"
Category: "Health & Wellness > Medical Devices"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Medical device using electrical stimulation - devices are not medicines regardless of health claims. Medicines must be chemical/pharmaceutical substances.", "confidence": 0.95}

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
{"result": "REJECTED", "classification": "pom", "reason": "Antibiotic - prescription only medicine", "confidence": 1.0}

Product: "CBD Oil 1000mg Full Spectrum Drops"
Category: "Health & Wellness > CBD"
{"result": "REJECTED", "classification": "cbd", "reason": "CBD/Cannabidiol product - requires FSA Novel Food authorization, cannot be sold without proper licensing", "confidence": 0.99}

Product: "Organic Hemp Seed Oil 250ml"
Category: "Food & Drink > Oils"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Hemp seed oil is a food product, does not contain CBD/Cannabidiol", "confidence": 0.95}

Product: "Elf Bar 600 Disposable Vape Strawberry Ice"
Category: "Vaping > Disposable Vapes"
{"result": "REJECTED", "classification": "tobacco", "reason": "E-cigarette/vape product - age-restricted and regulated under Tobacco and Related Products Regulations 2016", "confidence": 0.99}

Product: "Marlboro Gold 20 Cigarettes"
Category: "Tobacco > Cigarettes"
{"result": "REJECTED", "classification": "tobacco", "reason": "Tobacco cigarettes - age-restricted product regulated under TRPR 2016", "confidence": 1.0}

Product: "Fresh British Chicken Breast Fillets 500g"
Category: "Fresh Food > Meat & Poultry"
{"result": "REJECTED", "classification": "fresh_perishable", "reason": "Fresh meat product requiring cold chain logistics - cannot be sold through ambient supply chain", "confidence": 0.99}

Product: "Organic Whole Milk 2 Pints"
Category: "Dairy > Milk"
{"result": "REJECTED", "classification": "fresh_perishable", "reason": "Fresh dairy product requiring refrigeration - perishable item unsuitable for ambient supply chain", "confidence": 0.99}

Product: "John West Tuna Chunks in Brine 4x145g"
Category: "Food & Drink > Canned Fish"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Canned/shelf-stable food product, not perishable", "confidence": 0.98}

Product: "Clearblue Digital Pregnancy Test 2 Pack"
Category: "Health & Wellness > Family Planning"
{"result": "REJECTED", "classification": "medical_device", "reason": "In-Vitro Diagnostic (IVD) pregnancy test - customs restricted, cannot be shipped internationally", "confidence": 0.99}

Product: "OneTouch Verio Blood Glucose Test Strips 50 Pack"
Category: "Health & Wellness > Diabetes"
{"result": "REJECTED", "classification": "medical_device", "reason": "IVD blood glucose test strips - regulated diagnostic device, customs restricted", "confidence": 0.99}

Product: "FlowFlex COVID-19 Rapid Antigen Test 5 Pack"
Category: "Health & Wellness > Testing"
{"result": "REJECTED", "classification": "medical_device", "reason": "IVD rapid lateral flow test kit - customs restricted diagnostic device", "confidence": 0.99}

Product: "Omron M3 Comfort Blood Pressure Monitor"
Category: "Health & Wellness > Medical Devices"
{"result": "ACCEPTED", "classification": "not_medicine", "reason": "Non-IVD medical device (blood pressure monitor) - works through mechanical/electrical means, not a diagnostic test kit", "confidence": 0.95}`;

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
  // Tier 1: Keyword pre-filter for obvious tobacco/CBD products (no API cost)
  const preFilterResult = preClassifyProduct(productName);
  if (preFilterResult) {
    return preFilterResult;
  }

  try {
    // Tier 2: Gemini AI classification for everything else
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
      'not_medicine', 'gsl', 'pharmacy', 'pom', 'unclear', 'cbd', 'tobacco', 'fresh_perishable', 'medical_device'
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
