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
  'gemini-2.5-flash',      // Best balance of speed and quality
  'gemini-2.0-flash',      // Proven stable alternative
  'gemini-2.5-pro',        // More powerful if needed
  'gemini-flash-latest',   // Latest features
  'gemini-2.0-flash-exp',  // Experimental (last resort)
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
  summary: string;          // AI's summary of decisions made during generation
  processingLogs?: ProcessingLog[];  // Optional processing logs
}

/**
 * Function declarations for Gemini tool calling (new SDK format)
 */
const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'researchKeywords',
    description: 'Research SEO keywords for a blog topic. Call this FIRST to discover high-value keywords with search volume, competition, and intent data. Returns keyword suggestions that you should analyze to select the best primary keyword for the blog post.',
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
            ? `Found ${usableImages.length} analyzed images (${cachedMap.size} cached). Use URLs marked as usable.`
            : 'No usable images found. Use product images instead.',
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

  if (!finalText || finalText.length < 100) {
    throw new Error('Generated content is too short or empty');
  }

  // Parse JSON response with summary and content fields
  let summary = '';
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

  // Helper to extract summary and content using regex (fallback)
  const extractWithRegex = (text: string): { summary: string; content: string } | null => {
    // Try to extract summary field using proper JSON string matching
    // Pattern: match any char except " or \, OR any escaped sequence (\")
    const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);

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

        return {
          summary: summaryValue,
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
        parsed = true;
        addLog('success', `Parsed JSON directly (summary: ${summary.length} chars, content: ${cleanContent.length} chars)`);
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
        parsed = true;
        addLog('success', `Parsed sanitized JSON (summary: ${summary.length} chars, content: ${cleanContent.length} chars)`);
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
      parsed = true;
      addLog('info', `Extracted via regex (summary: ${summary.length} chars, content: ${cleanContent.length} chars)`);
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
  cleanContent = cleanContent
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // Convert markdown bold **text** to <strong>text</strong>
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert markdown italic *text* to <em>text</em>
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Convert --- separators to <hr>
    .replace(/^---+$/gm, '<hr>');

  // Validate no placeholder links
  const hasPlaceholderLinks = /<a\s+href=["']#["']/.test(cleanContent) ||
    /href=["']PRODUCT_URL["']/.test(cleanContent);
  if (hasPlaceholderLinks) {
    addLog('warning', `Content contains placeholder links - AI may not have used searchProducts correctly`);
  }

  // Validate product images are embedded (only if includeImages is enabled)
  if (request.includeImages !== false) {
    const hasProductImages = /<img[^>]+src=["'][^"']+["'][^>]*>/.test(cleanContent);
    if (!hasProductImages) {
      addLog('warning', `Content does not contain product images - AI may not have embedded images from searchProducts`);
    } else {
      const imageCount = (cleanContent.match(/<img[^>]+>/g) || []).length;
      addLog('info', `Product images embedded: ${imageCount} images`);
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

      addLog('success', `✓ Meta tags generated: "${metaTitle}" (${metaTitle.length} chars)`);
      addLog('info', `Meta description: ${metaDescription.length} characters`);
    } else {
      throw new Error('Failed to parse meta data JSON');
    }
  } catch (metaError) {
    addLog('warning', `Failed to generate meta tags: ${metaError instanceof Error ? metaError.message : 'Unknown error'}`);
    // Fallback: create basic meta tags
    metaTitle = `${selectedKeyword || request.topic} - ${request.persona.name}`;
    metaDescription = `Comprehensive guide to ${selectedKeyword || request.topic}. Expert insights and recommendations.`;
    addLog('info', `Using fallback meta tags`);
  }

  return {
    content: cleanContent,
    markdown: cleanContent, // Gemini returns HTML, not markdown
    wordCount,
    productLinks: productLinksUsed,
    articlesAnalyzed,
    selectedKeyword: selectedKeyword || request.topic, // Fallback to topic if no keyword selected
    metaTitle,
    metaDescription,
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

      // Success! Return the result with processing logs
      addLog('success', `✓ Blog generated successfully with ${modelName}`);

      return {
        success: true,
        data: {
          ...result,
          processingLogs, // Add processing logs to the result
        },
        error: null,
      };

    } catch (error) {
      lastError = error as Error;

      // Check if this is a rate limit error
      if (isRateLimitError(error)) {
        const message = getRateLimitMessage(modelName, error);
        addLog('warning', message);

        // If this is not the last model, continue to next one
        if (i < modelsToTry.length - 1) {
          addLog('info', `Trying next model in fallback chain...`);
          continue;
        } else {
          addLog('error', `All models exhausted. All have quota limits.`);
        }
      } else {
        // Non-rate-limit error - log and fail immediately
        addLog('error', `Error with ${modelName}: ${lastError.message}`);
        break;
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
