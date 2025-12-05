/**
 * Blogger AI Service
 * Wraps external API calls for AI-powered content generation
 */

import { GoogleGenAI } from '@google/genai';
import type {
  KeywordResearchResponse,
  MetaDataResponse,
  GenerateBlogRequest,
  GenerateBlogResponse,
  ServiceResponse,
  SeoScoreBreakdown,
  SeoScoreCriterion,
} from '@/types/blogger';
import { generateRelatedBlogLinks } from './shopify.service';
import { supabase } from '@/lib/supabase/client';

// Initialize Google GenAI
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Cache configuration
const CACHE_TTL_DAYS = 7; // Default TTL: 7 days

/**
 * Scraped article cache entry type
 */
interface CachedArticle {
  id: string;
  url: string;
  url_hash: string;
  title: string | null;
  text: string | null;
  headings: string[] | null;
  summary: string | null;
  word_count: number;
  html_size: number;
  scrape_duration_ms: number | null;
  extract_duration_ms: number | null;
  created_at: string;
  expires_at: string;
  hit_count: number;
  last_accessed_at: string;
}

/**
 * Generate MD5-like hash for URL (simple hash for cache key)
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check cache for a scraped article
 * Returns cached content if found and not expired
 */
async function checkCache(url: string): Promise<CachedArticle | null> {
  try {
    const urlHash = hashUrl(url);

    // Use maybeSingle() instead of single() to avoid 406 error when no rows found
    const { data, error } = await supabase
      .from('scraped_articles_cache')
      .select('*')
      .eq('url_hash', urlHash)
      .eq('url', url)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Update hit count and last accessed time
    await supabase
      .from('scraped_articles_cache')
      .update({
        hit_count: (data.hit_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    console.log(`[Cache] HIT: ${url} (${data.word_count} words, hits: ${data.hit_count + 1})`);
    return data as CachedArticle;
  } catch (error) {
    console.warn('[Cache] Check error:', error);
    return null;
  }
}

/**
 * Store scraped article in cache
 */
async function storeInCache(
  url: string,
  article: {
    title: string;
    text: string;
    headings: string[];
    summary?: string;
    wordCount: number;
    htmlSize?: number;
    scrapeDurationMs?: number;
    extractDurationMs?: number;
  }
): Promise<void> {
  try {
    const urlHash = hashUrl(url);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    // Upsert: update if exists, insert if new
    const { error } = await supabase
      .from('scraped_articles_cache')
      .upsert(
        {
          url,
          url_hash: urlHash,
          title: article.title,
          text: article.text,
          headings: article.headings,
          summary: article.summary || null,
          word_count: article.wordCount,
          html_size: article.htmlSize || 0,
          scrape_duration_ms: article.scrapeDurationMs || null,
          extract_duration_ms: article.extractDurationMs || null,
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
          last_accessed_at: new Date().toISOString(),
        },
        {
          onConflict: 'url',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.warn('[Cache] Store error:', error);
    } else {
      console.log(`[Cache] STORED: ${url} (expires: ${expiresAt.toLocaleDateString()})`);
    }
  } catch (error) {
    console.warn('[Cache] Store error:', error);
  }
}

/**
 * Clean up expired cache entries
 * Call periodically to keep cache clean
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_cache');

    if (error) {
      console.warn('[Cache] Cleanup error:', error);
      return 0;
    }

    console.log(`[Cache] Cleaned up ${data} expired entries`);
    return data || 0;
  } catch (error) {
    console.warn('[Cache] Cleanup error:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  totalSizeMb: number;
  avgWordCount: number;
  oldestEntry: string | null;
  newestEntry: string | null;
} | null> {
  try {
    const { data, error } = await supabase.rpc('get_cache_stats');

    if (error || !data || data.length === 0) {
      return null;
    }

    const stats = data[0];
    return {
      totalEntries: stats.total_entries || 0,
      expiredEntries: stats.expired_entries || 0,
      totalSizeMb: stats.total_size_mb || 0,
      avgWordCount: stats.avg_word_count || 0,
      oldestEntry: stats.oldest_entry,
      newestEntry: stats.newest_entry,
    };
  } catch (error) {
    console.warn('[Cache] Stats error:', error);
    return null;
  }
}

const API_URL = "https://mcgroceraiblogscreator-production.up.railway.app";

// Supabase Edge Function proxy URL for Decodo API (avoids CORS issues)
const DECODO_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/decodo-proxy`;

/**
 * Helper to call Decodo API via Supabase Edge Function proxy
 * This avoids CORS issues when calling from the browser
 */
async function callDecodoProxy(body: Record<string, unknown>): Promise<Response> {
  return fetch(DECODO_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Perform keyword research using Decodo Google Trends Scraper
 */
export async function researchKeywords(
  topic: string
): Promise<ServiceResponse<KeywordResearchResponse>> {
  try {
    // Use Decodo Advanced plan to get Google Suggest keyword data via proxy
    const response = await callDecodoProxy({
      target: 'google_suggest',
      query: topic,
      parse: false
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Decodo API error:', errorData);

      // Fallback to topic if API fails
      return {
        data: {
          keywords: [{ keyword: topic, volume: 0, difficulty: 0 }],
          related_topics: []
        },
        error: null,
        success: true,
      };
    }

    const data = await response.json();

    // Parse Decodo response to extract keywords
    const keywords: Array<{ keyword: string; volume?: number; difficulty?: number }> = [];
    console.log('researched keywords',keywords)

    // Extract suggestions from the response
    if (data.results && data.results.length > 0) {
      const contentStr = data.results[0].content;

      // Parse the stringified JSON array
      // Structure: [query, [suggestions], [], [], {metadata with relevance scores}]
      const contentArray = JSON.parse(contentStr);

      // The second element contains the keyword suggestions
      const suggestions = contentArray[1] || [];

      // The fifth element contains metadata including relevance scores
      const metadata = contentArray[4] || {};
      const relevanceScores = metadata['google:suggestrelevance'] || [];

      suggestions.slice(0, 10).forEach((suggestion: string, index: number) => {
        if (suggestion && suggestion.trim()) {
          const relevance = relevanceScores[index] || 0;

          // Convert relevance (0-1000) to difficulty (0-100)
          // Higher relevance = lower difficulty (more popular/easier to rank for trending terms)
          const difficulty = relevance > 0 ? Math.max(0, 100 - (relevance / 10)) : 50;

          keywords.push({
            keyword: suggestion,
            volume: relevance, // Use relevance score as proxy for volume
            difficulty: Math.round(difficulty)
          });
        }
      });
    }

    // If no keywords found, use the topic as fallback
    if (keywords.length === 0) {
      keywords.push({
        keyword: topic,
        volume: 0,
        difficulty: 0
      });
    }

    return {
      data: {
        keywords,
        related_topics: []
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error researching keywords with Decodo:', error);

    // Fallback to topic if any error occurs
    return {
      data: {
        keywords: [{ keyword: topic, volume: 0, difficulty: 0 }],
        related_topics: []
      },
      error: null,
      success: true,
    };
  }
}

/**
 * Generate SEO meta data (title and description) using Gemini
 * When content is provided, generates meta data based on the actual blog content
 * Otherwise falls back to topic-based generation
 */
export async function generateMetaData(
  topic: string,
  keywords: string[],
  content?: string
): Promise<ServiceResponse<MetaDataResponse>> {
  try {
    const primaryKeyword = keywords[0] || topic;

    // If keyword is very long (likely a title), extract core terms for the description
    const keywordForDescription = primaryKeyword.length > 30
      ? `the key terms from "${primaryKeyword}" (e.g., the main 2-3 word phrase)`
      : `"${primaryKeyword}"`;

    // Build prompt based on whether content is available
    let prompt: string;

    if (content && content.length > 100) {
      // Extract first ~2000 chars of content for context (keeps prompt size reasonable)
      const contentPreview = content.substring(0, 2000);

      prompt = `Generate SEO-optimized meta title and meta description for this blog post.

Topic: ${topic}
Primary Keyword/Phrase: ${primaryKeyword}

Blog Content Preview:
${contentPreview}${content.length > 2000 ? '...' : ''}

Requirements:
- Meta Title: 50-60 characters, include the primary keyword naturally, compelling and click-worthy, accurately reflect the content
- Meta Description: 140-160 characters, MUST include ${keywordForDescription} naturally, summarize the main value/takeaway from the content, include a call to action

IMPORTANT: The meta description MUST contain the primary keyword phrase (or its core terms if the keyword is long). This is critical for SEO scoring.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"title": "Your meta title here", "description": "Your meta description here"}`;
    } else {
      prompt = `Generate SEO-optimized meta title and meta description for a blog post.

Topic: ${topic}
Primary Keyword/Phrase: ${primaryKeyword}

Requirements:
- Meta Title: 50-60 characters, include the primary keyword naturally, compelling and click-worthy
- Meta Description: 140-160 characters, MUST include ${keywordForDescription} naturally, summarize the value proposition, include a call to action

IMPORTANT: The meta description MUST contain the primary keyword phrase (or its core terms if the keyword is long). This is critical for SEO scoring.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"title": "Your meta title here", "description": "Your meta description here"}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from Gemini');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      data: {
        title: data.title || '',
        description: data.description || '',
        keywords: keywords
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error generating meta data:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Generate blog content using AI with automatic internal linking
 */
export async function generateBlogContent(
  request: GenerateBlogRequest
): Promise<ServiceResponse<GenerateBlogResponse>> {
  try {
    // Generate the main blog content
    const res = await fetch(`${API_URL}/advanced-blog/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: request.topic,
        meta_description: "Generated content",
        persona: JSON.stringify({ id: request.persona_id }),
        template: JSON.stringify({ id: request.template_id }),
        keywords: request.keywords,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to generate blog content");
    }

    const data = await res.json();
    let finalContent = data.content;

    // Fetch related blog links from Shopify for internal linking
    console.log(`[AI Service] Fetching related blog links for topic: "${request.topic}"`);
    const linksResult = await generateRelatedBlogLinks(request.topic, 5);

    if (linksResult.success && linksResult.data && linksResult.data.length > 0) {
      console.log(`[AI Service] Found ${linksResult.data.length} related articles to embed`);

      // Append "Related Articles" section with internal links
      const relatedSection = `

## Related Articles

For more information about ${request.topic}, check out these articles:

${linksResult.data.map(link => `- ${link.markdown}`).join('\n')}
      `.trim();

      finalContent += '\n\n' + relatedSection;
      console.log(`[AI Service] ✓ Related articles section added to blog content`);
    } else {
      console.log(`[AI Service] No related articles found for "${request.topic}"`);
    }

    return {
      data: {
        content: finalContent,
        markdown: finalContent,
        meta: {
          title: "",
          description: "",
          keywords: request.keywords
        }
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error generating blog content:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Format blog content with images and product links
 */
export async function formatBlogContent(
  content: string,
  _images: Array<{ url: string; alt: string; position: number }>,
  _productLinks: Array<{ handle: string; title: string; url: string; position: number }>
): Promise<ServiceResponse<{ formatted_content: string }>> {
  try {
    // Convert content to array format if needed, or pass as is.
    // The reference API expects an array of blocks.
    // We might need a parser here.
    // For now, let's assume we can pass a simplified structure or the backend handles it.

    // Reference implementation converts HTML to array.
    // We'll need to implement that conversion or skip formatting for now if too complex.
    // Let's return the content as is for now to avoid breaking, or try to call the API.

    return {
      data: { formatted_content: content },
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error formatting blog content:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get top-ranking articles for a keyword
 */
export async function getTopRankingArticles(
  keyword: string,
  limit: number = 10
): Promise<ServiceResponse<Array<{
  position: number;
  title: string;
  url: string;
  description: string;
}>>> {
  try {
    // Append "article" to focus on editorial content rather than product pages
    // This improves competitive intelligence by showing actual blog articles/reviews
    const articleQuery = `${keyword} article`;

    // Use proxy to avoid CORS issues
    const response = await callDecodoProxy({
      target: 'google_search',
      query: articleQuery,
      parse: true,
      limit,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Decodo API error:', errorData);
      return {
        data: [],
        error: null,
        success: true,
      };
    }

    const data = await response.json();

    const articles: Array<{
      position: number;
      title: string;
      url: string;
      description: string;
    }> = [];

    if (data.results && data.results.length > 0 && data.results[0].content?.results?.results?.organic) {
      const organicResults = data.results[0].content.results.results.organic;

      organicResults.forEach((result: any) => {
        articles.push({
          position: result.pos,
          title: result.title || '',
          url: result.url || '',
          description: result.desc || ''
        });
      });
    }

    return {
      data: articles,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error fetching top-ranking articles:', error);
    return {
      data: [],
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Extract clean article content from raw HTML using Gemini LLM
 * This provides much better content extraction than regex-based parsing
 */
async function extractArticleWithLLM(
  html: string,
  url: string
): Promise<{
  title: string;
  text: string;
  headings: string[];
  summary: string;
}> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }

  // Pre-clean HTML to reduce token usage (remove scripts, styles, SVGs)
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .substring(0, 100000); // Limit to ~100KB to stay within token limits

  const prompt = `Extract the main article content from this HTML page. Ignore navigation, headers, footers, sidebars, ads, and comments.

URL: ${url}

HTML:
${cleanedHtml}

Return ONLY valid JSON (no markdown code blocks) in this exact format:
{
  "title": "The article title",
  "text": "The full article body text, preserving paragraphs with double newlines. Include all important content but exclude author bios, related articles, and promotional content.",
  "headings": ["Array of section headings from the article"],
  "summary": "A 2-3 sentence summary of what this article is about"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response - try multiple strategies
  let extracted: { title?: string; text?: string; headings?: string[]; summary?: string } | null = null;

  // Strategy 1: Find JSON object in response
  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let jsonStr = jsonMatch[0];

    // Strategy 1a: Direct parse
    try {
      extracted = JSON.parse(jsonStr);
    } catch {
      // Strategy 1b: Fix invalid escape sequences
      jsonStr = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (char: string) => {
        if (char === '\n' || char === '\r' || char === '\t') {
          return char === '\n' ? '\\n' : char === '\r' ? '\\r' : '\\t';
        }
        return '';
      });

      try {
        extracted = JSON.parse(jsonStr);
      } catch {
        // Strategy 1c: Aggressive cleanup - escape all newlines in string values
        console.warn('[LLM Extract] JSON parse failed, attempting aggressive cleanup');
        jsonStr = jsonStr
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');

        try {
          extracted = JSON.parse(jsonStr);
        } catch (finalError) {
          // Log the problematic JSON for debugging (first 500 chars)
          console.error('[LLM Extract] All JSON parse strategies failed');
          console.error('[LLM Extract] Raw response (first 500 chars):', resultText.substring(0, 500));
        }
      }
    }
  }

  // Strategy 2: If JSON parsing failed, try to extract content manually
  if (!extracted) {
    console.warn('[LLM Extract] Falling back to regex extraction');

    // Try to extract title from response
    const titleMatch = resultText.match(/"title"\s*:\s*"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';

    // Try to extract text - look for text field or just use the response
    const textMatch = resultText.match(/"text"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
    let text = '';
    if (textMatch) {
      text = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      // If we can't find JSON text field, use the raw response as a fallback
      // Strip any JSON-like structures
      text = resultText
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*\}/g, '')
        .trim();
    }

    extracted = {
      title,
      text,
      headings: [],
      summary: '',
    };
  }

  return {
    title: extracted.title || '',
    text: extracted.text || '',
    headings: extracted.headings || [],
    summary: extracted.summary || '',
  };
}

/**
 * Scrape a single article using Decodo Web Scraping API + LLM extraction
 * Pipeline: Cache check → Decodo (anti-bot bypass) → Gemini (content extraction) → Cache store
 */
async function scrapeWithDecodo(url: string): Promise<{
  url: string;
  title: string;
  text: string;
  wordCount: number;
  headings: string[];
  success: boolean;
  cached?: boolean;
  error?: string;
}> {
  try {
    // Step 0: Check cache first
    const cached = await checkCache(url);
    if (cached && cached.text && cached.word_count > 100) {
      return {
        url,
        title: cached.title || '',
        text: cached.text,
        wordCount: cached.word_count,
        headings: cached.headings || [],
        success: true,
        cached: true,
      };
    }

    console.log(`[Decodo] Scraping: ${url}`);
    const scrapeStart = Date.now();

    // Step 1: Fetch raw HTML with Decodo via proxy (handles anti-bot + CORS)
    const response = await callDecodoProxy({
      url: url,
      headless: 'html',
      device_type: 'desktop',
    });

    if (!response.ok) {
      throw new Error(`Decodo API error: ${response.status}`);
    }

    // Proxy returns JSON with {html, success} for scrape requests
    const proxyResponse = await response.json();
    const html = proxyResponse.html || '';
    const scrapeDurationMs = Date.now() - scrapeStart;
    console.log(`[Decodo] ✓ Fetched ${(html.length / 1024).toFixed(1)}KB HTML in ${scrapeDurationMs}ms`);

    // Check if HTML is too small to be useful (likely blocked or error page)
    if (html.length < 1000) {
      throw new Error(`HTML too small (${html.length} bytes) - page may be blocked or unavailable`);
    }

    // Step 2: Extract clean content with LLM
    console.log(`[Decodo] Extracting content with LLM...`);
    const extractStart = Date.now();
    const extracted = await extractArticleWithLLM(html, url);
    const extractDurationMs = Date.now() - extractStart;

    const wordCount = extracted.text.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`[Decodo] ✓ ${url} - ${wordCount} words extracted in ${extractDurationMs}ms`);

    // Step 3: Store in cache (async, don't await)
    storeInCache(url, {
      title: extracted.title,
      text: extracted.text,
      headings: extracted.headings,
      summary: extracted.summary,
      wordCount,
      htmlSize: html.length,
      scrapeDurationMs,
      extractDurationMs,
    }).catch(err => console.warn('[Cache] Background store failed:', err));

    return {
      url,
      title: extracted.title,
      text: extracted.text,
      wordCount,
      headings: extracted.headings.slice(0, 20),
      success: true,
      cached: false,
    };
  } catch (error) {
    console.error(`[Decodo] ✗ ${url} - ${error}`);
    return {
      url,
      title: '',
      text: '',
      wordCount: 0,
      headings: [],
      success: false,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Scrape multiple articles concurrently (batch processing)
 * Primary: Decodo + LLM extraction (handles anti-bot, clean content)
 * Fallback: Stagehand on RunPod (faster for simple sites)
 */
export async function scrapeArticlesBatch(
  urls: string[]
): Promise<ServiceResponse<Array<{
  url: string;
  title: string;
  text: string;
  wordCount: number;
  headings: string[];
  success: boolean;
}>>> {
  try {
    // Clean up expired cache entries (fire and forget)
    cleanupExpiredCache().catch(() => {});

    if (urls.length === 0) {
      return {
        success: true,
        data: [],
        error: null,
      };
    }

    console.log(`[Scraper] Starting batch scrape of ${urls.length} articles...`);

    // Primary: Use Decodo + LLM extraction (better content quality)
    console.log(`[Scraper] Using Decodo + LLM pipeline...`);

    const decodoResults = await Promise.all(
      urls.map(url => scrapeWithDecodo(url))
    );

    // Check which URLs failed with Decodo
    const successfulUrls = new Set(
      decodoResults.filter(r => r.success && r.wordCount > 100).map(r => r.url)
    );
    const failedUrls = urls.filter(url => !successfulUrls.has(url));

    let results = [...decodoResults];

    // Fallback: Try Stagehand for failed URLs (if configured)
    if (failedUrls.length > 0) {
      const RUNPOD_API_URL = import.meta.env.VITE_RUNPOD_API_URL;
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

      if (RUNPOD_API_URL && GEMINI_API_KEY) {
        console.log(`[Scraper] Using Stagehand fallback for ${failedUrls.length} URLs...`);

        try {
          const response = await fetch(`${RUNPOD_API_URL}/scrape-articles-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              urls: failedUrls,
              api_key: GEMINI_API_KEY,
              timeout: 60000,
            }),
            signal: AbortSignal.timeout(180000),
          });

          if (response.ok) {
            const data = await response.json();
            const stagehandResults = data.results || [];
            console.log(`[Scraper] Stagehand: ${data.successful}/${data.total} successful`);

            // Merge Stagehand results for failed URLs
            const resultMap = new Map(results.map(r => [r.url, r]));
            stagehandResults.forEach((result: any) => {
              if (result.success && result.wordCount > 100) {
                resultMap.set(result.url, result);
              }
            });

            results = urls.map(url => resultMap.get(url) || {
              url,
              title: '',
              text: '',
              wordCount: 0,
              headings: [],
              success: false,
            });
          }
        } catch (stagehandError) {
          console.warn(`[Scraper] Stagehand fallback failed:`, stagehandError);
        }
      }
    }

    // Log final results
    const successCount = results.filter(r => r.success).length;
    console.log(`[Scraper] Completed: ${successCount}/${urls.length} successful`);

    results.forEach((result) => {
      if (result.success) {
        console.log(`[Scraper] ✓ ${result.url} - ${result.wordCount} words`);
      } else {
        console.log(`[Scraper] ✗ ${result.url}`);
      }
    });

    return {
      success: true,
      data: results,
      error: null,
    };
  } catch (error) {
    console.error('[Scraper] Error:', error);
    return {
      success: false,
      data: [],
      error: error as Error,
    };
  }
}

/**
 * Calculate SEO score for content
 * Simple client-side calculation based on best practices
 */
export function calculateSeoScore(
  content: string,
  metaTitle: string,
  metaDescription: string,
  primaryKeyword: string
): number {
  let score = 0;
  const maxScore = 100;

  // Meta title optimization (20 points)
  if (metaTitle.length >= 50 && metaTitle.length <= 60) {
    score += 10;
  }
  if (metaTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    score += 10;
  }

  // Meta description optimization (20 points)
  if (metaDescription.length >= 140 && metaDescription.length <= 160) {
    score += 10;
  }
  if (metaDescription.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    score += 10;
  }

  // Content length (20 points)
  const wordCount = content.split(/\s+/).length;
  if (wordCount >= 1500) {
    score += 20;
  } else if (wordCount >= 1000) {
    score += 15;
  } else if (wordCount >= 500) {
    score += 10;
  }

  // Keyword density (20 points)
  const keywordCount = (content.match(new RegExp(primaryKeyword, 'gi')) || []).length;
  const density = (keywordCount / wordCount) * 100;
  if (density >= 1 && density <= 2) {
    score += 20;
  } else if (density >= 0.5 && density < 3) {
    score += 10;
  }

  // Heading structure (10 points)
  const hasH1 = /<h1[^>]*>/.test(content);
  const hasH2 = /<h2[^>]*>/.test(content);
  if (hasH1 && hasH2) {
    score += 10;
  } else if (hasH1 || hasH2) {
    score += 5;
  }

  // Internal links (10 points)
  // Count both HTML and markdown links
  const htmlLinkCount = (content.match(/<a[^>]*href/gi) || []).length;
  const markdownLinkCount = (content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
  const linkCount = htmlLinkCount + markdownLinkCount;

  if (linkCount >= 5) {
    score += 10;
  } else if (linkCount >= 3) {
    score += 8;
  } else if (linkCount >= 1) {
    score += 5;
  }

  return Math.min(score, maxScore);
}

/**
 * Calculate readability score (Flesch Reading Ease approximation)
 */
export function calculateReadabilityScore(content: string): number {
  // Strip HTML tags
  const text = content.replace(/<[^>]+>/g, ' ').trim();

  // Count sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Count words
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length || 1;

  // Count syllables (approximation)
  let syllableCount = 0;
  words.forEach((word) => {
    // Simple syllable counting heuristic
    const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
    const vowels = cleaned.match(/[aeiouy]+/g);
    syllableCount += vowels ? vowels.length : 1;
  });

  // Flesch Reading Ease formula (simplified)
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / wordCount;

  const score =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Normalize to 0-100 where 100 is easiest to read
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Helper function to check keyword presence with smart matching for long keywords
 * For short keywords (<=30 chars): exact substring match
 * For long keywords (>30 chars): check if significant words are present
 */
function checkKeywordPresence(
  text: string,
  keyword: string
): { found: boolean; matchType: 'exact' | 'partial' | 'none'; matchedTerms?: string[] } {
  const textLower = text.toLowerCase();
  const keywordLower = keyword.toLowerCase();

  // Short keyword - require exact match
  if (keyword.length <= 30) {
    const found = textLower.includes(keywordLower);
    return { found, matchType: found ? 'exact' : 'none' };
  }

  // Long keyword - first try exact match
  if (textLower.includes(keywordLower)) {
    return { found: true, matchType: 'exact' };
  }

  // Long keyword - check for significant words (3+ chars, not stop words)
  const stopWords = new Set(['the', 'and', 'for', 'your', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']);
  const keywordWords = keywordLower
    .split(/[\s:,\-|]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  const matchedTerms: string[] = [];
  for (const word of keywordWords) {
    if (textLower.includes(word)) {
      matchedTerms.push(word);
    }
  }

  // Consider it a match if at least 50% of significant words are found (min 2)
  const threshold = Math.max(2, Math.floor(keywordWords.length * 0.5));
  const found = matchedTerms.length >= threshold;

  return {
    found,
    matchType: found ? 'partial' : 'none',
    matchedTerms: found ? matchedTerms : undefined
  };
}

/**
 * Calculate SEO score for meta title with criteria breakdown
 */
export function calculateMetaTitleScore(
  metaTitle: string,
  primaryKeyword: string
): SeoScoreBreakdown {
  const criteria: SeoScoreCriterion[] = [];

  // Length check (10 points) - optimal 50-60 chars
  const lengthOptimal = metaTitle.length >= 50 && metaTitle.length <= 60;
  criteria.push({
    name: 'length',
    passed: lengthOptimal,
    points: lengthOptimal ? 10 : 0,
    maxPoints: 10,
    message: lengthOptimal
      ? 'Optimal length (50-60 chars)'
      : `Length: ${metaTitle.length} chars (aim for 50-60)`,
  });

  // Keyword inclusion (10 points) - with smart matching for long keywords
  const trimmedKeyword = primaryKeyword.trim();
  if (trimmedKeyword.length === 0) {
    criteria.push({
      name: 'keyword',
      passed: false,
      points: 0,
      maxPoints: 10,
      message: 'No primary keyword set',
    });
  } else {
    const keywordCheck = checkKeywordPresence(metaTitle, trimmedKeyword);
    const displayKeyword = trimmedKeyword.length > 40
      ? trimmedKeyword.substring(0, 40) + '...'
      : trimmedKeyword;

    let message: string;
    if (keywordCheck.found) {
      if (keywordCheck.matchType === 'exact') {
        message = `Primary keyword "${displayKeyword}" included`;
      } else {
        message = `Key terms found: ${keywordCheck.matchedTerms?.join(', ')}`;
      }
    } else {
      message = `Missing keyword: "${displayKeyword}"`;
    }

    criteria.push({
      name: 'keyword',
      passed: keywordCheck.found,
      points: keywordCheck.found ? 10 : 0,
      maxPoints: 10,
      message,
    });
  }

  return {
    score: criteria.reduce((sum, c) => sum + c.points, 0),
    maxScore: 20,
    criteria,
  };
}

/**
 * Calculate SEO score for meta description with criteria breakdown
 */
export function calculateMetaDescriptionScore(
  metaDescription: string,
  primaryKeyword: string
): SeoScoreBreakdown {
  const criteria: SeoScoreCriterion[] = [];

  // Length check (10 points) - optimal 140-160 chars
  const lengthOptimal =
    metaDescription.length >= 140 && metaDescription.length <= 160;
  criteria.push({
    name: 'length',
    passed: lengthOptimal,
    points: lengthOptimal ? 10 : 0,
    maxPoints: 10,
    message: lengthOptimal
      ? 'Optimal length (140-160 chars)'
      : `Length: ${metaDescription.length} chars (aim for 140-160)`,
  });

  // Keyword inclusion (10 points) - with smart matching for long keywords
  const trimmedKeyword = primaryKeyword.trim();
  if (trimmedKeyword.length === 0) {
    criteria.push({
      name: 'keyword',
      passed: false,
      points: 0,
      maxPoints: 10,
      message: 'No primary keyword set',
    });
  } else {
    const keywordCheck = checkKeywordPresence(metaDescription, trimmedKeyword);
    const displayKeyword = trimmedKeyword.length > 40
      ? trimmedKeyword.substring(0, 40) + '...'
      : trimmedKeyword;

    let message: string;
    if (keywordCheck.found) {
      if (keywordCheck.matchType === 'exact') {
        message = `Primary keyword "${displayKeyword}" included`;
      } else {
        message = `Key terms found: ${keywordCheck.matchedTerms?.join(', ')}`;
      }
    } else {
      message = `Missing keyword: "${displayKeyword}"`;
    }

    criteria.push({
      name: 'keyword',
      passed: keywordCheck.found,
      points: keywordCheck.found ? 10 : 0,
      maxPoints: 10,
      message,
    });
  }

  return {
    score: criteria.reduce((sum, c) => sum + c.points, 0),
    maxScore: 20,
    criteria,
  };
}
