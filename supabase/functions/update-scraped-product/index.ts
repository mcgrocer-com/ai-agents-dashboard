import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fields that are allowed to be updated
const ALLOWED_UPDATE_FIELDS = [
  'name',
  'price',
  'original_price',
  'description',
  'stock_status',
  'main_image',
  'images',
  'weight',
  'height',
  'width',
  'length',
  'category',
  'breadcrumbs',
  'variants',
  'variant_count',
  'ean_code',
  'product_id',
  'timestamp'
] as const;

const BATCH_SIZE = 10;

interface ProductUpdate {
  url: string;
  [key: string]: any;
}

interface ItemResult {
  url: string;
  success: boolean;
  error?: string;
  fields_updated?: string[];
}

interface BatchResponse {
  success: boolean;
  total: number;
  updated: number;
  failed: number;
  results: ItemResult[];
}

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function processBatch(
  supabaseClient: any,
  batch: ProductUpdate[]
): Promise<ItemResult[]> {
  const results: ItemResult[] = [];

  for (const item of batch) {
    const { url, ...fields } = item;

    // Filter to allowed fields only
    const filteredUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (ALLOWED_UPDATE_FIELDS.includes(key as any)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      results.push({
        url,
        success: false,
        error: 'No valid fields to update',
      });
      continue;
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseClient
      .from('scraped_products')
      .update({
        ...filteredUpdates,
        updated_at: now,
        scraper_updated_at: now,
      })
      .eq('url', url.trim());

    if (updateError) {
      console.error(`[UPDATE_SCRAPED_PRODUCT] Error updating ${url}:`, updateError);
      results.push({
        url,
        success: false,
        error: updateError.message,
      });
    } else {
      // Reset erpnext_updated_at on the corresponding pending_product so it re-syncs
      const { error: resetError } = await supabaseClient
        .from('pending_products')
        .update({
          erpnext_updated_at: null,
          sync_started_at: null,
          failed_sync_error_message: null,
          failed_sync_at: null,
          sync_full_product: true,
        })
        .eq('url', url.trim());

      if (resetError) {
        console.warn(`[UPDATE_SCRAPED_PRODUCT] Updated scraped_product but failed to reset sync for ${url}:`, resetError);
      } else {
        console.log(`[UPDATE_SCRAPED_PRODUCT] Reset ERPNext sync for ${url} - will re-sync on next run`);
      }

      results.push({
        url,
        success: true,
        fields_updated: Object.keys(filteredUpdates),
      });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const items: ProductUpdate[] = await req.json();

    // Validate input is an array
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse(
        { success: false, error: 'Request body must be a non-empty array of products' },
        400
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
        {
          success: false,
          error: `Every item must have a non-empty "url" field. Missing at indices: ${missingUrlIndices.join(', ')}`,
        },
        400
      );
    }

    console.log(`[UPDATE_SCRAPED_PRODUCT] Processing ${items.length} products in batches of ${BATCH_SIZE}`);

    // Process in batches
    const allResults: ItemResult[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      console.log(`[UPDATE_SCRAPED_PRODUCT] Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);

      const batchResults = await processBatch(supabaseClient, batch);
      allResults.push(...batchResults);
    }

    const updated = allResults.filter((r) => r.success).length;
    const failed = allResults.filter((r) => !r.success).length;

    console.log(`[UPDATE_SCRAPED_PRODUCT] Done. Updated: ${updated}, Failed: ${failed}`);

    const response: BatchResponse = {
      success: failed === 0,
      total: items.length,
      updated,
      failed,
      results: allResults,
    };

    return jsonResponse(response, failed === items.length ? 500 : 200);
  } catch (error) {
    console.error('[UPDATE_SCRAPED_PRODUCT] Unexpected error:', error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' },
      500
    );
  }
});
