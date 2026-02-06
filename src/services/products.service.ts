/**
 * Products Service
 *
 * Handles all product-related operations with Supabase.
 */

import { supabase } from '@/lib/supabase/client'
import type {
  ScrapedProduct,
  PendingProduct,
  ProductFilters,
  ProductWithAgentData,
} from '@/types'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

// Domains that are already hosted on our infrastructure (no need to re-host)
const HOSTED_DOMAINS = ['supabase.co', 'cdn.shopify.com', 'mcgrocer.com']

function isHostedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return HOSTED_DOMAINS.some((domain) => hostname.includes(domain))
  } catch {
    return false
  }
}


class ProductsService {
  /**
   * Get products with filters and pagination
   * Includes ERPNext sync status from pending_products table
   */
  async getProducts(filters: ProductFilters = {}) {
    try {
      const sortBy = filters.sortBy || 'updated_at'
      const sortOrder = filters.sortOrder || 'desc'

      // Use RPC function for erpnext_updated_at sorting (can't sort by joined table columns otherwise)
      if (sortBy === 'erpnext_updated_at') {
        const limit = filters.limit || 20
        const offset = filters.offset || 0

        const { data, error } = await supabase.rpc('get_products_sorted_by_erpnext_sync', {
          p_limit: limit,
          p_offset: offset,
          p_ascending: sortOrder === 'asc',
          p_search: filters.search || null,
          p_vendor: filters.vendor || null,
          p_pinned_only: false,
        })

        if (error) throw error

        const products = (data || []).map((product: any) => {
          let sync_status: 'synced' | 'failed' | 'pending' = 'pending'
          if (product.erpnext_updated_at && (!product.failed_sync_at || new Date(product.failed_sync_at) < new Date(product.erpnext_updated_at))) {
            sync_status = 'synced'
          } else if (product.failed_sync_at && (!product.erpnext_updated_at || new Date(product.failed_sync_at) > new Date(product.erpnext_updated_at))) {
            sync_status = 'failed'
          }

          const { total_count, ...productData } = product
          return {
            ...productData,
            sync_status,
          } as ScrapedProduct
        })

        const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0

        return {
          products,
          count: totalCount,
          error: null,
        }
      }

      // Use RPC function for failed_sync_at sorting (shows only products that failed to sync)
      if (sortBy === 'failed_sync_at') {
        const limit = filters.limit || 20
        const offset = filters.offset || 0

        const { data, error } = await supabase.rpc('get_products_sorted_by_failed_sync', {
          p_limit: limit,
          p_offset: offset,
          p_ascending: sortOrder === 'asc',
          p_search: filters.search || null,
          p_vendor: filters.vendor || null,
          p_pinned_only: false,
        })

        if (error) throw error

        const products = (data || []).map((product: any) => {
          const { total_count, ...productData } = product
          return {
            ...productData,
            sync_status: 'failed' as const,
          } as ScrapedProduct
        })

        const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0

        return {
          products,
          count: totalCount,
          error: null,
        }
      }

      // Regular query for other sort fields
      // Join with pending_products to get sync status and ai_title
      // Use 'planned' count for better performance with large datasets (estimates count from query planner)
      let query = supabase
        .from('scraped_products')
        .select(`
          *,
          pending_products!pending_products_scraped_product_id_fkey (
            erpnext_updated_at,
            failed_sync_at,
            failed_sync_error_message,
            item_code,
            ai_title,
            validation_error
          )
        `, { count: 'planned' })

      // Apply search filter on id, product_id, name, description, and ai_title
      // For ID field, use exact match for performance; for text fields use pattern matching
      if (filters.search) {
        // Check if search looks like a UUID (8-4-4-4-12 format with hyphens or 32 hex chars)
        const isUuidFormat = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(filters.search)

        if (isUuidFormat) {
          // Remove hyphens for comparison (id column stores text without hyphens)
          const cleanedId = filters.search.replace(/-/g, '')
          // Use exact match for ID (much faster than ilike)
          query = query.or(
            `id.eq.${cleanedId},product_id.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,ai_title.ilike.%${filters.search}%`
          )
        } else {
          // Use pattern matching for text search only
          query = query.or(
            `product_id.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,ai_title.ilike.%${filters.search}%`
          )
        }
      }

      // Apply vendor filter
      if (filters.vendor) {
        query = query.eq('vendor', filters.vendor)
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      // Apply dynamic filters
      if (filters.dynamicFilters && filters.dynamicFilters.length > 0) {
        filters.dynamicFilters.forEach((filter) => {
          const { field, operator, value } = filter

          switch (operator) {
            case '=':
              query = query.eq(field, value)
              break
            case '≠':
              query = query.neq(field, value)
              break
            case '>':
              query = query.gt(field, value)
              break
            case '<':
              query = query.lt(field, value)
              break
            case '>=':
              query = query.gte(field, value)
              break
            case '<=':
              query = query.lte(field, value)
              break
            case 'contains':
              query = query.ilike(field, `%${value}%`)
              break
            case 'starts with':
              query = query.ilike(field, `${value}%`)
              break
            case 'ends with':
              query = query.ilike(field, `%${value}`)
              break
            case 'is null':
              query = query.is(field, null)
              break
            case 'is not null':
              query = query.not(field, 'is', null)
              break
          }
        })
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      // Process products and calculate sync_status from pending_products join
      const productsWithSyncStatus = (data || []).map((product: any) => {
        const pending = product.pending_products?.[0] || product.pending_products

        let sync_status: 'synced' | 'failed' | 'pending' = 'pending'
        if (pending) {
          if (pending.erpnext_updated_at && (!pending.failed_sync_at || new Date(pending.failed_sync_at) < new Date(pending.erpnext_updated_at))) {
            sync_status = 'synced'
          } else if (pending.failed_sync_at && (!pending.erpnext_updated_at || new Date(pending.failed_sync_at) > new Date(pending.erpnext_updated_at))) {
            sync_status = 'failed'
          }
        }

        // Remove the nested pending_products object and flatten the data
        const { pending_products, ...productData } = product

        return {
          ...productData,
          sync_status,
          item_code: pending?.item_code,
          failed_sync_error_message: pending?.failed_sync_error_message,
          validation_error: pending?.validation_error,
        } as ScrapedProduct
      })

      // When no products are returned, use 0 as count (planned count estimate can be inaccurate for filtered queries)
      const actualCount = productsWithSyncStatus.length === 0 ? 0 : (count || 0)

      return {
        products: productsWithSyncStatus,
        count: actualCount,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get products with validation errors
   * Uses RPC function to filter products where validation_error IS NOT NULL
   */
  async getProductsWithValidationErrors(filters: ProductFilters = {}) {
    try {
      const limit = filters.limit || 20
      const offset = filters.offset || 0
      const sortBy = filters.sortBy || 'updated_at'
      const sortOrder = filters.sortOrder || 'desc'

      // Get vendor from dynamic filters if present
      let vendor: string | null = filters.vendor || null
      if (!vendor && filters.dynamicFilters) {
        const vendorFilter = filters.dynamicFilters.find(f => f.field === 'vendor')
        if (vendorFilter && vendorFilter.value && vendorFilter.value !== 'all') {
          vendor = vendorFilter.value
        }
      }

      const { data, error } = await supabase.rpc('get_products_with_validation_errors', {
        p_limit: limit,
        p_offset: offset,
        p_ascending: sortOrder === 'asc',
        p_search: filters.search || null,
        p_vendor: vendor,
        p_sort_by: sortBy,
      })

      if (error) throw error

      const products = (data || []).map((product: any) => {
        // Calculate sync_status from timestamps
        let sync_status: 'synced' | 'failed' | 'pending' = 'pending'
        if (product.erpnext_updated_at && (!product.failed_sync_at || new Date(product.failed_sync_at) < new Date(product.erpnext_updated_at))) {
          sync_status = 'synced'
        } else if (product.failed_sync_at && (!product.erpnext_updated_at || new Date(product.failed_sync_at) > new Date(product.erpnext_updated_at))) {
          sync_status = 'failed'
        }

        const { total_count, ...productData } = product
        return {
          ...productData,
          sync_status,
        } as ScrapedProduct
      })

      const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0

      return {
        products,
        count: totalCount,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get single product by ID
   */
  async getProductById(id: string) {
    try {
      const { data, error } = await supabase
        .from('scraped_products')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      return {
        product: data as ScrapedProduct,
        error: null,
      }
    } catch (error) {
      return {
        product: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get pending products (products being processed by agents)
   */
  async getPendingProducts(filters: ProductFilters = {}) {
    try {
      let query = supabase
        .from('pending_products')
        .select('*', { count: 'exact' })

      if (filters.vendor) {
        query = query.eq('vendor', filters.vendor)
      }

      // Filter by agent status
      if (filters.status) {
        query = query.or(
          `category_status.eq.${filters.status},weight_and_dimension_status.eq.${filters.status},seo_status.eq.${filters.status}`
        )
      }

      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        products: data as PendingProduct[],
        count: count || 0,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get product with all agent data
   */
  async getProductWithAgentData(productId: string) {
    try {
      // Get base product
      const { data: product, error: productError } = await supabase
        .from('scraped_products')
        .select('*')
        .eq('id', productId)
        .single()

      if (productError) throw productError

      // Get pending product (agent data)
      const { data: pendingProduct } = await supabase
        .from('pending_products')
        .select('*')
        .eq('scraped_product_id', productId)
        .single()

      // Parse numeric string fields from pending_products
      const parsedPendingProduct = pendingProduct ? {
        ...pendingProduct,
        // Weight & Dimension - parse string values to numbers
        weight_value: pendingProduct.weight ? parseFloat(pendingProduct.weight) : null,
        width_value: pendingProduct.width ? parseFloat(pendingProduct.width) : null,
        height_value: pendingProduct.height ? parseFloat(pendingProduct.height) : null,
        length_value: pendingProduct.length ? parseFloat(pendingProduct.length) : null,
        content_weight: pendingProduct.contentWeight ? parseFloat(pendingProduct.contentWeight) : null,
        packaging_weight: pendingProduct.packagingWeight ? parseFloat(pendingProduct.packagingWeight) : null,
        volumetric_weight: pendingProduct.volumetric_weight ? parseFloat(pendingProduct.volumetric_weight) : null,

        // Confidence values
        weight_confidence: pendingProduct.weight_confidence ? parseFloat(pendingProduct.weight_confidence) : null,
        dimension_confidence: pendingProduct.dimension_confidence ? parseFloat(pendingProduct.dimension_confidence) : null,
        category_confidence: pendingProduct.category_confidence ? parseFloat(pendingProduct.category_confidence) : null,
        seo_confidence: pendingProduct.seo_confidence ? parseFloat(pendingProduct.seo_confidence) : null,

        // Costs
        weight_cost: pendingProduct.weight_cost ? parseFloat(pendingProduct.weight_cost) : null,
        category_cost: pendingProduct.category_cost ? parseFloat(pendingProduct.category_cost) : null,
        seo_cost: pendingProduct.seo_cost ? parseFloat(pendingProduct.seo_cost) : null,

        // Other numeric fields
        density: pendingProduct.density ? parseFloat(pendingProduct.density) : null,
        item_count: pendingProduct.itemCount ? parseInt(pendingProduct.itemCount, 10) : null,

        // Rename camelCase fields to snake_case for consistency
        material_type: pendingProduct.materialType,
        item_type: pendingProduct.itemType,
        container_type: pendingProduct.containerType,
        internet_sources: pendingProduct.internetSources,
        weight_reasoning: pendingProduct.weight_reason,
        weight_tools_used: pendingProduct.weightTools,
        dimension_reasoning: pendingProduct.dimension_reason,
        dimension_tools_used: pendingProduct.dimensionToolsUsed,
        weight_dimension_error: null, // Add if you have error field
        category_mapped: pendingProduct.category,
      } : null

      // Combine data - exclude 'id' from pending product to avoid overwriting scraped_products.id
      const combinedProduct: ProductWithAgentData = parsedPendingProduct
        ? {
            ...product,
            ...Object.fromEntries(
              Object.entries(parsedPendingProduct).filter(([key]) => key !== 'id')
            ),
          }
        : product

      return {
        product: combinedProduct,
        error: null,
      }
    } catch (error) {
      return {
        product: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get vendors list from scraped_products with counts (optimized with RPC)
   */
  async getVendors() {
    try {
      // Use PostgreSQL's DISTINCT with COUNT via RPC for better performance
      const { data, error } = await supabase.rpc('get_distinct_vendors')

      if (error) {
        // Fallback to regular query if RPC doesn't exist
        console.warn('RPC get_distinct_vendors not found, using fallback query')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('scraped_products')
          .select('vendor')
          .not('vendor', 'is', null)
          .order('vendor', { ascending: true })

        if (fallbackError) throw fallbackError

        // Get unique vendors without counts
        const uniqueVendors = [...new Set(fallbackData.map((item) => item.vendor))]
          .filter(Boolean)
          .sort()
          .map((vendor) => ({ name: vendor, count: 0 }))

        return {
          vendors: uniqueVendors,
          error: null,
        }
      }

      // Transform data to include name and count
      const vendors = (data || [])
        .filter((row: any) => row.vendor)
        .map((row: any) => ({
          name: row.vendor,
          count: Number(row.product_count),
        }))

      return {
        vendors,
        error: null,
      }
    } catch (error) {
      return {
        vendors: [],
        error: error as Error,
      }
    }
  }
 

  /**
   * Update basic product fields (name, price, original_price, description, stock_status)
   * If ai_title or ai_description is set to null, also resets SEO status in pending_products
   */
  async updateBasicProductInfo(
    id: string,
    updates: {
      name?: string
      price?: number
      original_price?: number
      description?: string
      stock_status?: string
      main_image?: string
      ai_title?: string | null
      ai_description?: string | null
    }
  ) {
    try {
      // Separate AI fields from scraped_products updates
      const { ai_title, ai_description, ...scrapedProductUpdates } = updates

      // Check if we need to reset AI fields (when explicitly set to null)
      const shouldResetSeo = ai_title === null || ai_description === null

      // Update scraped_products table
      const { data, error } = await supabase
        .from('scraped_products')
        .update({
          ...scrapedProductUpdates,
          // Also clear AI fields in scraped_products if resetting
          ...(shouldResetSeo ? { ai_title: null, ai_description: null } : {}),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // If resetting AI fields, also update pending_products to trigger regeneration
      if (shouldResetSeo) {
        const { error: pendingError } = await supabase
          .from('pending_products')
          .update({
            ai_title: null,
            ai_description: null,
            seo_status: 'pending',
          })
          .eq('scraped_product_id', id)

        if (pendingError) {
          console.error('Error resetting SEO status in pending_products:', pendingError)
        }
      }

      return {
        success: true,
        product: data as ScrapedProduct,
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        product: null,
        error: error as Error,
      }
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(id: string) {
    try {
      const { error } = await supabase
        .from('scraped_products')
        .delete()
        .eq('id', id)

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Search products by URL
   */
  async searchByUrl(url: string) {
    try {
      const { data, error } = await supabase
        .from('scraped_products')
        .select('*')
        .eq('url', url)

      if (error) throw error

      return {
        products: data as ScrapedProduct[],
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        error: error as Error,
      }
    }
  }

  /**
   * Upload product image from external URL to Supabase Storage
   * Uses decodo-proxy to bypass CORS restrictions
   */
  async uploadProductImageFromUrl(
    imageUrl: string,
    productId: string
  ): Promise<{ success: boolean; url: string; error?: string }> {
    const logPrefix = '[Product Image Upload]'

    try {
      // Skip if already hosted on our infrastructure
      if (isHostedUrl(imageUrl)) {
        console.log(`${logPrefix} SKIP: Already hosted on Supabase`)
        return { success: true, url: imageUrl }
      }

      // Skip data URLs
      if (imageUrl.startsWith('data:')) {
        console.log(`${logPrefix} SKIP: Data URL`)
        return { success: true, url: imageUrl }
      }

      // Get Supabase URL for the edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      console.log(`${logPrefix} Fetching image via proxy: ${imageUrl}`)

      // Download the image via decodo-proxy (bypasses CORS)
      const proxyResponse = await fetch(`${supabaseUrl}/functions/v1/decodo-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url: imageUrl, proxy_image: true }),
      })

      if (!proxyResponse.ok) {
        console.error(`${logPrefix} Proxy returned ${proxyResponse.status}`)
        return { success: false, url: imageUrl, error: `Proxy error: ${proxyResponse.status}` }
      }

      const result = await proxyResponse.json()

      if (!result.success || !result.data) {
        console.error(`${logPrefix} Download failed: ${result.error || 'No image data returned'}`)
        return { success: false, url: imageUrl, error: result.error || 'No image data' }
      }

      const sizeKB = Math.round(result.size / 1024)
      const mimeType = result.mimeType || 'image/jpeg'

      console.log(`${logPrefix} Downloaded: ${sizeKB}KB, type: ${mimeType}`)

      // Validate mime type
      if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
        console.error(`${logPrefix} Invalid image type: ${mimeType}`)
        return { success: false, url: imageUrl, error: `Invalid image type: ${mimeType}` }
      }

      // Validate size
      if (result.size > MAX_IMAGE_SIZE) {
        console.error(`${logPrefix} Image too large: ${sizeKB}KB`)
        return { success: false, url: imageUrl, error: 'Image too large (>5MB)' }
      }

      // Convert base64 to blob
      const byteCharacters = atob(result.data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

      // Determine file extension
      const extMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
      }
      const fileExt = extMap[mimeType] || 'jpg'
      const fileName = `${productId}.${fileExt}`

      console.log(`${logPrefix} Uploading to Supabase: ${fileName}`)

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(fileName, blob, {
          cacheControl: '31536000', // 1 year cache
          upsert: true,
          contentType: mimeType,
        })

      if (uploadError) {
        console.error(`${logPrefix} Upload failed:`, uploadError.message)
        return { success: false, url: imageUrl, error: uploadError.message }
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(uploadData.path)

      console.log(`${logPrefix} Success: ${publicUrl}`)
      return { success: true, url: publicUrl }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`${logPrefix} Error:`, errorMsg)
      return { success: false, url: imageUrl, error: errorMsg }
    }
  }

  /**
   * Toggle pin status of a product
   */
  async togglePinProduct(id: string, pinned: boolean) {
    try {
      // Perform the update without requesting the response data
      const { error: updateError } = await supabase
        .from('scraped_products')
        .update({ pinned })
        .eq('id', id)

      if (updateError) throw updateError

      // Return success without fetching the updated product
      // The caller will update the local state
      return {
        success: true,
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      }
    }
  }

  /**
   * Get all pinned products
   * Includes ERPNext sync status from pending_products table
   */
  async getPinnedProducts(filters: ProductFilters = {}) {
    try {
      const sortBy = filters.sortBy || 'updated_at'
      const sortOrder = filters.sortOrder || 'desc'

      // Use RPC function for erpnext_updated_at sorting (can't sort by joined table columns otherwise)
      if (sortBy === 'erpnext_updated_at') {
        const limit = filters.limit || 20
        const offset = filters.offset || 0

        const { data, error } = await supabase.rpc('get_products_sorted_by_erpnext_sync', {
          p_limit: limit,
          p_offset: offset,
          p_ascending: sortOrder === 'asc',
          p_search: filters.search || null,
          p_vendor: filters.vendor || null,
          p_pinned_only: true,
        })

        if (error) throw error

        const products = (data || []).map((product: any) => {
          let sync_status: 'synced' | 'failed' | 'pending' = 'pending'
          if (product.erpnext_updated_at && (!product.failed_sync_at || new Date(product.failed_sync_at) < new Date(product.erpnext_updated_at))) {
            sync_status = 'synced'
          } else if (product.failed_sync_at && (!product.erpnext_updated_at || new Date(product.failed_sync_at) > new Date(product.erpnext_updated_at))) {
            sync_status = 'failed'
          }

          const { total_count, ...productData } = product
          return {
            ...productData,
            sync_status,
          } as ScrapedProduct
        })

        const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0

        return {
          products,
          count: totalCount,
          error: null,
        }
      }

      // Use RPC function for failed_sync_at sorting (shows only products that failed to sync)
      if (sortBy === 'failed_sync_at') {
        const limit = filters.limit || 20
        const offset = filters.offset || 0

        const { data, error } = await supabase.rpc('get_products_sorted_by_failed_sync', {
          p_limit: limit,
          p_offset: offset,
          p_ascending: sortOrder === 'asc',
          p_search: filters.search || null,
          p_vendor: filters.vendor || null,
          p_pinned_only: true,
        })

        if (error) throw error

        const products = (data || []).map((product: any) => {
          const { total_count, ...productData } = product
          return {
            ...productData,
            sync_status: 'failed' as const,
          } as ScrapedProduct
        })

        const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0

        return {
          products,
          count: totalCount,
          error: null,
        }
      }

      // Regular query for other sort fields
      // Use 'planned' count for better performance
      let query = supabase
        .from('scraped_products')
        .select(`
          *,
          pending_products!pending_products_scraped_product_id_fkey (
            erpnext_updated_at,
            failed_sync_at,
            failed_sync_error_message,
            item_code,
            ai_title,
            validation_error
          )
        `, { count: 'planned' })
        .eq('pinned', true)

      // Apply search filter on id, product_id, name, description, and ai_title
      // For ID field, use exact match for performance; for text fields use pattern matching
      if (filters.search) {
        // Check if search looks like a UUID (8-4-4-4-12 format with hyphens or 32 hex chars)
        const isUuidFormat = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(filters.search)

        if (isUuidFormat) {
          // Remove hyphens for comparison (id column stores text without hyphens)
          const cleanedId = filters.search.replace(/-/g, '')
          // Use exact match for ID (much faster than ilike)
          query = query.or(
            `id.eq.${cleanedId},product_id.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,ai_title.ilike.%${filters.search}%`
          )
        } else {
          // Use pattern matching for text search only
          query = query.or(
            `product_id.ilike.%${filters.search}%,name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,ai_title.ilike.%${filters.search}%`
          )
        }
      }

      // Apply vendor filter
      if (filters.vendor) {
        query = query.eq('vendor', filters.vendor)
      }

      // Apply dynamic filters
      if (filters.dynamicFilters && filters.dynamicFilters.length > 0) {
        filters.dynamicFilters.forEach((filter) => {
          const { field, operator, value } = filter

          switch (operator) {
            case '=':
              query = query.eq(field, value)
              break
            case '≠':
              query = query.neq(field, value)
              break
            case '>':
              query = query.gt(field, value)
              break
            case '<':
              query = query.lt(field, value)
              break
            case '>=':
              query = query.gte(field, value)
              break
            case '<=':
              query = query.lte(field, value)
              break
            case 'contains':
              query = query.ilike(field, `%${value}%`)
              break
            case 'starts with':
              query = query.ilike(field, `${value}%`)
              break
            case 'ends with':
              query = query.ilike(field, `%${value}`)
              break
            case 'is null':
              query = query.is(field, null)
              break
            case 'is not null':
              query = query.not(field, 'is', null)
              break
          }
        })
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      // Process products and calculate sync_status from pending_products join
      const productsWithSyncStatus = (data || []).map((product: any) => {
        const pending = product.pending_products?.[0] || product.pending_products

        let sync_status: 'synced' | 'failed' | 'pending' = 'pending'
        if (pending) {
          if (pending.erpnext_updated_at && (!pending.failed_sync_at || new Date(pending.failed_sync_at) < new Date(pending.erpnext_updated_at))) {
            sync_status = 'synced'
          } else if (pending.failed_sync_at && (!pending.erpnext_updated_at || new Date(pending.failed_sync_at) > new Date(pending.erpnext_updated_at))) {
            sync_status = 'failed'
          }
        }

        // Remove the nested pending_products object and flatten the data
        const { pending_products, ...productData } = product

        return {
          ...productData,
          sync_status,
          item_code: pending?.item_code,
          failed_sync_error_message: pending?.failed_sync_error_message,
          validation_error: pending?.validation_error,
        } as ScrapedProduct
      })

      // When no products are returned, use 0 as count (planned count estimate can be inaccurate for filtered queries)
      const actualCount = productsWithSyncStatus.length === 0 ? 0 : (count || 0)

      return {
        products: productsWithSyncStatus,
        count: actualCount,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }
}

export const productsService = new ProductsService()
