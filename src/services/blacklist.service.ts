/**
 * Blacklist Service
 * Handles product blacklisting to prevent ERPNext sync
 */

import { supabase } from '@/lib/supabase/client'

interface ServiceResponse<T> {
  data: T | null
  error: Error | null
  success: boolean
}

/**
 * Blacklist a single product
 */
export async function blacklistProduct(
  productId: string,
  reason: string
): Promise<ServiceResponse<{ message: string }>> {
  try {
    const { error } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: true,
        blacklist_reason: reason,
        blacklisted_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) {
      return { data: null, error: new Error(error.message), success: false }
    }

    return {
      data: { message: 'Product blacklisted successfully.' },
      error: null,
      success: true,
    }
  } catch (error) {
    return { data: null, error: error as Error, success: false }
  }
}

/**
 * Remove a product from the blacklist
 */
export async function unblacklistProduct(
  productId: string
): Promise<ServiceResponse<{ message: string }>> {
  try {
    const { error } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: false,
        blacklist_reason: null,
        blacklisted_at: null,
      })
      .eq('id', productId)

    if (error) {
      return { data: null, error: new Error(error.message), success: false }
    }

    return {
      data: { message: 'Product removed from blacklist.' },
      error: null,
      success: true,
    }
  } catch (error) {
    return { data: null, error: error as Error, success: false }
  }
}

/**
 * Bulk blacklist multiple products
 */
export async function bulkBlacklistProducts(
  productIds: string[],
  reason: string
): Promise<ServiceResponse<{ count: number }>> {
  try {
    const { error, count } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: true,
        blacklist_reason: reason,
        blacklisted_at: new Date().toISOString(),
      })
      .in('id', productIds)

    if (error) {
      return { data: null, error: new Error(error.message), success: false }
    }

    return {
      data: { count: count || productIds.length },
      error: null,
      success: true,
    }
  } catch (error) {
    return { data: null, error: error as Error, success: false }
  }
}

/**
 * Bulk unblacklist multiple products
 */
export async function bulkUnblacklistProducts(
  productIds: string[]
): Promise<ServiceResponse<{ count: number }>> {
  try {
    const { error, count } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: false,
        blacklist_reason: null,
        blacklisted_at: null,
      })
      .in('id', productIds)

    if (error) {
      return { data: null, error: new Error(error.message), success: false }
    }

    return {
      data: { count: count || productIds.length },
      error: null,
      success: true,
    }
  } catch (error) {
    return { data: null, error: error as Error, success: false }
  }
}

export const blacklistService = {
  blacklistProduct,
  unblacklistProduct,
  bulkBlacklistProducts,
  bulkUnblacklistProducts,
}
