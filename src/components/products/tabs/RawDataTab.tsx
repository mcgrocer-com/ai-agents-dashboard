/**
 * RawDataTab Component
 *
 * Displays raw JSON data from product scraping and ERPNext payload.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface RawDataTabProps {
  data: any
}

export function RawDataTab({ data }: RawDataTabProps) {
  const [copiedScraped, setCopiedScraped] = useState(false)
  const [copiedErpnext, setCopiedErpnext] = useState(false)

  // Extract only the original product data fields
  const getProductData = (data: any) => {
    if (!data) return {}

    // Only include the original product fields
    const allowedFields = [
      'name',
      'price',
      'original_price', // Maps to selling_price
      'product_id',
      'description',
      'stock_status',
      'url',
      'category',
      'vendor',
      'images',
      'main_image',
      'timestamp',
      'height',
      'weight',
      'width',
      'volumetric_weight',
      'length',
      'breadcrumbs', // Maps to breadcrumb
      'ai_title', // SEO optimized title (meta title)
      'ai_description', // SEO optimized description (meta description)
      'meta_title', // Maps to ai_title
      'meta_description', // Maps to ai_description
    ]

    // Dimension fields that should be formatted to 3 decimals
    const dimensionFields = ['height', 'width', 'length', 'volumetric_weight']

    // Create a new object with only allowed fields
    const productData: any = {}
    allowedFields.forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        let value = data[key]

        // Format dimension fields to 3 decimal places
        if (dimensionFields.includes(key) && typeof value === 'number') {
          value = parseFloat(value.toFixed(3))
        }

        // Map field names to match ERPNext format
        if (key === 'original_price') {
          productData['selling_price'] = value
        } else if (key === 'breadcrumbs') {
          productData['breadcrumb'] = value
        } else if (key === 'ai_title') {
          // Include both ai_title and meta_title
          productData['ai_title'] = value
          productData['meta_title'] = value
        } else if (key === 'ai_description') {
          // Include both ai_description and meta_description
          productData['ai_description'] = value
          productData['meta_description'] = value
        } else {
          productData[key] = value
        }
      }
    })

    return productData
  }

  // Get ERPNext payload format
  const getErpnextPayload = (data: any) => {
    if (!data) return {}

    const payload: any = {}

    // Map fields to ERPNext format
    if (data.name) payload.name = data.name
    if (data.price !== undefined && data.price !== null) payload.price = data.price
    if (data.original_price !== undefined && data.original_price !== null) {
      payload.selling_price = data.original_price
    }
    if (data.product_id) payload.product_id = data.product_id
    if (data.description) payload.description = data.description
    if (data.stock_status) payload.stock_status = data.stock_status
    if (data.url) payload.url = data.url
    if (data.category) payload.category = data.category
    if (data.breadcrumbs) payload.breadcrumb = data.breadcrumbs
    if (data.ai_title) payload.ai_title = data.ai_title
    if (data.ai_description) payload.summary = data.ai_description
    if (data.vendor) payload.vendor = data.vendor
    if (data.images) payload.images = data.images
    if (data.main_image) payload.main_image = data.main_image

    // SEO meta fields
    if (data.meta_title) payload.meta_title = data.meta_title
    if (data.meta_description) payload.meta_description = data.meta_description

    // Timestamp
    if (data.timestamp) {
      payload.timestamp = data.timestamp
    } else if (data.created_at) {
      payload.timestamp = new Date(data.created_at).toISOString()
    }

    // Dimensions - format to 3 decimal places
    if (data.weight !== undefined && data.weight !== null) {
      payload.weight = typeof data.weight === 'number' ? parseFloat(data.weight.toFixed(3)) : data.weight
    }
    if (data.height !== undefined && data.height !== null) {
      payload.height = typeof data.height === 'number' ? parseFloat(data.height.toFixed(3)) : data.height
    }
    if (data.width !== undefined && data.width !== null) {
      payload.width = typeof data.width === 'number' ? parseFloat(data.width.toFixed(3)) : data.width
    }
    if (data.length !== undefined && data.length !== null) {
      payload.length = typeof data.length === 'number' ? parseFloat(data.length.toFixed(3)) : data.length
    }
    if (data.volumetric_weight !== undefined && data.volumetric_weight !== null) {
      payload.volumetric_weight = typeof data.volumetric_weight === 'number'
        ? parseFloat(data.volumetric_weight.toFixed(3))
        : data.volumetric_weight
    }

    // Variants
    if (data.variants) {
      payload.variants = data.variants
      payload.variant_attribute = "color" // Default variant attribute
    }

    return payload
  }

  const productData = getProductData(data)
  const erpnextPayload = getErpnextPayload(data)

  const handleCopyScraped = () => {
    navigator.clipboard.writeText(JSON.stringify(productData, null, 2))
    setCopiedScraped(true)
    setTimeout(() => setCopiedScraped(false), 2000)
  }

  const handleCopyErpnext = () => {
    navigator.clipboard.writeText(JSON.stringify([erpnextPayload], null, 2))
    setCopiedErpnext(true)
    setTimeout(() => setCopiedErpnext(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Scraped Data Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Scraped Data (JSON)
          </h3>
          <button
            onClick={handleCopyScraped}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm
              text-gray-600 bg-gray-100 border border-gray-300 rounded-md
              hover:bg-gray-200 transition-colors"
          >
            {copiedScraped ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy JSON
              </>
            )}
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-w-full">
          <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-words min-w-0">
            {JSON.stringify(productData, null, 2)}
          </pre>
        </div>
      </div>

      {/* ERPNext Payload Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              ERPNext Payload (JSON)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Ready-to-use payload for ERPNext API testing
            </p>
          </div>
          <button
            onClick={handleCopyErpnext}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm
              text-gray-600 bg-gray-100 border border-gray-300 rounded-md
              hover:bg-gray-200 transition-colors"
          >
            {copiedErpnext ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Payload
              </>
            )}
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-w-full">
          <pre className="text-sm text-blue-100 font-mono whitespace-pre-wrap break-words min-w-0">
            {JSON.stringify([erpnextPayload], null, 2)}
          </pre>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 mb-2">
            <strong>Note:</strong> This payload is formatted as an array (required by ERPNext API).
          </p>
          <p className="text-xs text-blue-800">
            <strong>Field mappings:</strong>{' '}
            <code className="bg-blue-100 px-1 rounded">original_price → selling_price</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">breadcrumbs → breadcrumb</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">ai_description → summary</code>
          </p>
          <p className="text-xs text-blue-800 mt-2">
            <strong>Additional fields:</strong>{' '}
            <code className="bg-blue-100 px-1 rounded">meta_title</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">meta_description</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">variants</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">variant_attribute</code> (default: "color")
          </p>
        </div>
      </div>
    </div>
  )
}
