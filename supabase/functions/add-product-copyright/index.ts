/**
 * Add Product(s) to Copyright Queue
 *
 * Sets copyright_status to 'pending' for either:
 * - A single product (via productId) - creates pending_product if doesn't exist
 * - All products from a vendor (via vendor)
 *
 * POST /add-product-copyright
 * Body: { productId?: string, vendor?: string }
 *
 * Note: productId refers to scraped_products.id
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface RequestBody {
  productId?: string
  vendor?: string
}

interface ResponseData {
  success: boolean
  message?: string
  error?: string
  stats?: {
    updated_count: number
    vendor?: string
    productId?: string
  }
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
    const vendor = body.vendor?.trim()

    // Validate: must provide either productId or vendor, but not both
    if (!productId && !vendor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: either productId or vendor must be provided'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (productId && vendor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only one of productId or vendor should be provided, not both'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle vendor = 'all' case
    if (vendor === 'all') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cannot reset copyright for "all" vendors. Please select a specific vendor.'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let data, error, count

    if (productId) {
      // Add single product to copyright queue
      console.log(`Adding product to copyright queue: ${productId}`)

      // First, check if there's a pending_product with this scraped_product_id
      const { data: existingPending, error: checkError } = await supabase
        .from('pending_products')
        .select('id')
        .eq('scraped_product_id', productId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // Error other than "no rows returned"
        console.error('Error checking pending product:', checkError)
        throw checkError
      }

      if (existingPending) {
        // Update existing pending_product
        const result = await supabase
          .from('pending_products')
          .update({ copyright_status: 'pending' })
          .eq('id', existingPending.id)
          .select('id')
          .single()

        data = result.data
        error = result.error
        count = data ? 1 : 0
      } else {
        // Insert new pending_product record
        const result = await supabase
          .from('pending_products')
          .insert({
            scraped_product_id: productId,
            copyright_status: 'pending',
          })
          .select('id')
          .single()

        data = result.data
        error = result.error
        count = data ? 1 : 0
      }

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      if (!data) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to add product to copyright queue`
          } as ResponseData),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    } else {
      // Reset copyright status for all products from a vendor
      console.log(`Resetting copyright status for vendor: ${vendor}`)

      const result = await supabase
        .from('pending_products')
        .update({ copyright_status: 'pending' })
        .eq('vendor', vendor!)
        .select('id', { count: 'exact', head: false })

      data = result.data
      error = result.error
      count = result.count || 0
    }

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    const updatedCount = count || 0

    if (productId) {
      console.log(`Successfully added product ${productId} to copyright queue`)
    } else {
      console.log(`Successfully reset copyright status for ${updatedCount} products from ${vendor}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: productId
          ? `Successfully added product to copyright queue`
          : `Successfully reset copyright status for ${updatedCount} product${updatedCount !== 1 ? 's' : ''} from ${vendor}`,
        stats: {
          updated_count: updatedCount,
          vendor: vendor || undefined,
          productId: productId || undefined,
        },
      } as ResponseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Error resetting copyright status:', err)

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
