/**
 * useScraperProducts Hook
 *
 * Custom hook for fetching scraped products from Supabase with filters and pagination.
 */

import { useState, useEffect } from 'react'
import { scraperProductsService, type ScraperProduct } from '@/services/scraperProducts.service'
import type { FilterRule } from '@/components/filters/AdvancedFilterBuilder'

interface UseScraperProductsOptions {
  filters: FilterRule[]
  page: number
  pageSize: number
}

interface UseScraperProductsReturn {
  products: ScraperProduct[]
  count: number
  isLoading: boolean
  error: Error | null
}

export function useScraperProducts({
  filters,
  page,
  pageSize,
}: UseScraperProductsOptions): UseScraperProductsReturn {
  const [products, setProducts] = useState<ScraperProduct[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchProducts = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const offset = (page - 1) * pageSize
        const result = await scraperProductsService.getScraperProducts({
          filters,
          limit: pageSize,
          offset,
        })

        if (isMounted) {
          if (result.error) {
            setError(result.error)
          } else {
            setProducts(result.products)
            setCount(result.count)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchProducts()

    return () => {
      isMounted = false
    }
  }, [filters, page, pageSize])

  return { products, count, isLoading, error }
}

/**
 * useScraperVendors Hook
 *
 * Custom hook for fetching unique vendors from scraped products.
 */
export function useScraperVendors() {
  const [vendors, setVendors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchVendors = async () => {
      const result = await scraperProductsService.getVendors()
      if (isMounted) {
        setVendors(result)
        setIsLoading(false)
      }
    }

    fetchVendors()

    return () => {
      isMounted = false
    }
  }, [])

  return { vendors, isLoading }
}

/**
 * useStockStatuses Hook
 *
 * Custom hook for fetching unique stock statuses.
 */
export function useStockStatuses() {
  const [statuses, setStatuses] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const fetchStatuses = async () => {
      const result = await scraperProductsService.getStockStatuses()
      if (isMounted) {
        setStatuses(result)
        setIsLoading(false)
      }
    }

    fetchStatuses()

    return () => {
      isMounted = false
    }
  }, [])

  return { statuses, isLoading }
}
