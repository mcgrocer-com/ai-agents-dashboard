/**
 * FailedSyncDialog Component
 *
 * Dialog that displays products that failed to sync to ERPNext with their error messages.
 * Useful for debugging sync issues.
 */

import { useState, useEffect, useCallback } from 'react'
import { X, AlertTriangle, ExternalLink, RefreshCw, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react'
import { scraperProductsService } from '@/services/scraperProducts.service'

interface FailedProduct {
  id: string
  url: string
  name: string | null
  vendor: string | null
  failed_sync_error_message: string | null
  failed_sync_at: string | null
}

interface FailedSyncDialogProps {
  open: boolean
  onClose: () => void
  vendor: string
}

export function FailedSyncDialog({ open, onClose, vendor }: FailedSyncDialogProps) {
  const [products, setProducts] = useState<FailedProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const pageSize = 20

  const fetchFailedProducts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await scraperProductsService.getFailedSyncProducts(vendor, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })

      if (result.error) {
        setError(result.error.message)
      } else {
        setProducts(result.products)
        setTotalCount(result.count)
      }
    } catch (err) {
      setError('Failed to load failed products')
      console.error('Error fetching failed products:', err)
    } finally {
      setIsLoading(false)
    }
  }, [vendor, page])

  useEffect(() => {
    if (open) {
      fetchFailedProducts()
    }
  }, [open, fetchFailedProducts])

  // Reset page when dialog opens
  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleCopyError = async (id: string, errorMessage: string) => {
    try {
      await navigator.clipboard.writeText(errorMessage)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Failed Sync Products</h2>
                <p className="text-sm text-gray-500">
                  {totalCount} product{totalCount !== 1 ? 's' : ''} failed to sync to ERPNext
                  {vendor !== 'all' && ` for ${vendor}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchFailedProducts}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                {error}
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600 font-medium">No failed products</p>
                <p className="text-sm text-gray-500 mt-1">All products have synced successfully</p>
              </div>
            ) : (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {product.name || 'Unnamed Product'}
                          </h3>
                          {product.vendor && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              {product.vendor.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2 truncate">
                          ID: {product.id}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                          <span>Failed at: {formatDate(product.failed_sync_at)}</span>
                          {product.url && (
                            <>
                              <span>•</span>
                              <a
                                href={product.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700 flex items-center gap-1"
                              >
                                View Product <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </div>
                        {/* Error Message */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <code className="text-xs text-red-800 whitespace-pre-wrap break-all flex-1">
                              {product.failed_sync_error_message || 'No error message'}
                            </code>
                            <button
                              onClick={() =>
                                handleCopyError(product.id, product.failed_sync_error_message || '')
                              }
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                              title="Copy error message"
                            >
                              {copiedId === product.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1} -{' '}
                {Math.min(page * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isLoading}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
