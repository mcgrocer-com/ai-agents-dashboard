/**
 * ERPNext Service
 *
 * Handles communication with ERPNext API for product synchronization.
 */

import { supabase } from '@/lib/supabase/client'

async function scrapeUrl(url: string): Promise<any> {
  const { data, error } = await supabase
    .from('pending_products')
    .select('*, scraped_product:scraped_products!scraped_product_id(*)')
    .eq('url', url)
    .single()

  if (error) {
    console.error(`Error fetching product data for url ${url}:`, error)
    throw new Error(`Could not find product data for url: ${url}`)
  }

  const pendingData = data
  const productData = data.scraped_product

  if (!productData) {
    throw new Error(`No scraped_product data found for url: ${url}`)
  }

  // Combine and map data from both pending_products and scraped_products
  // to the format expected by the ERPNext API.
  return {
    name: productData.name,
    price: productData.price,
    selling_price: productData.original_price,
    product_id: pendingData.product_id,
    description: productData.description,
    stock_status: productData.stock_status,
    url: pendingData.url,
    category: pendingData.category,
    breadcrumb: pendingData.breadcrumbs,
    ai_title: pendingData.ai_title,
    summary: pendingData.ai_description,
    vendor: pendingData.vendor,
    images: productData.images,
    main_image: productData.main_image,
    timestamp: productData.timestamp || new Date(productData.created_at).toISOString(),
    weight: pendingData.weight,
    height: pendingData.height,
    width: pendingData.width,
    length: pendingData.length,
    volumetric_weight: pendingData.volumetric_weight,
    
  }
}

export interface ErpnextPushResult {
  url: string
  status: 'success' | 'error'
  production?: {
    item_code: string
    action: 'created' | 'updated'
  }
  staging?: {
    item_code: string
    action: 'created' | 'updated'
  }
  error?: string
}

export interface ErpnextPushResponse {
  success: boolean
  results: ErpnextPushResult[]
  summary: {
    total: number
    successful: number
    failed: number
  }
}

/**
 * Push a product to ERPNext by URL
 */
export async function pushToErpnext(url: string): Promise<{
  data: ErpnextPushResponse | null
  error: Error | null
}> {
  try {
    const scrapedData = await scrapeUrl(url)
    if(!scrapedData) {
      throw new Error(`No scraped data found for url: ${url}`)
    }
    if(scrapedData.weight === 0 || scrapedData.height === 0 || scrapedData.width === 0 ||
       scrapedData.length === 0 || scrapedData.volumetric_weight === 0 ||
      !scrapedData.category || scrapedData.breadcrumbs === null) {
      throw new Error(`Product not yet sanitized`)
    }
    const apiUrl = `${import.meta.env.VITE_ERPNEXT_API_ENDPOINT}`
    const authToken = `token ${import.meta.env.VITE_ERPNEXT_AUTH_TOKEN}`

    const response = await fetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([scrapedData]),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to push to ERPNext: ${errorText}`)
    }

    const result = await response.json()

    // Adapt the ERPNext response to the existing ErpnextPushResponse structure
    const formattedData: ErpnextPushResponse = {
      success: result.message.status !== 'error',
      results: [
        {
          url: url,
          status: result.message.errors?.length > 0 ? 'error' : 'success',
          production: {
            item_code: result.message.updated_items?.[0] || result.message.created_items?.[0] || '',
            action: result.message.updated_items?.length > 0 ? 'updated' : 'created',
          },
          error: result.message.errors?.[0]?.message,
        },
      ],
      summary: {
        total: 1,
        successful: result.message.errors?.length > 0 ? 0 : 1,
        failed: result.message.errors?.length > 0 ? 1 : 0,
      },
    }

    return {
      data: formattedData,
      error: null,
    }
  } catch (error) {
    console.error('Error pushing to ERPNext:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Push multiple products to ERPNext by URLs
 */
export async function pushMultipleToErpnext(urls: string[]): Promise<{
  data: ErpnextPushResponse | null
  error: Error | null
}> {
  try {
    const scrapedData = await Promise.all(urls.map(url => scrapeUrl(url)))

    const apiUrl = `${import.meta.env.VITE_ERPNEXT_API_ENDPOINT}`
    const authToken = `token ${import.meta.env.VITE_ERPNEXT_AUTH_TOKEN}`

    const response = await fetch(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scrapedData),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to push to ERPNext: ${errorText}`)
    }

    const result = await response.json()

    // This is a simplified adaptation. A real implementation would need to map
    // the results back to the individual URLs more robustly.
    const formattedData: ErpnextPushResponse = {
      success: result.message.status !== 'error',
      results: urls.map((url, index) => ({
        url: url,
        status: 'success', // Simplified, assuming all succeed or fail together
        production: {
          item_code: result.message.updated_items?.[index] || result.message.created_items?.[index] || '',
          action: result.message.updated_items?.length > index ? 'updated' : 'created',
        },
      })),
      summary: {
        total: urls.length,
        successful: result.message.created_items.length + result.message.updated_items.length,
        failed: result.message.errors.length,
      },
    }

    return {
      data: formattedData,
      error: null,
    }
  } catch (error) {
    console.error('Error pushing to ERPNext:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Push products to ERPNext by product URLs
 */
export async function pushProductsByUrls(productUrls: string[]): Promise<{
  data: {
    success: boolean
    results: Array<{
      productId: string
      url: string
      status: 'success' | 'failed'
      itemCode?: string
      error?: string
    }>
    summary: {
      total: number
      successful: number
      failed: number
    }
  } | null
  error: Error | null
}> {
  try {
    if (!Array.isArray(productUrls) || productUrls.length === 0) {
      throw new Error('productUrls array is required and cannot be empty')
    }

    const { data, error } = await supabase.functions.invoke('push-products-to-erpnext', {
      body: { productUrls }
    })

    if (error) {
      throw error
    }

    return {
      data,
      error: null
    }
  } catch (error) {
    console.error('Error pushing products by URLs:', error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error')
    }
  }
}

export const erpnextService = {
  pushToErpnext,
  pushMultipleToErpnext,
  pushProductsByUrls,
}
