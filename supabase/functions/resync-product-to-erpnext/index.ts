/**
 * Resync Single Product to ERPNext
 *
 * Resets erpnext_updated_at to NULL for a specific product,
 * forcing it to be re-synced to ERPNext in the next sync cycle.
 *
 * POST /resync-product-to-erpnext
 * Body: { productId: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface RequestBody {
  productId?: string
}

interface ResponseData {
  success: boolean
  message?: string
  error?: string
  productId?: string
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.'
      } as ResponseData),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: RequestBody = await req.json()
    const productId = body.productId?.trim()

    console.log('🔄 Resync to ERPNext request for product:', productId)

    if (!productId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: productId',
          usage: {
            endpoint: 'POST /resync-product-to-erpnext',
            body: { productId: 'string (required)' }
          }
        } as ResponseData),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Reset erpnext_updated_at, failed_sync_at, and failed_sync_error_message to NULL
    // This clears both successful sync status and failed sync status, allowing product to be re-synced
    const { data, error: updateError } = await supabase
      .from('pending_products')
      .update({
        erpnext_updated_at: null,
        failed_sync_at: null,
        failed_sync_error_message: null
      })
      .eq('id', productId)
      .select('id')
      .single()

    if (updateError) {
      console.error('❌ Error resetting sync status:', updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to reset sync status',
          details: updateError.message,
        } as ResponseData),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Product not found with ID: ${productId}`
        } as ResponseData),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🎉 Resync complete for product:', productId)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully reset product for ERPNext resync. It will be re-synced in the next sync cycle.`,
        productId,
      } as ResponseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('💥 Unexpected error:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      } as ResponseData),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
