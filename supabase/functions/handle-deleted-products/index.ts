import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 10;
const LOG_PREFIX = '[HANDLE_DELETED_PRODUCTS]';

interface DeletedProduct {
  url: string;
}

interface ItemResult {
  url: string;
  success: boolean;
  error?: string;
}

interface ResponseBody {
  success: boolean;
  total: number;
  blacklisted: number;
  failed: number;
  erpnext_disabled: boolean;
  erpnext_error?: string;
  results: ItemResult[];
}

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Blacklist a batch of products in the database.
 */
async function blacklistBatch(
  supabase: any,
  urls: string[],
): Promise<ItemResult[]> {
  const results: ItemResult[] = [];
  const now = new Date().toISOString();

  for (const url of urls) {
    const trimmedUrl = url.trim();

    const { error } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: true,
        blacklist_reason: 'Product deleted at source',
        blacklisted_at: now,
      })
      .eq('url', trimmedUrl);

    if (error) {
      console.error(`${LOG_PREFIX} Error blacklisting ${trimmedUrl}:`, error);
      results.push({ url: trimmedUrl, success: false, error: error.message });
    } else {
      results.push({ url: trimmedUrl, success: true });
    }
  }

  return results;
}

/**
 * Disable products in ERPNext by invoking the existing disable-products-in-erpnext edge function.
 */
async function disableInErpNext(
  supabase: any,
  urls: string[],
): Promise<{ success: boolean; error?: string }> {
  if (urls.length === 0) return { success: true };

  try {
    const { data, error } = await supabase.functions.invoke('disable-products-in-erpnext', {
      body: { urls, action: 'disable' },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && !data.success) {
      return { success: false, error: data.error || 'Unknown ERPNext error' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const items: DeletedProduct[] = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, error: 'Request body must be a non-empty array of objects with "url" field' },
        400,
      );
    }

    // Validate every item has a url
    const missingUrlIndices: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].url || typeof items[i].url !== 'string' || items[i].url.trim() === '') {
        missingUrlIndices.push(i);
      }
    }

    if (missingUrlIndices.length > 0) {
      return jsonResponse(
        { success: false, error: `Every item must have a non-empty "url" field. Missing at indices: ${missingUrlIndices.join(', ')}` },
        400,
      );
    }

    console.log(`${LOG_PREFIX} Processing ${items.length} deleted products`);

    // Step 1: Blacklist in database (in batches)
    const allResults: ItemResult[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchUrls = batch.map((item) => item.url);
      const batchResults = await blacklistBatch(supabase, batchUrls);
      allResults.push(...batchResults);
    }

    const blacklisted = allResults.filter((r) => r.success).length;
    const failed = allResults.filter((r) => !r.success).length;

    // Step 2: Disable in ERPNext (single call with all successfully blacklisted URLs)
    const blacklistedUrls = allResults
      .filter((r) => r.success)
      .map((r) => r.url);

    const erpResult = await disableInErpNext(supabase, blacklistedUrls);

    if (!erpResult.success) {
      console.warn(`${LOG_PREFIX} Blacklisted ${blacklisted} products but ERPNext disable failed: ${erpResult.error}`);
    } else {
      console.log(`${LOG_PREFIX} Done. Blacklisted: ${blacklisted}, ERPNext disabled: ${blacklistedUrls.length}, Failed: ${failed}`);
    }

    const response: ResponseBody = {
      success: failed === 0 && erpResult.success,
      total: items.length,
      blacklisted,
      failed,
      erpnext_disabled: erpResult.success,
      ...(erpResult.error && { erpnext_error: erpResult.error }),
      results: allResults,
    };

    return jsonResponse(response, failed === items.length ? 500 : 200);
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      500,
    );
  }
});
