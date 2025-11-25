/**
 * AgentMonitoringPage Component
 *
 * Reusable agent monitoring and management page that can be configured
 * for different agent types (category, weight_dimension, seo).
 * Uses optimized realtime updates for live data synchronization.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentMetrics, usePendingForAgent, useVendors, useAgentRealtime } from '@/hooks'
import { agentsService } from '@/services'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Pagination } from '@/components/ui/Pagination'
import { Dialog } from '@/components/ui/Dialog'
import { Toast } from '@/components/ui/Toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { AgentProductCard } from '@/components/products/AgentProductCard'
import { AgentVendorStatistics } from '@/components/agents/AgentVendorStatistics'
import { AdvancedFilterBuilder, type FilterRule } from '@/components/filters/AdvancedFilterBuilder'
import { Package, Search, SlidersHorizontal, RefreshCw, Trash2, RotateCcw, type LucideIcon } from 'lucide-react'
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

  const { metrics } = useAgentMetrics()
  const { vendors } = useVendors()

  const agent = metrics?.find((m) => m.agentType === agentType)

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
      const { data, error } = await supabase.functions.invoke('reset-copyright-completed', {
        body: selectedVendor ? { vendor: selectedVendor } : {}
      })

      if (error) throw error

      if (data.success) {
        const vendorMsg = selectedVendor ? ` for ${selectedVendor}` : ''
        setToast({
          message: `Successfully reset ${data.stats?.reset_count || 0} completed product(s) to pending${vendorMsg}`,
          type: 'success'
        })
        refresh()
      } else {
        setToast({ message: data.error || 'Failed to reset completed products', type: 'error' })
      }
    } catch (err) {
      console.error('Error resetting copyright completed:', err)
      setToast({ message: 'An error occurred while resetting completed products', type: 'error' })
    } finally {
      setIsResetting(false)
      setShowResetCompletedConfirm(false)
    }
  }

  const IconComponent = config.icon

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
              {agentType === 'copyright' && agent && agent.complete > 0 && (
                <button
                  onClick={() => setShowResetCompletedConfirm(true)}
                  disabled={isResetting}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>Reset Completed ({agent.complete})</span>
                </button>
              )}
              {agentType === 'copyright' && agent && selectedVendor && agent.pending > 0 && (
                <button
                  onClick={() => setShowClearQueueConfirm(true)}
                  disabled={isClearing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <Trash2 className={`h-4 w-4 ${isClearing ? 'animate-pulse' : ''}`} />
                  <span>Clear Queue ({agent.pending})</span>
                </button>
              )}
              {agent && agent.failed > 0 && (
                <button
                  onClick={handleOpenRetryDialog}
                  disabled={retrying}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                  <span>Retry Failed ({agent.failed})</span>
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
          </div>

          {/* Active Filters Display */}
          {(appliedFilters.length > 0 || searchTerm || selectedVendor || selectedStatus !== config.defaultStatus) && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-secondary-600">{count.toLocaleString()} products found</p>
              <button onClick={handleClearFilters} className="text-blue-600 hover:text-blue-700 font-medium">
                Clear all filters
              </button>
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
        message={`Are you sure you want to reset all COMPLETED products${selectedVendor ? ` for ${selectedVendor}` : ''} back to pending?\n\nThese products will be re-processed by the copyright agent.`}
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
}

function ProductsList({ products, isLoading, agentType, agentConfig, navigate }: ProductsListProps) {
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
          onClick={() => agentProduct.productData?.id && navigate(`/scraper-agent/${agentProduct.productData.id}`, {
            state: { from: `agents/${agentType === 'weight_dimension' ? 'weight' : agentType}` }
          })}
        />
      ))}
    </div>
  )
}
