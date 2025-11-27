/**
 * Agents Service
 *
 * Handles agent triggering and agent-related operations.
 */

import { supabase } from '@/lib/supabase/client'
import type { AgentMetrics, AgentStatus, AgentProduct, PendingProduct, ScrapedProduct } from '@/types'

export type AgentType = 'category' | 'weight_dimension' | 'seo' | 'scraper' | 'copyright' | 'classification'

export interface TriggerAgentParams {
  agentType: AgentType
  productIds?: string[]
  vendor?: string
  batchSize?: number
  testMode?: boolean
}

export interface RetryAgentParams {
  productId: string
  agentType: AgentType
  feedback?: string
}

class AgentsService {
  /**
   * Trigger agent processing
   * Note: This calls Supabase Edge Functions
   */
  async triggerAgent(params: TriggerAgentParams) {
    try {
      const { data, error } = await supabase.functions.invoke(
        `trigger-${params.agentType}-agent`,
        {
          body: {
            productIds: params.productIds,
            vendor: params.vendor,
            batchSize: params.batchSize || 10,
            testMode: params.testMode || false,
          },
        }
      )

      if (error) throw error

      return {
        data,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Retry agent processing for a specific product
   * Resets the agent status to 'pending' and optionally adds feedback
   */
  async retryAgent(params: RetryAgentParams) {
    try {
      const statusField = this.getStatusField(params.agentType)
      const feedbackField = this.getFeedbackField(params.agentType)

      const updates: any = {
        [statusField]: 'pending',
        updated_at: new Date().toISOString(),
        erpnext_updated_at: null, // Reset ERPNext sync status to allow re-sync after processing
      }

      // Add feedback if provided
      if (params.feedback) {
        updates[feedbackField] = params.feedback
      }

      const { data, error } = await supabase
        .from('pending_products')
        .update(updates)
        .eq('scraped_product_id', params.productId)
        .select()
        .single()

      if (error) throw error

      return {
        data,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get agent metrics from optimized RPC
   */
  async getAgentMetrics() {
    try {
      const { data, error } = await supabase.rpc('get_agent_metrics_optimized')

      if (error) throw error

      // Transform snake_case to camelCase
      const metrics = (data || []).map((row: any) => ({
        agentType: row.agent_type,
        totalProducts: Number(row.total_products),
        pending: Number(row.pending_count),
        processing: Number(row.processing_count),
        complete: Number(row.complete_count),
        failed: Number(row.failed_count),
        avgConfidence: Number(row.avg_confidence || 0),
        totalCost: Number(row.total_cost || 0),
        lastRun: row.last_run,
      }))

      return {
        metrics: metrics as AgentMetrics[],
        error: null,
      }
    } catch (error) {
      return {
        metrics: [],
        error: error as Error,
      }
    }
  }

  /**
   * Get pending products for a specific agent with filters
   * Returns products in AgentProduct format with clear separation of pending_products and scraped_products data
   */
  async getPendingForAgent(
    agentType: AgentType,
    options: {
      limit?: number
      offset?: number
      search?: string
      vendor?: string
      status?: string
    } = {}
  ) {
    try {
      const { limit = 50, offset = 0, search, vendor, status } = options
      const statusField = this.getStatusField(agentType)

      let query = supabase
        .from('pending_products')
        .select('*, scraped_product:scraped_products!scraped_product_id(*)', {
          count: 'exact',
        })

      // Filter by agent-specific status
      if (status) {
        query = query.eq(statusField, status)
      } else {
        query = query.eq(statusField, 'pending')
      }

      // Filter by vendor
      if (vendor) {
        query = query.eq('vendor', vendor)
      }

      // Search in scraped product data
      if (search) {
        // Note: This searches in the pending_products table fields
        // For scraped product fields, we need to join and filter
        query = query.or(
          `item_code.ilike.%${search}%,vendor.ilike.%${search}%,url.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      // Transform data into AgentProduct structure to clearly separate pending and scraped data
      const products: AgentProduct[] = (data || []).map((item: any) => ({
        pendingData: {
          // Extract only pending_products fields
          id: item.id,
          product_id: item.product_id,
          scraped_product_id: item.scraped_product_id,
          url: item.url,
          vendor: item.vendor,
          breadcrumbs: item.breadcrumbs,
          category_status: item.category_status,
          weight_and_dimension_status: item.weight_and_dimension_status,
          seo_status: item.seo_status,
          copyright_status: item.copyright_status,
          category_feedback: item.category_feedback,
          weight_dimension_feedback: item.weight_dimension_feedback,
          seo_feedback: item.seo_feedback,
          copyright_feedback: item.copyright_feedback,
          category: item.category,
          category_confidence: item.category_confidence,
          category_cost: item.category_cost,
          category_reasoning: item.category_reasoning,
          category_tools_used: item.category_tools_used,
          weight: item.weight,
          weight_confidence: item.weight_confidence,
          weight_cost: item.weight_cost,
          weight_reason: item.weight_reason,
          weightTools: item.weightTools,
          contentWeight: item.contentWeight,
          packagingWeight: item.packagingWeight,
          glb_url: item.glb_url,
          materialType: item.materialType,
          density: item.density,
          itemType: item.itemType,
          itemCount: item.itemCount,
          containerType: item.containerType,
          source: item.source,
          internetSources: item.internetSources,
          height: item.height,
          width: item.width,
          length: item.length,
          volumetric_weight: item.volumetric_weight,
          dimension_confidence: item.dimension_confidence,
          dimension_reason: item.dimension_reason,
          dimensionToolsUsed: item.dimensionToolsUsed,
          ai_title: item.ai_title,
          ai_description: item.ai_description,
          seo_cost: item.seo_cost,
          seo_reasoning: item.seo_reasoning,
          seo_confidence: item.seo_confidence,
          seo_tools_used: item.seo_tools_used,
          non_copyright_images: item.non_copyright_images,
          non_copyright_desc: item.non_copyright_desc,
          copyright_confidence: item.copyright_confidence,
          copyright_cost: item.copyright_cost,
          copyright_reasoning: item.copyright_reasoning,
          copyright_tools_used: item.copyright_tools_used,
          item_code: item.item_code,
          erpnext_updated_at: item.erpnext_updated_at,
          failed_sync_at: item.failed_sync_at,
          failed_sync_error_message: item.failed_sync_error_message,
          created_at: item.created_at,
          updated_at: item.updated_at, // This is pending_products.updated_at
        } as PendingProduct,
        productData: (item.scraped_product || null) as ScrapedProduct, // This is the full scraped_products object
      }))

      return {
        products,
        count: count || 0,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get failed products for a specific agent with filters
   * Returns products in AgentProduct format with clear separation of pending_products and scraped_products data
   */
  async getFailedForAgent(
    agentType: AgentType,
    options: {
      limit?: number
      offset?: number
      search?: string
      vendor?: string
    } = {}
  ) {
    try {
      const { limit = 50, offset = 0, search, vendor } = options
      const statusField = this.getStatusField(agentType)

      let query = supabase
        .from('pending_products')
        .select('*, scraped_product:scraped_products!scraped_product_id(*)', {
          count: 'exact',
        })
        .eq(statusField, 'failed')

      // Filter by vendor
      if (vendor) {
        query = query.eq('vendor', vendor)
      }

      // Search
      if (search) {
        query = query.or(
          `item_code.ilike.%${search}%,vendor.ilike.%${search}%,url.ilike.%${search}%`
        )
      }

      const { data, error, count } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      // Transform data into AgentProduct structure to clearly separate pending and scraped data
      const products: AgentProduct[] = (data || []).map((item: any) => ({
        pendingData: {
          id: item.id,
          product_id: item.product_id,
          scraped_product_id: item.scraped_product_id,
          url: item.url,
          vendor: item.vendor,
          breadcrumbs: item.breadcrumbs,
          category_status: item.category_status,
          weight_and_dimension_status: item.weight_and_dimension_status,
          seo_status: item.seo_status,
          copyright_status: item.copyright_status,
          category_feedback: item.category_feedback,
          weight_dimension_feedback: item.weight_dimension_feedback,
          seo_feedback: item.seo_feedback,
          copyright_feedback: item.copyright_feedback,
          category: item.category,
          category_confidence: item.category_confidence,
          category_cost: item.category_cost,
          category_reasoning: item.category_reasoning,
          category_tools_used: item.category_tools_used,
          weight: item.weight,
          weight_confidence: item.weight_confidence,
          weight_cost: item.weight_cost,
          weight_reason: item.weight_reason,
          weightTools: item.weightTools,
          contentWeight: item.contentWeight,
          packagingWeight: item.packagingWeight,
          glb_url: item.glb_url,
          materialType: item.materialType,
          density: item.density,
          itemType: item.itemType,
          itemCount: item.itemCount,
          containerType: item.containerType,
          source: item.source,
          internetSources: item.internetSources,
          height: item.height,
          width: item.width,
          length: item.length,
          volumetric_weight: item.volumetric_weight,
          dimension_confidence: item.dimension_confidence,
          dimension_reason: item.dimension_reason,
          dimensionToolsUsed: item.dimensionToolsUsed,
          ai_title: item.ai_title,
          ai_description: item.ai_description,
          seo_cost: item.seo_cost,
          seo_reasoning: item.seo_reasoning,
          seo_confidence: item.seo_confidence,
          seo_tools_used: item.seo_tools_used,
          non_copyright_images: item.non_copyright_images,
          non_copyright_desc: item.non_copyright_desc,
          copyright_confidence: item.copyright_confidence,
          copyright_cost: item.copyright_cost,
          copyright_reasoning: item.copyright_reasoning,
          copyright_tools_used: item.copyright_tools_used,
          item_code: item.item_code,
          erpnext_updated_at: item.erpnext_updated_at,
          failed_sync_at: item.failed_sync_at,
          failed_sync_error_message: item.failed_sync_error_message,
          created_at: item.created_at,
          updated_at: item.updated_at, // This is pending_products.updated_at
        } as PendingProduct,
        productData: item.scraped_product || null, // This is the full scraped_products object
      }))

      return {
        products,
        count: count || 0,
        error: null,
      }
    } catch (error) {
      return {
        products: [],
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Update agent status for a product
   */
  async updateAgentStatus(
    productId: string,
    agentType: AgentType,
    status: AgentStatus,
    feedback?: string
  ) {
    try {
      const statusField = this.getStatusField(agentType)
      const feedbackField = this.getFeedbackField(agentType)

      const updates: any = {
        [statusField]: status,
        updated_at: new Date().toISOString(),
      }

      if (feedback) {
        updates[feedbackField] = feedback
      }

      const { data, error } = await supabase
        .from('pending_products')
        .update(updates)
        .eq('scraped_product_id', productId)
        .select()
        .single()

      if (error) throw error

      return {
        product: data,
        error: null,
      }
    } catch (error) {
      return {
        product: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get agent processing summaries
   */
  async getProcessingSummaries(agentType?: AgentType, limit = 10) {
    try {
      let query = supabase
        .from('agent_processing_summary')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)

      if (agentType) {
        query = query.eq('agent_type', agentType)
      }

      const { data, error } = await query

      if (error) throw error

      return {
        summaries: data,
        error: null,
      }
    } catch (error) {
      return {
        summaries: [],
        error: error as Error,
      }
    }
  }

  /**
   * Helper: Get status field name for agent type
   */
  private getStatusField(agentType: AgentType): string {
    const fieldMap: Record<AgentType, string> = {
      category: 'category_status',
      weight_dimension: 'weight_and_dimension_status',
      seo: 'seo_status',
      scraper: 'status', // Special case
      copyright: 'copyright_status',
      classification: 'classification_status',
    }
    return fieldMap[agentType]
  }

  /**
   * Helper: Get feedback field name for agent type
   */
  private getFeedbackField(agentType: AgentType): string {
    const fieldMap: Record<AgentType, string> = {
      category: 'category_feedback',
      weight_dimension: 'weight_dimension_feedback',
      seo: 'seo_feedback',
      scraper: 'failed_sync_error_message', // For scraper, we use the error message field
      copyright: 'copyright_feedback',
      classification: 'classification_feedback',
    }
    return fieldMap[agentType]
  }

  /**
   * Retry all failed products for a specific agent
   */
  async retryAllFailed(
    agentType: AgentType,
    options: {
      vendor?: string
      message?: string
    } = {}
  ) {
    try {
      const statusField = this.getStatusField(agentType)
      const feedbackField = this.getFeedbackField(agentType)

      // Build the update object
      const updates: any = {
        [statusField]: 'pending',
        updated_at: new Date().toISOString(),
        erpnext_updated_at: null,
      }

      // Add message to feedback field if provided
      if (options.message) {
        updates[feedbackField] = options.message
      }

      // Build query
      let query = supabase
        .from('pending_products')
        .update(updates, { count: 'exact' })
        .eq(statusField, 'failed')

      // Filter by vendor if specified
      if (options.vendor) {
        query = query.eq('vendor', options.vendor)
      }

      const { error, count } = await query

      if (error) throw error

      return {
        count: count || 0,
        error: null,
      }
    } catch (error) {
      return {
        count: 0,
        error: error as Error,
      }
    }
  }

  /**
   * Get category agent data for a specific product
   */
  async getCategoryData(scrapedProductId: string) {
    try {
      const { data, error } = await supabase
        .from('category_data')
        .select('*')
        .eq('scraped_product_id', scrapedProductId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" error

      return {
        data: data || null,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get weight & dimension agent data for a specific product
   */
  async getWeightData(scrapedProductId: string) {
    try {
      const { data, error } = await supabase
        .from('weight_data')
        .select('*')
        .eq('scraped_product_id', scrapedProductId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" error

      return {
        data: data || null,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      }
    }
  }

  /**
   * Get SEO agent data for a specific product
   */
  async getSeoData(scrapedProductId: string) {
    try {
      const { data, error } = await supabase
        .from('seo_data')
        .select('*')
        .eq('scraped_product_id', scrapedProductId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // Ignore "not found" error

      return {
        data: data || null,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      }
    }
  }
}

export const agentsService = new AgentsService()
