/**
 * Advanced Filter System Types
 *
 * Type definitions for the dynamic filter builder system.
 * Supports complex filtering with multiple operators and field types.
 */

// ============================================================================
// Filter Operator Types
// ============================================================================

export type FilterOperator =
  | 'eq' // equals
  | 'neq' // not equal
  | 'gt' // greater than
  | 'lt' // less than
  | 'gte' // greater than or equal
  | 'lte' // less than or equal
  | 'like' // pattern matching
  | 'ilike' // case-insensitive like
  | 'in' // in array
  | 'is' // is null/not null

// ============================================================================
// Field Type Definitions
// ============================================================================

export type FieldType =
  | 'text'
  | 'number'
  | 'timestamp'
  | 'uuid'
  | 'boolean'
  | 'enum'
  | 'jsonb'

export interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  operators: FilterOperator[]
  enumValues?: string[] // For enum fields
  description?: string
}

// ============================================================================
// Filter Configuration
// ============================================================================

export interface DynamicFilter {
  id: string // Unique filter ID for React keys
  field: string
  operator: FilterOperator
  value: string | number | boolean | null | string[]
}

export interface FilterState {
  filters: DynamicFilter[]
}

// ============================================================================
// Operator Metadata
// ============================================================================

export interface OperatorDefinition {
  value: FilterOperator
  label: string
  symbol: string
  description: string
  valueRequired: boolean // Whether this operator needs a value input
}

export const OPERATOR_DEFINITIONS: Record<FilterOperator, OperatorDefinition> = {
  eq: {
    value: 'eq',
    label: 'equals',
    symbol: '=',
    description: 'Exact match',
    valueRequired: true,
  },
  neq: {
    value: 'neq',
    label: 'not equal',
    symbol: '≠',
    description: 'Does not match',
    valueRequired: true,
  },
  gt: {
    value: 'gt',
    label: 'greater than',
    symbol: '>',
    description: 'Greater than value',
    valueRequired: true,
  },
  lt: {
    value: 'lt',
    label: 'less than',
    symbol: '<',
    description: 'Less than value',
    valueRequired: true,
  },
  gte: {
    value: 'gte',
    label: 'greater than or equal',
    symbol: '≥',
    description: 'Greater than or equal to value',
    valueRequired: true,
  },
  lte: {
    value: 'lte',
    label: 'less than or equal',
    symbol: '≤',
    description: 'Less than or equal to value',
    valueRequired: true,
  },
  like: {
    value: 'like',
    label: 'like',
    symbol: '~',
    description: 'Pattern match (case-sensitive)',
    valueRequired: true,
  },
  ilike: {
    value: 'ilike',
    label: 'ilike',
    symbol: '~*',
    description: 'Pattern match (case-insensitive)',
    valueRequired: true,
  },
  in: {
    value: 'in',
    label: 'in',
    symbol: '∈',
    description: 'Matches any value in list',
    valueRequired: true,
  },
  is: {
    value: 'is',
    label: 'is',
    symbol: '∅',
    description: 'Check for null/not null',
    valueRequired: false,
  },
}

// ============================================================================
// Field Definitions for Scraped Products
// ============================================================================

export const SCRAPED_PRODUCT_FIELDS: FieldDefinition[] = [
  // Identifiers
  {
    name: 'id',
    label: 'UUID',
    type: 'uuid',
    operators: ['eq', 'neq', 'in'],
    description: 'Unique product identifier',
  },
  {
    name: 'product_id',
    label: 'Product ID',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'External product identifier',
  },
  {
    name: 'ean_code',
    label: 'EAN Code',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product barcode',
  },

  // Product Information
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product name',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'Product description',
  },
  {
    name: 'url',
    label: 'URL',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Product page URL',
  },

  // Vendor & Category
  {
    name: 'vendor',
    label: 'Vendor',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: [], // Populated dynamically
    description: 'Product vendor',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Product category',
  },

  // Pricing
  {
    name: 'price',
    label: 'Price',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Current price',
  },
  {
    name: 'original_price',
    label: 'Original Price',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Original price before discount',
  },

  // Dimensions & Weight
  {
    name: 'weight',
    label: 'Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product weight',
  },
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product width',
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product height',
  },
  {
    name: 'length',
    label: 'Length',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product length',
  },
  {
    name: 'volumetric_weight',
    label: 'Volumetric Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Calculated volumetric weight',
  },

  // Status Fields
  {
    name: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: ['pending', 'processing', 'complete', 'failed'],
    description: 'Overall processing status',
  },
  {
    name: 'stock_status',
    label: 'Stock Status',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Stock availability status',
  },

  // Variants
  {
    name: 'variant_count',
    label: 'Variant Count',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Number of product variants',
  },

  // AI Generated Content
  {
    name: 'ai_title',
    label: 'AI Title',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'AI-generated title',
  },
  {
    name: 'ai_description',
    label: 'AI Description',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'AI-generated description',
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Record creation timestamp',
  },
  {
    name: 'timestamp',
    label: 'Scraped At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product scrape timestamp',
  },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get field definition by name
 */
