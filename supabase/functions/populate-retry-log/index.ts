/**
 * One-time Edge Function to Populate Retry Log
 *
 * Finds products that failed classification before the retry system was deployed
 * and creates log entries so they can be picked up by the retry cron job.
 *
 * Usage: POST to edge function endpoint (one-time use)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for filters
    const body = await req.json().catch(() => ({}));
    const vendor = body.vendor; // Optional vendor filter
    const limit = body.limit || 100; // Default limit to prevent timeout
    const offset = body.offset || 0; // For pagination

    console.log('🔍 Finding products with failed classifications...', { vendor, limit, offset });

    // Step 1: Find products with classification = NULL and status = 'pending'
    let query = supabase
      .from('scraped_products')
      .select('id, name, vendor, url')
      .eq('status', 'pending')
      .is('classification', null);

    // Apply vendor filter if provided
    if (vendor) {
      query = query.eq('vendor', vendor);
    }

    const { data: failedProducts, error: queryError } = await query
      .range(offset, offset + limit - 1)
      .limit(limit);

    if (queryError) {
      console.error('❌ Error querying scraped_products:', queryError);
      throw queryError;
    }

    console.log(`📦 Found ${failedProducts?.length || 0} products with NULL classification`);

    if (!failedProducts || failedProducts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No failed products found',
          total_found: 0,
          log_entries_created: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Filter out products already in pending_products
    const productIds = failedProducts.map(p => p.id);
    const { data: pendingProducts, error: pendingError } = await supabase
      .from('pending_products')
      .select('scraped_product_id')
      .in('scraped_product_id', productIds);

    if (pendingError) {
      console.error('❌ Error querying pending_products:', pendingError);
      throw pendingError;
    }

    const pendingIds = new Set((pendingProducts || []).map((p: any) => p.scraped_product_id));
    const productsNeedingRetry = failedProducts.filter(p => !pendingIds.has(p.id));

    console.log(`🚫 Filtered out ${failedProducts.length - productsNeedingRetry.length} products already in pending_products`);
    console.log(`📊 ${productsNeedingRetry.length} products need retry log entries`);

    if (productsNeedingRetry.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All failed products are already in pending_products',
          total_found: failedProducts.length,
          already_in_pending: failedProducts.length,
          log_entries_created: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Check if any log entries already exist
    const { data: existingLogs, error: logError } = await supabase
      .from('classification_retry_log')
      .select('scraped_product_id')
      .in('scraped_product_id', productsNeedingRetry.map(p => p.id));

    if (logError) {
      console.error('❌ Error querying classification_retry_log:', logError);
      throw logError;
    }

    const existingLogIds = new Set((existingLogs || []).map((log: any) => log.scraped_product_id));
    const productsToLog = productsNeedingRetry.filter(p => !existingLogIds.has(p.id));

    console.log(`⏭️ Skipping ${existingLogIds.size} products that already have log entries`);

    if (productsToLog.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All products already have log entries',
          total_found: failedProducts.length,
          already_in_pending: pendingIds.size,
          already_have_logs: existingLogIds.size,
          log_entries_created: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📝 Creating ${productsToLog.length} retry log entries...`);

    // Step 4: Create log entries (retry immediately)
    const logEntries = productsToLog.map(product => ({
      scraped_product_id: product.id,
      retry_count: 0,
      status: 'retrying',
      last_error: 'Initial classification failed (before retry system deployment)',
      last_error_type: 'unknown',
      next_retry_at: new Date().toISOString(), // Retry immediately
      product_name: product.name,
      product_vendor: product.vendor,
    }));

    const { data: insertedLogs, error: insertError } = await supabase
      .from('classification_retry_log')
      .insert(logEntries);

    if (insertError) {
      console.error('❌ Error inserting log entries:', insertError);
      throw insertError;
    }

    console.log(`✅ Created ${logEntries.length} retry log entries`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully populated retry log with ${logEntries.length} entries`,
        total_found: failedProducts.length,
        already_in_pending: pendingIds.size,
        already_have_logs: existingLogIds.size,
        log_entries_created: logEntries.length,
        next_steps: 'The retry cron job will pick up these products in the next run (≤15 minutes)',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    console.error('Error type:', typeof err);
    console.error('Error JSON:', JSON.stringify(err, null, 2));

    let errorDetails = 'Unknown error';
    if (err instanceof Error) {
      errorDetails = err.message;
    } else if (typeof err === 'object' && err !== null) {
      errorDetails = JSON.stringify(err);
    } else {
      errorDetails = String(err);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: errorDetails,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
