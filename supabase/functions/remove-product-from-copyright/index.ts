/**
 * Remove Product from Copyright Queue
 *
 * Sets copyright_status to NULL for a specific product,
 * effectively removing it from the copyright agent queue.
 *
 * POST /remove-product-from-copyright
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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.'
      } as ResponseData),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: RequestBody = await req.json()
    const productId = body.productId?.trim()

    // Validate productId
    if (!productId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: productId'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Removing product ${productId} from copyright queue`)

    // Update product to set copyright_status to NULL
    const { data, error } = await supabase
      .from('pending_products')
      .update({ copyright_status: null })
      .eq('id', productId)
      .select('id')
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
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

    console.log(`Successfully removed product ${productId} from copyright queue`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully removed product from copyright queue`,
        productId: productId,
      } as ResponseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Error removing product from copyright queue:', err)

    const errorMessage = err instanceof Error ? err.message : 'Internal server error'

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      } as ResponseData),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
