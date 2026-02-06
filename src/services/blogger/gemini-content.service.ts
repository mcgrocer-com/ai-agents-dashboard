/**
 * Gemini AI Content Generation Service
 * Uses Google Gemini 2.0 Flash with function calling for:
 * - Shopify product integration
 * - Competitive intelligence from top-ranking articles
 * - Rich persona-driven content generation
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { searchProducts, generateRelatedBlogLinks } from './shopify.service';
import { getTopRankingArticles as getTopRankingArticlesService, scrapeArticlesBatch, callDecodoProxy } from './ai.service';
import { researchKeywords as researchKeywordsService } from './ai.service';
import type { BloggerPersona, BloggerTemplate, ServiceResponse } from '@/types/blogger';
import { buildSystemPrompt } from './system-prompt';
import { supabase } from '@/lib/supabase/client';
import { seoValidator } from './seo-validator.service';
import type { SeoValidationReport } from './seo-validator.service';

// Initialize Google GenAI with new SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

/**
 * Estimate token count from character count
 * Approximately 4 characters per token for English text
 */
function estimateTokens(charCount: number): number {
  return Math.round(charCount / 4);
}

/**
 * Format token count for display (e.g., "12,500 tokens")
 */
export function formatTokens(charCount: number): string {
  const tokens = estimateTokens(charCount);
  return `~${tokens.toLocaleString()} tokens`;
}

/**
 * Available Gemini models for blog generation
 */
export type GeminiModel =
  | 'gemini-3-pro-preview'      // Most powerful, 1M token context (Nov 2025)
  | 'gemini-3-flash-preview'    // Fast Gemini 3 model
  | 'gemini-2.5-flash'          // Stable, fast, recommended (default)
  | 'gemini-2.5-pro'            // More powerful, slower
  | 'gemini-2.0-flash'          // Alternative stable version
  | 'gemini-2.0-flash-exp'      // Experimental (may have quota limits)
  | 'gemini-flash-latest';      // Latest version

/**
 * Model fallback priority order
 * If primary model fails due to quota, automatically try these in order
 */
const MODEL_FALLBACK_CHAIN: GeminiModel[] = [
  'gemini-3-pro-preview',      // Most powerful (Nov 2025) - default
  'gemini-3-flash-preview',    // Fast Gemini 3 alternative
  'gemini-2.5-flash',          // Best balance of speed and quality
  'gemini-2.0-flash',          // Proven stable alternative
  'gemini-2.5-pro',            // More powerful if needed
  'gemini-flash-latest',       // Latest features
  'gemini-2.0-flash-exp',      // Experimental (last resort)
];

/**
 * Request for blog generation
 */
export interface GeminiBlogRequest {
  topic: string;
  persona: BloggerPersona;
  template: BloggerTemplate;
  model?: GeminiModel;
  includeImages?: boolean;  // Include product images in content
  articlesResearchCount?: number;  // Number of top articles to scrape (3-10, default: 3)
  seoIterationCount?: number;  // Max SEO fix iterations (5-10, default: 5)
  contextFileContent?: string;  // Optional context file content to inject into prompt
  userPrompt?: string;  // Optional user prompt for additional instructions
  onLogUpdate?: (logs: ProcessingLog[]) => void;  // Real-time log callback
}

/**
 * Processing log entry
 */
export interface ProcessingLog {
  timestamp: number;
  type: 'info' | 'function_call' | 'function_response' | 'success' | 'warning' | 'error';
  message: string;
}

/**
 * Response from blog generation
 */
export interface GeminiBlogResponse {
  content: string;          // HTML content
  markdown: string;         // Markdown version
  wordCount: number;
  productLinks: string[];   // Product handles linked in content
  articlesAnalyzed: number;
  selectedKeyword: string;  // Keyword the AI agent selected for SEO
  metaTitle: string;        // SEO meta title (50-60 chars)
  metaDescription: string;  // SEO meta description (140-160 chars)
  excerpt: string;          // Blog excerpt for listing pages (100-200 chars)
  tags: string[];           // SEO tags for blog categorization (3-6 tags)
  summary: string;          // AI's summary of decisions made during generation
  processingLogs?: ProcessingLog[];  // Optional processing logs
  seoReport?: SeoValidationReport;   // SEO validation report from validator agent
}

/**
 * Function declarations for Gemini tool calling (new SDK format)
 */
const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'researchKeywords',
    description: 'Research SEO keywords for a blog topic. Call this FIRST to discover high-value keywords with search volume, competition, and intent data. Returns keyword suggestions that you MUST analyze and rank before selecting the best primary keyword. When selecting, consider: (1) Search intent match - does it match what users want?, (2) Traffic potential - higher volume is better, (3) Competition - lower competition means easier to rank, (4) Topic relevance - how well it fits the topic, (5) User problem - does it address a clear user need?',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: 'Blog topic to research keywords for (e.g., "baby oil", "kitchen knives", "gluten free diet")',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of keyword suggestions to return (default: 10)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'getTopRankingArticles',
    description: 'COMPETITIVE INTELLIGENCE: Fetch top-ranking articles from UK Google search results for a keyword AND automatically scrape them in parallel. The number of articles to analyze is automatically configured based on user settings. Use this after selecting your primary keyword. Returns: (1) All ranking article titles/URLs/descriptions, (2) Full scraped content from top articles with word counts and headings. This single call gives you complete competitive intelligence!',
    parameters: {
      type: Type.OBJECT,
      properties: {
        keyword: {
          type: Type.STRING,
          description: 'The primary keyword to find top-ranking articles for (e.g., "best baby oil", "kitchen knife guide")',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'searchProducts',
    description: 'Find McGrocer products. Returns: title, url, handle, image_url. Call 3-5 times with varied queries. Use returned URLs in content - never use placeholders.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search query for products - be specific about product type or category (e.g., "kitchen knives", "organic olive oil", "baby formula")',
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of products to return per search (default: 5, recommended: 3-5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getContextFile',
    description: 'Retrieve the user-provided context file content. Call this when you need additional context, research data, guidelines, or reference material the user uploaded. Returns the full text content of the attached file. Only available when a context file has been attached.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'viewArticleImages',
    description: 'Analyze article images using AI vision. Pass image URLs from getTopRankingArticles(). Returns: url, usable (boolean), summary (AI description of image content). Use the summary to decide which images fit your blog topic. REQUIRED before using article images.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        imageUrls: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Array of image URLs to analyze (max 5)',
        },
      },
      required: ['imageUrls'],
    },
  },
];

 

/**
 * Result from function call with optional error info
 */
interface FunctionCallResult {
  data: any;
  error?: string;
  scrapingErrors?: string[];
}

/**
 * Check if error is a rate limit / quota exceeded error
 */
function isRateLimitError(error: any): boolean {
  const errorMessage = error?.message || String(error);
  return (
    errorMessage.includes('429') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('Too Many Requests') ||
    errorMessage.includes('exceeded')
  );
}

/**
 * Get user-friendly error message for rate limit errors
 */