export function getFieldDefinition(fieldName: string): FieldDefinition | undefined {
  return SCRAPED_PRODUCT_FIELDS.find((f) => f.name === fieldName)
}

/**
 * Get available operators for a field type
 */
export function getOperatorsForFieldType(fieldType: FieldType): FilterOperator[] {
  switch (fieldType) {
    case 'text':
      return ['eq', 'neq', 'like', 'ilike', 'in', 'is']
    case 'number':
      return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is']
    case 'timestamp':
      return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is']
    case 'uuid':
      return ['eq', 'neq', 'in']
    case 'boolean':
      return ['eq', 'is']
    case 'enum':
      return ['eq', 'neq', 'in']
    case 'jsonb':
      return ['is']
    default:
      return ['eq', 'neq']
  }
}

/**
 * Validate filter value based on field type
 */
export function isValidFilterValue(
  value: any,
  fieldType: FieldType,
  operator: FilterOperator
): boolean {
  if (operator === 'is') {
    return value === 'null' || value === 'not.null' || value === null
  }

  if (value === null || value === undefined || value === '') {
    return false
  }

  switch (fieldType) {
    case 'number':
      return !isNaN(Number(value))
    case 'timestamp':
      return !isNaN(Date.parse(String(value)))
    case 'boolean':
      return value === true || value === false || value === 'true' || value === 'false'
    default:
      return true
  }
}

/**
 * Generate unique filter ID
 */
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Update vendor enum values dynamically
 */
export function updateVendorEnumValues(vendors: string[]): FieldDefinition[] {
  return SCRAPED_PRODUCT_FIELDS.map((field) => {
    if (field.name === 'vendor') {
      return { ...field, enumValues: vendors }
    }
    return field
  })
}

// ============================================================================
// Field Definitions for Scraper Agent
// ============================================================================

export const SCRAPER_AGENT_FIELDS: FieldDefinition[] = [
  // Identifiers
  {
    name: 'id',
    label: 'Product ID',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in'],
    description: 'Unique product identifier',
  },
  {
    name: 'product_id',
    label: 'External Product ID',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'External product identifier from vendor',
  },
  {
    name: 'ean_code',
    label: 'EAN Code',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product barcode',
  },

  // Product Information
  {
    name: 'name',
    label: 'Product Name',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product name from vendor',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'Product description',
  },
  {
    name: 'url',
    label: 'Product URL',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Product page URL',
  },

  // Vendor & Category
  {
    name: 'vendor',
    label: 'Vendor',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: [], // Populated dynamically
    description: 'Product vendor/retailer',
  },
  {
    name: 'category',
    label: 'Vendor Category',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Original category from vendor',
  },

  // Pricing
  {
    name: 'price',
    label: 'Price',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Current price',
  },
  {
    name: 'original_price',
    label: 'Original Price',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Original price before discount',
  },

  // Dimensions & Weight
  {
    name: 'weight',
    label: 'Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product weight from vendor',
  },
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product width',
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product height',
  },
  {
    name: 'length',
    label: 'Length',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product length',
  },
  {
    name: 'volumetric_weight',
    label: 'Volumetric Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Calculated volumetric weight',
  },

  // Status Fields
  {
    name: 'status',
    label: 'Processing Status',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in'],
    description: 'Product processing status',
  },
  {
    name: 'stock_status',
    label: 'Stock Status',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'Stock availability from vendor',
  },

  // Variants
  {
    name: 'variant_count',
    label: 'Variant Count',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Number of product variants',
  },

  // AI Generated Content
  {
    name: 'ai_title',
    label: 'AI Title',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'AI-generated title',
  },
  {
    name: 'ai_description',
    label: 'AI Description',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'AI-generated description',
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Record creation timestamp',
  },
  {
    name: 'timestamp',
    label: 'Scraped At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Product scrape timestamp',
  },
]

// ============================================================================
// Field Definitions for Category Agent
// ============================================================================

export const CATEGORY_AGENT_FIELDS: FieldDefinition[] = [
  // Product Information (from joined scraped_products)
  {
    name: 'scraped_products.name',
    label: 'Product Name',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product name from scraped data',
  },
  {
    name: 'vendor',
    label: 'Vendor',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in'],
    description: 'Product vendor',
  },

  // Category Agent Results
  {
    name: 'category_status',
    label: 'Processing Status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: ['pending', 'processing', 'complete', 'failed'],
    description: 'Category processing status',
  },
  {
    name: 'category',
    label: 'Mapped Category',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'is'],
    description: 'AI-mapped product category',
  },
  {
    name: 'category_confidence',
    label: 'Confidence Score',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Category mapping confidence (0-1)',
  },
  {
    name: 'category_cost',
    label: 'Processing Cost',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'AI processing cost in USD',
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Record creation timestamp',
  },
  {
    name: 'updated_at',
    label: 'Updated At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Last update timestamp',
  },
]

