/**
 * Classification Agent Type Definitions
 *
 * Types for UK medicine classification validation system
 */

// ============================================================================
// Classification Types
// ============================================================================

/**
 * UK medicine classification categories
 * - not_medicine: Food, household, or non-medicinal product (ACCEPTED)
 * - gsl: General Sales List medicine (ACCEPTED)
 * - pharmacy: Pharmacy Medicine - requires pharmacy supervision (REJECTED)
 * - pom: Prescription Only Medicine (REJECTED)
 * - unclear: Borderline or uncertain classification (REJECTED)
 */
export type ClassificationType = 'not_medicine' | 'gsl' | 'pharmacy' | 'pom' | 'unclear'

/**
 * Classification result from AI
 */
export interface ClassificationResult {
  rejected: boolean
  classification: ClassificationType
  reason: string
  confidence: number
}

/**
 * Classification statistics
 */
export interface ClassificationStats {
  total: number
  accepted: number
  rejected: number
  acceptedPercentage: number
  rejectedPercentage: number
  byType: {
    not_medicine: number
    gsl: number
    pharmacy: number
    pom: number
    unclear: number
  }
}

/**
 * Classification filter options
 */
export type ClassificationFilter = 'all' | 'accepted' | 'rejected'

/**
 * Product with classification data (for dashboard display)
 */
export interface ClassifiedProduct {
  id: string
  name: string
  description: string | null
  vendor: string | null
  url: string | null
  main_image: string | null
  price: number | null
  rejected: boolean
  classification: ClassificationType | null
  classification_reason: string | null
  classification_confidence: number | null
  created_at: string | null
  updated_at: string | null
}
