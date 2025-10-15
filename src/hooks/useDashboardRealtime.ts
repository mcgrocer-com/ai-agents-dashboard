/**
 * useDashboardRealtime Hook
 *
 * Optimized realtime updates for dashboard metrics and agent data.
 * Uses SWR for caching and Supabase realtime for live updates.
 */

import { useEffect } from 'react'
import { mutate } from 'swr'
import { supabase } from '@/lib/supabase/client'

/**
 * Subscribe to pending_products changes and trigger SWR revalidation
 * This ensures all dashboard components stay in sync with minimal queries
 */
export function useDashboardRealtime() {
  useEffect(() => {
    // Subscribe to pending_products table changes
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_products',
        },
        (payload) => {
          console.log('Dashboard realtime update:', payload.eventType)
          
          // Revalidate all dashboard-related SWR caches
          mutate('dashboard-metrics')
          mutate('agent-metrics')
          mutate(
            (key) => typeof key === 'string' && key.startsWith('pending-products-'),
            undefined,
            { revalidate: true }
          )
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

/**
 * Subscribe to agent-specific realtime updates
 * Optimized for individual agent pages
 */
export function useAgentRealtime(agentType: 'category' | 'weight_dimension' | 'seo') {
  useEffect(() => {
    const statusField =
      agentType === 'category'
        ? 'category_status'
        : agentType === 'weight_dimension'
        ? 'weight_and_dimension_status'
        : 'seo_status'

    // Subscribe to changes for this specific agent
    const channel = supabase
      .channel(`agent-${agentType}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_products',
          filter: `${statusField}=neq.pending`,
        },
        (payload) => {
          console.log(`${agentType} agent realtime update:`, payload.eventType)
          
          // Revalidate agent-specific caches
          mutate('agent-metrics')
          mutate(`pending-products-${agentType}`)
          mutate(
            (key) =>
              typeof key === 'string' &&
              (key.startsWith(`pending-products-${agentType}`) ||
                key.startsWith('dashboard-metrics')),
            undefined,
            { revalidate: true }
          )
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentType])
}

/**
 * Subscribe to recent activity updates
 * Optimized for RecentActivity component
 *
 * @param onUpdate - Callback function to trigger when updates occur
 */
export function useRecentActivityRealtime(onUpdate?: () => void) {
  useEffect(() => {
    // Subscribe to all status changes (processing, complete, failed)
    const channel = supabase
      .channel('recent-activity-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_products',
        },
        (payload) => {
          console.log('Recent activity realtime update:', payload.eventType)

          // Call the callback if provided (for direct state updates)
          if (onUpdate) {
            onUpdate()
          }

          // Also revalidate SWR caches (for future SWR-based implementations)
          mutate(
            (key) => typeof key === 'string' && key.startsWith('recent-activity'),
            undefined,
            { revalidate: true }
          )
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [onUpdate])
}