function getRateLimitMessage(model: string, error: any): string {
  const errorMessage = error?.message || String(error);

  if (errorMessage.includes('per_day')) {
    return `Daily quota exceeded for ${model}. Trying alternative model...`;
  } else if (errorMessage.includes('per_minute')) {
    return `Rate limit exceeded for ${model} (too many requests). Trying alternative model...`;
  } else {
    return `Quota limit reached for ${model}. Trying alternative model...`;
  }
}

/**
 * Handle function calls from Gemini
 */
async function handleFunctionCall(functionName: string, args: any, request: GeminiBlogRequest): Promise<FunctionCallResult> {
  console.log(`[Gemini] Function call: ${functionName}`, args);

  switch (functionName) {
    case 'researchKeywords':
      const keywordsResult = await researchKeywordsService(args.topic);
      if (keywordsResult.success && keywordsResult.data) {
        const keywords = keywordsResult.data.keywords.slice(0, args.limit || 10);
        return {
          data: keywords.map(k => ({
            keyword: k.keyword,
            searchVolume: k.search_volume || k.volume || 0,
            competition: k.competition || 'UNKNOWN',
            intent: k.intent || 'informational',
          })),
        };
      }
      return { data: [], error: keywordsResult.error?.message || 'Failed to research keywords' };

    case 'getTopRankingArticles':
      // Use request.articlesResearchCount as the limit (default: 3)
      const articlesResearchCount = request.articlesResearchCount || 3;
      const articlesResult = await getTopRankingArticlesService(args.keyword, articlesResearchCount);

      if (!articlesResult.success || !articlesResult.data || articlesResult.data.length === 0) {
        return {
          data: { articles: [], scrapedContent: [] },
          error: articlesResult.error?.message || `No top-ranking articles found for "${args.keyword}"`,
        };
      }

      // Automatically batch scrape articles based on articlesResearchCount setting
      const topUrls = articlesResult.data.slice(0, articlesResearchCount).map(a => a.url);

      console.log(`[Gemini] Auto-scraping top ${topUrls.length} articles in batch...`);
      const batchResult = await scrapeArticlesBatch(topUrls);

      const scrapedArticles: any[] = [];
      const scrapingErrors: string[] = [];

      if (batchResult.success && batchResult.data) {
        batchResult.data.forEach(scraped => {
          if (scraped.success) {
            const words = scraped.text.split(/\s+/);
            const condensedText = words.slice(0, 2000).join(' ');

            scrapedArticles.push({
              url: scraped.url,
              title: scraped.title,
              text: condensedText,
              fullWordCount: scraped.wordCount,
              condensedWordCount: Math.min(2000, words.length),
              headings: scraped.headings.slice(0, 20),
              images: scraped.images || [],
            });
          } else {
            // Track scraping failures
            scrapingErrors.push(`Failed to scrape: ${scraped.url}`);
          }
        });
      } else if (batchResult.error) {
        scrapingErrors.push(`Batch scraping failed: ${batchResult.error.message}`);
      }

      return {
        data: {
          articles: articlesResult.data.slice(0, articlesResearchCount).map(a => ({
            position: a.position,
            title: a.title,
            url: a.url,
            description: a.description || '',
          })),
          scrapedContent: scrapedArticles,
          note: `Automatically scraped top ${scrapedArticles.length} articles for competitive analysis`,
        },
        scrapingErrors: scrapingErrors.length > 0 ? scrapingErrors : undefined,
      };

    case 'searchProducts':
      const productsResult = await searchProducts(args.query, args.limit || 5);
      if (productsResult.success && productsResult.data) {
        return {
          data: productsResult.data.products.map((p: any) => ({
            title: p.title,
            url: p.url,
            handle: p.handle,
            image_url: p.image_url || '',
          })),
        };
      }
      return { data: [], error: productsResult.error?.message || `No products found for "${args.query}"` };

    case 'getContextFile':
      // Return the context file content if available
      // Note: File size is validated at upload time in ContentGenerationChat
      if (request.contextFileContent) {
        return {
          data: {
            content: request.contextFileContent,
            tokenCount: estimateTokens(request.contextFileContent.length),
            note: 'Context retrieved. NOW CONTINUE: Call researchKeywords() next.',
          },
        };
      }
      return { data: null, error: 'No context file was attached to this request' };

    case 'viewArticleImages':
      // Fetch and analyze article images via proxy with vision subagent
      // Summaries cached in scraped_articles_cache.images JSONB
      const imageUrls: string[] = (args.imageUrls || []).slice(0, 5);
      if (imageUrls.length === 0) {
        return { data: [], error: 'No image URLs provided' };
      }

      // Check scraped_articles_cache for images with existing summaries
      const { data: articlesWithImages } = await supabase
        .from('scraped_articles_cache')
        .select('url, images')
        .not('images', 'is', null);

      // Build map of image URL -> cached summary from articles
      const cachedMap = new Map<string, { url: string; success: boolean; sizeKB: number; usable: boolean; summary: string; cached: boolean }>();
      (articlesWithImages || []).forEach((article: { url: string; images: any[] }) => {
        (article.images || []).forEach((img: any) => {
          if (img.src && img.summary && imageUrls.includes(img.src)) {
            cachedMap.set(img.src, {
              url: img.src,
              success: true,
              sizeKB: img.size_kb || 0,
              usable: img.usable !== false,
              summary: img.summary,
              cached: true,
            });
          }
        });
      });

      // Only process URLs not in cache
      const uncachedUrls = imageUrls.filter((url) => !cachedMap.has(url));
      console.log(`[viewArticleImages] ${cachedMap.size} cached, ${uncachedUrls.length} to analyze`);

      const newResults = await Promise.all(
        uncachedUrls.map(async (imgUrl: string) => {
          try {
            // Step 1: Fetch image via proxy
            const proxyResponse = await callDecodoProxy({ url: imgUrl, proxy_image: true });
            if (!proxyResponse.ok) {
              return { url: imgUrl, success: false, error: `Fetch failed: ${proxyResponse.status}` };
            }
            const result = await proxyResponse.json();

            if (!result.success || !result.data) {
              return { url: imgUrl, success: false, error: result.error || 'Unknown error' };
            }

            const sizeKB = Math.round(result.size / 1024);
            const usable = result.size > 5000 && result.size < 2000000;

            if (!usable) {
              return {
                url: imgUrl,
                success: true,
                sizeKB,
                usable: false,
                note: result.size < 5000 ? 'Too small (icon/thumbnail)' : 'Too large',
              };
            }

            // Step 2: Use vision subagent to analyze the image
            try {
              const visionResponse = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{
                  parts: [
                    {
                      inlineData: {
                        mimeType: result.mimeType,
                        data: result.data
                      }
                    },
                    {
                      text: `Describe this image in 1 sentence (max 100 chars). Focus on: what product/food/item is shown. Be specific and factual. Example: "A stack of chocolate digestive biscuits on a white plate"`
                    }
                  ]
                }]
              });

              const summary = visionResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Image content unclear';
              const trimmedSummary = summary.slice(0, 150);

              // Update scraped_articles_cache with summary for this image
              // Find articles containing this image and update the images array
              const { data: matchingArticles } = await supabase
                .from('scraped_articles_cache')
                .select('url, images')
                .not('images', 'is', null);

              for (const article of matchingArticles || []) {
                const images = article.images || [];
                const imgIndex = images.findIndex((i: any) => i.src === imgUrl);
                if (imgIndex >= 0) {
                  images[imgIndex] = { ...images[imgIndex], summary: trimmedSummary, usable: true, size_kb: sizeKB };
                  await supabase
                    .from('scraped_articles_cache')
                    .update({ images })
                    .eq('url', article.url);
                }
              }

              return { url: imgUrl, success: true, sizeKB, usable: true, summary: trimmedSummary };
            } catch (visionErr) {
              console.warn(`[viewArticleImages] Vision analysis failed for ${imgUrl}:`, visionErr);
              return {
                url: imgUrl,
                success: true,
                sizeKB,
                usable: true,
                summary: 'Image available (analysis unavailable)',
              };
            }
          } catch (err) {
            return { url: imgUrl, success: false, error: err instanceof Error ? err.message : 'Fetch error' };
          }
        })
      );

      // Combine cached + new results in original order
      type ImageResult = { url: string; success: boolean; usable?: boolean; sizeKB?: number; summary?: string; error?: string; note?: string; cached?: boolean };
      const imageResults: ImageResult[] = imageUrls.map(
        (url) => cachedMap.get(url) || newResults.find((r) => r.url === url) || { url, success: false, error: 'Unknown' }
      );

      const usableImages = imageResults.filter((r) => r.success && r.usable);
      return {
        data: {
          images: imageResults,
          usableCount: usableImages.length,
          cachedCount: cachedMap.size,
          note: usableImages.length > 0
            ? `SUCCESS: Found ${usableImages.length} usable images. NEXT: When writing content, embed 2-4 of these images distributed across sections (intro + body sections). Use the "summary" field to pick images relevant to each section.`
            : 'No usable article images. NEXT: You MUST still embed 2-4 product images from searchProducts() distributed across your blog sections.',
        },
      };

    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

