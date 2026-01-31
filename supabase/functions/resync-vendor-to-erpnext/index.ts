/**
 * Resync Vendor Products to ERPNext
 *
 * Resets erpnext_updated_at to NULL for all products from a specific vendor,
 * forcing them to be re-synced to ERPNext in the next sync cycle.
 *
 * POST /resync-vendor-to-erpnext
 * Body: { vendor: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface RequestBody {
  vendor?: string;
}

interface ResyncStats {
  total_products: number;
  successfully_reset: number;
  failed: number;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RequestBody = await req.json();
    const vendor = body.vendor?.trim();

    console.log('🔄 Resync to ERPNext request:', { vendor });

    if (!vendor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: vendor',
          usage: {
            endpoint: 'POST /resync-vendor-to-erpnext',
            body: { vendor: 'string (required)' }
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, get the count of products that will be affected
    const { count: totalCount, error: countError } = await supabase
      .from('pending_products')
      .select('*', { count: 'exact', head: true })
      .eq('vendor', vendor);

    if (countError) {
      console.error('❌ Error counting products:', countError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to count products',
          details: countError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!totalCount || totalCount === 0) {
      console.log('⚠️ No products found for vendor:', vendor);
      return new Response(
        JSON.stringify({
          success: true,
          message: `No products found for vendor: ${vendor}`,
          stats: {
            total_products: 0,
            successfully_reset: 0,
            failed: 0,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found ${totalCount} products for vendor: ${vendor}`);

    // Reset erpnext_updated_at, failed_sync_at, and failed_sync_error_message to NULL
    // This clears both successful sync status and failed sync status, allowing products to be re-synced
    const { data, error: updateError } = await supabase
      .from('pending_products')
      .update({
        erpnext_updated_at: null,
        failed_sync_at: null,
        failed_sync_error_message: null
      })
      .eq('vendor', vendor)
      .select('id');

    if (updateError) {
      console.error('❌ Error resetting sync status:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to reset sync status',
          details: updateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats: ResyncStats = {
      total_products: totalCount,
      successfully_reset: data?.length || 0,
      failed: totalCount - (data?.length || 0),
    };

    console.log('🎉 Resync complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully reset ${stats.successfully_reset} products for vendor: ${vendor}. They will be re-synced to ERPNext in the next sync cycle.`,
        stats,
        details: {
          vendor,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
