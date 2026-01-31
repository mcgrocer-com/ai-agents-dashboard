/**
 * Reset Agent Completed
 *
 * Resets agent status from 'complete' to 'pending' for all products or filtered by vendor.
 * Supports multiple agent types: seo, copyright.
 *
 * POST /reset-agent-completed
 * Body: { agentType: 'seo' | 'copyright', vendor?: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

type AgentType = 'seo' | 'copyright'

interface RequestBody {
  agentType: AgentType
  vendor?: string
}

interface ResponseData {
  success: boolean
  message?: string
  error?: string
  stats?: {
    reset_count: number
  }
}

// Map agent type to the corresponding status column in pending_products
const agentStatusColumns: Record<AgentType, string> = {
  seo: 'seo_status',
  copyright: 'copyright_status',
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
    const { agentType, vendor } = body

    // Validate agent type
    if (!agentType || !agentStatusColumns[agentType]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid agent type. Must be one of: ${Object.keys(agentStatusColumns).join(', ')}`
        } as ResponseData),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const statusColumn = agentStatusColumns[agentType]
    console.log(`Resetting ${agentType} completed products${vendor ? ` for vendor: ${vendor}` : ''}...`)

    // Build query to reset status from 'complete' to 'pending'
    let query = supabase
      .from('pending_products')
      .update({ [statusColumn]: 'pending' })
      .eq(statusColumn, 'complete')

    // Apply vendor filter if provided
    if (vendor) {
      query = query.eq('vendor', vendor)
    }

    const { data, error, count } = await query.select('id', { count: 'exact', head: false })

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    const resetCount = count || 0

    console.log(`Successfully reset ${resetCount} ${agentType} products from complete to pending`)

    const vendorMsg = vendor ? ` for ${vendor}` : ''
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully reset ${resetCount} product${resetCount !== 1 ? 's' : ''} from complete to pending${vendorMsg}`,
        stats: {
          reset_count: resetCount,
        },
      } as ResponseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Error resetting agent completed:', err)

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
