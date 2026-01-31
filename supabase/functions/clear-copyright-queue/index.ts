/**
 * Clear Copyright Queue
 *
 * Sets copyright_status to NULL for all products with copyright_status = 'pending',
 * effectively removing them from the copyright agent queue.
 *
 * POST /clear-copyright-queue
 * Body: {} (no parameters required)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface ResponseData {
  success: boolean
  message?: string
  error?: string
  stats?: {
    cleared_count: number
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

    console.log('Clearing copyright queue (setting pending to NULL)...')

    // Update all products with copyright_status = 'pending' to NULL
    const { data, error, count } = await supabase
      .from('pending_products')
      .update({ copyright_status: null })
      .eq('copyright_status', 'pending')
      .select('id', { count: 'exact', head: false })

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    const clearedCount = count || 0

    console.log(`Successfully cleared ${clearedCount} products from copyright queue`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully cleared ${clearedCount} product${clearedCount !== 1 ? 's' : ''} from copyright queue`,
        stats: {
          cleared_count: clearedCount,
        },
      } as ResponseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Error clearing copyright queue:', err)

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
