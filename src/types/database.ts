/**
 * Database Type Definitions
 *
 * TypeScript interfaces matching Supabase database schema.
 * Auto-generated based on schema inspection.
 */

import type { ClassificationType } from './classification'

// ============================================================================
// Core Product Types
// ============================================================================

export interface Product {
  id: string
  item_code: string | null
  title: string | null
  description: string | null
  url: string | null
  image: string | null
  images: Record<string, any> | null
  breadcrumbs: Record<string, any> | null
  category: string | null
  weight: number | null
  width: number | null
  height: number | null
  length: number | null
  volumetric_weight: number | null
  created_at: string | null
  updated_at: string | null
}

export interface ScrapedProduct {
  id: string
  vendor: string | null
  name: string | null
  price: number | null
  weight: number | null
  description: string | null
  category: string | null
  stock_status: string | null
  images: Record<string, any> | null
  main_image: string | null
  variants: Record<string, any> | null
  variant_count: number | null
  product_id: string | null
  original_price: number | null
  timestamp: string | null
  url: string | null
  breadcrumbs: Record<string, any> | null
  ean_code: string | null
  status: string
  ai_title: string | null
  ai_description: string | null
  height: number | null
  width: number | null
  length: number | null
  volumetric_weight: number | null
  pinned: boolean | null
  created_at: string | null
  updated_at: string | null

  // Classification agent results (UK medicine compliance)
  rejected: boolean
  classification: ClassificationType | null
  classification_reason: string | null
  classification_confidence: number | null

  // ERPNext sync status (joined from pending_products)
  sync_status?: 'synced' | 'failed' | 'pending'
  item_code?: string | null
  failed_sync_error_message?: string | null
  erpnext_updated_at?: string | null
  failed_sync_at?: string | null
  validation_error?: string | null
}

export interface PendingProduct {
  id: string
  product_id: string | null
  scraped_product_id: string | null
  url: string | null
  vendor: string | null
  breadcrumbs: Record<string, any> | null

  // Agent statuses
  category_status: AgentStatus
  weight_and_dimension_status: AgentStatus
  seo_status: AgentStatus
  copyright_status: AgentStatus | null
  faq_status: AgentStatus | null

  // Feedback fields for retry guidance
  category_feedback: string | null
  weight_dimension_feedback: string | null
  seo_feedback: string | null
  copyright_feedback: string | null

  // Category agent results
  category: string | null
  category_confidence: number | null
  category_cost: number | null
  category_reasoning: string | null
  category_tools_used: Record<string, any> | null

  // Weight agent results
  weight: number | null
  weight_confidence: number | null
  weight_cost: number | null
  weight_reason: string | null
  weightTools: Record<string, any> | null
  contentWeight: string | null
  packagingWeight: string | null
  glb_url: string | null
  materialType: string | null
  density: number | null
  itemType: string | null
  itemCount: number | null
  containerType: string | null
  source: string | null
  internetSources: Record<string, any> | null

  // Dimension agent results
  height: string | null
  width: string | null
  length: string | null
  volumetric_weight: string | null
  dimension_confidence: number | null
  dimension_reason: string | null
  dimensionToolsUsed: Record<string, any> | null

  // SEO agent results
  ai_title: string | null
  ai_description: string | null
  seo_cost: number | null
  seo_reasoning: string | null
  seo_confidence: number | null
  seo_tools_used: Record<string, any> | null

  // Copyright agent results
  non_copyright_images: string[] | null
  non_copyright_desc: string | null
  copyright_confidence: number | null
  copyright_cost: number | null
  copyright_reasoning: string | null
  copyright_tools_used: Record<string, any> | null

  // FAQ agent results
  faq: FaqItem[] | null
  faq_confidence: number | null
  faq_cost: number | null
  faq_reasoning: string | null
  faq_tools_used: Record<string, any> | null

  item_code: string | null
  erpnext_updated_at: string | null
  failed_sync_at: string | null
  failed_sync_error_message: string | null
  validation_error: string | null
  created_at: string | null
  updated_at: string | null
}

// ============================================================================
// Agent Processing Types
// ============================================================================

export type AgentStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface FaqItem {
  question: string
  answer: string
}

