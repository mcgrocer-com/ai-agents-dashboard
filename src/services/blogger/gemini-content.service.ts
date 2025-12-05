/**
 * Gemini AI Content Generation Service
 * Uses Google Gemini 2.0 Flash with function calling for:
 * - Shopify product integration
 * - Competitive intelligence from top-ranking articles
 * - Rich persona-driven content generation
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { searchProducts, generateRelatedBlogLinks } from './shopify.service';
import { getTopRankingArticles as getTopRankingArticlesService, scrapeArticlesBatch } from './ai.service';
import { researchKeywords as researchKeywordsService } from './ai.service';
import type { BloggerPersona, BloggerTemplate, ServiceResponse } from '@/types/blogger';

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
function formatTokens(charCount: number): string {
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
    description: 'CRITICAL: Call this function 3-5 times BEFORE writing blog content to find real McGrocer products with actual URLs and images. Returns product objects with title, url, handle, description, price, and image_url. You MUST use the returned URLs and images in your content - never use placeholder links like href="#". Call this for different product categories (e.g., "kitchen knives", "chef knife", "paring knife") to get variety.',
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
];

/**
 * Build rich system prompt with persona and template context
 */
function buildSystemPrompt(
  persona: BloggerPersona,
  template: BloggerTemplate,
  request: GeminiBlogRequest
): string {
  const contextData = persona.context_data;

  return `You are ${persona.name}, a ${persona.role}.

PERSONA IDENTITY & EXPERTISE:
- Experience: ${contextData?.years_experience || 'Many'} years in the field
- Location: ${contextData?.location || 'United Kingdom'}
${contextData?.background ? `- Background: ${contextData.background}` : ''}
${contextData?.credentials ? `- Credentials: ${contextData.credentials}` : ''}
- Specialty: ${contextData?.specialty || persona.expertise}

WRITING STYLE & APPROACH:
- Style: ${contextData?.writing_style || persona.writing_style || 'Professional and engaging'}
- Methodology: ${contextData?.methodology || 'Research-driven and fact-based'}
- Purpose: ${contextData?.purpose || 'Educate and inform readers'}
${contextData?.career_milestone ? `- Notable Work: ${contextData.career_milestone}` : ''}

TEMPLATE: ${template.name}
${template.description}

CONTENT STRUCTURE TO FOLLOW:
${template.content_structure}

SEO REQUIREMENTS (Target Score: 80+/100):
${template.seo_rules || 'Include primary keyword naturally, use semantic HTML, add internal links'}
- Content Length: Write 1500+ words for maximum SEO impact (20 points)
- Keyword Usage: Include primary keyword 1-2% of total words (optimal density for 20 points)
- Heading Structure: Use both <h2> and <h3> tags with keyword in H2 (10 points)
- Internal Links: Include 3+ product links from searchProducts() (10 points)

WRITING INSTRUCTIONS:
${template.prompt_template || 'Write in a clear, engaging style that reflects your expertise'}

${template.notes ? `ADDITIONAL NOTES:\n${template.notes}` : ''}

BLOG TOPIC: ${request.topic}
${request.contextFileContent ? `
CONTEXT FILE AVAILABLE:
The user has attached a context file (${formatTokens(request.contextFileContent.length)}) with additional guidelines, research, or reference material.
Call getContextFile() to retrieve this content when you need it - typically BEFORE writing the blog post.
This allows you to incorporate user-provided information into your content.
` : ''}${request.userPrompt ? `
USER INSTRUCTIONS:
The user has provided the following specific instructions for this content generation. Follow these instructions carefully:

"${request.userPrompt}"

---
` : ''}
YOUR TASK - FOLLOW THIS EXACT WORKFLOW:
${request.contextFileContent ? `
STEP 0: RETRIEVE CONTEXT FILE (RECOMMENDED)
Call getContextFile() to retrieve the user-provided context file.
Review this content BEFORE starting your research - it may contain:
- Writing guidelines or style preferences
- Research data or statistics to reference
- Specific instructions or requirements
- Background information on the topic

` : ''}STEP 1: KEYWORD RESEARCH (MANDATORY)
Call researchKeywords("${request.topic}") to discover high-value SEO keywords.
Analyze the results and select the BEST primary keyword based on:
- Search volume (higher is better for traffic potential)
- Competition level (lower competition = easier to rank)
- Search intent (informational/commercial intent matching your content goal)
- Relevance to the topic

After reviewing the keyword suggestions, explicitly state which keyword you've selected and why.

STEP 2: COMPETITIVE INTELLIGENCE (AUTOMATIC - ONE CALL)

Call getTopRankingArticles("[your selected keyword]") - this AUTOMATICALLY scrapes the top ${request.articlesResearchCount || 3} articles in parallel!

What you get back:
- List of top-ranking articles (titles, URLs, descriptions)
- FULL SCRAPED CONTENT from top ${request.articlesResearchCount || 3} ranking articles (2000+ word excerpts each)
- Word counts, headings, and content structure from top competitors
- Complete competitive intelligence in a SINGLE fast operation

Note: The system automatically analyzes ${request.articlesResearchCount || 3} top-ranking articles.

This gives you EVERYTHING needed to outrank competitors - no manual scraping calls required!

STEP 3: PRODUCT RESEARCH (MANDATORY)
Call searchProducts() 3-5 times with different product queries related to your topic.
Examples:
- If topic is "baby oil": searchProducts("baby oil johnson"), searchProducts("organic baby oil"), searchProducts("baby massage oil")
- If topic is "kitchen knives": searchProducts("kitchen knives"), searchProducts("chef knife"), searchProducts("paring knife")

Collect real product URLs ${request.includeImages !== false ? 'AND image URLs' : ''} that you will use in your content. NEVER use placeholder links${request.includeImages !== false ? ' or images' : ''}.

STEP 4: WRITE COMPREHENSIVE BLOG POST
Write a complete, SEO-optimized blog post (1500+ words) with PROPER HTML FORMATTING and EXCELLENT READABILITY:

REQUIRED HTML STRUCTURE:
   - Start with <h2> tag containing your primary keyword (e.g., <h2>How to Use Baby Oil for Skin: A Comprehensive Guide</h2>)
   - Use <h3> tags for main sections (e.g., <h3>Benefits of Baby Oil for Skin</h3>)
   - Use <h4> tags for subsections (e.g., <h4>1. Moisturizing Dry Skin</h4>)
   - Wrap ALL paragraphs in <p> tags (e.g., <p>Baby oil is a versatile skincare product...</p>)
   - Use <strong> for important text (e.g., <strong>never use placeholder links</strong>)
   - Use <em> for emphasis (e.g., <em>naturally derived ingredients</em>)
   - Use <ul> and <li> for unordered lists (e.g., <ul><li>First benefit</li><li>Second benefit</li></ul>)
   - Use <ol> and <li> for numbered lists (e.g., <ol><li>Step one</li><li>Step two</li></ol>)

CONTENT REQUIREMENTS:
   - Write in ${persona.name}'s voice and expertise WITHOUT introducing yourself (NO "Hello, I'm..." or "As a...")
   - Go straight into the content - the blog should feel like authoritative guidance, not a personal introduction
   - Naturally includes your selected primary keyword (especially in H2, first paragraph, and throughout)
   - READABILITY: Write for easy comprehension (8th-9th grade reading level):
     * Break up long paragraphs (max 3-4 sentences per paragraph)
     * Use active voice instead of passive voice
   ${request.includeImages !== false ? `- Includes REAL product links AND images from searchProducts results:
     <p>
       <a href="[ACTUAL URL]">
         <img src="[ACTUAL image_url]" alt="[ACTUAL PRODUCT TITLE]" style="max-width: 300px; height: auto; border-radius: 8px; margin: 10px 0;" />
       </a>
     </p>
     <p>The <a href="[ACTUAL URL]"><strong>[ACTUAL PRODUCT TITLE]</strong></a> is an excellent choice because...</p>
   - Embed product images naturally within the content flow (e.g., in product recommendations, comparison sections)` : `- Includes REAL product links (text links only, NO images) from searchProducts results:
     <p>The <a href="[ACTUAL URL]"><strong>[ACTUAL PRODUCT TITLE]</strong></a> is an excellent choice because...</p>`}
   - CRITICAL: NO external links to competitor websites, brands, or external resources (NO "Further Reading", NO "Learn More" with external URLs)
   - ONLY link to McGrocer products - these are the ONLY permitted <a> tags in your content
   - Leverages insights from top-ranking articles while adding unique value
   - Adds a clear, compelling call-to-action at the end
   - Aims to OUTRANK the competing articles you analyzed
 
STEP 5: RETURN HTML ONLY
Return ONLY the HTML content (no markdown backticks, no explanations, no meta-commentary).

CRITICAL RULES:
- NEVER introduce yourself or use first-person introductions (NO "I'm...", "Hello, I'm...", "As a...")
- You MUST call ALL research functions in this EXACT order:
  1. researchKeywords()
  2. getTopRankingArticles("[selected keyword]") - automatically analyzes ${request.articlesResearchCount || 3} articles!
  3. searchProducts() (3-5 times with different queries)
- NEVER use placeholder links like href="#" or href="PRODUCT_URL"
- ABSOLUTELY NO EXTERNAL LINKS: Do NOT include ANY links to external websites (NO competitor sites, NO "Further Reading", NO "Learn More" sections with external URLs)
- ONLY link to McGrocer products from searchProducts() results - these are the ONLY permitted links
- If you want to reference external information, write about it WITHOUT linking (e.g., "According to industry experts..." instead of linking to expert sites)
${request.includeImages !== false ? `- NEVER use placeholder images or omit images - ALWAYS use real image_url from searchProducts results
- ALL product images MUST use real image_url from searchProducts results
- Embed 3-5 product images throughout the blog post to enrich visual appeal` : `- DO NOT include any <img> tags - text links only`}
- ALL product links MUST use real URLs from searchProducts results
- Do NOT copy content from top-ranking articles - add unique insights and value
- Make product mentions feel natural, not forced or salesy
- Focus on helping the UK reader solve their problem with authoritative, well-researched content`;
}

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
          data: productsResult.data.products.map(p => ({
            title: p.title,
            url: p.url,
            handle: p.handle,
            description: p.description || '',
            price: p.price || 'Price varies',
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

CRITICAL: When you write the final blog post, output ONLY the HTML content. Do NOT include any preamble, explanation, or commentary like "I will now write..." or "Here is the blog post...". Start directly with the <h2> tag.

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
            const urls = data?.scrapedContent?.map((s: any) => s.url) || [];
            urls.forEach((url: string) => addLog('function_response', `Scraped article: words: ${data?.scrapedContent?.find((s: any) => s.url === url)?.fullWordCount || 0} ${url}`));
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

  // Step 6: Extract final content
  const finalText = result.text;

  if (!finalText || finalText.length < 500) {
    throw new Error('Generated content is too short or empty');
  }

  // Clean up any markdown code blocks if present
  let cleanContent = finalText
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Strip any preamble text before the first HTML tag or markdown header
  // This handles cases where the AI outputs "I will now write..." or similar
  const firstHtmlTagMatch = cleanContent.match(/^[\s\S]*?(<h[1-6]|<p|<div|##\s)/i);
  if (firstHtmlTagMatch && firstHtmlTagMatch.index && firstHtmlTagMatch.index > 0) {
    // There's text before the first HTML tag/header - strip it
    const preambleEndIndex = firstHtmlTagMatch.index;
    const preamble = cleanContent.substring(0, preambleEndIndex).trim();
    if (preamble.length > 0 && preamble.length < 1000) {
      // Only strip if it looks like a preamble (not too long)
      addLog('info', `Stripped preamble text (${preamble.length} chars)`);
      cleanContent = cleanContent.substring(preambleEndIndex).trim();
    }
  }

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
