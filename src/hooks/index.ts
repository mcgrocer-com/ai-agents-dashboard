/**
 * Hooks Index
 *
 * Central export for all custom hooks.
 */

export { useAuth } from './useAuth'
export { useProducts, useProduct, usePendingProducts, useVendors } from './useProducts'
export { useAgentMetrics, useTriggerAgent, useRetryAgent, usePendingForAgent, useFailedForAgent } from './useAgents'
export { useDashboardMetrics, useVendorStats, useRecentActivity, useProductsByStatus } from './useStats'
export { useRealtime, usePendingProductsRealtime, useScrapedProductsRealtime } from './useRealtime'
export { useDashboardRealtime, useAgentRealtime, useRecentActivityRealtime } from './useDashboardRealtime'
export { useScraperProducts, useScraperVendors, useStockStatuses } from './useScraperProducts'
export { useMariaDBProducts } from './useMariaDBProducts'
export { useUserPreferences } from './useUserPreferences'