export interface MapperAgentProduct {
  id: string
  product_id: string
  status: AgentStatus
  retry: boolean
  feedback: string | null
  confidence_score: number | null
  category_mapped: string | null
  reasoning: string | null
  tools_used: Record<string, any> | null
  processing_cost: number | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

export interface WeightDimensionAgentProduct {
  id: string
  product_id: string
  status: AgentStatus
  retry: boolean
  feedback: string | null
  confidence_score: number | null
  weight_value: number | null
  weight_unit: string | null
  width_value: number | null
  height_value: number | null
  length_value: number | null
  dimension_unit: string | null
  volumetric_weight: number | null
  reasoning: string | null
  tools_used: Record<string, any> | null
  processing_cost: number | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

export interface SeoAgentProduct {
  id: string
  product_id: string
  status: AgentStatus
  retry: boolean
  feedback: string | null
  confidence_score: number | null
  optimized_title: string | null
  optimized_description: string | null
  keywords_used: string[] | null
  reasoning: string | null
  tools_used: Record<string, any> | null
  processing_cost: number | null
  error_message: string | null
  created_at: string | null
  updated_at: string | null
}

// ============================================================================
// Supporting Tables
// ============================================================================

export interface Category {
  id: string
  name: string
  parent_id: string | null
  level: number
  path: string | null
  description: string | null
  agent_created: string | null
  usage_count: number
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AgentResource {
  id: string
  agent_type: 'category' | 'weight_dimension' | 'seo' | 'scraper' | 'copyright' | 'faq'
  resource_type: 'prompt' | 'guideline' | 'context' | 'template'
  title: string
  content: string
  is_active: boolean
  version: number
  created_at: string | null
  updated_at: string | null
}

export interface SeoKeyword {
  id: string
  keyword: string
  category: string | null
  priority: number
  usage_count: number
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface User {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'reviewer' | 'seo-expert' | 'analyst' | 'operator'
  is_active: boolean
  last_login: string | null
  preferences: Record<string, any>
  created_at: string | null
  updated_at: string | null
}

export interface AgentProcessingSummary {
  id: string
  run_id: string
  agent_type: string
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  batch_size: number
  max_concurrent: number
  max_batches: number | null
  vendor: string | null
  test_mode: boolean
  total_batches_processed: number
  total_products_processed: number
  total_successful: number
  total_failed: number
  success_rate: number | null
  agent_stats: Record<string, any>
  total_ai_cost: number
  db_stats: Record<string, any>
  server_hostname: string | null
  gpu_model: string | null
  python_version: string | null
  notes: string | null
  errors: any[]
  created_at: string
  updated_at: string
}

// ============================================================================
// Dashboard Metrics Types
// ============================================================================

export interface DashboardMetrics {
  partialSanitized: number // Products with category AND weight complete
  fullSanitized: number // Products with category, weight, AND seo complete
  processingProducts: number
  totalCost: number
  successRate: number // Average of all agent success rates
}

export interface AgentMetrics {
  agentType: 'category' | 'weight_dimension' | 'seo' | 'copyright' | 'faq'
  totalProducts: number
  pending: number
  processing: number
  complete: number
  failed: number
  avgConfidence: number
  totalCost: number
  lastRun: string | null
}

export interface VendorStats {
  vendor: string
  totalProducts: number
  pending: number
  complete: number
}

export interface RecentActivity {
  id: string
  productName: string
  vendor: string
  imageUrl: string
  agent: string
  status: AgentStatus
  timestamp: string
  productId: string
  // Agent statuses for complete tab items
  categoryStatus?: AgentStatus
  weightStatus?: AgentStatus
  seoStatus?: AgentStatus
  copyrightStatus?: AgentStatus
  faqStatus?: AgentStatus
}

// ============================================================================
// Query Filter Types
// ============================================================================

export interface DynamicFilter {
  field: string
  operator: string
  value: any
}

export interface ProductFilters {
  search?: string
  vendor?: string
  status?: AgentStatus | string
  dynamicFilters?: DynamicFilter[]
  sortBy?: 'name' | 'price' | 'updated_at' | 'created_at' | 'erpnext_updated_at' | 'failed_sync_at' | 'scraper_updated_at'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// ============================================================================
// Combined Product View (with agent data)
// ============================================================================

export interface ProductWithAgentData extends ScrapedProduct {
  categoryAgent?: MapperAgentProduct
  weightAgent?: WeightDimensionAgentProduct
  seoAgent?: SeoAgentProduct
}

// ============================================================================
// Agent Product Interface (Unified)
// ============================================================================

/**
 * Unified interface for agent product data that clearly separates
 * pending_products table data from scraped_products table data.
 * This prevents naming conflicts (e.g., both tables have updated_at).
 */
export interface AgentProduct {
  // Pending product data (from pending_products table)
  pendingData: PendingProduct

  // Scraped product data (from scraped_products table)
  productData: ScrapedProduct | null
}
