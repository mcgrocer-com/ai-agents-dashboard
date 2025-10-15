/**
 * MariaDB Products Service
 *
 * Handles API calls for MCGrocer products from MariaDB via Next.js API proxy.
 */

import type { FilterRule } from '@/components/filters/AdvancedFilterBuilder'

export interface MariaDBProduct {
  itemCode: string
  itemName: string | null
  description: string | null
  itemGroup: string | null
  breadcrumb: string[] | null
  brand: string | null
  modified: string | null
  productUrl: string | null
}

export interface MariaDBProductsFilters {
  filters: FilterRule[]
  limit?: number
  offset?: number
  searchTerm?: string
}

class MariaDBProductsService {
  private baseUrl = 'http://localhost:3000/api/erpnext/products'

  /**
   * Get MCGrocer products from MariaDB via Next.js API
   */
  async getProducts(options: MariaDBProductsFilters = { filters: [] }) {
    try {
      const { limit = 20, offset = 0, searchTerm = '' } = options

      const page = Math.floor(offset / limit) + 1
      const url = new URL(this.baseUrl)
      url.searchParams.set('page', page.toString())
      url.searchParams.set('limit', limit.toString())
      if (searchTerm) {
        url.searchParams.set('search', searchTerm)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch products')
      }

      return {
        products: data.data as MariaDBProduct[],
        count: data.pagination.total,
        error: null,
      }
    } catch (error) {
      console.error('Error fetching MariaDB products:', error)
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
      { label: 'Item Code', value: 'itemCode', type: 'text' as const },
      { label: 'Item Name', value: 'itemName', type: 'text' as const },
      { label: 'Description', value: 'description', type: 'text' as const },
      { label: 'Item Group', value: 'itemGroup', type: 'text' as const },
      { label: 'Brand', value: 'brand', type: 'text' as const },
    ]
  }
}

export const mariadbProductsService = new MariaDBProductsService()
