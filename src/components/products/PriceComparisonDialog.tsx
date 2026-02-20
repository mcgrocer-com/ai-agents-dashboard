/**
 * PriceComparisonDialog Component
 *
 * Modal dialog for displaying price comparison results from various retailers.
 * Supports optional product description for better AI matching accuracy.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Scale, X, ExternalLink, Loader2, AlertTriangle, ToggleLeft, ToggleRight, Database, Globe, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface PriceComparisonProduct {
  vendor: string
  product_name: string
  price: number
  source_url: string
  availability: 'In Stock' | 'Out of Stock' | 'Unsure'
  extraction_method?: 'json-ld' | 'html-parse' | 'ai-html' | 'cached'
  last_checked?: string
}

interface PriceComparisonResults {
  success: boolean
  products?: PriceComparisonProduct[]
  metadata?: {
    execution_time: number
    description?: string | null
    cache_hit?: boolean
    cache_age_seconds?: number
  }
  debug?: Record<string, unknown>
  error?: string
}

interface PriceComparisonDialogProps {
  open: boolean
  onClose: () => void
  productName: string
  productDescription?: string
}

export function PriceComparisonDialog({
  open,
  onClose,
  productName,
  productDescription,
}: PriceComparisonDialogProps) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PriceComparisonResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [includeDescription, setIncludeDescription] = useState(true)
  const [bypassCache, setBypassCache] = useState(false)

  const fetchPriceComparison = async (forceBypass?: boolean) => {
    if (!productName) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const requestBody: Record<string, unknown> = {
        query: productName,
        limit: 6,
      }

      if (forceBypass ?? bypassCache) {
        requestBody.bypass_cache = true
      }

      // Include description if toggle is on and description exists
      if (includeDescription && productDescription) {
        requestBody.description = productDescription
      }

      const { data, error: fetchError } = await supabase.functions.invoke('on-demand-scraper-v2', {
        body: requestBody,
      })

      if (fetchError) throw fetchError

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch price comparison')
      }

      setResults(data)
    } catch (err: unknown) {
      console.error('Error comparing prices:', err)
      setError(err instanceof Error ? err.message : 'Failed to compare prices')
    } finally {
      setLoading(false)
    }
  }

  // Fetch prices when dialog opens
  useEffect(() => {
    if (open && productName) {
      fetchPriceComparison()
    }
  }, [open, productName])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  const getAvailabilityStyle = (availability: string) => {
    switch (availability) {
      case 'In Stock':
        return 'bg-green-100 text-green-700'
      case 'Out of Stock':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-orange-50">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-orange-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Price Comparison</h2>
                <p className="text-sm text-gray-600 truncate max-w-md">{productName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Description Toggle */}
              {productDescription && (
                <button
                  onClick={() => setIncludeDescription(!includeDescription)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg hover:bg-orange-100 transition-colors"
                  title={includeDescription ? 'Description included in search' : 'Description not included'}
                >
                  {includeDescription ? (
                    <ToggleRight className="h-5 w-5 text-orange-600" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                  )}
                  <span className={includeDescription ? 'text-orange-600' : 'text-gray-500'}>
                    Desc
                  </span>
                </button>
              )}
              {/* Bypass Cache Toggle */}
              <button
                onClick={() => setBypassCache(!bypassCache)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg hover:bg-orange-100 transition-colors"
                title={bypassCache ? 'Cache bypassed — fetches fresh results' : 'Using cached results if available'}
              >
                {bypassCache ? (
                  <ToggleRight className="h-5 w-5 text-orange-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-gray-400" />
                )}
                <span className={bypassCache ? 'text-orange-600' : 'text-gray-500'}>
                  Fresh
                </span>
              </button>
              {/* Retry Button */}
              <button
                onClick={() => fetchPriceComparison()}
                disabled={loading}
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Re-run price comparison"
              >
                <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-orange-600 animate-spin mb-4" />
                <p className="text-gray-600">Searching for prices across retailers...</p>
                <p className="text-sm text-gray-500 mt-1">This may take 10-30 seconds</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-red-600 font-medium">Error</p>
                <p className="text-gray-600 mt-1">{error}</p>
                <button
                  onClick={() => fetchPriceComparison()}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : results ? (
              <div className="space-y-4">
                {/* Results Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.products?.length || 0}
                      </p>
                      <p className="text-xs text-gray-500">Results Found</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {results.products?.[0]?.price
                          ? `£${results.products[0].price.toFixed(2)}`
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">Lowest Price</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {results.metadata?.execution_time
                          ? `${results.metadata.execution_time.toFixed(1)}s`
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">Search Time</p>
                    </div>
                    <div>
                      {results.metadata?.cache_hit ? (
                        <>
                          <p className="text-2xl font-bold text-blue-600">
                            {results.metadata.cache_age_seconds != null
                              ? results.metadata.cache_age_seconds < 60
                                ? `${results.metadata.cache_age_seconds}s`
                                : `${Math.round(results.metadata.cache_age_seconds / 60)}m`
                              : '—'}
                          </p>
                          <p className="text-xs text-blue-500">Cache Hit</p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-purple-600">Live</p>
                          <p className="text-xs text-purple-500">Fresh Data</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price List */}
                {results.products && results.products.length > 0 ? (
                  <div className="space-y-3">
                    {results.products.map((item, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          index === 0 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                index === 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {item.vendor}
                            </span>
                            {index === 0 && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-600 text-white">
                                Best Price
                              </span>
                            )}
                            {/* Availability Badge */}
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded ${getAvailabilityStyle(
                                item.availability
                              )}`}
                            >
                              {item.availability}
                            </span>
                            {/* Source Badge */}
                            {item.extraction_method && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  item.extraction_method === 'cached'
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-purple-50 text-purple-600'
                                }`}
                                title={
                                  item.extraction_method === 'cached'
                                    ? `From DB${item.last_checked ? ` (${new Date(item.last_checked).toLocaleDateString()})` : ''}`
                                    : `Live scraped (${item.extraction_method})`
                                }
                              >
                                {item.extraction_method === 'cached' ? (
                                  <><Database className="h-2.5 w-2.5" /> DB</>
                                ) : (
                                  <><Globe className="h-2.5 w-2.5" /> Live</>
                                )}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-sm text-gray-700 mt-1 truncate"
                            title={item.product_name}
                          >
                            {item.product_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`text-lg font-bold ${
                              index === 0 ? 'text-green-600' : 'text-gray-900'
                            }`}
                          >
                            £{item.price?.toFixed(2) || 'N/A'}
                          </span>
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View on retailer site"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No price results found for this product.</p>
                  </div>
                )}

                {/* Debug Info (collapsible) */}
                {results.debug && (
                  <details className="mt-6">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Debug Information
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(results.debug, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">Powered by ScraperAPI (Price Comparison v2)</p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
