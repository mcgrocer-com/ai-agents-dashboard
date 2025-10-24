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

class ProductsService {
  /**
   * Get products with filters and pagination
   * Includes ERPNext sync status from pending_products table
   */
  async getProducts(filters: ProductFilters = {}) {
    try {
      // Join with pending_products to get sync status
      // Use 'planned' count for better performance with large datasets (estimates count from query planner)
      let query = supabase
        .from('scraped_products')
        .select(`
          *,
          pending_products!pending_products_scraped_product_id_fkey (
            erpnext_updated_at,
            failed_sync_at,
            failed_sync_error_message,
            item_code
          )
        `, { count: 'planned' })

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        )
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
      const sortBy = filters.sortBy || 'updated_at'
      const sortOrder = filters.sortOrder || 'desc'
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
        } as ScrapedProduct
      })

      return {
        products: productsWithSyncStatus,
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
   */
  async updateBasicProductInfo(
    id: string,
    updates: {
      name?: string
      price?: number
      original_price?: number
      description?: string
      stock_status?: string
    }
  ) {
    try {
      const { data, error } = await supabase
        .from('scraped_products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

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
      // Use 'planned' count for better performance
      let query = supabase
        .from('scraped_products')
        .select(`
          *,
          pending_products!pending_products_scraped_product_id_fkey (
            erpnext_updated_at,
            failed_sync_at,
            failed_sync_error_message,
            item_code
          )
        `, { count: 'planned' })
        .eq('pinned', true)

      // Apply search filter
      if (filters.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        )
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
      const sortBy = filters.sortBy || 'updated_at'
      const sortOrder = filters.sortOrder || 'desc'
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
        } as ScrapedProduct
      })

      return {
        products: productsWithSyncStatus,
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
}

export const productsService = new ProductsService()
