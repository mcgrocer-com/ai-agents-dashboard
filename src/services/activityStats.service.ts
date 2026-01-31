/**
 * Activity statistics and vendor data fetching utilities
 */

import { supabase } from '@/lib/supabase/client'

export type AgentFilter = 'category' | 'weight_dimension' | 'seo' | 'copyright' | 'faq'

export interface ActivityStats {
  today: number
  thisWeek: number
  thisMonth: number
  lastMonth: number
}

class ActivityStatsService {
  /**
   * Get aggregated activity statistics for complete products
   * @param agentFilters - Array of agent types to filter by
   * @param vendorFilter - Optional vendor name to filter by
   * @returns Activity counts for today, this month, and last month
   */
  async getCompleteActivityStats(
    agentFilters: AgentFilter[],
    vendorFilter?: string
  ): Promise<ActivityStats> {
    try {
      // Call the RPC function with filters
      const { data, error } = await supabase.rpc('get_activity_stats', {
        agent_filters: agentFilters,
        vendor_filter: vendorFilter || null,
      })

      if (error) {
        console.error('Error fetching activity stats:', error)
        return { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0 }
      }

      if (!data || data.length === 0) {
        return { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0 }
      }

      // Parse the RPC response
      const stats = data[0]
      return {
        today: stats.today_count || 0,
        thisWeek: stats.this_week_count || 0,
        thisMonth: stats.this_month_count || 0,
        lastMonth: stats.last_month_count || 0,
      }
    } catch (err) {
      console.error('Exception fetching activity stats:', err)
      return { today: 0, thisWeek: 0, thisMonth: 0, lastMonth: 0 }
    }
  }

  /**
   * Get list of vendors with product counts
   * @param agentFilters - Array of agent types to filter by
   * @returns Array of vendors with their product counts
   */
  async getVendors(
    agentFilters: AgentFilter[]
  ): Promise<Array<{ vendor: string; count: number }>> {
    try {
      // Call the RPC function to get vendors
      const { data, error } = await supabase.rpc('get_vendors_by_agent', {
        agent_filters: agentFilters,
      })

      if (error) {
        console.error('Error fetching vendors:', error)
        return []
      }

      if (!data || data.length === 0) {
        return []
      }

      // Transform the response
      return data.map((item: any) => ({
        vendor: item.vendor || '',
        count: item.product_count || 0,
      }))
    } catch (err) {
      console.error('Exception fetching vendors:', err)
      return []
    }
  }

  /**
   * Get recent products by vendor with agent filtering
   * @param vendorFilter - Optional vendor name to filter by
   * @param agentFilters - Array of agent types to filter by
   * @param rowLimit - Maximum number of rows to return
   */
  async getRecentProductsByVendor(
    vendorFilter: string | null,
    agentFilters: AgentFilter[],
    rowLimit: number = 20
  ) {
    try {
      const { data, error } = await supabase.rpc('get_recent_products_by_vendor', {
        vendor_filter: vendorFilter,
        agent_filters: agentFilters,
        row_limit: rowLimit,
      })

      if (error) {
        console.error('Error fetching recent products by vendor:', error)
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('Exception fetching recent products by vendor:', err)
      return { data: null, error: err as Error }
    }
  }

  /**
   * Get processing products (products currently being processed by agents)
   * Uses RPC function that automatically resets stale processing products (>5 min) back to pending
   * @param limit - Maximum number of products to return (default: 50)
   */
  async getProcessingProducts(limit: number = 50) {
    try {
      const { data, error } = await supabase.rpc('get_processing_products', {
        row_limit: limit,
      })

      if (error) {
        console.error('Error fetching processing products:', error)
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('Exception fetching processing products:', err)
      return { data: null, error: err as Error }
    }
  }
}

export const activityStatsService = new ActivityStatsService()

