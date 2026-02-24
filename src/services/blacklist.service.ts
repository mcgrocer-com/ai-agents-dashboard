/**
 * Blacklist Service
 * Handles product blacklisting: marks as blacklisted in Supabase AND disables in ERPNext.
 */

import { supabase } from '@/lib/supabase/client'

interface ServiceResponse<T> {
  data: T | null
  error: Error | null
  success: boolean
}

/**
 * Disable products in ERPNext by their URLs.
 * Calls the disable-products-in-erpnext edge function which holds the ERPNext auth token server-side.
 */
async function disableInErpNext(urls: string[]): Promise<{ success: boolean; error?: string }> {
  if (urls.length === 0) return { success: true }

  try {
    const { data, error } = await supabase.functions.invoke('disable-products-in-erpnext', {
      body: { urls },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data && !data.success) {
      return { success: false, error: data.error || 'Unknown ERPNext error' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Blacklist a single product (marks in DB + disables in ERPNext)
 */
export async function blacklistProduct(
  productId: string,
  reason: string,
  url?: string | null
): Promise<ServiceResponse<{ message: string }>> {
  try {
    // Disable in ERPNext if URL is available
    if (url) {
      const erpResult = await disableInErpNext([url])
      if (!erpResult.success) {
        console.warn(`[Blacklist] ERPNext disable failed for ${productId}: ${erpResult.error}`)
      }
    }

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
 * Bulk blacklist multiple products (marks in DB + disables in ERPNext)
 * @param urls - Product URLs to disable in ERPNext (pass from loaded products)
 */
export async function bulkBlacklistProducts(
  productIds: string[],
  reason: string,
  urls?: string[]
): Promise<ServiceResponse<{ count: number }>> {
  try {
    // Disable in ERPNext if URLs are provided
    if (urls && urls.length > 0) {
      const erpResult = await disableInErpNext(urls)
      if (!erpResult.success) {
        console.warn(`[Blacklist] ERPNext bulk disable failed: ${erpResult.error}`)
      }
    }

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
 * Bulk blacklist by URLs only (for "Blacklist All in Category" where we have URLs but not IDs).
 * Fetches product IDs from the URLs, disables in ERPNext, and marks as blacklisted in DB.
 */
export async function bulkBlacklistByUrls(
  urls: string[],
  reason: string
): Promise<ServiceResponse<{ count: number }>> {
  try {
    // Disable in ERPNext
    const erpResult = await disableInErpNext(urls)
    if (!erpResult.success) {
      console.warn(`[Blacklist] ERPNext bulk disable failed: ${erpResult.error}`)
    }

    // Blacklist in database by URL
    const { error, count } = await supabase
      .from('scraped_products')
      .update({
        blacklisted: true,
        blacklist_reason: reason,
        blacklisted_at: new Date().toISOString(),
      })
      .in('url', urls)

    if (error) {
      return { data: null, error: new Error(error.message), success: false }
    }

    return {
      data: { count: count || urls.length },
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
  bulkBlacklistByUrls,
  bulkUnblacklistProducts,
}
