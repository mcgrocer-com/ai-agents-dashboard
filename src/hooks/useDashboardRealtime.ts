/**
 * useDashboardRealtime Hook
 *
 * Optimized realtime updates for dashboard metrics and agent data.
 * Uses SWR for caching and Supabase realtime for live updates.
 * Throttles revalidation to prevent query storms during rapid updates.
 */

import { useEffect, useRef, useCallback } from 'react'
import { mutate } from 'swr'
import { supabase } from '@/lib/supabase/client'

/** Minimum interval (ms) between revalidation triggers */
const THROTTLE_MS = 5000

/**
 * Returns a throttled version of the callback that fires at most once per interval.
 * Trailing calls are coalesced: if called during the cooldown, one final call
 * fires when the cooldown expires.
 */
function useThrottledCallback(callback: () => void, intervalMs: number) {
  const lastRun = useRef(0)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastRun.current

    if (elapsed >= intervalMs) {
      lastRun.current = now
      callbackRef.current()
    } else if (!pending.current) {
      // Schedule a trailing call
      pending.current = setTimeout(() => {
        lastRun.current = Date.now()
        pending.current = null
        callbackRef.current()
      }, intervalMs - elapsed)
    }
  }, [intervalMs])
}

/**
 * Subscribe to pending_products changes and trigger SWR revalidation
 * This ensures all dashboard components stay in sync with minimal queries
 */
export function useDashboardRealtime() {
  const throttledRevalidate = useThrottledCallback(() => {
    mutate('dashboard-metrics')
    mutate('agent-metrics')
    mutate(
      (key) => typeof key === 'string' && key.startsWith('pending-products-'),
      undefined,
      { revalidate: true }
    )
  }, THROTTLE_MS)

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
        () => {
          throttledRevalidate()
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [throttledRevalidate])
}

/**
 * Subscribe to agent-specific realtime updates
 * Optimized for individual agent pages
 */
export function useAgentRealtime(agentType: 'category' | 'weight_dimension' | 'seo' | 'faq') {
  const throttledRevalidate = useThrottledCallback(() => {
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
  }, THROTTLE_MS)

  useEffect(() => {
    const statusFieldMap: Record<string, string> = {
      category: 'category_status',
      weight_dimension: 'weight_and_dimension_status',
      seo: 'seo_status',
      faq: 'faq_status',
    }
    const statusField = statusFieldMap[agentType]

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
        () => {
          throttledRevalidate()
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [agentType, throttledRevalidate])
}

/**
 * Subscribe to recent activity updates
 * Optimized for RecentActivity component
 *
 * @param onUpdate - Callback function to trigger when updates occur
 */
export function useRecentActivityRealtime(onUpdate?: () => void) {
  const throttledUpdate = useThrottledCallback(() => {
    if (onUpdate) {
      onUpdate()
    }
    mutate(
      (key) => typeof key === 'string' && key.startsWith('recent-activity'),
      undefined,
      { revalidate: true }
    )
  }, THROTTLE_MS)

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
        () => {
          throttledUpdate()
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [throttledUpdate])
}
