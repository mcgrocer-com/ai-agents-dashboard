/**
 * ProductsPage Component
 *
 * Displays Scraper Products from Supabase with search, filtering, sorting, and pagination.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Search, SlidersHorizontal } from 'lucide-react'
import { useScraperProducts } from '@/hooks'
import { scraperProductsService, type ScraperProduct } from '@/services/scraperProducts.service'
import { AdvancedFilterBuilder, type FilterRule } from '@/components/filters/AdvancedFilterBuilder'
import { Pagination } from '@/components/ui/Pagination'
import { Dialog } from '@/components/ui/Dialog'

type SortField = 'name' | 'price' | 'vendor' | 'created_at'
type SortDirection = 'asc' | 'desc'

export function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>([])
  const [tempFilters, setTempFilters] = useState<FilterRule[]>([])
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const columns = scraperProductsService.getAvailableColumns()

  const { products, count, isLoading, error } = useScraperProducts({
    filters: appliedFilters,
    page,
    pageSize,
  })

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)

    // Add search filter to applied filters
    if (value.trim()) {
      const searchFilter: FilterRule = {
        id: 'search',
        column: 'name',
        operator: 'contains',
        value: value.trim(),
      }

      // Remove existing search filter and add new one
      setAppliedFilters((prev) => [...prev.filter((f) => f.id !== 'search'), searchFilter])
    } else {
      // Remove search filter if empty
      setAppliedFilters((prev) => prev.filter((f) => f.id !== 'search'))
    }
  }

  const handleOpenFilterDialog = () => {
    // Copy applied filters (excluding search) to temp filters
    setTempFilters(appliedFilters.filter((f) => f.id !== 'search'))
    setShowFilterDialog(true)
  }

  const handleApplyFilters = () => {
    // Apply temp filters to applied filters, preserving search filter
    const searchFilter = appliedFilters.find((f) => f.id === 'search')
    setAppliedFilters(searchFilter ? [...tempFilters, searchFilter] : tempFilters)
    setShowFilterDialog(false)
    setPage(1)
  }

  const handleCancelFilters = () => {
    setShowFilterDialog(false)
    // Reset temp filters
    setTempFilters(appliedFilters.filter((f) => f.id !== 'search'))
  }

  // Apply sorting to products
  const sortedProducts = [...products].sort((a, b) => {
    let aVal: any = a[sortField]
    let bVal: any = b[sortField]

    if (sortField === 'price') {
      aVal = Number(aVal) || 0
      bVal = Number(bVal) || 0
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Count filters excluding search
  const filterCount = appliedFilters.filter((f) => f.id !== 'search').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">Products</h1>
        <p className="text-secondary-600 mt-1">
          Browse and filter products scraped from various sources
        </p>
      </div>

      {/* Search and Controls Bar */}
      <div className="flex gap-3 items-center">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={handleOpenFilterDialog}
          className="flex items-center gap-2 px-4 py-2 border border-secondary-300 rounded-lg transition-colors text-secondary-700 hover:bg-secondary-50"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
          {filterCount > 0 && (
            <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {filterCount}
            </span>
          )}
        </button>

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
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="price-asc">Price Low-High</option>
          <option value="price-desc">Price High-Low</option>
          <option value="vendor-asc">Vendor A-Z</option>
          <option value="vendor-desc">Vendor Z-A</option>
        </select>
      </div>

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onClose={handleCancelFilters} title="Filter Products">
        <div className="space-y-6">
          <AdvancedFilterBuilder
            columns={columns}
            filters={tempFilters}
            onFiltersChange={setTempFilters}
            onApply={handleApplyFilters}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-secondary-200">
            <button
              onClick={handleCancelFilters}
              className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Dialog>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-secondary-600">
          Showing {sortedProducts.length} of {count?.toLocaleString()} products
        </p>
        {appliedFilters.length > 0 && (
          <button
            onClick={() => {
              setAppliedFilters([])
              setTempFilters([])
              setSearchTerm('')
              setPage(1)
            }}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Products List */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading products: {error.message}</p>
        </div>
      ) : (
        <ScraperProductsList products={sortedProducts} isLoading={isLoading} />
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
 * Scraper Products List Component
 */
interface ScraperProductsListProps {
  products: ScraperProduct[]
  isLoading: boolean
}

function ScraperProductsList({ products, isLoading }: ScraperProductsListProps) {
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
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 via-primary-50 to-purple-100 flex items-center justify-center mb-4 border border-primary-200">
            <Package className="w-10 h-10 text-primary-400" />
          </div>
          <p className="text-secondary-600 text-center font-medium">No products found</p>
          <p className="text-sm text-secondary-500 text-center mt-2">
            Try adjusting your filters or search term
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
            onClick={() => navigate(`/products/${product.id}`)}
            className="block p-4 hover:bg-secondary-50 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-4">
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