/**
 * Generate blog content using Gemini with function calling
 * Internal implementation - use generateBlogWithGemini() for automatic fallback
 */
async function generateBlogWithModel(
  request: GeminiBlogRequest,
  modelName: GeminiModel,
  addLog: (type: ProcessingLog['type'], message: string) => void
): Promise<GeminiBlogResponse> {
  // Step 1: Build rich system prompt
  const systemPrompt = buildSystemPrompt(
    request.persona,
    request.template,
    request
  );

  // Step 2: Initialize chat with function calling (new SDK)
  addLog('info', `Initializing ${modelName} with function calling support`);

  const chat = ai.chats.create({
    model: modelName,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
    },
  });

  // Step 3: Generate content with autonomous agent workflow
  addLog('info', 'Instructing AI agent to research keywords, analyze competitors, and find products...');

  let result = await chat.sendMessage({
    message: `START NOW: Follow the exact workflow described in your instructions:
1. Call researchKeywords("${request.topic}") to get keyword suggestions
2. Analyze the keywords and select the best one (state your choice explicitly)
3. Call getTopRankingArticles("[selected keyword]") - this automatically scrapes ${request.articlesResearchCount || 3} articles!
4. Call searchProducts() 3-5 times with different product queries
5. Write the complete blog post with real product links

CRITICAL OUTPUT FORMAT: Your final response MUST be a JSON object like this:
{"summary": "Your brief reasoning here", "content": "<h2>Title</h2><p>HTML content</p>"}

- Put ALL your reasoning/decisions in the "summary" field (2-3 sentences)
- Put ONLY clean HTML in the "content" field - no thoughts, no preamble
- Do NOT wrap the JSON in markdown code blocks

Begin with researchKeywords now.`,
  });

  // Step 4: Handle function calls iteratively
  let functionCallCount = 0;
  const maxFunctionCalls = 20; // Allow for keyword research + articles + product searches
  const productLinksUsed: string[] = [];
  let selectedKeyword = '';
  let articlesAnalyzed = 0;

  while (
    result.candidates?.[0]?.content?.parts?.some(
      (part: any) => part.functionCall
    ) &&
    functionCallCount < maxFunctionCalls
  ) {
    functionCallCount++;
    addLog('info', `Processing function call batch ${functionCallCount}...`);

    const functionCalls = result.candidates[0].content.parts.filter(
      (part: any) => part.functionCall
    );

    // Execute all function calls
    const functionResponseParts = await Promise.all(
      functionCalls.map(async (fc: any) => {
        // Log the function call
        const argsStr = JSON.stringify(fc.functionCall.args);
        addLog('function_call', `Calling ${fc.functionCall.name}(${argsStr})`);

        const functionResult = await handleFunctionCall(
          fc.functionCall.name,
          fc.functionCall.args,
          request
        );

        // Log any errors from the function call
        if (functionResult.error) {
          addLog('error', functionResult.error);
        }

        // Log any scraping errors
        if (functionResult.scrapingErrors) {
          functionResult.scrapingErrors.forEach(err => addLog('error', err));
        }

        // Log the function response and track data
        if (fc.functionCall.name === 'researchKeywords') {
          const keywords = functionResult.data;
          if (Array.isArray(keywords) && keywords.length > 0) {
            addLog('function_response', `Found ${keywords.length} keyword suggestions for "${fc.functionCall.args.topic}"`);
          } else if (!functionResult.error) {
            addLog('error', `No keywords found for "${fc.functionCall.args.topic}"`);
          }
        } else if (fc.functionCall.name === 'getTopRankingArticles') {
          selectedKeyword = fc.functionCall.args.keyword;
          const data = functionResult.data;
          const totalArticles = data?.articles?.length || 0;
          articlesAnalyzed = data?.scrapedContent?.length || 0;

          if (totalArticles === 0) {
            addLog('error', `Found 0 top-ranking articles for "${selectedKeyword}"`);
          } else {
            addLog('function_response', `Found ${totalArticles} top-ranking articles for "${selectedKeyword}" (automatically scraped top ${articlesAnalyzed})`);
            // Log details for each scraped article
            data?.scrapedContent?.forEach((s: any) => {
              const textChars = s.text?.length || 0;
              const imageCount = s.images?.length || 0;
              addLog('function_response', `Scraped: ${s.fullWordCount} words, ${Math.round(textChars/1024)}KB text, ${imageCount} images → ${s.url}`);
            });
            // Total content size being passed to AI
            const totalChars = data?.scrapedContent?.reduce((sum: number, s: any) => sum + (s.text?.length || 0), 0) || 0;
            const totalImages = data?.scrapedContent?.reduce((sum: number, s: any) => sum + (s.images?.length || 0), 0) || 0;
            addLog('info', `Total context: ${Math.round(totalChars/1024)}KB text, ${totalImages} images available for AI`);

            // Nudge about image collection step
            if (totalImages > 0) {
              addLog('info', `→ AI should now call viewArticleImages() to analyze ${totalImages} article images`);
            }
          }
        } else if (fc.functionCall.name === 'searchProducts') {
          const products = functionResult.data;
          if (Array.isArray(products) && products.length > 0) {
            addLog('function_response', `Found ${products.length} products for "${fc.functionCall.args.query}"`);
          } else if (!functionResult.error) {
            addLog('error', `No products found for "${fc.functionCall.args.query}"`);
          }
        } else if (fc.functionCall.name === 'getContextFile') {
          const data = functionResult.data;
          if (data?.content) {
            addLog('function_response', `Retrieved context file (~${data.tokenCount.toLocaleString()} tokens)`);
          } else if (!functionResult.error) {
            addLog('warning', `No context file available`);
          }
        }

        // Track product handles
        if (fc.functionCall.name === 'searchProducts' && Array.isArray(functionResult.data)) {
          functionResult.data.forEach((p: any) => {
            if (p.handle && !productLinksUsed.includes(p.handle)) {
              productLinksUsed.push(p.handle);
            }
          });
        }

        // Return function response in the correct format for new SDK
        // Wrap array results in an object with a 'products' key
        const wrappedResponse = Array.isArray(functionResult.data)
          ? { products: functionResult.data }
          : functionResult.data;

        return {
          functionResponse: {
            name: fc.functionCall.name,
            response: wrappedResponse as Record<string, unknown>,
          },
        };
      })
    );

    // Send function responses back to Gemini
    result = await chat.sendMessage({ message: functionResponseParts });
  }

  // Step 6: Extract final content from JSON response
  const finalText = result.text;

  // Debug: Log the raw response to understand what's happening
  if (!finalText || finalText.length < 100) {
    addLog('error', `Raw result.text length: ${finalText?.length || 0}`);
    addLog('error', `Raw result.text preview: "${(finalText || '').substring(0, 200)}"`);

    // Check if there's content in candidates
    const candidates = result.candidates;
    if (candidates?.[0]?.content?.parts) {
      const parts = candidates[0].content.parts;
      addLog('error', `Found ${parts.length} parts in response`);
      parts.forEach((p: any, i: number) => {
        if (p.text) addLog('error', `Part ${i}: text (${p.text.length} chars)`);
        if (p.functionCall) addLog('error', `Part ${i}: functionCall (${p.functionCall.name})`);
      });
    }

    // Check finish reason
    const finishReason = candidates?.[0]?.finishReason;
    if (finishReason) {
      addLog('error', `Finish reason: ${finishReason}`);
    }

    throw new Error('Generated content is too short or empty');
  }

  // Parse JSON response with summary, excerpt, tags, and content fields
  let summary = '';
  let excerpt = '';
  let tags: string[] = [];
  let cleanContent = '';

  // Clean up any markdown code blocks around JSON
  const jsonText = finalText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Helper function to sanitize JSON string for parsing
  const sanitizeJsonString = (str: string): string => {
    // Try to extract and fix JSON with unescaped characters
    const jsonMatch = str.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return str;

    let json = jsonMatch[0];

    // Strategy 1: Find content field and properly escape its value
    const contentMatch = json.match(/"content"\s*:\s*"/);
    if (contentMatch && contentMatch.index !== undefined) {
      const contentStart = contentMatch.index + contentMatch[0].length;

      // Find the end of the content value (last " before }, accounting for nested quotes)
      // Work backwards from the end to find the closing pattern
      const closingPatterns = [
        /"\s*\}$/,           // "} at end
        /"\s*,\s*"[^"]+"\s*:\s*"[^"]*"\s*\}$/,  // ", "key": "value"}
      ];

      let contentEnd = -1;
      for (const pattern of closingPatterns) {
        const match = json.match(pattern);
        if (match && match.index !== undefined) {
          contentEnd = match.index;
          break;
        }
      }

      if (contentEnd > contentStart) {
        const beforeContent = json.substring(0, contentStart);
        const contentValue = json.substring(contentStart, contentEnd);
        const afterContent = json.substring(contentEnd);

        // Escape problematic characters within the content value
        const escapedContent = contentValue
          .replace(/\\/g, '\\\\')           // Escape backslashes first
          .replace(/\n/g, '\\n')            // Escape actual newlines
          .replace(/\r/g, '\\r')            // Escape carriage returns
          .replace(/\t/g, '\\t')            // Escape tabs
          .replace(/(?<!\\)"/g, '\\"');     // Escape unescaped quotes

        json = beforeContent + escapedContent + afterContent;
      }
    }

    return json;
  };

  // Helper to extract summary, excerpt, tags, and content using regex (fallback)
  const extractWithRegex = (text: string): { summary: string; excerpt: string; tags: string[]; content: string } | null => {
    // Try to extract summary field using proper JSON string matching
    // Pattern: match any char except " or \, OR any escaped sequence (\")
    const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const excerptMatch = text.match(/"excerpt"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    // Try to extract tags array
    const tagsMatch = text.match(/"tags"\s*:\s*\[((?:[^\]])*)\]/);
    let tagsValue: string[] = [];
    if (tagsMatch) {
      // Parse the array contents - extract quoted strings
      const tagStrings = tagsMatch[1].match(/"([^"]+)"/g);
      if (tagStrings) {
        tagsValue = tagStrings.map(t => t.replace(/"/g, '').trim());
      }
    }

    // Try to extract content field - match from "content": " to the last occurrence of the pattern "} or just before }
    const contentStartMatch = text.match(/"content"\s*:\s*"/);
    if (contentStartMatch && contentStartMatch.index !== undefined) {
      const startIdx = contentStartMatch.index + contentStartMatch[0].length;

      // Find where content ends - look for pattern that ends the JSON
      // Content ends at the last " before the closing }
      let endIdx = text.lastIndexOf('"}');
      if (endIdx === -1) {
        endIdx = text.lastIndexOf('"');
      }

      if (endIdx > startIdx) {
        let contentValue = text.substring(startIdx, endIdx);

        // Clean up escaped sequences that became literal strings
        contentValue = contentValue
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\t/g, '  ')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');

        // Clean up summary - unescape quotes and convert newlines to spaces
        let summaryValue = '';
        if (summaryMatch) {
          summaryValue = summaryMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
        }

        // Clean up excerpt - unescape quotes and convert newlines to spaces
        let excerptValue = '';
        if (excerptMatch) {
          excerptValue = excerptMatch[1]
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .trim();
        }

        return {
          summary: summaryValue,
          excerpt: excerptValue,
          tags: tagsValue,
          content: contentValue.trim()
        };
      }
    }

    return null;
  };

  // Try multiple parsing strategies
  let parsed = false;

  // Strategy 1: Direct JSON parse
  try {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.content) {
        cleanContent = result.content;
        summary = result.summary || '';
        excerpt = result.excerpt || '';
        tags = Array.isArray(result.tags) ? result.tags : [];
        parsed = true;
        addLog('success', `Parsed JSON directly (summary: ${summary.length} chars, excerpt: ${excerpt.length} chars, tags: ${tags.length}, content: ${cleanContent.length} chars)`);
      }
    }
  } catch {
    // Strategy 1 failed, continue to next
  }

  // Strategy 2: Sanitize and parse
  if (!parsed) {
    try {
      const sanitized = sanitizeJsonString(jsonText);
      const result = JSON.parse(sanitized);
      if (result.content) {
        cleanContent = result.content;
        summary = result.summary || '';
        excerpt = result.excerpt || '';
        tags = Array.isArray(result.tags) ? result.tags : [];
        parsed = true;
        addLog('success', `Parsed sanitized JSON (summary: ${summary.length} chars, excerpt: ${excerpt.length} chars, tags: ${tags.length}, content: ${cleanContent.length} chars)`);
      }
    } catch {
      // Strategy 2 failed, continue to next
    }
  }

  // Strategy 3: Regex extraction
  if (!parsed) {
    const extracted = extractWithRegex(jsonText);
    if (extracted && extracted.content) {
      cleanContent = extracted.content;
      summary = extracted.summary;
      excerpt = extracted.excerpt || '';
      tags = extracted.tags || [];
      parsed = true;
      addLog('info', `Extracted via regex (summary: ${summary.length} chars, excerpt: ${excerpt.length} chars, tags: ${tags.length}, content: ${cleanContent.length} chars)`);
    }
  }

  // Strategy 4: Fallback - treat entire response as content
  if (!parsed) {
    addLog('warning', 'All JSON parsing strategies failed, using raw fallback');
    cleanContent = jsonText;
    summary = '';

    // Strip any preamble text before the first HTML tag
    const firstHtmlTagMatch = cleanContent.match(/^[\s\S]*?(<h[1-6]|<p|<div|##\s)/i);
    if (firstHtmlTagMatch && firstHtmlTagMatch.index && firstHtmlTagMatch.index > 0) {
      const preambleEndIndex = firstHtmlTagMatch.index;
      const preamble = cleanContent.substring(0, preambleEndIndex).trim();
      if (preamble.length > 0 && preamble.length < 1000) {
        summary = preamble;
        addLog('info', `Extracted preamble as summary (${preamble.length} chars)`);
        cleanContent = cleanContent.substring(preambleEndIndex).trim();
      }
    }
  }

  // Final cleanup: ensure no literal escape sequences remain in content
  cleanContent = cleanContent
    .replace(/\\n/g, '\n')      // Convert literal \n to actual newlines
    .replace(/\\r/g, '')        // Remove \r
    .replace(/\\t/g, '  ')      // Convert \t to spaces
    .replace(/\\"/g, '"')       // Convert \" to "
    .replace(/\\\\/g, '\\');    // Convert \\ to \

  // Convert markdown headers to HTML if present (## -> <h2>, ### -> <h3>, etc.)
  // IMPORTANT: Convert # to h2 (not h1) - h1 is reserved for page title from CMS
  cleanContent = cleanContent
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h2>$1</h2>')  // Single # becomes h2, NOT h1
    // Convert markdown bold **text** to <strong>text</strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert markdown italic *text* to <em>text</em>
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Convert --- separators to <hr>
    .replace(/^---+$/gm, '<hr>');

  // Remove any h1 tags that slipped through (convert to h2)
  cleanContent = cleanContent.replace(/<h1([^>]*)>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>');

  // Remove empty headings (critical for SEO)
  cleanContent = cleanContent.replace(/<h([1-6])([^>]*)>\s*<\/h\1>/gi, '');

  // Validate no placeholder links
  const hasPlaceholderLinks = /<a\s+href=["']#["']/.test(cleanContent) ||
    /href=["']PRODUCT_URL["']/.test(cleanContent);
  if (hasPlaceholderLinks) {
    addLog('warning', `Content contains placeholder links - AI may not have used searchProducts correctly`);
  }

  // Validate images are embedded (only if includeImages is enabled)
  if (request.includeImages !== false) {
    const imageCount = (cleanContent.match(/<img[^>]+>/g) || []).length;

    if (imageCount === 0) {
      addLog('error', `CRITICAL: No images found in content! AI failed to embed images. Target: 2-4 images.`);
    } else if (imageCount === 1) {
      addLog('warning', `Only 1 image embedded. Target is 2-4 images distributed across sections.`);
    } else if (imageCount >= 2 && imageCount <= 4) {
      addLog('success', `✓ ${imageCount} images embedded successfully (target: 2-4)`);
    } else {
      addLog('info', `${imageCount} images embedded (target: 2-4)`);
    }
  } else {
    addLog('info', `Product images disabled - text links only`);
  }

  // Validate HTML structure
  const hasH2 = /<h2[^>]*>/.test(cleanContent);
  const hasH3 = /<h3[^>]*>/.test(cleanContent);
  const hasParagraphs = /<p[^>]*>/.test(cleanContent);

  if (!hasH2) {
    addLog('warning', `Content missing <h2> tag - should have main heading`);
  }
  if (!hasH3) {
    addLog('warning', `Content missing <h3> tags - should have section headings`);
  }
  if (!hasParagraphs) {
    addLog('warning', `Content missing <p> tags - paragraphs should be wrapped`);
  }

  if (hasH2 && hasH3 && hasParagraphs) {
    addLog('info', `✓ HTML structure validated (h2, h3, p tags present)`);
  }

  // Step 5.5: Fetch and append related blog links from Shopify
  addLog('info', `Fetching related blog articles from Shopify...`);
  const linksResult = await generateRelatedBlogLinks(request.topic, 5);

  if (linksResult.success && linksResult.data && linksResult.data.length > 0) {
    addLog('success', `✓ Found ${linksResult.data.length} related articles`);

    // Append related articles section in HTML
    const relatedSection = `

<h2>Related Articles</h2>

<p>For more information about ${request.topic}, check out these articles:</p>

<ul>
${linksResult.data.map(link => `  <li><a href="${link.url}" target="_blank">${link.title}</a></li>`).join('\n')}
</ul>
    `.trim();

    cleanContent += '\n\n' + relatedSection;
    addLog('success', `✓ Related articles section added (${linksResult.data.length} links)`);
  } else {
    addLog('info', `No related articles found for "${request.topic}"`);
  }

  // Calculate word count
  const wordCount = cleanContent.split(/\s+/).length;

  addLog('success', `✓ Blog content generated successfully!`);
  addLog('info', `Selected keyword: "${selectedKeyword}"`);
  addLog('info', `Word count: ${wordCount} words`);
  addLog('info', `Product links: ${productLinksUsed.length} products mentioned`);
  addLog('info', `Articles analyzed: ${articlesAnalyzed}`);
  addLog('info', `Function calls: ${functionCallCount} total calls made`);

  // Step 7: Generate SEO meta title and description
  addLog('info', 'Generating SEO meta title and description...');

  let metaTitle = '';
  let metaDescription = '';

  // Helper to truncate meta title intelligently (at word boundary)
  const truncateTitle = (title: string, maxLen: number = 60): string => {
    if (title.length <= maxLen) return title;
    // Find last space before maxLen to avoid cutting words
    const truncated = title.substring(0, maxLen);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated;
  };

  // Helper to truncate meta description intelligently
  const truncateDescription = (desc: string, maxLen: number = 160): string => {
    if (desc.length <= maxLen) return desc;
    const truncated = desc.substring(0, maxLen - 3); // Leave room for ellipsis
    const lastSpace = truncated.lastIndexOf(' ');
    const lastPeriod = truncated.lastIndexOf('.');
    // Prefer ending at a sentence if possible
    if (lastPeriod > maxLen - 40) {
      return desc.substring(0, lastPeriod + 1);
    }
    return (lastSpace > maxLen - 40 ? truncated.substring(0, lastSpace) : truncated) + '...';
  };

  try {
    const metaPrompt = `Based on this blog content and primary keyword "${selectedKeyword || request.topic}", generate SEO-optimized meta tags.

CONTENT:
${cleanContent}

REQUIREMENTS:
- Meta Title: EXACTLY 50-60 characters (count carefully!), includes primary keyword naturally at the beginning, compelling and click-worthy
- Meta Description: EXACTLY 140-160 characters (count carefully!), includes primary keyword, persuasive summary that encourages clicks

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "metaTitle": "Your SEO-optimized title here",
  "metaDescription": "Your SEO-optimized description here"
}`;

    const metaResult = await ai.models.generateContent({
      model: modelName,
      contents: metaPrompt,
    });
    const metaText = (metaResult.text || '').trim();

    // Extract JSON from response (handle potential markdown code blocks)
    const jsonMatch = metaText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const metaData = JSON.parse(jsonMatch[0]);
      metaTitle = metaData.metaTitle || '';
      metaDescription = metaData.metaDescription || '';

      // Enforce character limits with intelligent truncation
      if (metaTitle.length > 60) {
        addLog('warning', `Meta title too long (${metaTitle.length} chars), truncating to 60`);
        metaTitle = truncateTitle(metaTitle, 60);
      }
      if (metaDescription.length > 160) {
        addLog('warning', `Meta description too long (${metaDescription.length} chars), truncating to 160`);
        metaDescription = truncateDescription(metaDescription, 160);
      }

      addLog('success', `✓ Meta tags generated: "${metaTitle}" (${metaTitle.length} chars)`);
      addLog('info', `Meta description: ${metaDescription.length} characters`);
    } else {
      throw new Error('Failed to parse meta data JSON');
    }
  } catch (metaError) {
    addLog('warning', `Failed to generate meta tags: ${metaError instanceof Error ? metaError.message : 'Unknown error'}`);
    // Fallback: create basic meta tags with enforced limits
    metaTitle = truncateTitle(`${selectedKeyword || request.topic} - ${request.persona.name}`, 60);
    metaDescription = truncateDescription(`Comprehensive guide to ${selectedKeyword || request.topic}. Expert insights and recommendations.`, 160);
    addLog('info', `Using fallback meta tags`);
  }

  // Use excerpt from Content Agent (SEO Validator will handle issues via feedback loop)
  const finalExcerpt = excerpt || metaDescription;

  // Fallback tags from keyword if AI didn't generate any
  const finalTags = tags.length > 0 ? tags : (selectedKeyword ? [selectedKeyword.toLowerCase()] : []);

  return {
    content: cleanContent,
    markdown: cleanContent, // Gemini returns HTML, not markdown
    wordCount,
    productLinks: productLinksUsed,
    articlesAnalyzed,
    selectedKeyword: selectedKeyword || request.topic, // Fallback to topic if no keyword selected
    metaTitle,
    metaDescription,
    excerpt: finalExcerpt, // Blog excerpt for listing pages
    tags: finalTags, // SEO tags for blog categorization
    summary, // AI's summary of decisions made during generation
    processingLogs: [], // Will be populated by the wrapper function
  };
}

/**
 * Generate blog content with automatic model fallback
 * Tries models in priority order if rate limits are hit
 */
export async function generateBlogWithGemini(
  request: GeminiBlogRequest
): Promise<ServiceResponse<GeminiBlogResponse>> {
  const processingLogs: ProcessingLog[] = [];

  const addLog = (type: ProcessingLog['type'], message: string) => {
    const log: ProcessingLog = { timestamp: Date.now(), type, message };
    processingLogs.push(log);
    console.log(`[Gemini] ${message}`);

    // Call the callback to update logs in real-time
    if (request.onLogUpdate) {
      request.onLogUpdate([...processingLogs]);
    }
  };

  addLog('info', 'Starting blog generation...');
  addLog('info', `Topic: ${request.topic}`);
  addLog('info', `Persona: ${request.persona.name}`);
  addLog('info', `Template: ${request.template.name}`);
  addLog('info', `Total Articles To Research: ${request.articlesResearchCount || 3}`);
  addLog('info', `Embed Product Images: ${request.includeImages || false}`);
  addLog('info', `SEO Fix Iterations: ${request.seoIterationCount || 5}`);
  if (request.contextFileContent) {
    addLog('info', `Context file: ${formatTokens(request.contextFileContent.length)} of additional context provided`);
  }
  if (request.userPrompt) {
    addLog('info', `User prompt: "${request.userPrompt.substring(0, 100)}${request.userPrompt.length > 100 ? '...' : ''}"`);
  }

  // Determine model priority order
  const requestedModel = request.model || 'gemini-2.5-flash'; // Default to stable version
  addLog('info', `Requested model: ${requestedModel}`);

  // Build fallback chain starting with requested model
  const modelsToTry: GeminiModel[] = [requestedModel];

  // Add other models from fallback chain (excluding the requested one)
  MODEL_FALLBACK_CHAIN.forEach(model => {
    if (model !== requestedModel && !modelsToTry.includes(model)) {
      modelsToTry.push(model);
    }
  });

  addLog('info', `Fallback chain: ${modelsToTry.join(' → ')}`);

  // Try each model in order until one succeeds
  let lastError: Error | null = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const modelName = modelsToTry[i];

    try {
      if (i > 0) {
        addLog('warning', `Attempting fallback model #${i}: ${modelName}`);
      }

      const result = await generateBlogWithModel(request, modelName, addLog);

      // Success! Now run SEO validation
      addLog('success', `✓ Blog generated successfully with ${modelName}`);
      addLog('info', 'Running SEO validation...');

      const seoReport = await seoValidator.validate(
        result.content,
        result.metaTitle,
        result.metaDescription,
        { autoFix: true, primaryKeyword: result.selectedKeyword, excerpt: result.excerpt, tags: result.tags, model: modelName }
      );

      // Log SEO validation results - show all checks performed
      addLog('info', `SEO Score: ${seoReport.score}/100 (Grade: ${seoReport.grade})`);

      // Log individual check results (even when passing)
      const { checks } = seoReport;
      addLog(checks.title.passed ? 'success' : 'warning',
        `✓ Title: ${checks.title.length} chars ${checks.title.passed ? '(valid)' : '(needs fix)'}`);
      addLog(checks.description.passed ? 'success' : 'warning',
        `✓ Description: ${checks.description.length} chars ${checks.description.passed ? '(valid)' : '(needs fix)'}`);
      addLog(checks.excerpt.passed ? 'success' : 'warning',
        `✓ Excerpt: ${checks.excerpt.length} chars ${checks.excerpt.passed ? '(valid)' : '(needs fix)'}`);
      addLog(checks.headings.passed ? 'success' : 'warning',
        `✓ Headings: ${checks.headings.hierarchy.length} found ${checks.headings.passed ? '(valid hierarchy)' : `(${checks.headings.issues.join(', ')})`}`);
      addLog(checks.links.passed ? 'success' : 'warning',
        `✓ Links: ${checks.links.total} total, ${checks.links.external} external ${checks.links.passed ? '(valid)' : `(${checks.links.invalid} invalid)`}`);
      addLog(checks.images.passed ? 'success' : 'warning',
        `✓ Images: ${checks.images.total} total, ${checks.images.withAlt}/${checks.images.total} with alt ${checks.images.passed ? '(valid)' : '(missing alt)'}`);
      addLog(checks.aiContent.passed ? 'success' : 'error',
        `✓ AI Content: ${checks.aiContent.passed ? 'Clean (no self-intro or reasoning detected)' : `ISSUES: ${checks.aiContent.patterns.join(', ')}`}`);
      addLog(checks.tags.passed ? 'success' : 'warning',
        `✓ Tags: ${checks.tags.tags.length} tags ${checks.tags.passed ? '(valid and relevant)' : `(${checks.tags.issues.join(', ')})`}`);
      addLog(checks.readability.passed ? 'success' : 'warning',
        `✓ Readability: ${checks.readability.score}/100 (${checks.readability.grade}) ${checks.readability.passed ? '' : `- ${checks.readability.issues.join(', ')}`}`);

      // Log issue counts if any
      if (seoReport.criticalCount > 0) {
        addLog('error', `SEO Critical Issues: ${seoReport.criticalCount}`);
      }
      if (seoReport.errorCount > 0) {
        addLog('warning', `SEO Errors: ${seoReport.errorCount}`);
      }
      if (seoReport.warningCount > 0) {
        addLog('info', `SEO Warnings: ${seoReport.warningCount}`);
      }

      // Log specific issues (detailed)
      seoReport.issues.forEach(issue => {
        const logType = issue.severity === 'critical' || issue.severity === 'error' ? 'error' : 'warning';
        addLog(logType, `[${issue.category.toUpperCase()}] ${issue.message}`);
      });

      // ITERATIVE FEEDBACK LOOP: Keep fixing until Grade A (90+) or max iterations
      let finalContent = result.content;
      let finalTitle = result.metaTitle;
      let finalDescription = result.metaDescription;
      let finalExcerpt = result.excerpt;
      let currentScore = seoReport.score;
      let currentReport = seoReport;
      const maxIterations = request.seoIterationCount || 5; // User-configurable (5-10)
      const targetScore = 90; // Grade A

      // Track the best version seen (score can go down after "over-fixing")
      let bestContent = finalContent;
      let bestTitle = finalTitle;
      let bestDescription = finalDescription;
      let bestExcerpt = finalExcerpt;
      let bestScore = currentScore;
      let bestIteration = 0;

      // Track categories that passed - skip re-validating them (saves API calls, avoids AI variance)
      type IssueCategory = 'title' | 'description' | 'excerpt' | 'headings' | 'links' | 'images' | 'ai-content' | 'tags' | 'readability';
      const passedCategories: IssueCategory[] = [];

      // Collect initially passed categories from first validation
      if (seoReport.checks.title.passed) passedCategories.push('title');
      if (seoReport.checks.description.passed) passedCategories.push('description');
      if (seoReport.checks.excerpt.passed) passedCategories.push('excerpt');
      if (seoReport.checks.headings.passed) passedCategories.push('headings');
      if (seoReport.checks.links.passed) passedCategories.push('links');
      if (seoReport.checks.images.passed) passedCategories.push('images');
      if (seoReport.checks.aiContent.passed) passedCategories.push('ai-content');
      if (seoReport.checks.tags.passed) passedCategories.push('tags');
      if (seoReport.checks.readability.passed) passedCategories.push('readability');

      // Apply suggested alt texts for images if available
      if (!seoReport.checks.images.passed && seoReport.checks.images.suggestedAlts && seoReport.checks.images.suggestedAlts.length > 0) {
        addLog('info', `Applying ${seoReport.checks.images.suggestedAlts.length} suggested alt texts for images...`);
        for (const altSuggestion of seoReport.checks.images.suggestedAlts) {
          // Find and update images with missing or poor alt text
          const escapedSrc = altSuggestion.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match img tag with this src that has no alt or empty alt
          const imgNoAltPattern = new RegExp(`(<img[^>]*src=["']${escapedSrc}["'][^>]*)(>)`, 'gi');
          const imgEmptyAltPattern = new RegExp(`(<img[^>]*src=["']${escapedSrc}["'][^>]*)alt=["']["']([^>]*>)`, 'gi');

          if (imgNoAltPattern.test(finalContent)) {
            finalContent = finalContent.replace(imgNoAltPattern, `$1 alt="${altSuggestion.suggestedAlt}"$2`);
            addLog('success', `✓ Added alt text: "${altSuggestion.suggestedAlt.substring(0, 50)}..."`);
          } else if (imgEmptyAltPattern.test(finalContent)) {
            finalContent = finalContent.replace(imgEmptyAltPattern, `$1alt="${altSuggestion.suggestedAlt}"$2`);
            addLog('success', `✓ Fixed empty alt: "${altSuggestion.suggestedAlt.substring(0, 50)}..."`);
          }
        }
      }

      if (passedCategories.length > 0) {
        addLog('info', `Categories already passing: ${passedCategories.join(', ')}`);
      }

      for (let iteration = 1; iteration <= maxIterations && currentScore < targetScore; iteration++) {
        const hasIssues = currentReport.issues.length > 0;
        if (!hasIssues) break;

        addLog('info', `SEO Fix Iteration ${iteration}/${maxIterations} - Current score: ${currentScore}/100`);

        try {
          // Build list of ALL issues for the Content Agent to fix
          const issuesList = currentReport.issues
            .filter(i => i.severity === 'critical' || i.severity === 'error' || i.severity === 'warning')
            .map(i => `- [${i.category.toUpperCase()}] ${i.message}: ${i.suggestion}`)
            .join('\n');

          const fixPrompt = `You are an SEO Content Fixer Agent. Fix ALL the following SEO issues to achieve a perfect score:

ISSUES TO FIX:
${issuesList}

CURRENT VALUES:
- Title (${finalTitle.length} chars): "${finalTitle}"
- Description (${finalDescription.length} chars): "${finalDescription}"
- Excerpt (${finalExcerpt.length} chars): "${finalExcerpt}"

CURRENT CONTENT (for link/heading fixes):
${finalContent}

REQUIREMENTS:
- Title: 50-60 characters, include keyword "${result.selectedKeyword}"
- Description: 140-160 characters, compelling CTA, include keyword naturally
- Excerpt: 100-200 characters, UNIQUE from description, engaging teaser for blog listing
- Links (<a href> ONLY): Remove tracking parameters (?_pos, ?_psq, etc), add rel="noopener noreferrer" to target="_blank" links
- External links: Must have rel="nofollow"
- Image alt text: If images are missing alt or have poor alt text, add descriptive alt (10-125 chars)
- IMPORTANT: Do NOT modify <img src> URLs - only fix alt attributes

Return ONLY a JSON object with the fixed fields (only include fields that need fixing):
{
  "metaTitle": "fixed title if needed",
  "metaDescription": "fixed description if needed",
  "excerpt": "fixed excerpt if needed",
  "contentFixes": [
    {"find": "old link or text", "replace": "fixed link or text"}
  ]
}`;

          const fixResponse = await ai.models.generateContent({
            model: modelName,
            contents: fixPrompt,
          });

          const fixText = fixResponse.text || '';
          const fixJsonMatch = fixText.match(/\{[\s\S]*\}/);

          if (fixJsonMatch) {
            const fixes = JSON.parse(fixJsonMatch[0]);
            let fixesApplied = 0;

            if (fixes.metaTitle && fixes.metaTitle !== finalTitle) {
              finalTitle = fixes.metaTitle;
              addLog('success', `✓ Fixed title: "${finalTitle}" (${finalTitle.length} chars)`);
              fixesApplied++;
            }
            if (fixes.metaDescription && fixes.metaDescription !== finalDescription) {
              finalDescription = fixes.metaDescription;
              addLog('success', `✓ Fixed description (${finalDescription.length} chars)`);
              fixesApplied++;
            }
            if (fixes.excerpt && fixes.excerpt !== finalExcerpt) {
              finalExcerpt = fixes.excerpt;
              addLog('success', `✓ Fixed excerpt (${finalExcerpt.length} chars)`);
              fixesApplied++;
            }
            if (fixes.contentFixes && Array.isArray(fixes.contentFixes)) {
              let contentFixesApplied = 0;
              let imageAltFixesApplied = 0;
              for (const cf of fixes.contentFixes) {
                if (cf.find && cf.replace && finalContent.includes(cf.find)) {
                  // Check if this is an image fix
                  const isImageTag = cf.find.includes('<img') || cf.replace.includes('<img');
                  const findSrc = cf.find.match(/src=["']([^"']+)["']/)?.[1];
                  const replaceSrc = cf.replace.match(/src=["']([^"']+)["']/)?.[1];
                  const isSrcChange = findSrc && replaceSrc && findSrc !== replaceSrc;

                  if (isImageTag && isSrcChange) {
                    // Skip fixes that change image URLs (protect rehosted images)
                    continue;
                  } else if (isImageTag) {
                    // Allow alt text fixes - they don't change src URLs
                    finalContent = finalContent.replace(cf.find, cf.replace);
                    fixesApplied++;
                    imageAltFixesApplied++;
                  } else {
                    // Non-image fix
                    finalContent = finalContent.replace(cf.find, cf.replace);
                    fixesApplied++;
                    contentFixesApplied++;
                  }
                }
              }
              if (contentFixesApplied > 0) {
                addLog('success', `✓ Applied ${contentFixesApplied} content fixes`);
              }
              if (imageAltFixesApplied > 0) {
                addLog('success', `✓ Applied ${imageAltFixesApplied} image alt text fixes`);
              }
            }

            if (fixesApplied === 0) {
              addLog('info', 'No new fixes applied - stopping iteration');
              break;
            }

            // Re-validate after fixes (skip categories that already passed)
            addLog('info', `Re-validating... (skipping ${passedCategories.length} passed categories)`);
            currentReport = await seoValidator.validate(
              finalContent,
              finalTitle,
              finalDescription,
              {
                autoFix: false,
                primaryKeyword: result.selectedKeyword,
                excerpt: finalExcerpt,
                tags: result.tags,
                model: modelName,
                skipCategories: passedCategories,
              }
            );
            currentScore = currentReport.score;
            addLog('info', `New SEO Score: ${currentScore}/100 (Grade: ${currentReport.grade})`);

            // Update passed categories with newly passing checks
            if (currentReport.checks.title.passed && !passedCategories.includes('title')) passedCategories.push('title');
            if (currentReport.checks.description.passed && !passedCategories.includes('description')) passedCategories.push('description');
            if (currentReport.checks.excerpt.passed && !passedCategories.includes('excerpt')) passedCategories.push('excerpt');
            if (currentReport.checks.headings.passed && !passedCategories.includes('headings')) passedCategories.push('headings');
            if (currentReport.checks.links.passed && !passedCategories.includes('links')) passedCategories.push('links');
            if (currentReport.checks.images.passed && !passedCategories.includes('images')) passedCategories.push('images');
            if (currentReport.checks.aiContent.passed && !passedCategories.includes('ai-content')) passedCategories.push('ai-content');
            if (currentReport.checks.tags.passed && !passedCategories.includes('tags')) passedCategories.push('tags');
            if (currentReport.checks.readability.passed && !passedCategories.includes('readability')) passedCategories.push('readability');

            // Track best version (score can decrease after over-fixing)
            if (currentScore > bestScore) {
              bestScore = currentScore;
              bestContent = finalContent;
              bestTitle = finalTitle;
              bestDescription = finalDescription;
              bestExcerpt = finalExcerpt;
              bestIteration = iteration;
            }

            if (currentScore >= targetScore) {
              addLog('success', `✓ Target score achieved! (${currentScore}/100)`);
              break;
            }
          }
        } catch (fixError) {
          addLog('warning', `Fix iteration ${iteration} failed: ${fixError instanceof Error ? fixError.message : 'Unknown error'}`);
        }
      }

      // Use best version if final score dropped below peak
      if (currentScore < bestScore) {
        addLog('warning', `Score dropped from ${bestScore} to ${currentScore} - reverting to best version (iteration ${bestIteration})`);
        finalContent = bestContent;
        finalTitle = bestTitle;
        finalDescription = bestDescription;
        finalExcerpt = bestExcerpt;
        currentScore = bestScore;
      }

      if (currentScore < targetScore) {
        addLog('info', `Final score: ${currentScore}/100 - some issues may require manual review`);
      }

      // NOTE: Image validation removed - viewArticleImages() already validates images server-side
      // Client-side validation was causing CORS false positives (browsers can display cross-origin images)

      return {
        success: true,
        data: {
          ...result,
          content: finalContent,
          metaTitle: finalTitle,
          metaDescription: finalDescription,
          excerpt: finalExcerpt,
          processingLogs,
          seoReport, // Include SEO report in response
        },
        error: null,
      };

    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message || 'Unknown error';

      // Check if this is a rate limit error
      if (isRateLimitError(error)) {
        const message = getRateLimitMessage(modelName, error);
        addLog('warning', message);
      } else {
        addLog('error', `Error with ${modelName}: ${errorMessage}`);
      }

      // For recoverable errors, try the next model in fallback chain
      const isRecoverableError =
        isRateLimitError(error) ||
        errorMessage.includes('too short or empty') ||
        errorMessage.includes('Failed to parse') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('RECITATION') ||
        errorMessage.includes('SAFETY');

      if (isRecoverableError && i < modelsToTry.length - 1) {
        addLog('info', `Trying next model in fallback chain...`);
        continue;
      }

      // Non-recoverable error or last model - stop trying
      if (i >= modelsToTry.length - 1) {
        addLog('error', `All models exhausted.`);
      }
    }
  }

  // All models failed
  addLog('error', 'Failed to generate blog with any available model');

  return {
    success: false,
    data: null,
    error: lastError || new Error('Failed to generate blog content with any available model'),
  };
}
