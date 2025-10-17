/**
 * Statistics Types
 *
 * Type definitions for various statistics and metrics across the application.
 */

/**
 * Vendor-specific statistics from pending_products table
 */
export interface VendorStatistics {
  totalProducts: number
  withCategoryAndWeight: number
  withAllData: number
  syncedToErpNext: number
  failedToSync: number
}

/**
 * Agent-specific vendor statistics from pending_products table
 * Shows statistics for a single agent type filtered by vendor
 */
export interface AgentVendorStatistics {
  totalProducts: number
  pending: number
  processing: number
  complete: number
  failed: number
}
