/**
 * PinnedProductsPage Component
 *
 * Displays all pinned products with search, filtering, sorting, and pagination.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, Package, Search } from 'lucide-react'
import { productsService } from '@/services'
import { Pagination } from '@/components/ui/Pagination'
import type { ScrapedProduct, ProductFilters } from '@/types'

type SortField = 'name' | 'price' | 'updated_at' | 'created_at'
type SortDirection = 'asc' | 'desc'

export function PinnedProductsPage() {
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    fetchPinnedProducts()
  }, [page, pageSize, searchTerm, sortField, sortDirection])

  const fetchPinnedProducts = async () => {
    setIsLoading(true)
    setError(null)

    const filters: ProductFilters = {
      search: searchTerm || undefined,
      sortBy: sortField,
      sortOrder: sortDirection,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    const { products: data, count: total, error: err } = await productsService.getPinnedProducts(filters)

    if (err) {
      setError(err)
    } else {
      setProducts(data)
      setCount(total)
    }

    setIsLoading(false)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Pin className="h-8 w-8 text-yellow-500 fill-current" />
          <h1 className="text-3xl font-bold text-secondary-900">Pinned Products</h1>
        </div>
        <p className="text-secondary-600 mt-1">
          View and manage your pinned products
        </p>
      </div>

      {/* Search and Controls Bar */}
      <div className="flex gap-3 items-center">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            placeholder="Search pinned products..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Sort Dropdown */}
        <select
          value={`${sortField}-${sortDirection}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-') as [SortField, SortDirection]
            setSortField(field)
            setSortDirection(dir)
            setPage(1)
          }}
          className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        >
          <option value="updated_at-desc">Recently Updated</option>
          <option value="updated_at-asc">Oldest First</option>
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest Created</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="price-asc">Price Low-High</option>
          <option value="price-desc">Price High-Low</option>
        </select>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-secondary-600">
          Showing {products.length} of {count.toLocaleString()} pinned products
        </p>
      </div>

      {/* Products List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading products: {error.message}</p>
        </div>
      ) : (
        <PinnedProductsList products={products} isLoading={isLoading} />
      )}

      {/* Pagination */}
      {!isLoading && count > 0 && (
        <Pagination
          currentPage={page}
          pageSize={pageSize}
          totalCount={count}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}

/**
 * Pinned Products List Component
 */
interface PinnedProductsListProps {
  products: ScrapedProduct[]
  isLoading: boolean
}

function PinnedProductsList({ products, isLoading }: PinnedProductsListProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
        <div className="divide-y divide-secondary-200">
          {/* Shimmer loading skeleton */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="p-4 animate-pulse">
              <div className="flex items-start gap-4">
                {/* Image skeleton */}
                <div className="w-16 h-16 rounded bg-gray-200 flex-shrink-0"></div>

                {/* Content skeleton */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-5 w-3/4 bg-gray-200 rounded"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded flex-shrink-0"></div>
                  </div>
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                  <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                  <div className="flex items-center gap-4">
                    <div className="h-3 w-20 bg-gray-200 rounded"></div>
                    <div className="h-3 w-16 bg-gray-200 rounded"></div>
                    <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-100 flex items-center justify-center mb-4 border border-yellow-200">
            <Pin className="w-10 h-10 text-yellow-500" />
          </div>
          <p className="text-secondary-600 text-center font-medium">No pinned products found</p>
          <p className="text-sm text-secondary-500 text-center mt-2">
            Pin products from the product detail page to see them here
          </p>
        </div>
      </div>
    )
  }

  // Helper function to strip HTML tags
  const stripHtml = (html: string | null) => {
    if (!html) return ''
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Helper function to format relative time
  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
      <div className="divide-y divide-secondary-200">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => navigate(`/scraper-agent/${product.id}`, { state: { from: 'scraper-agent' } })}
            className="block p-4 hover:bg-secondary-50 transition-colors cursor-pointer relative"
          >
            {/* Pin indicator */}
            <div className="absolute top-4 right-4">
              <Pin className="w-5 h-5 text-yellow-500 fill-current" />
            </div>

            <div className="flex items-start gap-4 pr-8">
              {/* Product Image */}
              {product.main_image ? (
                <img
                  src={product.main_image}
                  alt={product.name || 'Product'}
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded bg-gradient-to-br from-primary-100 via-primary-50 to-purple-100 flex items-center justify-center flex-shrink-0 border border-primary-200">
                  <Package className="w-8 h-8 text-primary-400" />
                </div>
              )}

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-secondary-900 truncate">
                    {product.name || 'Unnamed Product'}
                  </h3>
                  {product.updated_at && (
                    <span className="text-xs text-secondary-500 flex-shrink-0">
                      {formatRelativeTime(product.updated_at)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-secondary-600 line-clamp-2 mt-1">
                  {stripHtml(product.description)}
                </p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {product.vendor && (
                    <span className="text-xs text-secondary-600">{product.vendor.toUpperCase()}</span>
                  )}
                  {product.price && (
                    <>
                      <span className="text-xs text-secondary-400">•</span>
                      <span className="text-xs font-medium text-secondary-900">
                        £{Number(product.price).toFixed(2)}
                      </span>
                    </>
                  )}
                  {product.stock_status && (
                    <>
                      <span className="text-xs text-secondary-400">•</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          product.stock_status.toLowerCase().includes('in stock') ||
                          product.stock_status.toLowerCase() === 'available'
                            ? 'bg-green-100 text-green-700'
                            : product.stock_status.toLowerCase().includes('out of stock')
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {product.stock_status}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
