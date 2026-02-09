/**
 * ScraperAgentPage Component
 *
 * Displays Scraper Products with tabs for All Products and Pinned Products.
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, SlidersHorizontal, Pin, ChevronDown, ChevronUp, CloudUpload, AlertTriangle, Clock, CheckSquare, Square, XCircle, Send, Ban } from 'lucide-react'
import { productsService, blacklistService } from '@/services'
import { scraperProductsService } from '@/services/scraperProducts.service'
import { supabase } from '@/lib/supabase/client'
import { Pagination } from '@/components/ui/Pagination'
import { DebouncedSearchInput } from '@/components/ui/DebouncedSearchInput'
import { AdvancedFilterBuilder, type FilterRule, type FilterColumn } from '@/components/filters/AdvancedFilterBuilder'
import { VendorStatistics } from '@/components/scraper/VendorStatistics'
import { VendorSelectionDialog } from '@/components/scraper/VendorSelectionDialog'
import { ProductActionsMenu } from '@/components/scraper/ProductActionsMenu'
import { useToast } from '@/hooks/useToast'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import type { SyncDataSource } from '@/services/user.service'
import type { ScrapedProduct, ProductFilters } from '@/types'
import type { DynamicFilter } from '@/types/database'

type SortField = 'name' | 'price' | 'updated_at' | 'created_at' | 'erpnext_updated_at' | 'failed_sync_at' | 'scraper_updated_at'
type SortDirection = 'asc' | 'desc'
type TabType = 'all' | 'pinned' | 'price_updated' | 'validation_issues' | 'blacklisted'

// All available columns including vendor (for default filter column selector)
const ALL_COLUMNS: FilterColumn[] = [
  { label: 'Vendor', value: 'vendor', type: 'text' },
  { label: 'Name', value: 'name', type: 'text' },
  { label: 'Product ID', value: 'product_id', type: 'text' },
  { label: 'Price', value: 'price', type: 'number' },
  { label: 'Original Price', value: 'original_price', type: 'number' },
  { label: 'Stock Status', value: 'stock_status', type: 'text' },
  { label: 'Category', value: 'category', type: 'text' },
  { label: 'Description', value: 'description', type: 'text' },
  { label: 'Height', value: 'height', type: 'number' },
  { label: 'Width', value: 'width', type: 'number' },
  { label: 'Length', value: 'length', type: 'number' },
  { label: 'Weight', value: 'weight', type: 'number' },
  { label: 'Volumetric Weight', value: 'volumetric_weight', type: 'number' },
  { label: 'Variant Count', value: 'variant_count', type: 'number' },
  { label: 'Created Date', value: 'created_at', type: 'date' },
  { label: 'Updated Date', value: 'updated_at', type: 'date' },
  { label: 'Price Updated Date', value: 'scraper_updated_at', type: 'date' },
]

// Filter columns for user-added filters (Vendor is handled by default filter)
const FILTER_COLUMNS: FilterColumn[] = ALL_COLUMNS.filter((col) => col.value !== 'vendor')

// Utility functions moved outside components for better performance
const stripHtml = (html: string | null): string => {
  if (!html) return ''
  // Use a more efficient method with regex instead of DOM manipulation
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&') // Replace &amp;
    .replace(/&lt;/g, '<') // Replace &lt;
    .replace(/&gt;/g, '>') // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .trim()
}

const formatRelativeTime = (timestamp: string | null): string => {
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

export function ScraperAgentPage() {
  const { showToast } = useToast()
  const { preferences, updateVendorSyncPreferences, toggleSyncToErpnext } = useUserPreferences()
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [products, setProducts] = useState<ScrapedProduct[]>([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const fetchRequestIdRef = useRef(0) // Track latest request to ignore stale responses
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Filter states
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [defaultVendor, setDefaultVendor] = useState<string>('')

  // Selection states
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  // Vendor selection dialog states
  const [showVendorDialog, setShowVendorDialog] = useState(false)
  const [vendorsList, setVendorsList] = useState<{ name: string; count: number; syncCount?: number }[]>([])

  // Fetch vendors on mount and set default vendor filter
  useEffect(() => {
    const loadVendors = async () => {
      const { vendors: vendorList } = await productsService.getVendors()
      if (vendorList && vendorList.length > 0) {
        // Fetch sync-ready counts for each vendor
        const vendorsWithSyncCounts = await Promise.all(
          vendorList.map(async (vendor: { name: string; count: number }) => {
            const stats = await scraperProductsService.getVendorStatistics(vendor.name)
            return {
              ...vendor,
              syncCount: stats?.withAllData || 0
            }
          })
        )

        setVendorsList(vendorsWithSyncCounts)
        setDefaultVendor('all')

        // Create dropdown options from vendors with "All Vendors" at top
        const vendorOptions = [
          { label: 'All Vendors', value: 'all' },
          ...vendorList.map((vendor: { name: string; count: number }) => ({
            label: `${vendor.name} (${vendor.count.toLocaleString()} products)`,
            value: vendor.name,
          })),
        ]

        // Create default vendor filter with dropdown and locked operator
        const defaultFilter: FilterRule = {
          id: 'default-vendor-filter',
          column: 'vendor',
          operator: '=',
          value: 'all',
          isDefault: true,
          dropdownOptions: vendorOptions,
          lockOperator: true,
        }
        setFilters([defaultFilter])
      }
    }
    loadVendors()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [activeTab, page, pageSize, searchTerm, sortField, sortDirection, filters])

  // Convert FilterRules to DynamicFilters for the API
  const convertToDynamicFilters = (filterRules: FilterRule[]): DynamicFilter[] => {
    return filterRules
      .filter((rule) => {
        // Exclude vendor filter if "all" is selected
        if (rule.column === 'vendor' && rule.value === 'all') {
          return false
        }
        return true
      })
      .map((rule) => ({
        field: rule.column,
        operator: rule.operator,
        value: rule.value,
      }))
  }

  const fetchProducts = useCallback(async () => {
    // Increment request ID to track this specific request
    const currentRequestId = ++fetchRequestIdRef.current

    setIsLoading(true)
    setError(null)

    // Build dynamic filters
    let dynamicFilters = filters.length > 0 ? convertToDynamicFilters(filters) : []

    // For price_updated tab, add filter for scraper_updated_at IS NOT NULL
    if (activeTab === 'price_updated') {
      dynamicFilters = [
        ...dynamicFilters,
        {
          field: 'scraper_updated_at',
          operator: 'is not null',
          value: null,
        },
      ]
    }

    // For blacklisted tab, add filter for blacklisted = true
    if (activeTab === 'blacklisted') {
      dynamicFilters = [
        ...dynamicFilters,
        {
          field: 'blacklisted',
          operator: '=',
          value: 'true',
        },
      ]
    }

    const productFilters: ProductFilters = {
      search: searchTerm || undefined,
      sortBy: activeTab === 'price_updated' ? 'scraper_updated_at' : sortField,
      sortOrder: activeTab === 'price_updated' ? 'desc' : sortDirection,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      dynamicFilters: dynamicFilters.length > 0 ? dynamicFilters : undefined,
    }

    // Use appropriate service method based on active tab
    let result
    if (activeTab === 'pinned') {
      result = await productsService.getPinnedProducts(productFilters)
    } else if (activeTab === 'validation_issues') {
      // Use RPC function for validation issues (filters products with validation_error IS NOT NULL)
      result = await productsService.getProductsWithValidationErrors(productFilters)
    } else {
      result = await productsService.getProducts(productFilters)
    }

    // Ignore stale responses - only process if this is still the latest request
    if (currentRequestId !== fetchRequestIdRef.current) {
      return
    }

    if (result.error) {
      setError(result.error)
      setProducts([])
      setCount(0)
    } else {
      // Process products to truncate descriptions
      const processedProducts = result.products.map((product: ScrapedProduct) => ({
        ...product,
        description: product.description
          ? stripHtml(product.description.substring(0, 200)) + (product.description.length > 200 ? '...' : '')
          : ''
      }))
      setProducts(processedProducts)
      setCount(result.count)
    }

    setIsLoading(false)
  }, [activeTab, page, pageSize, searchTerm, sortField, sortDirection, filters])

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
    setPage(1)
  }, [])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setPage(1)
    setSearchTerm('')
    // Clear selection when changing tabs
    setSelectedProductIds(new Set())
    setSelectionMode(false)
  }, [])

  // Selection handlers
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev)
    setSelectedProductIds(new Set())
  }, [])

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }, [])

  // Check if all products on current page are selected
  const areAllCurrentPageSelected = useMemo(() => {
    if (products.length === 0) return false
    return products.every((p) => selectedProductIds.has(p.id))
  }, [products, selectedProductIds])

  // Memoize count of selected products on current page
  const selectedOnPageCount = useMemo(() => {
    return products.filter(p => selectedProductIds.has(p.id)).length
  }, [products, selectedProductIds])

  const selectAllProducts = useCallback(() => {
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev)
      if (areAllCurrentPageSelected) {
        // Deselect all products on current page
        products.forEach((p) => newSet.delete(p.id))
      } else {
        // Select all products on current page
        products.forEach((p) => newSet.add(p.id))
      }
      return newSet
    })
  }, [products, areAllCurrentPageSelected])

  const clearSelection = useCallback(() => {
    setSelectedProductIds(new Set())
    setSelectionMode(false)
  }, [])

  // Bulk action to send products to copyright agent
  const handleBulkSendToCopyright = useCallback(async () => {
    if (selectedProductIds.size === 0) {
      showToast('No products selected', 'error')
      return
    }

    setIsSendingBulk(true)
    const productIdsArray = Array.from(selectedProductIds)
    let successCount = 0
    let failCount = 0

    try {
      // Send each product to copyright agent
      for (const productId of productIdsArray) {
        try {
          const { data, error } = await supabase.functions.invoke('add-product-copyright', {
            body: { productId }
          })

          if (error) throw error

          if (data.success) {
            successCount++
          } else {
            failCount++
            console.error(`Failed to send product ${productId}:`, data.error)
          }
        } catch (err) {
          failCount++
          console.error(`Error sending product ${productId} to Copyright Agent:`, err)
        }
      }

      // Show result toast
      if (successCount > 0 && failCount === 0) {
        showToast(
          `Successfully sent ${successCount} ${successCount === 1 ? 'product' : 'products'} to Copyright Agent`,
          'success'
        )
      } else if (successCount > 0 && failCount > 0) {
        showToast(
          `Sent ${successCount} ${successCount === 1 ? 'product' : 'products'}, ${failCount} failed`,
          'info'
        )
      } else {
        showToast('Failed to send products to Copyright Agent', 'error')
      }

      // Clear selection and refresh
      clearSelection()
      await fetchProducts()
    } catch (err) {
      console.error('Error in bulk send to copyright:', err)
      showToast('An error occurred while sending products', 'error')
    } finally {
      setIsSendingBulk(false)
    }
  }, [selectedProductIds, showToast, clearSelection, fetchProducts])

  // Bulk action to blacklist products
  const handleBulkBlacklist = useCallback(async () => {
    if (selectedProductIds.size === 0) {
      showToast('No products selected', 'error')
      return
    }

    const reason = window.prompt('Please provide a reason for blacklisting these products:')
    if (!reason || reason.trim() === '') {
      showToast('Blacklist operation cancelled - reason is required', 'info')
      return
    }

    try {
      const productIdsArray = Array.from(selectedProductIds)
      const result = await blacklistService.bulkBlacklistProducts(productIdsArray, reason.trim())

      if (result.success) {
        showToast(
          `Successfully blacklisted ${result.data?.count || productIdsArray.length} ${productIdsArray.length === 1 ? 'product' : 'products'}`,
          'success'
        )
        clearSelection()
        await fetchProducts()
      } else {
        showToast(result.error?.message || 'Failed to blacklist products', 'error')
      }
    } catch (err) {
      console.error('Error in bulk blacklist:', err)
      showToast('An error occurred while blacklisting products', 'error')
    }
  }, [selectedProductIds, showToast, clearSelection, fetchProducts])

  // Bulk action to unblacklist products
  const handleBulkUnblacklist = useCallback(async () => {
    if (selectedProductIds.size === 0) {
      showToast('No products selected', 'error')
      return
    }

    try {
      const productIdsArray = Array.from(selectedProductIds)
      const result = await blacklistService.bulkUnblacklistProducts(productIdsArray)

      if (result.success) {
        showToast(
          `Successfully unblacklisted ${result.data?.count || productIdsArray.length} ${productIdsArray.length === 1 ? 'product' : 'products'}`,
          'success'
        )
        clearSelection()
        await fetchProducts()
      } else {
        showToast(result.error?.message || 'Failed to unblacklist products', 'error')
      }
    } catch (err) {
      console.error('Error in bulk unblacklist:', err)
      showToast('An error occurred while unblacklisting products', 'error')
    }
  }, [selectedProductIds, showToast, clearSelection, fetchProducts])

  // Handler for saving vendor sync preferences
  const handleSaveVendorPreferences = async (
    vendors: string[],
    prioritizeCopyright: boolean,
    dataSource: SyncDataSource
  ) => {
    const success = await updateVendorSyncPreferences(vendors, prioritizeCopyright, dataSource)
    if (success) {
      showToast(
        vendors.length === 0
          ? 'All vendors will be synced to ERPNext'
          : `${vendors.length} vendor${vendors.length > 1 ? 's' : ''} selected for ERPNext sync`,
        'success'
      )
    } else {
      showToast('Failed to save vendor preferences', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold text-secondary-900">Scraper Agent</h1>
        <p className="text-secondary-600 mt-1">
          Browse and manage products scraped from various sources
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => handleTabChange('all')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'all'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              All Products
            </div>
          </button>
          <button
            onClick={() => handleTabChange('pinned')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'pinned'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4" />
              Pinned Products
            </div>
          </button>
          <button
            onClick={() => handleTabChange('price_updated')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'price_updated'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Price Updated
            </div>
          </button>
          <button
            onClick={() => handleTabChange('validation_issues')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'validation_issues'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Validation Issues
            </div>
          </button>
          <button
            onClick={() => handleTabChange('blacklisted')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'blacklisted'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Blacklisted
            </div>
          </button>
        </nav>
      </div>

      {/* Vendor Statistics */}
      {defaultVendor && (
        <div className="flex-shrink-0">
          <VendorStatistics
            vendor={defaultVendor}
            onConfigureClick={() => setShowVendorDialog(true)}
            syncEnabled={preferences?.sync_to_erpnext ?? true}
            onSyncToggle={toggleSyncToErpnext}
          />
        </div>
      )}

      {/* Search and Controls Bar */}
      <div className="flex-shrink-0 flex gap-3 items-center">
        {/* Selection Mode Toggle */}
        <button
          onClick={toggleSelectionMode}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${selectionMode
            ? 'border-primary-500 bg-primary-50 text-primary-700'
            : 'border-secondary-300 text-secondary-700 hover:bg-secondary-50'
            }`}
          title="Toggle selection mode"
        >
          {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          <span>Select</span>
          {selectionMode && selectedProductIds.size > 0 && (
            <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-0.5">
              {selectedProductIds.size}
            </span>
          )}
        </button>

        {/* Select All Checkbox - Only shown when in selection mode */}
        {selectionMode && (
          <button
            onClick={selectAllProducts}
            className="flex items-center gap-2 px-4 py-2 border border-secondary-300 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50"
            title={areAllCurrentPageSelected ? "Deselect all on this page" : "Select all on this page"}
          >
            {areAllCurrentPageSelected ? (
              <CheckSquare className="w-4 h-4 text-primary-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {areAllCurrentPageSelected ? 'Deselect Page' : 'Select Page'}
            </span>
          </button>
        )}

        {/* Search Input */}
        <DebouncedSearchInput
          placeholder={`Search ${activeTab === 'pinned' ? 'pinned ' : ''}products...`}
          onSearch={handleSearch}
          className="flex-1"
          key={activeTab} // Reset input when tab changes
        />

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${filters.filter((f) => !f.isDefault).length > 0
            ? 'border-primary-500 bg-primary-50 text-primary-700'
            : 'border-secondary-300 text-secondary-700 hover:bg-secondary-50'
            }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {filters.filter((f) => !f.isDefault).length > 0 && (
            <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-0.5">
              {filters.filter((f) => !f.isDefault).length}
            </span>
          )}
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
          <option value="updated_at-desc">Recently Updated</option>
          <option value="updated_at-asc">Least Recently Updated</option>
          <option value="scraper_updated_at-desc">Recently Price Updated</option>
          <option value="scraper_updated_at-asc">Least Recently Price Updated</option>
          <option value="erpnext_updated_at-desc">Recently Synced to ERPNext</option>
          <option value="erpnext_updated_at-asc">Least Recently Synced to ERPNext</option>
          <option value="failed_sync_at-desc">Recently Failed Syncs</option>
          <option value="failed_sync_at-asc">Oldest Failed Syncs</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="price-asc">Price Low-High</option>
          <option value="price-desc">Price High-Low</option>
        </select>
      </div>

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-secondary-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-secondary-900">Advanced Filters</h3>
            {defaultVendor && (
              <p className="text-xs text-yellow-600">
                {defaultVendor === 'all' ? 'Showing all vendors' : `Filtered by vendor: ${defaultVendor}`}
              </p>
            )}
          </div>
          <AdvancedFilterBuilder
            columns={FILTER_COLUMNS}
            allColumns={ALL_COLUMNS}
            filters={filters}
            onFiltersChange={(newFilters) => {
              setFilters(newFilters)
              // Update defaultVendor state when vendor filter changes
              const vendorFilter = newFilters.find((f) => f.column === 'vendor')
              if (vendorFilter) {
                setDefaultVendor(vendorFilter.value)
              }
              setPage(1) // Reset to first page when filters change
            }}
          />
        </div>
      )}

      {/* Bulk Actions Bar - Shows when items are selected */}
      {selectionMode && selectedProductIds.size > 0 && (
        <div className="flex-shrink-0 bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-primary-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-primary-900">
                {selectedProductIds.size} {selectedProductIds.size === 1 ? 'product' : 'products'} selected
              </span>
              <span className="text-xs text-primary-700">
                {selectedOnPageCount} on this page
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkSendToCopyright}
              disabled={isSendingBulk}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingBulk ? 'Sending...' : 'Send to Copyright Agent'}</span>
            </button>
            {activeTab === 'blacklisted' ? (
              <button
                onClick={handleBulkUnblacklist}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <Ban className="w-4 h-4" />
                <span>Unblacklist Selected</span>
              </button>
            ) : (
              <button
                onClick={handleBulkBlacklist}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                <Ban className="w-4 h-4" />
                <span>Blacklist Selected</span>
              </button>
            )}
            <button
              onClick={clearSelection}
              className="flex items-center gap-2 px-4 py-2 border border-secondary-300 bg-white text-secondary-700 rounded-lg text-sm font-medium hover:bg-secondary-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex-shrink-0 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <p className="text-secondary-600">
            Showing {products.length} of {count.toLocaleString()}{' '}
            {activeTab === 'pinned' ? 'pinned ' : activeTab === 'price_updated' ? 'price-updated ' : activeTab === 'validation_issues' ? 'products with validation issues' : activeTab === 'blacklisted' ? 'blacklisted products' : 'products'}
          </p>
          {selectionMode && selectedProductIds.size > 0 && (
            <p className="text-primary-600 font-medium">
              • {selectedProductIds.size} selected across all pages
            </p>
          )}
        </div>
        {searchTerm && (
          <span className="text-secondary-500 text-sm">
            Searching for: &quot;{searchTerm}&quot;
          </span>
        )}
      </div>

      {/* Products List - fills remaining space */}
      <div className="flex-1 flex flex-col min-h-0">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error loading products: {error.message}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <ProductsList
              products={products}
              isLoading={isLoading}
              showPinned={activeTab === 'pinned'}
              tabType={activeTab}
              onRefresh={fetchProducts}
              selectionMode={selectionMode}
              selectedProductIds={selectedProductIds}
              onToggleSelection={toggleProductSelection}
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0">
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

      {/* Vendor Selection Dialog */}
      <VendorSelectionDialog
        open={showVendorDialog}
        onClose={() => setShowVendorDialog(false)}
        vendors={vendorsList}
        selectedVendors={preferences?.sync_vendors || []}
        prioritizeCopyright={preferences?.prioritize_copyright || false}
        dataSource={preferences?.sync_data_source || 'All'}
        onSave={handleSaveVendorPreferences}
      />
    </div>
  )
}

/**
 * Product Card Component - Memoized for better performance
 */
interface ProductCardProps {
  product: ScrapedProduct
  showPinned: boolean
  onRefresh?: () => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelection?: (productId: string) => void
}

const ProductCard = memo(({ product, showPinned, onRefresh, selectionMode = false, isSelected = false, onToggleSelection }: ProductCardProps) => {
  const navigate = useNavigate()

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(product.id)
    } else {
      // Support Ctrl/Cmd+Click or middle-click to open in new tab
      if (e.ctrlKey || e.metaKey || e.button === 1) {
        // HashRouter: construct URL with hash for proper routing
        window.open(`${window.location.origin}${window.location.pathname}#/scraper-agent/${product.id}`, '_blank')
      } else {
        navigate(`/scraper-agent/${product.id}`, { state: { from: 'scraper-agent' } })
      }
    }
  }, [navigate, product.id, selectionMode, onToggleSelection])

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onToggleSelection) {
      onToggleSelection(product.id)
    }
  }, [onToggleSelection, product.id])

  const handleAuxClick = useCallback((e: React.MouseEvent) => {
    // Handle middle-click (button 1)
    if (e.button === 1 && !selectionMode) {
      e.preventDefault()
      // HashRouter: construct URL with hash for proper routing
      window.open(`${window.location.origin}${window.location.pathname}#/scraper-agent/${product.id}`, '_blank')
    }
  }, [product.id, selectionMode])

  return (
    <div
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      className="block p-4 hover:bg-secondary-50 cursor-pointer relative hover-bg-optimized"
      style={{ contain: 'layout style paint' }}
    >
      {/* Selection Checkbox - Shows when in selection mode */}
      {selectionMode && (
        <div className="absolute top-4 left-4 z-10" onClick={handleCheckboxClick}>
          {isSelected ? (
            <CheckSquare className="w-6 h-6 text-primary-600 cursor-pointer" />
          ) : (
            <Square className="w-6 h-6 text-gray-400 cursor-pointer hover:text-gray-600" />
          )}
        </div>
      )}

      {/* Pin indicator for pinned products */}
      {showPinned && !selectionMode && (
        <div className="absolute top-4 right-4">
          <Pin className="w-5 h-5 text-yellow-500 fill-current" />
        </div>
      )}

      <div className={`flex items-start gap-4 ${showPinned && !selectionMode ? 'pr-8' : ''} ${selectionMode ? 'pl-10' : ''}`}>
        {/* Product Image */}
        {product.main_image ? (
          <img
            src={product.main_image}
            alt={product.name || 'Product'}
            className="w-16 h-16 rounded object-cover flex-shrink-0"
            loading="lazy"
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {product.updated_at && (
                <span className="text-xs text-secondary-500">
                  {formatRelativeTime(product.updated_at)}
                </span>
              )}
              {/* ERPNext Sync Status Badge */}
              {product.sync_status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${product.sync_status === 'synced'
                    ? 'bg-blue-100 text-blue-700'
                    : product.sync_status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}
                  title={
                    product.sync_status === 'synced'
                      ? `Synced to ERPNext${product.item_code ? ` (${product.item_code})` : ''}`
                      : product.sync_status === 'failed'
                        ? `Sync failed${product.failed_sync_error_message ? `: ${product.failed_sync_error_message}` : ''}`
                        : 'Not yet synced'
                  }
                >
                  {product.sync_status === 'synced' && <CloudUpload className="w-3 h-3" />}
                  {product.sync_status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                  {product.sync_status === 'pending' && <Clock className="w-3 h-3" />}
                  <span>
                    {product.sync_status === 'synced' && 'Synced'}
                    {product.sync_status === 'failed' && 'Failed'}
                    {product.sync_status === 'pending' && 'Pending'}
                  </span>
                </span>
              )}
              {/* Validation Error Badge */}
              {product.validation_error && (
                <span
                  className="text-xs px-2 py-0.5 rounded flex items-center gap-1 bg-red-100 text-red-700"
                  title={product.validation_error}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Validation Error</span>
                </span>
              )}
              {/* Blacklisted Badge */}
              {product.blacklisted && (
                <span
                  className="text-xs px-2 py-0.5 rounded flex items-center gap-1 bg-red-600 text-white"
                  title="This product has been blacklisted"
                >
                  <Ban className="w-3 h-3" />
                  <span>Blacklisted</span>
                </span>
              )}
              {/* Product Actions Menu */}
              <ProductActionsMenu
                productId={product.id}
                productName={product.name || 'Unnamed Product'}
                onActionComplete={onRefresh}
              />
            </div>
          </div>
          <p className="text-sm text-secondary-600 line-clamp-2 mt-1">
            {product.description}
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
                  className={`text-xs px-2 py-0.5 rounded ${product.stock_status.toLowerCase().includes('in stock') ||
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
  )
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  // Only re-render if product data, selection state, or selection mode changes
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.description === nextProps.product.description &&
    prevProps.product.updated_at === nextProps.product.updated_at &&
    prevProps.product.sync_status === nextProps.product.sync_status &&
    prevProps.product.validation_error === nextProps.product.validation_error &&
    prevProps.product.blacklisted === nextProps.product.blacklisted &&
    prevProps.showPinned === nextProps.showPinned &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.isSelected === nextProps.isSelected
  )
})

ProductCard.displayName = 'ProductCard'

/**
 * Products List Component - Memoized for better performance
 */
interface ProductsListProps {
  products: ScrapedProduct[]
  isLoading: boolean
  showPinned?: boolean
  tabType?: TabType
  onRefresh?: () => void
  selectionMode?: boolean
  selectedProductIds?: Set<string>
  onToggleSelection?: (productId: string) => void
}

const ProductsList = memo(({ products, isLoading, showPinned = false, tabType = 'all', onRefresh, selectionMode = false, selectedProductIds = new Set(), onToggleSelection }: ProductsListProps) => {
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
    const getEmptyStateContent = () => {
      switch (tabType) {
        case 'pinned':
          return {
            icon: <Pin className="w-10 h-10 text-yellow-500" />,
            gradient: 'from-yellow-100 via-yellow-50 to-amber-100 border-yellow-200',
            title: 'No pinned products found',
            message: 'Pin products from the product detail page to see them here'
          }
        case 'price_updated':
          return {
            icon: <Clock className="w-10 h-10 text-blue-500" />,
            gradient: 'from-blue-100 via-blue-50 to-indigo-100 border-blue-200',
            title: 'No price-updated products found',
            message: 'Products updated through price comparison sync will appear here'
          }
        case 'validation_issues':
          return {
            icon: <AlertTriangle className="w-10 h-10 text-red-500" />,
            gradient: 'from-red-100 via-red-50 to-orange-100 border-red-200',
            title: 'No validation issues found',
            message: 'All products have passed validation checks'
          }
        case 'blacklisted':
          return {
            icon: <Ban className="w-10 h-10 text-red-600" />,
            gradient: 'from-red-100 via-red-50 to-red-100 border-red-300',
            title: 'No blacklisted products found',
            message: 'Products that have been blacklisted will appear here'
          }
        default:
          return {
            icon: <Package className="w-10 h-10 text-primary-400" />,
            gradient: 'from-primary-100 via-primary-50 to-purple-100 border-primary-200',
            title: 'No products found',
            message: 'Try adjusting your search term'
          }
      }
    }

    const emptyState = getEmptyStateContent()

    return (
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
        <div className="flex flex-col items-center justify-center py-12">
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${emptyState.gradient} flex items-center justify-center mb-4 border`}>
            {emptyState.icon}
          </div>
          <p className="text-secondary-600 text-center font-medium">
            {emptyState.title}
          </p>
          <p className="text-sm text-secondary-500 text-center mt-2">
            {emptyState.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-secondary-200"
    >
      <div className="divide-y divide-secondary-200">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showPinned={showPinned}
            onRefresh={onRefresh}
            selectionMode={selectionMode}
            isSelected={selectedProductIds.has(product.id)}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>
    </div>
  )
})

ProductsList.displayName = 'ProductsList'
