/**
 * Add to Cart Queue - ERPNext Integration
 *
 * Receives cart requests from ERPNext and queues them for automated add-to-cart.
 * The queue processor will pick up pending items and use browser automation
 * to add products to vendor carts.
 *
 * Auto-creates vendors if not found (for UK vendors fallback from ERPNext).
 *
 * POST /add-to-cart
 * Body: {
 *   product_url: string (required) - URL of the product to add
 *   vendor: string (required) - Vendor name (e.g., "tesco", "sainsburys")
 *   quantity?: number - Quantity to add (default: 1)
 *   product_name?: string - Optional product name for display
 *   product_data?: object - Additional product metadata
 * }
 *
 * Response:
 * - 200: { success: true, queue_id: string, message: string, vendor_created?: boolean }
 * - 400: { success: false, error: string } - Invalid request
 * - 500: { success: false, error: string } - Server error
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface RequestBody {
  product_url: string
  vendor: string
  quantity?: number
  product_name?: string
  product_data?: Record<string, unknown>
}

interface ResponseData {
  success: boolean
  queue_id?: string
  message?: string
  error?: string
  vendor_created?: boolean
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Fixed UUID for ERPNext system integration (not multi-tenant)
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

Deno.serve(async (req) => {
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
    const {
      product_url,
      vendor,
      quantity = 1,
      product_name,
      product_data
    } = body

    // Validate required fields
    if (!product_url?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: product_url'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!vendor?.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: vendor'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate URL format
    try {
      new URL(product_url)
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid product_url: must be a valid URL'
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Look up vendor in database (case-insensitive)
    let { data: vendorData, error: vendorError } = await supabase
      .from('vendors')
      .select('id, name, can_automate, requires_captcha')
      .ilike('name', vendor.trim())
      .single()

    let vendorCreated = false

    // Auto-create vendor if not found (UK vendors fallback from ERPNext)
    if (vendorError || !vendorData) {
      console.log(`Vendor not found, auto-creating: ${vendor}`)

      // Extract domain from product URL
      const productUrlObj = new URL(product_url)
      const domain = productUrlObj.hostname.replace('www.', '')

      // Create vendor with default settings
      const { data: newVendor, error: createError } = await supabase
        .from('vendors')
        .insert({
          name: vendor.trim(),
          domain: domain,
          login_url: null,
          cart_url: null,
          selectors: null,
          is_prioritized: false,
          can_automate: true,
          requires_captcha: false,
          rate_limit_daily: 50,
        })
        .select('id, name, can_automate, requires_captcha')
        .single()

      if (createError || !newVendor) {
        console.error('Error auto-creating vendor:', createError)
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to auto-create vendor "${vendor}": ${createError?.message || 'Unknown error'}`
          } as ResponseData),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`Auto-created vendor: ${newVendor.name} (${newVendor.id})`)
      vendorData = newVendor
      vendorCreated = true
    }

    // Check if vendor supports automation
    if (!vendorData.can_automate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Vendor "${vendorData.name}" does not support automation. Manual add required.`
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine initial status based on captcha requirement
    const initialStatus = vendorData.requires_captcha ? 'manual_required' : 'pending'

    // Create cart queue entry
    const { data: queueEntry, error: insertError } = await supabase
      .from('cart_queue')
      .insert({
        user_id: SYSTEM_USER_ID,
        vendor_id: vendorData.id,
        product_url: product_url.trim(),
        product_name: product_name?.trim() || null,
        product_data: {
          ...product_data,
          quantity: quantity,
          source: 'erpnext'
        },
        status: initialStatus,
        attempts: 0,
        max_attempts: 3,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error creating queue entry:', insertError)
      throw insertError
    }

    const message = initialStatus === 'manual_required'
      ? `Product queued for manual add (${vendorData.name} requires captcha)`
      : `Product queued for automated add to ${vendorData.name}`

    console.log(`Queue entry created: ${queueEntry.id} for vendor ${vendorData.name}`)

    return new Response(
      JSON.stringify({
        success: true,
        queue_id: queueEntry.id,
        message: message,
        vendor_created: vendorCreated
      } as ResponseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (err) {
    console.error('Error processing add-to-cart request:', err)

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
