/**
 * Classification Card Component
 * Displays product with classification information
 * Clickable to open classification dialog
 */

import { CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import ClassificationBadge from './ClassificationBadge'
import type { ClassifiedProduct } from '@/types/classification'

interface ClassificationCardProps {
  product: ClassifiedProduct
  isAdmin: boolean
  onAccept?: (productId: string) => void
  onReject?: (productId: string) => void
  onRetry?: (productId: string) => void
  onClick?: (product: ClassifiedProduct) => void
}

const ClassificationCard = ({
  product,
  isAdmin,
  onAccept,
  onReject,
  onRetry,
  onClick
}: ClassificationCardProps) => {
  const defaultImage = 'https://via.placeholder.com/150?text=No+Image'

  const handleCardClick = () => {
    if (onClick) {
      onClick(product)
    }
  }

  const handleButtonClick = (e: React.MouseEvent, callback: () => void) => {
    e.stopPropagation()
    callback()
  }

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-xl shadow-sm border border-secondary-200 p-4 transition-all ${
        onClick ? 'hover:shadow-md hover:border-blue-300 cursor-pointer' : 'hover:shadow-md'
      }`}
    >
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="flex-shrink-0">
          <img
            src={product.main_image || defaultImage}
            alt={product.name || 'Product'}
            className="w-20 h-20 object-cover rounded-md"
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-secondary-900 truncate">
                {product.name || 'Unknown Product'}
              </h3>
              <p className="text-xs text-secondary-500 mt-1">{product.vendor}</p>
            </div>
            <ClassificationBadge
              classification={product.classification}
              rejected={product.rejected}
            />
          </div>

          {/* Classification Reason */}
          {product.classification_reason && (
            <p className="text-xs text-secondary-600 mt-2 line-clamp-2">
              {product.classification_reason}
            </p>
          )}

          {/* Confidence Score */}
          {product.classification_confidence !== null && (
            <div className="mt-2">
              <span className="text-xs text-secondary-500">
                Confidence: {Math.round(product.classification_confidence * 100)}%
              </span>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex gap-2 mt-3">
              {product.rejected && onAccept && (
                <button
                  onClick={(e) => handleButtonClick(e, () => onAccept(product.id))}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Accept
                </button>
              )}
              {!product.rejected && onReject && (
                <button
                  onClick={(e) => handleButtonClick(e, () => onReject(product.id))}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </button>
              )}
              {onRetry && (
                <button
                  onClick={(e) => handleButtonClick(e, () => onRetry(product.id))}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-secondary-700 bg-secondary-100 hover:bg-secondary-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClassificationCard
