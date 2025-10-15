/**
 * useStats Hook
 *
 * Hook for fetching dashboard statistics and metrics.
 */

import useSWR from 'swr'
import { statsService } from '@/services'

export function useDashboardMetrics() {
  const { data, error, isLoading, mutate } = useSWR(
    'dashboard-metrics',
    () => statsService.getDashboardMetrics(),
    {
      revalidateOnFocus: false, // Realtime handles updates
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Prevent duplicate requests within 2s
    }
  )

  return {
    metrics: data?.metrics || null,
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useVendorStats(refreshInterval = 30000) {
  const { data, error, isLoading, mutate } = useSWR(
    'vendor-stats',
    () => statsService.getVendorStats(),
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  )

  return {
    stats: data?.stats || [],
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useRecentActivity(limit = 20, refreshInterval = 5000) {
  const { data, error, isLoading, mutate } = useSWR(
    ['recent-activity', limit],
    () => statsService.getRecentActivity(limit),
    {
      refreshInterval,
      revalidateOnFocus: true,
    }
  )

  return {
    activities: data?.activities || [],
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}

export function useProductsByStatus(
  status: string,
  agentType?: 'category' | 'weight_dimension' | 'seo',
  limit = 20
) {
  const { data, error, isLoading, mutate } = useSWR(
    ['products-by-status', status, agentType, limit],
    () => statsService.getProductsByStatus(status, agentType, limit),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  )

  return {
    products: data?.products || [],
    isLoading,
    error: data?.error || error,
    refresh: mutate,
  }
}
