/**
 * Statistics Service
 *
 * Handles dashboard metrics and statistics queries.
 */

import { supabase } from '@/lib/supabase/client'
import type {
  DashboardMetrics,
  VendorStats,
  RecentActivity,
} from '@/types'

class StatsService {
  /**
   * Get dashboard overview metrics
   */
  async getDashboardMetrics(): Promise<{
    metrics: DashboardMetrics | null
    error: Error | null
  }> {
    try {
      // Get processing products
      const { count: processingProducts } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .or(
          'category_status.eq.processing,weight_and_dimension_status.eq.processing,seo_status.eq.processing'
        )

      // Get partial sanitized (category AND weight complete)
      const { count: partialSanitized } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .eq('category_status', 'complete')
        .eq('weight_and_dimension_status', 'complete')

      // Get full sanitized (category, weight, AND seo complete)
      const { count: fullSanitized } = await supabase
        .from('pending_products')
        .select('*', { count: 'exact', head: true })
        .eq('category_status', 'complete')
        .eq('weight_and_dimension_status', 'complete')
        .eq('seo_status', 'complete')

      // Get agent metrics to calculate average success rate
      const { data: agentMetrics } = await supabase.rpc('get_agent_metrics_optimized')

      // Calculate average success rate from all agents
      let successRate = 0
      if (agentMetrics && agentMetrics.length > 0) {
        const agentSuccessRates = agentMetrics.map((agent: any) => {
          const finishedItems = Number(agent.complete_count) + Number(agent.failed_count)
          return finishedItems > 0 ? Number(agent.complete_count) / finishedItems : 0
        })
        successRate = agentSuccessRates.reduce((sum: number, rate: number) => sum + rate, 0) / agentSuccessRates.length
      }

      // Get total cost from processing summaries
      const { data: summaries } = await supabase
        .from('agent_processing_summary')
        .select('total_ai_cost')

      const totalCost = summaries?.reduce(
        (sum, s) => sum + (s.total_ai_cost || 0),
        0
      ) || 0

      return {
        metrics: {
          partialSanitized: partialSanitized || 0,
          fullSanitized: fullSanitized || 0,
          processingProducts: processingProducts || 0,
          totalCost,
          successRate,
        },
        error: null,
      }
    } catch (error) {
      return {
        metrics: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(): Promise<{
    stats: VendorStats[]
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from('pending_products')
        .select('vendor, category_status')

      if (error) throw error

      // Group by vendor
      const vendorMap = new Map<string, VendorStats>()

      data?.forEach((item) => {
        const vendor = item.vendor || 'Unknown'
        const current = vendorMap.get(vendor) || {
          vendor,
          totalProducts: 0,
          pending: 0,
          complete: 0,
        }

        current.totalProducts++
        if (item.category_status === 'pending') current.pending++
        if (item.category_status === 'complete') current.complete++

        vendorMap.set(vendor, current)
      })

      const stats = Array.from(vendorMap.values())
        .sort((a, b) => b.totalProducts - a.totalProducts)

      return {
        stats,
        error: null,
      }
    } catch (error) {
      return {
        stats: [],
        error: error as Error,
      }
    }
  }

  /**
   * Get recent activity feed with optional filtering
   */
  async getRecentActivity(
    limit = 20,
    statusFilter?: 'processing' | 'complete'
  ): Promise<{
    activities: RecentActivity[]
    error: Error | null
  }> {
    try {
      let query = supabase
        .from('pending_products')
        .select(
          `
          id,
          scraped_product_id,
          vendor,
          category_status,
          weight_and_dimension_status,
          seo_status,
          updated_at,
          scraped_products!inner (
            name,
            main_image
          )
        `
        )
        .order('updated_at', { ascending: false })

      // Apply status filter
      if (statusFilter === 'processing') {
        query = query.or(
          'category_status.eq.processing,weight_and_dimension_status.eq.processing,seo_status.eq.processing'
        )
      }

      const { data, error } = await query.limit(limit * 3)

      if (error) throw error

      // Transform to RecentActivity format
      const activities: RecentActivity[] = []

      data?.forEach((item: any) => {
        const productName = item.scraped_products?.name || 'Product'
        const vendor = item.vendor || ''
        const imageUrl = item.scraped_products?.main_image || ''

        // Category agent activity
        if (item.category_status && item.category_status !== 'pending') {
          activities.push({
            id: `cat-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Category Mapper',
            status: item.category_status,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // Weight & Dimension agent activity
        if (
          item.weight_and_dimension_status &&
          item.weight_and_dimension_status !== 'pending'
        ) {
          activities.push({
            id: `weight-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Weight & Dimension',
            status: item.weight_and_dimension_status,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // SEO agent activity
        if (item.seo_status && item.seo_status !== 'pending') {
          activities.push({
            id: `seo-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'SEO Optimizer',
            status: item.seo_status,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }
      })

      // Sort by timestamp
      activities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      return {
        activities,
        error: null,
      }
    } catch (error) {
      return {
        activities: [],
        error: error as Error,
      }
    }
  }

  /**
   * Get products by status (pending, processing, complete, failed)
   */
  async getProductsByStatus(
    status: string,
    agentType?: 'category' | 'weight_dimension' | 'seo',
    limit = 20
  ) {
    try {
      let query = supabase
        .from('pending_products')
        .select('*')
        .limit(limit)
        .order('updated_at', { ascending: false })

      if (agentType) {
        const statusField =
          agentType === 'category'
            ? 'category_status'
            : agentType === 'weight_dimension'
            ? 'weight_and_dimension_status'
            : 'seo_status'

        query = query.eq(statusField, status)
      } else {
        // Match any agent with this status
        query = query.or(
          `category_status.eq.${status},weight_and_dimension_status.eq.${status},seo_status.eq.${status}`
        )
      }

      const { data, error } = await query

      if (error) throw error

      return {
        products: data,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        error: error as Error,
      }
    }
  }

  /**
   * Get agent-specific metrics by vendor
   */
  async getVendorAgentMetrics(vendor: string) {
    try {
      const { data, error } = await supabase
        .from('pending_products')
        .select('*')
        .eq('vendor', vendor)

      if (error) throw error

      // Calculate metrics
      const metrics = {
        category: {
          pending: 0,
          processing: 0,
          complete: 0,
          failed: 0,
        },
        weight_dimension: {
          pending: 0,
          processing: 0,
          complete: 0,
          failed: 0,
        },
        seo: {
          pending: 0,
          processing: 0,
          complete: 0,
          failed: 0,
        },
      }

      data?.forEach((item) => {
        metrics.category[item.category_status as keyof typeof metrics.category]++
        metrics.weight_dimension[item.weight_and_dimension_status as keyof typeof metrics.weight_dimension]++
        metrics.seo[item.seo_status as keyof typeof metrics.seo]++
      })

      return {
        metrics,
        error: null,
      }
    } catch (error) {
      return {
        metrics: null,
        error: error as Error,
      }
    }
  }
}

export const statsService = new StatsService()
