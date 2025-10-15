/**
 * Central export for all TypeScript types
 */

// Export database types
export type {
  Product,
  ScrapedProduct,
  PendingProduct,
  ProductWithAgentData,
  AgentProduct,
  AgentStatus,
  AgentMetrics,
  VendorStats,
  RecentActivity,
  DashboardMetrics,
  ProductFilters,
} from './database'

// Export filter types from filters module
export type {
  DynamicFilter,
  FilterOperator,
  FieldType,
  FieldDefinition,
  FilterState,
  OperatorDefinition,
} from './filters'

// Re-export filter helpers
export {
  OPERATOR_DEFINITIONS,
  SCRAPED_PRODUCT_FIELDS,
  getFieldDefinition,
  getOperatorsForFieldType,
  isValidFilterValue,
  generateFilterId,
  updateVendorEnumValues,
} from './filters'
