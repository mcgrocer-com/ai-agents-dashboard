/**
 * Manual Push Scraped Products to Pending Products
 *
 * Supports two modes:
 * 1. Bulk processing by vendor (vendor parameter)
 * 2. Single product re-queueing (productId parameter with agent data preservation)
 *
 * Useful for:
 * - Initial data migration
 * - Reprocessing after webhook failures
 * - Batch processing by vendor
 * - Re-adding rejected products that were manually reclassified
 *
 * POST /manual-push-to-pending
 * Body: { vendor?: string } OR { productId: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BATCH_SIZE = 100;

interface RequestBody {
  vendor?: string;
  productId?: string; // For single product re-queueing
}

interface ScrapedProduct {
  id: string;
  vendor: string;
  url: string;
  product_id: string;
  breadcrumbs?: any;
}

interface PendingProduct {
  product_id: string;
  scraped_product_id: string;
  url: string;
  vendor: string;
  breadcrumbs?: any;
  category_status: string;
  weight_and_dimension_status: string;
  seo_status: string;
}

interface ProcessingStats {
  total_scraped: number;
  already_in_pending: number;
  successfully_inserted: number;
  failed: number;
  duplicate_errors: number;
}

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
    const productId = body.productId?.trim();

    console.log('📥 Manual push request:', { vendor, productId });

    // MODE 1: Single product re-queueing (preserves existing agent data if available)
    if (productId) {
      console.log(`🔍 Re-queueing single product: ${productId}`);

      // Fetch the scraped product with existing agent data
      const { data: scrapedProduct, error: fetchError } = await supabase
        .from('scraped_products')
        .select('id, vendor, url, product_id, breadcrumbs, category, ai_title, ai_description, weight, height, width, length, volumetric_weight')
        .eq('id', productId)
        .single();

      if (fetchError || !scrapedProduct) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Product not found: ${productId}`,
            details: fetchError?.message
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if product already exists in pending_products
      const { data: existingPending } = await supabase
        .from('pending_products')
        .select('id')
        .eq('scraped_product_id', productId)
        .maybeSingle();

      if (existingPending) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Product already in pending queue',
            product_id: productId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prepare pending product with existing agent data
      const pendingProduct = {
        product_id: scrapedProduct.product_id,
        scraped_product_id: scrapedProduct.id,
        url: scrapedProduct.url || '',
        vendor: scrapedProduct.vendor || '',
        breadcrumbs: scrapedProduct.breadcrumbs || null,
        // Preserve existing agent data if available
        category: scrapedProduct.category || null,
        category_status: scrapedProduct.category ? 'complete' : 'pending',
        ai_title: scrapedProduct.ai_title || null,
        ai_description: scrapedProduct.ai_description || null,
        seo_status: (scrapedProduct.ai_title && scrapedProduct.ai_description) ? 'complete' : 'pending',
        weight: scrapedProduct.weight || null,
        height: scrapedProduct.height || null,
        width: scrapedProduct.width || null,
        length: scrapedProduct.length || null,
        volumetric_weight: scrapedProduct.volumetric_weight || null,
        weight_and_dimension_status: (scrapedProduct.weight && scrapedProduct.height && scrapedProduct.width && scrapedProduct.length) ? 'complete' : 'pending',
      };

      // Insert into pending_products
      const { error: insertError } = await supabase
        .from('pending_products')
        .insert([pendingProduct]);

      if (insertError) {
        console.error('❌ Error inserting pending product:', insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to add product to pending queue',
            details: insertError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Successfully re-queued product: ${productId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product successfully added to pending queue with preserved agent data',
          product_id: productId,
          agent_data_preserved: {
            category: !!scrapedProduct.category,
            seo: !!(scrapedProduct.ai_title && scrapedProduct.ai_description),
            dimensions: !!(scrapedProduct.weight && scrapedProduct.height && scrapedProduct.width && scrapedProduct.length)
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE 2: Bulk vendor processing
    if (!vendor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: vendor or productId',
          usage: {
            endpoint: 'POST /manual-push-to-pending',
            body: { vendor: 'string (for bulk)' },
            or: { productId: 'string (for single product)' }
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ALL scraped products by vendor (paginated to avoid 1000 row limit)
    console.log(`🔍 Fetching all scraped products for vendor: ${vendor}`);
    const FETCH_BATCH_SIZE = 1000;
    const scrapedProducts: ScrapedProduct[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error: fetchError, count } = await supabase
        .from('scraped_products')
        .select('id, vendor, url, product_id, breadcrumbs', { count: 'exact' })
        .eq('vendor', vendor)
        .range(offset, offset + FETCH_BATCH_SIZE - 1);

      if (fetchError) {
        console.error('❌ Error fetching scraped products:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to fetch scraped products',
            details: fetchError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data && data.length > 0) {
        scrapedProducts.push(...data);
        console.log(`📥 Fetched ${data.length} products (offset: ${offset}, total so far: ${scrapedProducts.length})`);

        if (count && offset === 0) {
          console.log(`📊 Total products available: ${count}`);
        }

        offset += FETCH_BATCH_SIZE;
        hasMore = data.length === FETCH_BATCH_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (scrapedProducts.length === 0) {
      console.log('⚠️ No scraped products found for vendor:', vendor);
      return new Response(
        JSON.stringify({
          success: true,
          message: `No scraped products found for vendor: ${vendor}`,
          stats: {
            total_scraped: 0,
            already_in_pending: 0,
            successfully_inserted: 0,
            failed: 0,
            duplicate_errors: 0,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found ${scrapedProducts.length} scraped products in total`);

    // Fetch ALL existing scraped_product_ids from pending_products for this vendor
    console.log(`🔍 Fetching all existing pending_products IDs for vendor: ${vendor}`);
    const existingIds = new Set<string>();
    let pendingOffset = 0;
    let hasMorePending = true;

    while (hasMorePending) {
      const { data: existingPending, error: pendingError } = await supabase
        .from('pending_products')
        .select('scraped_product_id')
        .eq('vendor', vendor)
        .range(pendingOffset, pendingOffset + FETCH_BATCH_SIZE - 1);

      if (pendingError) {
        console.error('❌ Error fetching existing pending products:', pendingError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to fetch existing pending products',
            details: pendingError.message,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingPending && existingPending.length > 0) {
        existingPending.forEach((p: { scraped_product_id: string }) => existingIds.add(p.scraped_product_id));
        console.log(`📥 Fetched ${existingPending.length} existing IDs (offset: ${pendingOffset}, total so far: ${existingIds.size})`);

        pendingOffset += FETCH_BATCH_SIZE;
        hasMorePending = existingPending.length === FETCH_BATCH_SIZE;
      } else {
        hasMorePending = false;
      }
    }

    console.log(`✅ Found ${existingIds.size} products already in pending_products`);

    // Filter out products that already exist
    const productsToInsert = scrapedProducts.filter(p => !existingIds.has(p.id));

    console.log(`📊 To insert: ${productsToInsert.length} new products`);

    if (productsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All products already exist in pending_products',
          stats: {
            total_scraped: scrapedProducts.length,
            already_in_pending: existingIds.size,
            successfully_inserted: 0,
            failed: 0,
            duplicate_errors: 0,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map to pending_products schema
    const pendingProducts: PendingProduct[] = productsToInsert.map(product => ({
      product_id: product.product_id,
      scraped_product_id: product.id,
      url: product.url || '',
      vendor: product.vendor || '',
      breadcrumbs: product.breadcrumbs || null,
      category_status: 'pending',
      weight_and_dimension_status: 'pending',
      seo_status: 'pending',
    }));

    // Insert in batches
    const stats: ProcessingStats = {
      total_scraped: scrapedProducts.length,
      already_in_pending: existingIds.size,
      successfully_inserted: 0,
      failed: 0,
      duplicate_errors: 0,
    };

    console.log(`🚀 Inserting ${pendingProducts.length} new products in batches of ${BATCH_SIZE}`);

    for (let i = 0; i < pendingProducts.length; i += BATCH_SIZE) {
      const batch = pendingProducts.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pendingProducts.length / BATCH_SIZE);

      try {
        const { data, error } = await supabase
          .from('pending_products')
          .insert(batch)
          .select();

        if (error) {
          // If duplicate error, some products might already exist (concurrent insertions)
          // Insert one by one to find which ones are actually new
          if (error.code === '23505') {
            console.log(`⚠️ Batch ${batchNum}/${totalBatches}: Duplicate detected, retrying individually...`);

            for (const product of batch) {
              try {
                const { error: singleError } = await supabase
                  .from('pending_products')
                  .insert([product]);

                if (singleError) {
                  if (singleError.code === '23505') {
                    stats.duplicate_errors++;
                  } else {
                    stats.failed++;
                    console.error(`❌ Failed to insert:`, singleError.message);
                  }
                } else {
                  stats.successfully_inserted++;
                }
              } catch (singleErr) {
                stats.failed++;
              }
            }
            console.log(`✅ Batch ${batchNum}/${totalBatches}: Processed individually`);
          } else {
            console.error(`❌ Batch ${batchNum}/${totalBatches} failed:`, error);
            stats.failed += batch.length;
          }
        } else {
          stats.successfully_inserted += data?.length || 0;
          console.log(`✅ Batch ${batchNum}/${totalBatches}: Inserted ${data?.length || 0} products`);
        }
      } catch (err) {
        console.error(`💥 Batch ${batchNum}/${totalBatches} exception:`, err);
        stats.failed += batch.length;
      }
    }

    console.log('🎉 Processing complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.total_scraped} scraped products for vendor: ${vendor}`,
        stats,
        details: {
          vendor,
          batches_processed: Math.ceil(pendingProducts.length / BATCH_SIZE),
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
