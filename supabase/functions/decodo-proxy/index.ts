import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DECODO_USERNAME = Deno.env.get('DECODO_USERNAME') || "U0000325993";
const DECODO_PASSWORD = Deno.env.get('DECODO_PASSWORD') || "PW_1204851d9672b739805dbbe7da71cc1f5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Retry helper with exponential backoff for 502/503 errors
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 502/503 gateway errors (upstream issues)
      if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Decodo Proxy] Got ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Decodo Proxy] Fetch error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { url, target, query, headless, device_type, parse, google_tbs, proxy_image } = await req.json();

    // Image proxy mode - fetch image and return as base64
    if (proxy_image && url) {
      console.log(`[Decodo Proxy] Proxying image: ${url}`);
      try {
        const imageResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*',
            'Referer': new URL(url).origin,
          },
        });

        if (!imageResponse.ok) {
          console.error(`[Decodo Proxy] Image fetch failed: ${imageResponse.status}`);
          return new Response(
            JSON.stringify({ error: `Image fetch failed: ${imageResponse.status}` }),
            { status: imageResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/')) {
          return new Response(
            JSON.stringify({ error: `Not an image: ${contentType}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const arrayBuffer = await imageResponse.arrayBuffer();

        // Convert to base64 in chunks to avoid call stack overflow for large images
        const uint8Array = new Uint8Array(arrayBuffer);
        const CHUNK_SIZE = 32768; // 32KB chunks
        let binary = '';
        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
          const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);

        console.log(`[Decodo Proxy] Image proxied: ${Math.round(arrayBuffer.byteLength / 1024)}KB`);

        return new Response(
          JSON.stringify({
            success: true,
            mimeType: contentType.split(';')[0].trim(),
            data: base64,
            size: arrayBuffer.byteLength,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (imgError) {
        console.error(`[Decodo Proxy] Image proxy error:`, imgError);
        return new Response(
          JSON.stringify({ error: imgError instanceof Error ? imgError.message : 'Image proxy failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const basicAuth = btoa(`${DECODO_USERNAME}:${DECODO_PASSWORD}`);

    // Build request body based on type
    let body: Record<string, unknown>;

    if (target === 'google_search') {
      // Google Search SERP API request
      // See: https://help.decodo.com/docs/web-scraping-api-google
      body = {
        target: 'google_search',
        query,
        google_domain: 'google.co.uk',
        gl: 'uk',           // Geo location (country code)
        hl: 'en',           // Host language
        parse: parse ?? true,
        // Date filter: qdr:h (hour), qdr:d (day), qdr:w (week), qdr:m (month), qdr:y (year)
        ...(google_tbs && { google_tbs }),
      };
    } else if (target === 'google_suggest') {
      // Google Suggest (keyword research)
      body = {
        target: 'google_suggest',
        query,
        parse: parse ?? false,
      };
    } else {
      // Default: Web scrape request
      body = {
        url,
        headless: headless || 'html',
        device_type: device_type || 'desktop',
      };
    }

    console.log(`[Decodo Proxy] Request: ${target || 'scrape'} - ${query || url}`);

    // Match the working test script exactly: always include Accept: application/json
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${basicAuth}`,
      'Accept': 'application/json',
    };

    console.log(`[Decodo Proxy] Making request with body:`, JSON.stringify(body));

    const response = await fetchWithRetry('https://scraper-api.decodo.com/v2/scrape', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Decodo Proxy] Error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `Decodo API error: ${response.status}`,
          details: errorText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // For web scraping (no target), parse JSON and extract HTML from results[0].content
    // For SERP/suggest requests, return the JSON directly
    if (!target) {
      // Web scrape: Decodo returns JSON like {"results":[{"content":"<html>..."}]}
      const data = await response.json();
      console.log(`[Decodo Proxy] Scrape response received`);

      // Extract HTML from the nested structure
      let html = '';
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        html = data.results[0].content || '';
        console.log(`[Decodo Proxy] Extracted HTML from results[0].content: ${html.length} bytes`);
      } else if (typeof data === 'string') {
        // Fallback: if data is already a string, use it directly
        html = data;
        console.log(`[Decodo Proxy] Using response as raw HTML: ${html.length} bytes`);
      } else {
        console.warn(`[Decodo Proxy] Unexpected response structure:`, Object.keys(data));
        html = JSON.stringify(data);
      }

      return new Response(
        JSON.stringify({ html, success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // SERP/suggest: parse as JSON
      const data = await response.json();
      return new Response(
        JSON.stringify(data),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('[Decodo Proxy] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
