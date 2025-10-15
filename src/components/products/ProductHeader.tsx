/**
 * ProductHeader Component
 *
 * Displays product header with image, name, and basic information.
 */

import { Package, ExternalLink } from 'lucide-react'

interface ProductHeaderProps {
  name: string
  code?: string
  vendor?: string
  price?: number
  imageUrl?: string
  productUrl?: string
}

export function ProductHeader({
  name,
  code,
  vendor,
  price,
  imageUrl,
  productUrl,
}: ProductHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex gap-6">
        {/* Product Image */}
        <div className="flex-shrink-0">
          {imageUrl ? (
            <div className="relative w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
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
                  ${price.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {productUrl && (
            <div className="mt-4">
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
        </div>
      </div>
    </div>
  )
}