// ============================================================================
// Field Definitions for Weight-Dimension Agent
// ============================================================================

export const WEIGHT_DIMENSION_AGENT_FIELDS: FieldDefinition[] = [
  // Product Information (from joined scraped_products)
  {
    name: 'scraped_products.name',
    label: 'Product Name',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product name from scraped data',
  },
  {
    name: 'vendor',
    label: 'Vendor',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in'],
    description: 'Product vendor',
  },

  // Weight-Dimension Agent Results
  {
    name: 'weight_and_dimension_status',
    label: 'Processing Status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: ['pending', 'processing', 'complete', 'failed'],
    description: 'Weight/dimension processing status',
  },
  {
    name: 'weight',
    label: 'Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Estimated product weight',
  },
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Estimated width',
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Estimated height',
  },
  {
    name: 'length',
    label: 'Length',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Estimated length',
  },
  {
    name: 'volumetric_weight',
    label: 'Volumetric Weight',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Calculated volumetric weight',
  },
  {
    name: 'weight_confidence',
    label: 'Weight Confidence',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Weight estimation confidence (0-1)',
  },
  {
    name: 'dimension_confidence',
    label: 'Dimension Confidence',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Dimension estimation confidence (0-1)',
  },
  {
    name: 'weight_cost',
    label: 'Processing Cost',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'AI processing cost in USD',
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Record creation timestamp',
  },
  {
    name: 'updated_at',
    label: 'Updated At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Last update timestamp',
  },
]

/**
 * Update vendor enum values for scraper agent fields
 */
export function updateScraperVendorEnumValues(vendors: string[]): FieldDefinition[] {
  return SCRAPER_AGENT_FIELDS.map((field) => {
    if (field.name === 'vendor') {
      return { ...field, enumValues: vendors }
    }
    return field
  })
}

// ============================================================================
// Field Definitions for SEO Agent
// ============================================================================

export const SEO_AGENT_FIELDS: FieldDefinition[] = [
  // Product Information (from joined scraped_products)
  {
    name: 'scraped_products.name',
    label: 'Product Name',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in', 'is'],
    description: 'Product name from scraped data',
  },
  {
    name: 'vendor',
    label: 'Vendor',
    type: 'text',
    operators: ['eq', 'neq', 'like', 'ilike', 'in'],
    description: 'Product vendor',
  },

  // SEO Agent Results
  {
    name: 'seo_status',
    label: 'Processing Status',
    type: 'enum',
    operators: ['eq', 'neq', 'in'],
    enumValues: ['pending', 'processing', 'complete', 'failed'],
    description: 'SEO processing status',
  },
  {
    name: 'ai_title',
    label: 'AI-Optimized Title',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'SEO-optimized title',
  },
  {
    name: 'ai_description',
    label: 'AI-Optimized Description',
    type: 'text',
    operators: ['like', 'ilike', 'is'],
    description: 'SEO-optimized description',
  },
  {
    name: 'seo_confidence',
    label: 'Confidence Score',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'SEO optimization confidence (0-1)',
  },
  {
    name: 'seo_cost',
    label: 'Processing Cost',
    type: 'number',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'AI processing cost in USD',
  },

  // Timestamps
  {
    name: 'created_at',
    label: 'Created At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Record creation timestamp',
  },
  {
    name: 'updated_at',
    label: 'Updated At',
    type: 'timestamp',
    operators: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is'],
    description: 'Last update timestamp',
  },
]

/**
 * Update vendor enum values for category agent fields
 */
export function updateCategoryVendorEnumValues(vendors: string[]): FieldDefinition[] {
  return CATEGORY_AGENT_FIELDS.map((field) => {
    if (field.name === 'vendor') {
      return { ...field, enumValues: vendors }
    }
    return field
  })
}

/**
 * Update vendor enum values for weight-dimension agent fields
 */
export function updateWeightDimensionVendorEnumValues(vendors: string[]): FieldDefinition[] {
  return WEIGHT_DIMENSION_AGENT_FIELDS.map((field) => {
    if (field.name === 'vendor') {
      return { ...field, enumValues: vendors }
    }
    return field
  })
}

/**
 * Update vendor enum values for SEO agent fields
 */
export function updateSeoVendorEnumValues(vendors: string[]): FieldDefinition[] {
  return SEO_AGENT_FIELDS.map((field) => {
    if (field.name === 'vendor') {
      return { ...field, enumValues: vendors }
    }
    return field
  })
}
