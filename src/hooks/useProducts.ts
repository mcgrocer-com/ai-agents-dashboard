/**
 * useProducts Hook
 *
 * Hook for fetching and managing products with SWR.
 */

import useSWR from 'swr'
import { productsService } from '@/services'
import type { ProductFilters } from '@/types'

interface UseProductsOptions extends ProductFilters {
  refreshInterval?: number
}

export function useProducts(options: UseProductsOptions = {}) {
  const { refreshInterval = 0, ...filters } = options

  const { data, error, isLoading, mutate } = useSWR(
    ['products', JSON.stringify(filters)],
    () => productsService.getProducts(filters),
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  )

  return {
    products: data?.products || [],
    count: data?.count || 0,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useProduct(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? ['product', id] : null,
    () => (id ? productsService.getProductById(id) : null),
    {
      revalidateOnFocus: false,
    }
  )

  return {
    product: data?.product || null,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function usePendingProducts(options: UseProductsOptions = {}) {
  const { refreshInterval = 5000, ...filters } = options

  const { data, error, isLoading, mutate } = useSWR(
    ['pending-products', JSON.stringify(filters)],
    () => productsService.getPendingProducts(filters),
    {
      refreshInterval,
      revalidateOnFocus: true,
    }
  )

  return {
    products: data?.products || [],
    count: data?.count || 0,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useVendors() {
  const { data, error, isLoading } = useSWR(
    'vendors',
    () => productsService.getVendors(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )

  return {
    vendors: data?.vendors || [],
    isLoading,
    error: data?.error || error,
  }
}
