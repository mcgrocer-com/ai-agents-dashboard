/**
 * AgentProductCard Component
 *
 * Standardized product card for agent monitoring pages.
 * Displays consistent information across all agent types:
 * - Image, name, vendor, item code
 * - Price, stock status
 * - Agent status and confidence
 * - Agent-specific details
 */

import { useState, useRef, useEffect } from 'react'
import { Package, MoreVertical, Trash2, type LucideIcon } from 'lucide-react'
import type { AgentProduct, AgentStatus } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { AgentType } from '@/services/agents.service'
import { formatCurrency } from '@/lib/utils/format'
import { supabase } from '@/lib/supabase/client'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Toast } from '@/components/ui/Toast'

interface AgentProductCardProps {
  agentProduct: AgentProduct
  agentType: AgentType
  agentConfig: {
    icon: LucideIcon
    iconColor: string
    primaryColor: string
  }
  onClick?: (e: React.MouseEvent) => void
}

export function AgentProductCard({ agentProduct, agentType, agentConfig, onClick }: AgentProductCardProps) {
  const { pendingData, productData } = agentProduct
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const handleRemoveFromQueue = async () => {
    setIsRemoving(true)
    try {
      const { data, error } = await supabase.functions.invoke('remove-product-from-copyright', {
        body: { productId: pendingData.id }
      })

      if (error) throw error

      if (data.success) {
        setToast({
          message: `Product "${productData?.name || pendingData.item_code || 'Unnamed Product'}" removed from copyright queue`,
          type: 'success'
        })
        // Refresh the page after a short delay to show the toast
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setToast({ message: data.error || 'Failed to remove product from queue', type: 'error' })
      }
    } catch (err) {
      console.error('Error removing product from copyright queue:', err)
      setToast({ message: 'An error occurred while removing product from queue', type: 'error' })
    } finally {
      setIsRemoving(false)
      setShowRemoveConfirm(false)
      setIsMenuOpen(false)
    }
  }

  // Helper function to format relative time
  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Get agent-specific status and confidence
  const getAgentStatus = (): AgentStatus => {
    switch (agentType) {
      case 'category':
        return pendingData.category_status
      case 'weight_dimension':
        return pendingData.weight_and_dimension_status
      case 'seo':
        return pendingData.seo_status
      case 'copyright':
        return pendingData.copyright_status || 'pending'
      default:
        return 'pending'
    }
  }

  const getAgentConfidence = (): number | null => {
    switch (agentType) {
      case 'category':
        return pendingData.category_confidence
      case 'weight_dimension':
        return pendingData.weight_confidence
      case 'seo':
        return null // SEO agent doesn't display confidence
      case 'copyright':
        return pendingData.copyright_confidence
      default:
        return null
    }
  }

  const agentStatus = getAgentStatus()
  const agentConfidence = getAgentConfidence()

  // Format price - use the utility function
  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A'
    return formatCurrency(price)
  }

  // Format stock status
  const getStockBadge = (status: string | null) => {
    if (!status) return null
    const isInStock = status.toLowerCase().includes('in stock') || status.toLowerCase().includes('available')
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${
          isInStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {status}
      </span>
    )
  }

  const IconComponent = agentConfig.icon

  const handleAuxClick = (e: React.MouseEvent) => {
    // Handle middle-click to open in new tab
    if (e.button === 1 && onClick) {
      e.preventDefault()
      onClick(e)
    }
  }

  return (
    <div
      onClick={onClick}
      onAuxClick={handleAuxClick}
      className="p-4 hover:bg-secondary-50 transition-colors cursor-pointer border-b border-secondary-200 last:border-b-0"
    >
      <div className="flex items-start gap-4">
        {/* Product Image */}
        {productData?.main_image ? (
          <img
            src={productData.main_image}
            alt={productData.name || 'Product'}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-secondary-200"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
            <Package className="w-10 h-10 text-blue-400" />
          </div>
        )}

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Name and Time */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-secondary-900 truncate text-base">
              {productData?.name || pendingData.item_code || 'Unnamed Product'}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {pendingData.updated_at && (
                <span className="text-xs text-secondary-500 font-medium">
                  {formatRelativeTime(pendingData.updated_at)}
                </span>
              )}
              {/* Actions Menu - Only for Copyright Agent */}
              {agentType === 'copyright' && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMenuOpen(!isMenuOpen)
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label="Product actions"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-600" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setIsMenuOpen(false)
                            setShowRemoveConfirm(true)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                          <span>Remove from Queue</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Vendor and Item Code */}
          <div className="flex items-center gap-2 text-sm text-secondary-600 mb-2">
            {productData?.vendor && (
              <span className="font-medium">{productData.vendor}</span>
            )}
            {productData?.vendor && pendingData.item_code && (
              <span className="text-secondary-400">•</span>
            )}
            {pendingData.item_code && (
              <span className="text-xs font-mono bg-secondary-100 px-2 py-0.5 rounded">
                {pendingData.item_code}
              </span>
            )}
          </div>

          {/* Metadata Grid: Price, Stock, Status, Confidence */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {/* Price */}
            {productData?.price && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-secondary-900">
                  {formatPrice(productData.price)}
                </span>
              </div>
            )}

            {/* Stock Status */}
            {productData?.stock_status && getStockBadge(productData.stock_status)}

            {/* Agent Status Badge */}
            <StatusBadge status={agentStatus} />

            {/* Confidence Score */}
            {agentConfidence !== null && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  agentConfidence >= 0.8
                    ? 'bg-green-100 text-green-700'
                    : agentConfidence >= 0.6
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {(agentConfidence * 100).toFixed(0)}% confidence
              </span>
            )}
          </div>

          {/* Agent-Specific Details Row */}
          <AgentSpecificDetails
            agentType={agentType}
            pendingData={pendingData}
            icon={IconComponent}
            iconColor={agentConfig.iconColor}
          />
        </div>
      </div>

      {/* Remove from Queue Confirmation Dialog */}
      {agentType === 'copyright' && (
        <>
          <ConfirmationDialog
            open={showRemoveConfirm}
            onClose={() => setShowRemoveConfirm(false)}
            onConfirm={handleRemoveFromQueue}
            title="Remove from Copyright Queue"
            message={`Are you sure you want to remove "${productData?.name || pendingData.item_code || 'this product'}" from the copyright queue?\n\nThis will set its copyright_status to NULL, removing it from the queue. You can add it back later if needed.`}
            confirmText="Remove"
            cancelText="Cancel"
            variant="danger"
            loading={isRemoving}
          />

          {/* Toast Notification */}
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Agent-Specific Details Component
 * Renders unique information for each agent type
 */
interface AgentSpecificDetailsProps {
  agentType: AgentType
  pendingData: any
  icon: LucideIcon
  iconColor: string
}

function AgentSpecificDetails({ agentType, pendingData, icon: Icon, iconColor }: AgentSpecificDetailsProps) {
  const renderCategoryDetails = () => {
    if (!pendingData.category) return null
    return (
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-secondary-700 font-medium">{pendingData.category}</span>
      </div>
    )
  }

  const renderWeightDetails = () => {
    const hasWeight = pendingData.weight
    const hasDimensions = pendingData.height || pendingData.width || pendingData.length

    if (!hasWeight && !hasDimensions) return null

    return (
      <div className="flex items-center gap-3 text-sm">
        {hasWeight && (
          <div className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 ${iconColor}`} />
            <span className="text-secondary-700 font-medium">
              {Number(pendingData.weight).toFixed(2)} kg
            </span>
          </div>
        )}
        {hasDimensions && (
          <>
            {hasWeight && <span className="text-secondary-400">•</span>}
            <span className="text-xs text-secondary-600">
              Dims: {pendingData.length || '?'} × {pendingData.width || '?'} × {pendingData.height || '?'} cm
            </span>
          </>
        )}
      </div>
    )
  }

  const renderSeoDetails = () => {
    if (!pendingData.ai_title) return null
    return (
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-secondary-700 truncate max-w-md">
          {pendingData.ai_title.substring(0, 60)}
          {pendingData.ai_title.length > 60 ? '...' : ''}
        </span>
      </div>
    )
  }

  const renderCopyrightDetails = () => {
    const nonCopyrightImages = pendingData.non_copyright_images
    if (!nonCopyrightImages || nonCopyrightImages.length === 0) return null
    return (
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-secondary-700 font-medium">
          {nonCopyrightImages.length} non-copyright image{nonCopyrightImages.length !== 1 ? 's' : ''} found
        </span>
      </div>
    )
  }

  switch (agentType) {
    case 'category':
      return renderCategoryDetails()
    case 'weight_dimension':
      return renderWeightDetails()
    case 'seo':
      return renderSeoDetails()
    case 'copyright':
      return renderCopyrightDetails()
    default:
      return null
  }
}
