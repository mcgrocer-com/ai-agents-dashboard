/**
 * ProductHeader Component
 *
 * Displays product header with image, name, and basic information.
 */

import { Package, ExternalLink, Pin, Edit, CheckCircle, XCircle } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

interface ProductHeaderProps {
  name: string
  code?: string
  vendor?: string
  price?: number
  originalPrice?: number
  imageUrl?: string
  alternativeImages?: string[]
  productUrl?: string
  erpnextUpdatedAt?: string | null
  failedSyncAt?: string | null
  pinned?: boolean
  onTogglePin?: () => void
  togglingPin?: boolean
  onEdit?: () => void
}

export function ProductHeader({
  name,
  code,
  vendor,
  price,
  originalPrice,
  imageUrl,
  alternativeImages = [],
  productUrl,
  erpnextUpdatedAt,
  failedSyncAt,
  pinned = false,
  onTogglePin,
  togglingPin = false,
  onEdit,
}: ProductHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex gap-6">
        {/* Main Product Image - Tall */}
        <div className="flex-shrink-0 space-y-3">
          {imageUrl ? (
            <div className="relative w-48 h-64 bg-gray-100 rounded-lg overflow-hidden group">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-contain"
              />
              {/* Pin Button - Circular Overlay at Top Left */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin?.()
                }}
                disabled={togglingPin}
                className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  pinned
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600 hover:scale-110'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-110'
                }`}
                title={pinned ? 'Unpin Product' : 'Pin Product'}
              >
                {togglingPin ? (
                  <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Pin className={`h-5 w-5 ${pinned ? 'fill-current' : ''}`} />
                )}
              </button>
            </div>
          ) : (
            <div className="relative w-48 h-64 bg-gray-100 rounded-lg flex items-center justify-center group">
              <Package className="h-16 w-16 text-gray-400" />
              {/* Pin Button - Circular Overlay at Top Left */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePin?.()
                }}
                disabled={togglingPin}
                className={`absolute top-2 left-2 p-2 rounded-full shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  pinned
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600 hover:scale-110'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-110'
                }`}
                title={pinned ? 'Unpin Product' : 'Pin Product'}
              >
                {togglingPin ? (
                  <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Pin className={`h-5 w-5 ${pinned ? 'fill-current' : ''}`} />
                )}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Edit Button */}
            {onEdit && (
              <button
                onClick={onEdit}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Edit className="h-4 w-4" />
                Edit Product
              </button>
            )}

            {/* ERPNext Sync Status Indicator */}
            <div className="w-full">
              {erpnextUpdatedAt && (!failedSyncAt || new Date(erpnextUpdatedAt) > new Date(failedSyncAt)) ? (
                <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-900">Synced to ERPNext</p>
                      <p className="text-xs text-green-700 truncate">
                        {formatDateTime(erpnextUpdatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : failedSyncAt ? (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-900">Sync Failed</p>
                      <p className="text-xs text-red-700 truncate">
                        {formatDateTime(failedSyncAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full border-2 border-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">Not Synced</p>
                      <p className="text-xs text-gray-600">Waiting for sync</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {code && (
                  <div>
                    <span className="text-gray-500">Code:</span>{' '}
                    <span className="font-mono">{code}</span>
                  </div>
                )}
                {vendor && (
                  <div>
                    <span className="text-gray-500">Vendor:</span>{' '}
                    <span className="font-medium capitalize">{vendor}</span>
                  </div>
                )}
              </div>
            </div>
            {price !== undefined && price !== null && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(price)}
                </p>
                {originalPrice !== undefined && originalPrice !== null && originalPrice !== price && (
                  <p className="text-lg text-gray-500 line-through mt-1">
                    {formatCurrency(originalPrice)}
                  </p>
                )}
              </div>
            )}
          </div>

          {productUrl && (
            <div className="mt-2">
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600
                  hover:text-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                View Original Product
              </a>
            </div>
          )}

          {/* Alternative Images Gallery */}
          {alternativeImages.length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Alternative Images ({alternativeImages.length})
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {alternativeImages.map((image, index) => (
                  <a
                    key={index}
                    href={image}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors"
                  >
                    <img
                      src={image}
                      alt={`${name} alternative ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
