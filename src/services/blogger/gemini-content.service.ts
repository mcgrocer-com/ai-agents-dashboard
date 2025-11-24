/**
 * Gemini AI Content Generation Service
 * Uses Google Gemini 2.0 Flash with function calling for:
 * - Shopify product integration
 * - Competitive intelligence from top-ranking articles
 * - Rich persona-driven content generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { searchProducts, generateRelatedBlogLinks } from './shopify.service';
import { getTopRankingArticles as getTopRankingArticlesService, scrapeArticlesBatch } from './ai.service';
import { researchKeywords as researchKeywordsService } from './ai.service';
import type { BloggerPersona, BloggerTemplate, ServiceResponse } from '@/types/blogger';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

/**
 * Request for blog generation
 */
export interface GeminiBlogRequest {
  topic: string;
  persona: BloggerPersona;
  template: BloggerTemplate;
  model?: 'gemini-2.0-flash-exp' | 'gemini-2.5-pro-exp' | 'gemini-3-pro-preview';
  includeImages?: boolean;  // Include product images in content
  articlesResearchCount?: number;  // Number of top articles to scrape (3-10, default: 3)
  onLogUpdate?: (logs: ProcessingLog[]) => void;  // Real-time log callback
}

/**
 * Processing log entry
 */
export interface ProcessingLog {
  timestamp: number;
  type: 'info' | 'function_call' | 'function_response' | 'success' | 'warning';
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
 * Function declarations for Gemini tool calling
 */
const functionDeclarations = [
  {
    name: 'researchKeywords',
    description: 'Research SEO keywords for a blog topic. Call this FIRST to discover high-value keywords with search volume, competition, and intent data. Returns keyword suggestions that you should analyze to select the best primary keyword for the blog post.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Blog topic to research keywords for (e.g., "baby oil", "kitchen knives", "gluten free diet")',
        },
        limit: {
          type: 'number',
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
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
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
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for products - be specific about product type or category (e.g., "kitchen knives", "organic olive oil", "baby formula")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of products to return per search (default: 5, recommended: 3-5)',
        },
      },
      required: ['query'],
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

YOUR TASK - FOLLOW THIS EXACT WORKFLOW:

STEP 1: KEYWORD RESEARCH (MANDATORY)
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
 * Handle function calls from Gemini
 */
async function handleFunctionCall(functionName: string, args: any, request: GeminiBlogRequest) {
  console.log(`[Gemini] Function call: ${functionName}`, args);

  switch (functionName) {
    case 'researchKeywords':
      const keywordsResult = await researchKeywordsService(args.topic);
      if (keywordsResult.success && keywordsResult.data) {
        const keywords = keywordsResult.data.keywords.slice(0, args.limit || 10);
        return keywords.map(k => ({
          keyword: k.keyword,
          searchVolume: k.search_volume || k.volume || 0,
          competition: k.competition || 'UNKNOWN',
          intent: k.intent || 'informational',
        }));
      }
      return [];

    case 'getTopRankingArticles':
      // Use request.articlesResearchCount as the limit (default: 3)
      const articlesResearchCount = request.articlesResearchCount || 3;
      const articlesResult = await getTopRankingArticlesService(args.keyword, articlesResearchCount);
      if (articlesResult.success && articlesResult.data && articlesResult.data.length > 0) {
        // Automatically batch scrape articles based on articlesResearchCount setting
        const topUrls = articlesResult.data.slice(0, articlesResearchCount).map(a => a.url);

        console.log(`[Gemini] Auto-scraping top ${topUrls.length} articles in batch...`);
        const batchResult = await scrapeArticlesBatch(topUrls);

        const scrapedArticles: any[] = [];
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
            }
          });
        }

        return {
          articles: articlesResult.data.slice(0, articlesResearchCount).map(a => ({
            position: a.position,
            title: a.title,
            url: a.url,
            description: a.description || '',
          })),
          scrapedContent: scrapedArticles,
          note: `Automatically scraped top ${scrapedArticles.length} articles for competitive analysis`,
        };
      }
      return { articles: [], scrapedContent: [] };

    case 'searchProducts':
      const productsResult = await searchProducts(args.query, args.limit || 5);
      if (productsResult.success && productsResult.data) {
        return productsResult.data.products.map(p => ({
          title: p.title,
          url: p.url,
          handle: p.handle,
          description: p.description || '',
          price: p.price || 'Price varies',
          image_url: p.image_url || '',
        }));
      }
      return [];

    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

/**
 * Generate blog content using Gemini 2.0 Flash with function calling
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

  try {
    addLog('info', 'Starting blog generation...');
    addLog('info', `Topic: ${request.topic}`);
    addLog('info', `Persona: ${request.persona.name}`);
    addLog('info', `Template: ${request.template.name}`);
    addLog('info', `Model: ${request.model || 'gemini-2.0-flash-exp'}`);
    addLog('info', `Total Articles To Research: ${request.articlesResearchCount || 3}`);
    addLog('info', `Embed Product Images: ${request.includeImages || false}`);

    // Step 1: Build rich system prompt
    const systemPrompt = buildSystemPrompt(
      request.persona,
      request.template,
      request
    );

    // Step 2: Initialize Gemini model with function calling
    const modelName = request.model || 'gemini-2.0-flash-exp';
    addLog('info', `Initializing ${modelName} with function calling support`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ functionDeclarations: functionDeclarations as any }],
    });

    // Step 3: Generate content with autonomous agent workflow
    addLog('info', 'Instructing AI agent to research keywords, analyze competitors, and find products...');

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
      ],
    });

    let result = await chat.sendMessage(
      `START NOW: Follow the exact workflow described in your instructions:
1. Call researchKeywords("${request.topic}") to get keyword suggestions
2. Analyze the keywords and select the best one (state your choice explicitly)
3. Call getTopRankingArticles("[selected keyword]") - this automatically scrapes ${request.articlesResearchCount || 3} articles!
4. Call searchProducts() 3-5 times with different product queries
5. Write the complete blog post with real product links

Begin with researchKeywords now.`
    );

    // Step 4: Handle function calls iteratively
    let functionCallCount = 0;
    const maxFunctionCalls = 20; // Allow for keyword research + articles + product searches
    const productLinksUsed: string[] = [];
    let selectedKeyword = '';
    let articlesAnalyzed = 0;

    while (
      result.response.candidates?.[0]?.content?.parts?.some(
        part => part.functionCall
      ) &&
      functionCallCount < maxFunctionCalls
    ) {
      functionCallCount++;
      addLog('info', `Processing function call batch ${functionCallCount}...`);

      const functionCalls = result.response.candidates[0].content.parts.filter(
        part => part.functionCall
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

          // Log the function response and track data
          if (fc.functionCall.name === 'researchKeywords' && Array.isArray(functionResult)) {
            addLog('function_response', `Found ${functionResult.length} keyword suggestions for "${fc.functionCall.args.topic}"`);
          } else if (fc.functionCall.name === 'getTopRankingArticles' && functionResult && !Array.isArray(functionResult)) {
            selectedKeyword = fc.functionCall.args.keyword;
            const result = functionResult as any;
            const totalArticles = result.articles?.length || 0;
            articlesAnalyzed = result.scrapedContent?.length || 0;
            const urls = result.scrapedContent?.map((s: any) => s.url) || [];
            addLog('function_response', `Found ${totalArticles} top-ranking articles for "${selectedKeyword}" (automatically scraped top ${articlesAnalyzed})`);
            urls.map((url: string) => addLog('function_response', `Scraped article: words: ${result.scrapedContent?.find((s: any) => s.url === url)?.fullWordCount || 0} ${url}`));
          } else if (fc.functionCall.name === 'searchProducts' && Array.isArray(functionResult)) {
            addLog('function_response', `Found ${functionResult.length} products for "${fc.functionCall.args.query}"`);
          }

          // Track product handles
          if (fc.functionCall.name === 'searchProducts' && Array.isArray(functionResult)) {
            functionResult.forEach((p: any) => {
              if (p.handle && !productLinksUsed.includes(p.handle)) {
                productLinksUsed.push(p.handle);
              }
            });
          }

          // Return function response in the correct format for Gemini API
          // Wrap array results in an object with a 'products' key
          const wrappedResponse = Array.isArray(functionResult)
            ? { products: functionResult }
            : functionResult;

          return {
            functionResponse: {
              name: fc.functionCall.name,
              response: wrappedResponse as Record<string, unknown>,
            },
          };
        })
      );

      // Send function responses back to Gemini
      result = await chat.sendMessage(functionResponseParts);
    }

    // Step 6: Extract final content
    const finalText = result.response.text();

    if (!finalText || finalText.length < 500) {
      throw new Error('Generated content is too short or empty');
    }

    // Clean up any markdown code blocks if present
    let cleanContent = finalText
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

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
      const metaModel = genAI.getGenerativeModel({ model: modelName });
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

      const metaResult = await metaModel.generateContent(metaPrompt);
      const metaText = metaResult.response.text().trim();

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
      success: true,
      data: {
        content: cleanContent,
        markdown: cleanContent, // Gemini returns HTML, not markdown
        wordCount,
        productLinks: productLinksUsed,
        articlesAnalyzed,
        selectedKeyword: selectedKeyword || request.topic, // Fallback to topic if no keyword selected
        metaTitle,
        metaDescription,
        processingLogs,
      },
      error: null,
    };
  } catch (error) {
    addLog('warning', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      data: null,
      error: error as Error,
    };
  }
}
