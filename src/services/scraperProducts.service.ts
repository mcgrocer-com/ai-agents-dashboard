/**
 * Scraper Products Service
 *
 * Handles API calls for scraped products from Supabase.
 */

import { supabase } from '@/lib/supabase/client'
import type { FilterRule } from '@/components/filters/AdvancedFilterBuilder'
import type { VendorStatistics, AgentVendorStatistics } from '@/types/statistics'
import type { AgentType } from '@/services/agents.service'

export interface ScraperProduct {
  id: string
  name: string | null
  description: string | null
  price: number | null
  vendor: string | null
  stock_status: string | null
  main_image: string | null
  images: string[] | null
  url: string | null
  created_at: string
  updated_at: string | null
  // Agent-generated fields
  category: string | null
  breadcrumbs: any | null
  ai_title: string | null
  ai_description: string | null
  weight: number | null
  height: number | null
  width: number | null
  length: number | null
  volumetric_weight: number | null
}

export interface ScraperProductsFilters {
  filters: FilterRule[]
  limit?: number
  offset?: number
}

class ScraperProductsService {
  /**
   * Get scraped products with filters and pagination
   */
  async getScraperProducts(options: ScraperProductsFilters = { filters: [] }) {
    try {
      const { filters = [], limit = 20, offset = 0 } = options

      let query = supabase
        .from('scraped_products')
        .select('*', { count: 'exact' })

      // Apply filter rules
      for (const filter of filters) {
        const column = filter.column
        const value = filter.value

        switch (filter.operator) {
          case '=':
            query = query.eq(column, value)
            break
          case '≠':
            query = query.neq(column, value)
            break
          case '>':
            query = query.gt(column, value)
            break
          case '<':
            query = query.lt(column, value)
            break
          case '>=':
            query = query.gte(column, value)
            break
          case '<=':
            query = query.lte(column, value)
            break
          case 'contains':
            query = query.ilike(column, `%${value}%`)
            break
          case 'starts with':
            query = query.ilike(column, `${value}%`)
            break
          case 'ends with':
            query = query.ilike(column, `%${value}`)
            break
          case 'is null':
            query = query.is(column, null)
            break
          case 'is not null':
            query = query.not(column, 'is', null)
            break
        }
      }

      // Default sorting
      query = query.order('created_at', { ascending: false })

      // Pagination
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        products: data as ScraperProduct[],
        count: count || 0,
        error: null,
      }
    } catch (error) {
      console.error('Error fetching scraper products:', error)
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get available columns for filter builder
   */
  getAvailableColumns() {
    return [
      // Basic product fields
      { label: 'ID', value: 'id', type: 'text' as const },
      { label: 'Name', value: 'name', type: 'text' as const },
      { label: 'Description', value: 'description', type: 'text' as const },
      { label: 'Price', value: 'price', type: 'number' as const },
      { label: 'Vendor', value: 'vendor', type: 'text' as const },
      { label: 'Stock Status', value: 'stock_status', type: 'text' as const },

      // Category Agent fields
      { label: 'Category', value: 'category', type: 'text' as const },

      // SEO Agent fields
      { label: 'AI Title', value: 'ai_title', type: 'text' as const },
      { label: 'AI Description', value: 'ai_description', type: 'text' as const },

      // Weight & Dimension Agent fields
      { label: 'Weight (kg)', value: 'weight', type: 'number' as const },
      { label: 'Height (cm)', value: 'height', type: 'number' as const },
      { label: 'Width (cm)', value: 'width', type: 'number' as const },
      { label: 'Length (cm)', value: 'length', type: 'number' as const },
      { label: 'Volumetric Weight (kg)', value: 'volumetric_weight', type: 'number' as const },
    ]
  }

  /**
   * Get unique vendors from scraped products
   */
  async getVendors() {
    try {
      const { data, error } = await supabase
        .from('scraped_products')
        .select('vendor')
        .not('vendor', 'is', null)
        .order('vendor')

      if (error) throw error

      // Get unique vendors
      const vendors = [...new Set(data?.map((item) => item.vendor).filter(Boolean))]
      return vendors as string[]
    } catch (error) {
      console.error('Error fetching vendors:', error)
      return []
    }
  }

  /**
   * Get unique stock statuses
   */
  async getStockStatuses() {
    try {
      const { data, error } = await supabase
        .from('scraped_products')
        .select('stock_status')
        .not('stock_status', 'is', null)
        .order('stock_status')

      if (error) throw error

      // Get unique stock statuses
      const statuses = [...new Set(data?.map((item) => item.stock_status).filter(Boolean))]
      return statuses as string[]
    } catch (error) {
      console.error('Error fetching stock statuses:', error)
      return []
    }
  }

  /**
   * Get vendor-specific statistics from pending_products table
   */
  async getVendorStatistics(vendor: string): Promise<VendorStatistics | null> {
    try {
      // Use RPC function for efficient server-side aggregation
      const { data, error } = await supabase.rpc('get_vendor_statistics', {
        vendor_name: vendor,
      })
      if (error) {
        return {
          totalProducts: 0,
          withCategoryAndWeight: 0,
          withAllData: 0,
          syncedToErpNext: 0,
          failedToSync: 0,
        }
      }

      // The RPC function returns a JSON object with our statistics
      if (data && typeof data === 'object') {
        return {
          totalProducts: data.totalProducts || 0,
          withCategoryAndWeight: data.withCategoryAndWeight || 0,
          withAllData: data.withAllData || 0,
          syncedToErpNext: data.syncedToErpNext || 0,
          failedToSync: data.failedToSync || 0,
        }
      }

      return data as VendorStatistics
    } catch (error) {
      console.error('Error fetching vendor statistics:', error)
      return null
    }
  }

  /**
   * Get agent-specific vendor statistics from pending_products table
   */
  async getAgentVendorStatistics(agentType: AgentType, vendor: string): Promise<AgentVendorStatistics | null> {
    try {
      // Use RPC function for efficient server-side aggregation
      const { data, error } = await supabase.rpc('get_agent_vendor_statistics', {
        agent_type: agentType,
        vendor_filter: vendor,
      })

      if (error) {
        console.error('Error calling get_agent_vendor_statistics:', error)
        return {
          totalProducts: 0,
          pending: 0,
          processing: 0,
          complete: 0,
          failed: 0,
        }
      }

      // The RPC function returns a JSON object with our statistics
      if (data && typeof data === 'object') {
        return {
          totalProducts: data.totalProducts || 0,
          pending: data.pending || 0,
          processing: data.processing || 0,
          complete: data.complete || 0,
          failed: data.failed || 0,
        }
      }

      return data as AgentVendorStatistics
    } catch (error) {
      console.error('Error fetching agent vendor statistics:', error)
      return null
    }
  }
}

export const scraperProductsService = new ScraperProductsService()
