/**
 * AgentMonitoringPage Component
 *
 * Reusable agent monitoring and management page that can be configured
 * for different agent types (category, weight_dimension, seo).
 * Uses optimized realtime updates for live data synchronization.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentMetrics, usePendingForAgent, useVendors, useAgentRealtime } from '@/hooks'
import { agentsService } from '@/services'
import { scraperProductsService } from '@/services/scraperProducts.service'
import type { AgentVendorStatistics as AgentVendorStats } from '@/types/statistics'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Pagination } from '@/components/ui/Pagination'
import { Dialog } from '@/components/ui/Dialog'
import { Toast } from '@/components/ui/Toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { AgentProductCard } from '@/components/products/AgentProductCard'
import { AgentVendorStatistics } from '@/components/agents/AgentVendorStatistics'
import { AdvancedFilterBuilder, type FilterRule } from '@/components/filters/AdvancedFilterBuilder'
import { Package, Search, SlidersHorizontal, RefreshCw, Trash2, RotateCcw, CheckSquare, Square, XCircle, CloudUpload, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { AgentType } from '@/services/agents.service'

export interface FilterColumn {
  label: string
  value: string
  type: 'text' | 'number'
}

export interface AgentConfig {
  // Header configuration
  title: string
  subtitle: string
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  primaryColor: string

  // About section
  aboutTitle: string
  aboutDescription: string
  keyFeatures: string[]

  // Filters
  filterColumns: FilterColumn[]
  defaultStatus: string

  // Retry dialog feedback field name
  feedbackFieldLabel: string
}

interface AgentMonitoringPageProps {
  agentType: AgentType
  config: AgentConfig
}

export function AgentMonitoringPage({ agentType, config }: AgentMonitoringPageProps) {
  // Enable realtime updates for this agent (only for main agents, not scraper)
  if (agentType !== 'scraper') {
    useAgentRealtime(agentType as 'category' | 'weight_dimension' | 'seo')
  }

  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(config.defaultStatus)
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>([])
  const [tempFilters, setTempFilters] = useState<FilterRule[]>([])
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [showRetryDialog, setShowRetryDialog] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showClearQueueConfirm, setShowClearQueueConfirm] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [showResetCompletedConfirm, setShowResetCompletedConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [vendorStats, setVendorStats] = useState<AgentVendorStats | null>(null)
  const [selectedErpnextSync, setSelectedErpnextSync] = useState<'all' | 'synced' | 'not_synced'>('all')

  // Selection state (for copyright agent bulk operations)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [isBulkResyncing, setIsBulkResyncing] = useState(false)
  const [isBulkResetting, setIsBulkResetting] = useState(false)

  const { metrics } = useAgentMetrics()
  const { vendors } = useVendors()

  const agent = metrics?.find((m) => m.agentType === agentType)

  // Fetch vendor-specific statistics when vendor changes
  useEffect(() => {
    if (!selectedVendor) {
      setVendorStats(null)
      return
    }

    const fetchVendorStats = async () => {
      const stats = await scraperProductsService.getAgentVendorStatistics(agentType, selectedVendor)
      setVendorStats(stats)
    }

    fetchVendorStats()
  }, [selectedVendor, agentType])

  // Fetch pending products with filters
  const {
    products,
    count,
    isLoading: productsLoading,
    refresh,
  } = usePendingForAgent(agentType, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: searchTerm || undefined,
    vendor: selectedVendor || undefined,
    status: selectedStatus || undefined,
    erpnextSynced: selectedErpnextSync !== 'all' ? selectedErpnextSync : undefined,
  })

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  const handleOpenFilterDialog = () => {
    setTempFilters(appliedFilters)
    setShowFilterDialog(true)
  }

  const handleApplyFilters = () => {
    setAppliedFilters(tempFilters)
    setShowFilterDialog(false)
    setPage(1)
  }

  const handleCancelFilters = () => {
    setShowFilterDialog(false)
    setTempFilters(appliedFilters)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedVendor('')
    setSelectedStatus(config.defaultStatus)
    setSelectedErpnextSync('all')
    setAppliedFilters([])
    setTempFilters([])
    setPage(1)
  }

  const handleOpenRetryDialog = () => {
    setRetryMessage('')
    setShowRetryDialog(true)
  }

  const handleRetryFailed = async () => {
    setRetrying(true)
    try {
      const result = await agentsService.retryAllFailed(agentType, {
        vendor: selectedVendor || undefined,
        message: retryMessage || undefined,
      })

      if (result.error) {
        setToast({ message: `Failed to retry: ${result.error.message}`, type: 'error' })
      } else {
        setToast({ message: `Successfully reset ${result.count} failed product(s) to pending status!`, type: 'success' })
        setShowRetryDialog(false)
        setRetryMessage('')
        refresh()

        // Refresh vendor stats if a vendor is selected
        if (selectedVendor) {
          const stats = await scraperProductsService.getAgentVendorStatistics(agentType, selectedVendor)
          setVendorStats(stats)
        }
      }
    } catch (error: any) {
      setToast({ message: `Error: ${error.message}`, type: 'error' })
    } finally {
      setRetrying(false)
    }
  }

  const handleClearQueue = async () => {
    if (!selectedVendor) return
    setIsClearing(true)
    try {
      const { data, error } = await supabase.functions.invoke('clear-copyright-queue', {
        body: { vendor: selectedVendor }
      })

      if (error) throw error

      if (data.success) {
        setToast({
          message: `Successfully cleared ${data.stats?.cleared_count || 0} pending product(s) for ${selectedVendor}`,
          type: 'success'
        })
        refresh()

        // Refresh vendor stats if a vendor is selected
        if (selectedVendor) {
          const stats = await scraperProductsService.getAgentVendorStatistics(agentType, selectedVendor)
          setVendorStats(stats)
        }
      } else {
        setToast({ message: data.error || 'Failed to clear queue', type: 'error' })
      }
    } catch (err) {
      console.error('Error clearing copyright queue:', err)
      setToast({ message: 'An error occurred while clearing the queue', type: 'error' })
    } finally {
      setIsClearing(false)
      setShowClearQueueConfirm(false)
    }
  }

  const handleResetCompleted = async () => {
    setIsResetting(true)
    try {
      const { data, error } = await supabase.functions.invoke('reset-agent-completed', {
        body: {
          agentType,
          ...(selectedVendor && { vendor: selectedVendor })
        }
      })

      if (error) throw error

      if (data.success) {
        const vendorMsg = selectedVendor ? ` for ${selectedVendor}` : ''
        setToast({
          message: `Successfully reset ${data.stats?.reset_count || 0} completed product(s) to pending${vendorMsg}`,
          type: 'success'
        })
        refresh()

        // Refresh vendor stats if a vendor is selected
        if (selectedVendor) {
          const stats = await scraperProductsService.getAgentVendorStatistics(agentType, selectedVendor)
          setVendorStats(stats)
        }
      } else {
        setToast({ message: data.error || 'Failed to reset completed products', type: 'error' })
      }
    } catch (err) {
      console.error(`Error resetting ${agentType} completed:`, err)
      setToast({ message: 'An error occurred while resetting completed products', type: 'error' })
    } finally {
      setIsResetting(false)
      setShowResetCompletedConfirm(false)
    }
  }

  // Selection helpers
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedProductIds(new Set())
    }
    setSelectionMode(!selectionMode)
  }

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const selectAllProducts = () => {
    if (products.length === 0) return
    const allIds = products.map((p: any) => p.pendingData.id)
    setSelectedProductIds(new Set(allIds))
  }

  const clearSelection = () => {
    setSelectedProductIds(new Set())
  }

  // Bulk action handlers
  const handleBulkResyncToErpnext = async () => {
    if (selectedProductIds.size === 0) return
    setIsBulkResyncing(true)

    const productIdsArray = Array.from(selectedProductIds)
    let successCount = 0
    let errorCount = 0

    for (const productId of productIdsArray) {
      try {
        const { data, error } = await supabase.functions.invoke('resync-product-to-erpnext', {
          body: { productId }
        })
        if (error || !data?.success) {
          errorCount++
        } else {
          successCount++
        }
      } catch {
        errorCount++
      }
    }

    setIsBulkResyncing(false)
    clearSelection()
    refresh()

    if (errorCount === 0) {
      setToast({
        message: `Successfully queued ${successCount} product(s) for ERPNext resync`,
        type: 'success'
      })
    } else {
      setToast({
        message: `Resynced ${successCount} product(s), ${errorCount} failed`,
        type: errorCount === productIdsArray.length ? 'error' : 'info'
      })
    }
  }

  const handleBulkResetCompleted = async () => {
    if (selectedProductIds.size === 0) return
    setIsBulkResetting(true)

    const productIdsArray = Array.from(selectedProductIds)
    let successCount = 0
    let errorCount = 0

    for (const productId of productIdsArray) {
      try {
        // Reset the copyright_status to pending
        const { error } = await supabase
          .from('pending_products')
          .update({ copyright_status: 'pending' })
          .eq('id', productId)

        if (error) {
          errorCount++
        } else {
          successCount++
        }
      } catch {
        errorCount++
      }
    }

    setIsBulkResetting(false)
    clearSelection()
    refresh()

    if (errorCount === 0) {
      setToast({
        message: `Successfully reset ${successCount} product(s) to pending`,
        type: 'success'
      })
    } else {
      setToast({
        message: `Reset ${successCount} product(s), ${errorCount} failed`,
        type: errorCount === productIdsArray.length ? 'error' : 'info'
      })
    }
  }

  const IconComponent = config.icon

  // Get the appropriate counts based on vendor selection
  const completedCount = selectedVendor && vendorStats
    ? vendorStats.complete
    : agent?.complete || 0

  const pendingCount = selectedVendor && vendorStats
    ? vendorStats.pending
    : agent?.pending || 0

  const failedCount = selectedVendor && vendorStats
    ? vendorStats.failed
    : agent?.failed || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-3 ${config.iconBgColor} rounded-lg`}>
              <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-secondary-900">{config.title}</h1>
              <p className="text-secondary-600 mt-1">{config.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Vendor Statistics - Shows vendor-specific agent metrics */}
      <AgentVendorStatistics agentType={agentType} vendor={selectedVendor || 'all'} />

      {/* Products Section */}
      <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
        <div className="p-6 border-b border-secondary-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-secondary-900">Products Queue</h2>
              <p className="text-sm text-secondary-600 mt-1">
                {count.toLocaleString()} products found
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Reset Completed button - Only for SEO agent (copyright uses selection-based bulk actions) */}
              {agentType === 'seo' && completedCount > 0 && (
                <button
                  onClick={() => setShowResetCompletedConfirm(true)}
                  disabled={isResetting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>Reset Completed ({completedCount.toLocaleString()})</span>
                </button>
              )}
              {agentType === 'copyright' && selectedVendor && pendingCount > 0 && (
                <button
                  onClick={() => setShowClearQueueConfirm(true)}
                  disabled={isClearing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 className={`h-4 w-4 ${isClearing ? 'animate-pulse' : ''}`} />
                  <span>Clear Queue ({pendingCount.toLocaleString()})</span>
                </button>
              )}
              {failedCount > 0 && (
                <button
                  onClick={handleOpenRetryDialog}
                  disabled={retrying}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                  <span>Retry Failed ({failedCount.toLocaleString()})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-secondary-200">
          <div className="flex gap-3 items-center mb-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Search by item code, vendor, or URL..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={handleOpenFilterDialog}
              className="flex items-center gap-2 px-4 py-2 border border-secondary-300 rounded-lg transition-colors text-secondary-700 hover:bg-secondary-50"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {appliedFilters.length > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                  {appliedFilters.length}
                </span>
              )}
            </button>

            {/* Vendor Filter */}
            <select
              value={selectedVendor}
              onChange={(e) => {
                setSelectedVendor(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor: { name: string; count: number }) => (
                <option key={vendor.name} value={vendor.name}>
                  {vendor.name} ({vendor.count.toLocaleString()})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="complete">Complete</option>
              <option value="failed">Failed</option>
            </select>

            {/* ERPNext Sync Filter - Only for copyright agent */}
            {agentType === 'copyright' && (
              <select
                value={selectedErpnextSync}
                onChange={(e) => {
                  setSelectedErpnextSync(e.target.value as 'all' | 'synced' | 'not_synced')
                  setPage(1)
                }}
                className="px-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Sync Status</option>
                <option value="synced">Synced to ERPNext</option>
                <option value="not_synced">Not Synced</option>
              </select>
            )}

            {/* Selection Mode Toggle - Only for copyright agent */}
            {agentType === 'copyright' && (
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${
                  selectionMode
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-secondary-300 text-secondary-700 hover:bg-secondary-50'
                }`}
              >
                {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span className="font-medium">Select</span>
                {selectionMode && selectedProductIds.size > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {selectedProductIds.size}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Active Filters Display */}
          {(appliedFilters.length > 0 || searchTerm || selectedVendor || selectedStatus !== config.defaultStatus || selectedErpnextSync !== 'all') && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-secondary-600">{count.toLocaleString()} products found</p>
              <button onClick={handleClearFilters} className="text-blue-600 hover:text-blue-700 font-medium">
                Clear all filters
              </button>
            </div>
          )}

          {/* Bulk Actions Bar - Only for copyright agent when products are selected */}
          {agentType === 'copyright' && selectionMode && selectedProductIds.size > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedProductIds.size} {selectedProductIds.size === 1 ? 'product' : 'products'} selected
                  </span>
                  <button
                    onClick={selectAllProducts}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select all on page
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Clear selection
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkResyncToErpnext}
                    disabled={isBulkResyncing || isBulkResetting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <CloudUpload className={`h-4 w-4 ${isBulkResyncing ? 'animate-pulse' : ''}`} />
                    <span>{isBulkResyncing ? 'Resyncing...' : 'Resync to ERPNext'}</span>
                  </button>
                  <button
                    onClick={handleBulkResetCompleted}
                    disabled={isBulkResyncing || isBulkResetting}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <RotateCcw className={`h-4 w-4 ${isBulkResetting ? 'animate-spin' : ''}`} />
                    <span>{isBulkResetting ? 'Resetting...' : 'Reset to Pending'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filter Dialog */}
        <Dialog open={showFilterDialog} onClose={handleCancelFilters} title="Filter Products">
          <div className="space-y-6">
            <AdvancedFilterBuilder
              columns={config.filterColumns}
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </Dialog>

        {/* Retry Failed Dialog */}
        <Dialog open={showRetryDialog} onClose={() => setShowRetryDialog(false)} title="Retry Failed Products">
          <div className="space-y-6">
            <div>
              <p className="text-sm text-secondary-700 mb-4">
                This will reset all failed products back to "pending" status so they can be processed again.
                {selectedVendor && (
                  <span className="block mt-2 font-medium text-orange-600">
                    Filtering by vendor: {selectedVendor}
                  </span>
                )}
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <RefreshCw className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">What will happen:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Status will be reset to "pending"</li>
                      <li>ERPNext sync timestamp will be cleared</li>
                      <li>Products will be queued for re-processing</li>
                      {selectedVendor ? (
                        <li>Only {selectedVendor} products will be affected</li>
                      ) : (
                        <li>All failed products will be affected</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Optional Message
                <span className="text-xs text-secondary-500 font-normal ml-2">
                  (saved to {config.feedbackFieldLabel} field)
                </span>
              </label>
              <textarea
                value={retryMessage}
                onChange={(e) => setRetryMessage(e.target.value)}
                placeholder="e.g., Retrying with updated guidelines, Fixed data quality issues, etc."
                rows={4}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-secondary-200">
              <button
                onClick={() => setShowRetryDialog(false)}
                disabled={retrying}
                className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRetryFailed}
                disabled={retrying}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {retrying ? (
                  <>
                    <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Retry Failed Products</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog>

        {/* Products List */}
        <ProductsList
          products={products}
          isLoading={productsLoading}
          agentType={agentType}
          agentConfig={config}
          navigate={navigate}
          selectionMode={agentType === 'copyright' ? selectionMode : false}
          selectedProductIds={selectedProductIds}
          onToggleSelection={toggleProductSelection}
        />

        {/* Pagination */}
        {!productsLoading && count > 0 && (
          <div className="p-6 border-t border-secondary-200">
            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalCount={count}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          </div>
        )}
      </div>

      {/* Agent Description */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-secondary-200">
        <h2 className="text-lg font-bold text-secondary-900 mb-4">{config.aboutTitle}</h2>
        <div className="prose prose-sm text-secondary-700">
          <p>{config.aboutDescription}</p>
          <h3 className="text-base font-semibold text-secondary-900 mt-4 mb-2">Key Features:</h3>
          <ul className="list-disc pl-6 space-y-1">
            {config.keyFeatures.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Clear Queue Confirmation Dialog */}
      <ConfirmationDialog
        open={showClearQueueConfirm}
        onClose={() => setShowClearQueueConfirm(false)}
        onConfirm={handleClearQueue}
        title="Clear Copyright Queue"
        message={`Are you sure you want to clear all PENDING products for ${selectedVendor} from the copyright queue?\n\nThis will set copyright_status to NULL, removing them from the queue. This action cannot be undone.`}
        confirmText="Clear Queue"
        cancelText="Cancel"
        variant="danger"
        loading={isClearing}
      />

      {/* Reset Completed Confirmation Dialog */}
      <ConfirmationDialog
        open={showResetCompletedConfirm}
        onClose={() => setShowResetCompletedConfirm(false)}
        onConfirm={handleResetCompleted}
        title="Reset Completed Products"
        message={`Are you sure you want to reset all COMPLETED products${selectedVendor ? ` for ${selectedVendor}` : ''} back to pending?\n\nThese products will be re-processed by the ${config.title.toLowerCase()}.`}
        confirmText="Reset to Pending"
        cancelText="Cancel"
        variant="warning"
        loading={isResetting}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

/**
 * Products List Component
 */
interface ProductsListProps {
  products: any[]
  isLoading: boolean
  agentType: AgentType
  agentConfig: AgentConfig
  navigate: ReturnType<typeof useNavigate>
  selectionMode?: boolean
  selectedProductIds?: Set<string>
  onToggleSelection?: (productId: string) => void
}

function ProductsList({
  products,
  isLoading,
  agentType,
  agentConfig,
  navigate,
  selectionMode = false,
  selectedProductIds = new Set(),
  onToggleSelection
}: ProductsListProps) {
  if (isLoading) {
    return (
      <div>
        {/* Shimmer loading skeleton matching AgentProductCard structure */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="p-4 border-b border-secondary-200 last:border-b-0 animate-pulse"
          >
            <div className="flex items-start gap-4">
              {/* Image skeleton */}
              <div className="w-20 h-20 rounded-lg bg-gray-200 flex-shrink-0"></div>

              {/* Content skeleton */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="h-5 w-3/4 bg-gray-200 rounded"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded flex-shrink-0"></div>
                </div>

                {/* Vendor and item code */}
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded"></div>
                </div>

                {/* Metadata badges */}
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 bg-gray-200 rounded"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
                  <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
                  <div className="h-5 w-28 bg-gray-200 rounded-full"></div>
                </div>

                {/* Agent-specific details */}
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-200 rounded"></div>
                  <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 flex items-center justify-center mb-4 border border-blue-200">
          <Package className="w-10 h-10 text-blue-400" />
        </div>
        <p className="text-secondary-600 text-center font-medium">No products found</p>
        <p className="text-sm text-secondary-500 text-center mt-2">
          Try adjusting your filters or clear all filters to see all products
        </p>
      </div>
    )
  }

  return (
    <div>
      {products.map((agentProduct) => (
        <AgentProductCard
          key={agentProduct.pendingData.id}
          agentProduct={agentProduct}
          agentType={agentType}
          agentConfig={{
            icon: agentConfig.icon,
            iconColor: agentConfig.iconColor,
            primaryColor: agentConfig.primaryColor,
          }}
          selectionMode={selectionMode}
          isSelected={selectedProductIds.has(agentProduct.pendingData.id)}
          onToggleSelection={onToggleSelection}
          onClick={(e) => {
            if (!agentProduct.productData?.id) return

            // Support Ctrl/Cmd+Click or middle-click to open in new tab
            if (e.ctrlKey || e.metaKey || e.button === 1) {
              // HashRouter: construct URL with hash for proper routing
              window.open(`${window.location.origin}${window.location.pathname}#/scraper-agent/${agentProduct.productData.id}`, '_blank')
            } else {
              navigate(`/scraper-agent/${agentProduct.productData.id}`, {
                state: { from: `agents/${agentType === 'weight_dimension' ? 'weight' : agentType}` }
              })
            }
          }}
        />
      ))}
    </div>
  )
}
