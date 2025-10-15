/**
 * Real-time Subscription Service
 *
 * Handles Supabase real-time subscriptions for live updates.
 */

import { supabase } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ChangeEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface ChangePayload<T> {
  eventType: ChangeEventType
  new: T
  old: T
  schema: string
  table: string
}

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map()

  /**
   * Subscribe to table changes
   */
  subscribeToTable<T>(
    tableName: string,
    callback: (payload: ChangePayload<T>) => void,
    filter?: { column: string; value: any }
  ): RealtimeChannel {
    // Create unique channel ID
    const channelId = filter
      ? `${tableName}-${filter.column}-${filter.value}`
      : tableName

    // Return existing channel if already subscribed
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!
    }

    // Create new subscription
    let channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as ChangeEventType,
            new: payload.new as T,
            old: payload.old as T,
            schema: payload.schema,
            table: payload.table,
          })
        }
      )
      .subscribe()

    this.channels.set(channelId, channel)
    return channel
  }

  /**
   * Subscribe to pending products changes
   */
  subscribeToPendingProducts(
    callback: (payload: ChangePayload<any>) => void,
    vendor?: string
  ) {
    return this.subscribeToTable(
      'pending_products',
      callback,
      vendor ? { column: 'vendor', value: vendor } : undefined
    )
  }

  /**
   * Subscribe to scraped products changes
   */
  subscribeToScrapedProducts(
    callback: (payload: ChangePayload<any>) => void,
    vendor?: string
  ) {
    return this.subscribeToTable(
      'scraped_products',
      callback,
      vendor ? { column: 'vendor', value: vendor } : undefined
    )
  }

  /**
   * Subscribe to agent processing summaries
   */
  subscribeToProcessingSummaries(
    callback: (payload: ChangePayload<any>) => void
  ) {
    return this.subscribeToTable('agent_processing_summary', callback)
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelId: string) {
    const channel = this.channels.get(channelId)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelId)
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()
  }

  /**
   * Get channel by ID
   */
  getChannel(channelId: string): RealtimeChannel | undefined {
    return this.channels.get(channelId)
  }

  /**
   * Get all active channels
   */
  getAllChannels(): RealtimeChannel[] {
    return Array.from(this.channels.values())
  }

  /**
   * Subscribe to multiple events on a single table
   */
  subscribeToMultipleEvents<T>(
    tableName: string,
    callbacks: {
      onInsert?: (data: T) => void
      onUpdate?: (data: T) => void
      onDelete?: (data: T) => void
    },
    filter?: { column: string; value: any }
  ) {
    return this.subscribeToTable<T>(
      tableName,
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onInsert?.(payload.new)
            break
          case 'UPDATE':
            callbacks.onUpdate?.(payload.new)
            break
          case 'DELETE':
            callbacks.onDelete?.(payload.old)
            break
        }
      },
      filter
    )
  }
}

export const realtimeService = new RealtimeService()
