/**
 * VariantsTab Component
 *
 * Displays product variants with images, prices, and stock status.
 */

import { Package2, ExternalLink, CheckCircle, XCircle } from 'lucide-react'

interface Variant {
  name: string
  price?: number
  original_price?: number
  product_id?: string | number
  stock_status?: string
  url?: string
  main_image?: string
  swatch_image?: string
  vendor?: string
  timestamp?: string
}

interface VariantsTabProps {
  variants?: any
  variantCount?: number
}

export function VariantsTab({ variants, variantCount }: VariantsTabProps) {
  // Parse variants if it's a JSON string
  let parsedVariants: Variant[] = []
  
  if (variants) {
    try {
      if (typeof variants === 'string') {
        parsedVariants = JSON.parse(variants)
      } else if (Array.isArray(variants)) {
        parsedVariants = variants
      }
    } catch (error) {
      console.error('Error parsing variants:', error)
    }
  }

  if (!parsedVariants || parsedVariants.length === 0) {
    return (
      <div className="text-center py-12">
        <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg text-gray-600">No variants available</p>
        <p className="text-sm text-gray-500 mt-2">This product does not have any variants</p>
      </div>
    )
  }

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A'
    return `£${price.toFixed(2)}`
  }

  const getStockStatusColor = (status?: string) => {
    if (!status) return 'text-gray-500'
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes('in stock') || lowerStatus.includes('available')) {
      return 'text-green-600'
    }
    if (lowerStatus.includes('out of stock') || lowerStatus.includes('unavailable')) {
      return 'text-red-600'
    }
    return 'text-yellow-600'
  }

  const getStockStatusIcon = (status?: string) => {
    if (!status) return null
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes('in stock') || lowerStatus.includes('available')) {
      return <CheckCircle className="h-4 w-4" />
    }
    if (lowerStatus.includes('out of stock') || lowerStatus.includes('unavailable')) {
      return <XCircle className="h-4 w-4" />
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package2 className="h-5 w-5 text-blue-500" />
            Product Variants
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {variantCount || parsedVariants.length} {parsedVariants.length === 1 ? 'variant' : 'variants'} available
          </p>
        </div>
      </div>

      {/* Variants Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {parsedVariants.map((variant, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Variant Image */}
            {(variant.main_image || variant.swatch_image) && (
              <div className="aspect-square bg-gray-50 relative">
                <img
                  src={variant.main_image || variant.swatch_image}
                  alt={variant.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Variant Details */}
            <div className="p-2 space-y-1.5">
              {/* Name */}
              <h4 className="font-medium text-gray-900 text-xs line-clamp-2 leading-tight">
                {variant.name}
              </h4>

              {/* Price */}
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-gray-900">
                  {formatPrice(variant.price)}
                </span>
                {variant.original_price && variant.original_price !== variant.price && (
                  <span className="text-xs text-gray-500 line-through">
                    {formatPrice(variant.original_price)}
                  </span>
                )}
              </div>

              {/* Stock Status */}
              {variant.stock_status && (
                <div className={`flex items-center gap-1 ${getStockStatusColor(variant.stock_status)}`}>
                  {getStockStatusIcon(variant.stock_status)}
                  <span className="text-xs font-medium">{variant.stock_status}</span>
                </div>
              )}

              {/* View Product Link */}
              {variant.url && (
                <a
                  href={variant.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{parsedVariants.length}</p>
            <p className="text-xs text-gray-600 mt-1">Total Variants</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {parsedVariants.filter(v => v.stock_status?.toLowerCase().includes('in stock')).length}
            </p>
            <p className="text-xs text-gray-600 mt-1">In Stock</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatPrice(Math.min(...parsedVariants.map(v => v.price || 0).filter(p => p > 0)))}
            </p>
            <p className="text-xs text-gray-600 mt-1">Lowest Price</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatPrice(Math.max(...parsedVariants.map(v => v.price || 0)))}
            </p>
            <p className="text-xs text-gray-600 mt-1">Highest Price</p>
          </div>
        </div>
      </div>
    </div>
  )
}

