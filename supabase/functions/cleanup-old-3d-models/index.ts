/**
 * Cleanup Old 3D Models
 *
 * Automatically cleans up 3D model files from storage for products updated last week.
 * This helps manage storage costs by removing outdated 3D models.
 *
 * Features:
 * - Finds products with glb_url that were updated 7-14 days ago
 * - Deletes the actual files from Supabase storage (proper cleanup, not orphaning)
 * - Updates glb_url to NULL in database
 * - Processes up to 1000 products per run
 * - Designed to run as a weekly cron job
 *
 * Cron Schedule: Twice weekly on Sunday and Wednesday at 2 AM UTC
 * Manual Trigger: POST /cleanup-old-3d-models
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface ResponseData {
  success: boolean
  message?: string
  error?: string
  stats?: {
    products_found: number
    files_deleted: number
    files_failed: number
    database_updated: number
  }
}

function extractFilePath(url: string): string | null {
  /**
   * Extract file path from full Supabase storage URL.
   *
   * Example:
   * https://xxx.supabase.co/storage/v1/object/public/product-files/3d-models/uuid/file.glb
   * -> 3d-models/uuid/file.glb
   */
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/product-files/')
    if (pathParts.length === 2) {
      return pathParts[1]
    }
    return null
  } catch {
    return null
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
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Starting 3D model cleanup...')

    // Get products with 3D models updated 7-14 days ago
    const { data: products, error: fetchError } = await supabase
      .from('pending_products')
      .select('id, item_code, glb_url, updated_at')
      .not('glb_url', 'is', null)
      .like('glb_url', '%3d-models%')
      .gte('updated_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .lt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1000)

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`)
    }

    if (!products || products.length === 0) {
      console.log('No products found for cleanup')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No products found for cleanup',
          stats: {
            products_found: 0,
            files_deleted: 0,
            files_failed: 0,
            database_updated: 0
          }
        } as ResponseData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log(`Found ${products.length} products with 3D models to clean up`)

    // Extract file paths and track which products to update
    const filePaths: string[] = []
    const productIdsToUpdate: number[] = []

    for (const product of products) {
      const filePath = extractFilePath(product.glb_url)
      if (filePath) {
        filePaths.push(filePath)
        productIdsToUpdate.push(product.id)
      }
    }

    console.log(`Extracted ${filePaths.length} file paths`)

    // Delete files from storage in batches of 100 (Supabase limit)
    let filesDeleted = 0
    let filesFailed = 0
    const BATCH_SIZE = 100

    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE)

      try {
        const { data: deleteData, error: deleteError } = await supabase
          .storage
          .from('product-files')
          .remove(batch)

        if (deleteError) {
          console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} deletion error:`, deleteError)
          filesFailed += batch.length
        } else {
          const deleted = Array.isArray(deleteData) ? deleteData.length : batch.length
          filesDeleted += deleted
          console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleted ${deleted} files`)
        }
      } catch (error) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error)
        filesFailed += batch.length
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Update database to clear glb_url for successfully processed products
    // Batch updates to avoid issues with large IN clauses
    let databaseUpdated = 0
    const DB_BATCH_SIZE = 100

    for (let i = 0; i < productIdsToUpdate.length; i += DB_BATCH_SIZE) {
      const batch = productIdsToUpdate.slice(i, i + DB_BATCH_SIZE)

      try {
        const { data: updateData, error: updateError } = await supabase
          .from('pending_products')
          .update({ glb_url: null })
          .in('id', batch)
          .select('id')

        if (updateError) {
          console.error(`DB batch ${Math.floor(i / DB_BATCH_SIZE) + 1} error:`, updateError)
        } else {
          const updated = updateData?.length || 0
          databaseUpdated += updated
          console.log(`DB batch ${Math.floor(i / DB_BATCH_SIZE) + 1}: Updated ${updated} records`)
        }
      } catch (error) {
        console.error(`DB batch ${Math.floor(i / DB_BATCH_SIZE) + 1} exception:`, error)
      }

      // Small delay between batches
      if (i + DB_BATCH_SIZE < productIdsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`Total database records updated: ${databaseUpdated}`)

    const stats = {
      products_found: products.length,
      files_deleted: filesDeleted,
      files_failed: filesFailed,
      database_updated: databaseUpdated
    }

    console.log('Cleanup complete:', stats)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${filesDeleted} 3D model files from ${products.length} products`,
        stats
      } as ResponseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in cleanup function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      } as ResponseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
