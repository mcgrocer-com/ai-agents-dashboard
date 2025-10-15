/**
 * useRealtime Hook
 *
 * Hook for managing real-time subscriptions.
 */

import { useEffect } from 'react'
import { realtimeService } from '@/services'
import type { ChangePayload } from '@/services'

interface UseRealtimeOptions<T> {
  tableName: string
  onInsert?: (data: T) => void
  onUpdate?: (data: T) => void
  onDelete?: (data: T) => void
  filter?: { column: string; value: any }
}

export function useRealtime<T>({
  tableName,
  onInsert,
  onUpdate,
  onDelete,
  filter,
}: UseRealtimeOptions<T>) {
  useEffect(() => {
    realtimeService.subscribeToMultipleEvents<T>(
      tableName,
      {
        onInsert,
        onUpdate,
        onDelete,
      },
      filter
    )

    // Cleanup on unmount
    return () => {
      const channelId = filter
        ? `${tableName}-${filter.column}-${filter.value}`
        : tableName
      realtimeService.unsubscribe(channelId)
    }
  }, [tableName, onInsert, onUpdate, onDelete, filter])
}

export function usePendingProductsRealtime(
  onUpdate: (data: any) => void,
  vendor?: string
) {
  useEffect(() => {
    realtimeService.subscribeToPendingProducts(
      (payload: ChangePayload<any>) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          onUpdate(payload.new)
        }
      },
      vendor
    )

    return () => {
      const channelId = vendor
        ? `pending_products-vendor-${vendor}`
        : 'pending_products'
      realtimeService.unsubscribe(channelId)
    }
  }, [onUpdate, vendor])
}

export function useScrapedProductsRealtime(
  onUpdate: (data: any) => void,
  vendor?: string
) {
  useEffect(() => {
    realtimeService.subscribeToScrapedProducts(
      (payload: ChangePayload<any>) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          onUpdate(payload.new)
        }
      },
      vendor
    )

    return () => {
      const channelId = vendor
        ? `scraped_products-vendor-${vendor}`
        : 'scraped_products'
      realtimeService.unsubscribe(channelId)
    }
  }, [onUpdate, vendor])
}
