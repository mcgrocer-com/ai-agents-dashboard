/**
 * useMariaDBProducts Hook
 *
 * Custom hook for fetching MCGrocer products from MariaDB via Next.js API proxy.
 */

import { useState, useEffect } from 'react'
import { mariadbProductsService, type MariaDBProduct } from '@/services/mariadbProducts.service'
import type { FilterRule } from '@/components/filters/AdvancedFilterBuilder'

interface UseMariaDBProductsOptions {
  filters: FilterRule[]
  page: number
  pageSize: number
  searchTerm?: string
}

interface UseMariaDBProductsReturn {
  products: MariaDBProduct[]
  count: number
  isLoading: boolean
  error: Error | null
}

export function useMariaDBProducts({
  filters,
  page,
  pageSize,
  searchTerm = '',
}: UseMariaDBProductsOptions): UseMariaDBProductsReturn {
  const [products, setProducts] = useState<MariaDBProduct[]>([])
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
        const result = await mariadbProductsService.getProducts({
          filters,
          limit: pageSize,
          offset,
          searchTerm,
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
  }, [filters, page, pageSize, searchTerm])

  return { products, count, isLoading, error }
}
