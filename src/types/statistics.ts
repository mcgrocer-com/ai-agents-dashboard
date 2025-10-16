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
