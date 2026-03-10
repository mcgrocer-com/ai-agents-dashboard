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
      'original_price', // Maps to price (standard/RRP price in ERPNext)
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
        if (key === 'price') {
          productData['selling_price'] = value
        } else if (key === 'original_price') {
          productData['price'] = value
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

  /**
   * Sanitize text fields for ERPNext API compatibility.
   * Mirrors sanitizeForERPNext in _shared/erpnext-utils.ts
   */
  const sanitizeForERPNext = (text: string): string => {
    return text
      .replace(/\\/g, '')
      .replace(/\*/g, '')
      .replace(/"/g, '')
      .replace(/\?/g, '')
      .replace(/\|/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u201C\u201D]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Check if a URL starts with http:// or https://
   */
  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string') return false
    return url.startsWith('http://') || url.startsWith('https://')
  }

  /**
   * Filter array of URLs to only include valid ones
   */
  const filterValidUrls = (urls: unknown): string[] | null => {
    if (!Array.isArray(urls)) return null
    const valid = urls.filter((url): url is string => isValidUrl(url))
    return valid.length > 0 ? valid : null
  }

  /**
   * Get ERPNext payload format — mirrors productToERPNextFormat in _shared/erpnext-utils.ts
   */
  const getErpnextPayload = (data: any) => {
    if (!data) return {}

    const payload: any = {
      url: data.url,
      vendor: data.vendor || 'unknown',
      timestamp: data.updated_at || new Date().toISOString(),
      copyright: 'false',
    }

    if (data.product_id) payload.product_id = data.product_id

    // Product fields (included for creation or full sync)
    if (data.name) payload.name = sanitizeForERPNext(data.name)
    if (data.description) payload.description = data.description

    // Price mapping: original_price → price, price → selling_price
    if (data.original_price !== undefined && data.original_price !== null) {
      payload.price = Number(data.original_price)
    }
    if (data.price !== undefined && data.price !== null) {
      payload.selling_price = Number(data.price)
    }

    // Normalize stock_status casing to match ERPNext expected values
    if (data.stock_status) {
      const stockMap: Record<string, string> = {
        'in stock': 'In Stock',
        'in_stock': 'In Stock',
        'low stock': 'Low Stock',
        'low_stock': 'Low Stock',
        'on order': 'On Order',
        'on_order': 'On Order',
        'out of stock': 'Out of Stock',
        'out_of_stock': 'Out of Stock',
      }
      payload.stock_status =
        stockMap[data.stock_status.toLowerCase()] || data.stock_status
    }

    // Images — use copyright images if available, otherwise original
    if (
      data.non_copyright_images &&
      Array.isArray(data.non_copyright_images) &&
      data.non_copyright_images.length > 0
    ) {
      const validCopyrightImages = filterValidUrls(data.non_copyright_images)
      if (validCopyrightImages && validCopyrightImages.length > 0) {
        payload.main_image = validCopyrightImages[0]
        payload.images = validCopyrightImages
        payload.copyright = 'true'
      } else {
        if (isValidUrl(data.main_image)) payload.main_image = data.main_image
        const validImages = filterValidUrls(data.images)
        if (validImages) payload.images = validImages
      }
    } else {
      if (isValidUrl(data.main_image)) payload.main_image = data.main_image
      const validImages = filterValidUrls(data.images)
      if (validImages) payload.images = validImages
    }

    // Use copyright description if available
    if (data.non_copyright_desc) {
      payload.description = data.non_copyright_desc
      payload.copyright = 'true'
    }

    // Category fields — validate not empty
    const isCategoryValid =
      data.category && data.category !== '' && data.category !== '[]'
    const isBreadcrumbValid =
      data.breadcrumbs &&
      JSON.stringify(data.breadcrumbs) !== '[]' &&
      (Array.isArray(data.breadcrumbs) ? data.breadcrumbs.length > 0 : true)

    if (isCategoryValid) payload.category = data.category
    if (isBreadcrumbValid) payload.breadcrumb = data.breadcrumbs

    // Weight/dimension fields
    if (data.weight !== null && data.weight !== undefined)
      payload.weight = Number(data.weight)
    if (data.height !== null && data.height !== undefined)
      payload.height = Number(data.height)
    if (data.width !== null && data.width !== undefined)
      payload.width = Number(data.width)
    if (data.length !== null && data.length !== undefined)
      payload.length = Number(data.length)
    if (data.volumetric_weight !== null && data.volumetric_weight !== undefined)
      payload.volumetric_weight = Number(data.volumetric_weight)

    // SEO fields (sanitized)
    if (data.ai_title) payload.ai_title = sanitizeForERPNext(data.ai_title)
    if (data.ai_description)
      payload.summary = sanitizeForERPNext(data.ai_description)
    if (data.meta_title)
      payload.meta_title = sanitizeForERPNext(data.meta_title)
    if (data.meta_description)
      payload.meta_description = sanitizeForERPNext(data.meta_description)

    // FAQs (stringified JSON array, limit to 3)
    if (data.faq && Array.isArray(data.faq) && data.faq.length > 0) {
      payload.faqs = JSON.stringify(data.faq.slice(0, 3))
    }

    // Scraper timestamp
    if (data.timestamp) {
      payload.last_scrapped_at = data.timestamp
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
            <strong>Note:</strong> This payload mirrors{' '}
            <code className="bg-blue-100 px-1 rounded">productToERPNextFormat()</code>{' '}
            from <code className="bg-blue-100 px-1 rounded">_shared/erpnext-utils.ts</code>.
          </p>
          <p className="text-xs text-blue-800">
            <strong>Field mappings:</strong>{' '}
            <code className="bg-blue-100 px-1 rounded">original_price → price</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">price → selling_price</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">breadcrumbs → breadcrumb</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">ai_description → summary</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">faq → faqs</code>,{' '}
            <code className="bg-blue-100 px-1 rounded">timestamp → last_scrapped_at</code>
          </p>
          <p className="text-xs text-blue-800 mt-2">
            <strong>Sanitization:</strong> Text fields (name, SEO) have special characters removed.
            Copyright images/description used when available. Stock status normalized to Title Case.
          </p>
        </div>
      </div>
    </div>
  )
}
