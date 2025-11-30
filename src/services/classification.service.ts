/**
 * Classification Agent Service
 * Handles product classification for UK medicine compliance
 */

import { supabase } from '@/lib/supabase/client'
import type {
  ClassificationFilter,
  ClassificationStats,
  ClassifiedProduct,
  ClassificationType
} from '@/types/classification'

/**
 * Service response wrapper
 */
interface ServiceResponse<T> {
  data: T | null
  error: Error | null
  success: boolean
}

/**
 * Fetch classified products with filters
 */
export async function getClassifiedProducts(params: {
  filter?: ClassificationFilter
  classification?: ClassificationType
  search?: string
  vendor?: string
  limit?: number
  offset?: number
}): Promise<ServiceResponse<{ products: ClassifiedProduct[]; totalCount: number }>> {
  try {
    let query = supabase
      .from('scraped_products')
      .select('id, name, description, vendor, url, main_image, price, rejected, classification, classification_reason, classification_confidence, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })

    // Apply filter
    if (params.filter === 'accepted') {
      query = query.eq('rejected', false)
    } else if (params.filter === 'rejected') {
      query = query.eq('rejected', true)
    }

    // Apply classification type filter
    if (params.classification) {
      query = query.eq('classification', params.classification)
    }

    // Apply search filter
    if (params.search) {
      query = query.ilike('name', `%${params.search}%`)
    }

    // Apply vendor filter
    if (params.vendor) {
      query = query.eq('vendor', params.vendor)
    }

    // Apply pagination
    if (params.limit) {
      query = query.limit(params.limit)
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Classification Service] Error fetching products:', error)
      return {
        data: null,
        error: new Error(error.message),
        success: false
      }
    }

    return {
      data: {
        products: data as ClassifiedProduct[],
        totalCount: count || 0
      },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Get classification statistics
 */
export async function getClassificationStats(): Promise<ServiceResponse<ClassificationStats>> {
  try {
    // Get total count
    const { count: total, error: totalError } = await supabase
      .from('scraped_products')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // Get accepted count
    const { count: accepted, error: acceptedError } = await supabase
      .from('scraped_products')
      .select('*', { count: 'exact', head: true })
      .eq('rejected', false)

    if (acceptedError) throw acceptedError

    // Get rejected count
    const { count: rejected, error: rejectedError } = await supabase
      .from('scraped_products')
      .select('*', { count: 'exact', head: true })
      .eq('rejected', true)

    if (rejectedError) throw rejectedError

    // Get counts by classification type
    const { data: byTypeData, error: byTypeError } = await supabase
      .from('scraped_products')
      .select('classification')

    if (byTypeError) throw byTypeError

    const byType = {
      not_medicine: 0,
      gsl: 0,
      pharmacy: 0,
      pom: 0,
      unclear: 0
    }

    byTypeData?.forEach(item => {
      if (item.classification && item.classification in byType) {
        byType[item.classification as keyof typeof byType]++
      }
    })

    const stats: ClassificationStats = {
      total: total || 0,
      accepted: accepted || 0,
      rejected: rejected || 0,
      acceptedPercentage: total ? ((accepted || 0) / total) * 100 : 0,
      rejectedPercentage: total ? ((rejected || 0) / total) * 100 : 0,
      byType
    }

    return {
      data: stats,
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Error getting stats:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Admin: Accept a rejected product (manual override)
 * Updates scraped_products to mark as accepted and pushes to pending_products
 */
export async function acceptProduct(
  productId: string,
  reason: string
): Promise<ServiceResponse<{ message: string }>> {
  try {
    // Update scraped_products to mark as accepted
    const { error: updateError } = await supabase
      .from('scraped_products')
      .update({
        rejected: false,
        classification_reason: `Manual override: ${reason}`
      })
      .eq('id', productId)

    if (updateError) {
      console.error('[Classification Service] Error accepting product:', updateError)
      return {
        data: null,
        error: new Error(updateError.message),
        success: false
      }
    }

    return {
      data: { message: 'Product accepted successfully. It will be processed by other agents.' },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Admin: Reject an accepted product (manual override)
 * Updates scraped_products to mark as rejected and removes from pending_products
 */
export async function rejectProduct(
  productId: string,
  reason: string,
  classification: ClassificationType
): Promise<ServiceResponse<{ message: string }>> {
  try {
    // Update scraped_products to mark as rejected
    const { error: updateError } = await supabase
      .from('scraped_products')
      .update({
        rejected: true,
        classification: classification,
        classification_reason: `Manual override: ${reason}`
      })
      .eq('id', productId)

    if (updateError) {
      console.error('[Classification Service] Error rejecting product:', updateError)
      return {
        data: null,
        error: new Error(updateError.message),
        success: false
      }
    }

    // Remove from pending_products if it exists
    const { error: deleteError } = await supabase
      .from('pending_products')
      .delete()
      .eq('scraped_product_id', productId)

    if (deleteError) {
      console.warn('[Classification Service] Warning: Failed to remove from pending_products:', deleteError)
      // Don't fail the entire operation if delete fails
    }

    return {
      data: { message: 'Product rejected successfully.' },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Update product classification (manual override)
 * Can change any product's classification type and reason
 */
export async function updateClassification(
  productId: string,
  classification: ClassificationType,
  reason: string
): Promise<ServiceResponse<{ message: string }>> {
  try {
    // Determine if the new classification should mark as rejected
    const isRejected = classification === 'pharmacy' || classification === 'pom' || classification === 'unclear'

    // Update scraped_products with new classification
    const { error: updateError } = await supabase
      .from('scraped_products')
      .update({
        rejected: isRejected,
        classification: classification,
        classification_reason: `Manual override: ${reason}`,
        classification_confidence: 1.0 // Manual overrides have 100% confidence
      })
      .eq('id', productId)

    if (updateError) {
      console.error('[Classification Service] Error updating classification:', updateError)
      return {
        data: null,
        error: new Error(updateError.message),
        success: false
      }
    }

    // If rejected, remove from pending_products
    if (isRejected) {
      const { error: deleteError } = await supabase
        .from('pending_products')
        .delete()
        .eq('scraped_product_id', productId)

      if (deleteError) {
        console.warn('[Classification Service] Warning: Failed to remove from pending_products:', deleteError)
      }
    }

    return {
      data: { message: 'Classification updated successfully.' },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Retry classification for a product
 * Calls standalone classify-product edge function to re-classify
 * Note: This ONLY classifies. Pushing to pending_products is handled by the database webhook.
 */
export async function retryClassification(
  productId: string
): Promise<ServiceResponse<{ message: string }>> {
  try {
    // Call classify-product edge function with force=true to reclassify
    const { data, error } = await supabase.functions.invoke('classify-product', {
      body: {
        productId: productId,
        force: true // Force reclassification even if already classified
      }
    })

    if (error) {
      console.error('[Classification Service] Error retrying classification:', error)
      return {
        data: null,
        error: new Error(error.message),
        success: false
      }
    }

    if (!data.success) {
      console.error('[Classification Service] Classification failed:', data.error)
      return {
        data: null,
        error: new Error(data.error || 'Classification failed'),
        success: false
      }
    }

    return {
      data: { message: 'Classification retry completed successfully.' },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Batch classify multiple products
 * Useful for classifying existing unclassified products
 * Note: This ONLY classifies. Pushing to pending_products is handled by the database webhook.
 */
export async function batchClassifyProducts(
  productIds: string[],
  force: boolean = false
): Promise<ServiceResponse<{ total: number; successful: number; failed: number }>> {
  try {
    const { data, error } = await supabase.functions.invoke('classify-product', {
      body: {
        productIds: productIds,
        force: force
      }
    })

    if (error) {
      console.error('[Classification Service] Error batch classifying:', error)
      return {
        data: null,
        error: new Error(error.message),
        success: false
      }
    }

    return {
      data: {
        total: data.total || 0,
        successful: data.successful || 0,
        failed: data.failed || 0
      },
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Classify product by name and description (without storing)
 * Useful for testing classification before creating a product
 */
export async function classifyProductPreview(
  name: string,
  description: string
): Promise<ServiceResponse<{
  rejected: boolean
  classification: string
  reason: string
  confidence: number
}>> {
  try {
    const { data, error } = await supabase.functions.invoke('classify-product', {
      body: {
        name: name,
        description: description
      }
    })

    if (error) {
      console.error('[Classification Service] Error classifying preview:', error)
      return {
        data: null,
        error: new Error(error.message),
        success: false
      }
    }

    if (!data.success) {
      return {
        data: null,
        error: new Error(data.error || 'Classification failed'),
        success: false
      }
    }

    return {
      data: data.classification,
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}

/**
 * Get list of unique vendors using RPC function
 */
export async function getVendors(): Promise<ServiceResponse<string[]>> {
  try {
    const { data, error } = await supabase.rpc('get_distinct_vendors')

    if (error) {
      console.error('[Classification Service] Error fetching vendors:', error)
      return {
        data: null,
        error: new Error(error.message),
        success: false
      }
    }

    // RPC returns objects with {vendor, product_count} - extract vendor names
    const vendors = (data as Array<{ vendor: string; product_count: number }> || [])
      .map(item => item.vendor)
      .filter(Boolean)
      .sort()

    return {
      data: vendors,
      error: null,
      success: true
    }
  } catch (error) {
    console.error('[Classification Service] Unexpected error:', error)
    return {
      data: null,
      error: error as Error,
      success: false
    }
  }
}
