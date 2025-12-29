/**
 * PriceComparisonDialog Component
 *
 * Modal dialog for displaying price comparison results from various retailers.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Scale, X, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface PriceComparisonProduct {
  vendor: string
  product_name: string
  price: number
  source_url: string
}

interface PriceComparisonResults {
  success: boolean
  products?: PriceComparisonProduct[]
  metadata?: {
    execution_time: number
  }
  debug?: Record<string, unknown>
  error?: string
}

interface PriceComparisonDialogProps {
  open: boolean
  onClose: () => void
  productName: string
}

export function PriceComparisonDialog({ open, onClose, productName }: PriceComparisonDialogProps) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PriceComparisonResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPriceComparison = async () => {
    if (!productName) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('price-comparison', {
        body: {
          query: productName,
          limit: 6,
        },
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
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
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
                  onClick={fetchPriceComparison}
                  className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : results ? (
              <div className="space-y-4">
                {/* Results Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
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
                          <div className="flex items-center gap-2">
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
            <p className="text-xs text-gray-500">Powered by Serper API (Price Comparison)</p>
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
