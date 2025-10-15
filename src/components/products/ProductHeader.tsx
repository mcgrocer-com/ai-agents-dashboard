/**
 * ProductHeader Component
 *
 * Displays product header with image, name, and basic information.
 */

import { Package, ExternalLink, Send, Pin } from 'lucide-react'
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
  pinned?: boolean
  onSendToErpnext?: () => void
  sendingToErpnext?: boolean
  onTogglePin?: () => void
  togglingPin?: boolean
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
  pinned = false,
  onSendToErpnext,
  sendingToErpnext = false,
  onTogglePin,
  togglingPin = false,
}: ProductHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex gap-6">
        {/* Main Product Image - Tall */}
        <div className="flex-shrink-0 space-y-3">
          {imageUrl ? (
            <div className="relative w-48 h-64 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-48 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-400" />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Pin/Unpin Button */}
            <button
              onClick={onTogglePin}
              disabled={togglingPin}
              className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                pinned
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {togglingPin ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {pinned ? 'Unpinning...' : 'Pinning...'}
                </>
              ) : (
                <>
                  <Pin className={`h-4 w-4 ${pinned ? 'fill-current' : ''}`} />
                  {pinned ? 'Unpin Product' : 'Pin Product'}
                </>
              )}
            </button>

            {/* Send to ERPNext Button */}
            <button
              onClick={onSendToErpnext}
              disabled={sendingToErpnext}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingToErpnext ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to ERPNext
                </>
              )}
            </button>
            {erpnextUpdatedAt && (
              <p className="text-xs text-gray-500 text-center">
                Last sent: {formatDateTime(erpnextUpdatedAt)}
              </p>
            )}
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
