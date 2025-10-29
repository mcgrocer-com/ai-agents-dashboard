/**
 * RawDataTab Component
 *
 * Displays raw JSON data from product scraping.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface RawDataTabProps {
  data: any
}

export function RawDataTab({ data }: RawDataTabProps) {
  const [copied, setCopied] = useState(false)

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

  const productData = getProductData(data)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(productData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Scraped Data (JSON)
        </h3>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm
            text-gray-600 bg-gray-100 border border-gray-300 rounded-md
            hover:bg-gray-200 transition-colors"
        >
          {copied ? (
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
  )
}
