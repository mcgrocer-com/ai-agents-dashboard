/**
 * Classification Agent Page
 * UK medicine classification validation - matches other agent page design
 */

import { useState, useEffect } from 'react'
import { Search, Package, ShieldCheck, MessageSquare, X, RefreshCw } from 'lucide-react'
import ClassificationStats from '@/components/classification/ClassificationStats'
import ClassificationCard from '@/components/classification/ClassificationCard'
import ManualOverrideDialog from '@/components/classification/ManualOverrideDialog'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { Pagination } from '@/components/ui/Pagination'
import { Toast, useToast } from '@/components/ui/Toast'
import {
  getClassifiedProducts,
  getClassificationStats,
  acceptProduct,
  rejectProduct,
  retryClassification,
  getVendors
} from '@/services/classification.service'
import type {
  ClassificationFilter,
  ClassificationStats as StatsType,
  ClassifiedProduct,
  ClassificationType
} from '@/types/classification'

const ClassificationAgentPage = () => {
  const [products, setProducts] = useState<ClassifiedProduct[]>([])
  const [stats, setStats] = useState<StatsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ClassificationFilter>('all')
  const [classificationFilter, setClassificationFilter] = useState<ClassificationType | ''>('')
  const [search, setSearch] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [vendors, setVendors] = useState<string[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'accept' | 'reject'>('accept')
  const [selectedProduct, setSelectedProduct] = useState<ClassifiedProduct | null>(null)
  const [showGuidelines, setShowGuidelines] = useState(false)

  // Toast notifications
  const { toast, showToast, hideToast } = useToast()

  const hasActiveFilters = filter !== 'all' || classificationFilter !== '' ||
    search !== '' || vendorFilter !== ''

  // Fetch data on mount and when filters or pagination changes
  useEffect(() => {
    fetchData()
  }, [filter, classificationFilter, search, vendorFilter, currentPage, pageSize])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [filter, classificationFilter, search, vendorFilter])

  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const offset = (currentPage - 1) * pageSize

      const productsResult = await getClassifiedProducts({
        filter,
        classification: classificationFilter || undefined,
        search: search || undefined,
        vendor: vendorFilter || undefined,
        limit: pageSize,
        offset: offset
      })

      if (productsResult.success && productsResult.data) {
        setProducts(productsResult.data.products)
        setTotalCount(productsResult.data.totalCount)
      }

      const statsResult = await getClassificationStats()
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('Failed to fetch data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    const result = await getVendors()
    if (result.success && result.data) {
      setVendors(result.data)
    }
  }

  const handleAcceptClick = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
      setDialogMode('accept')
      setDialogOpen(true)
    }
  }

  const handleRejectClick = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
      setDialogMode('reject')
      setDialogOpen(true)
    }
  }

  const handleDialogConfirm = async (reason: string, classification?: ClassificationType) => {
    if (!selectedProduct) return

    try {
      if (dialogMode === 'accept') {
        const result = await acceptProduct(selectedProduct.id, reason)
        if (result.success) {
          showToast('Product accepted successfully', 'success')
          fetchData()
        } else {
          showToast(result.error?.message || 'Failed to accept product', 'error')
        }
      } else {
        if (!classification) {
          showToast('Please select a classification type', 'error')
          return
        }
        const result = await rejectProduct(selectedProduct.id, reason, classification)
        if (result.success) {
          showToast('Product rejected successfully', 'success')
          fetchData()
        } else {
          showToast(result.error?.message || 'Failed to reject product', 'error')
        }
      }
    } catch (error) {
      console.error('Error handling override:', error)
      showToast('An error occurred while processing', 'error')
    } finally {
      setDialogOpen(false)
      setSelectedProduct(null)
    }
  }

  const handleRetry = async (productId: string) => {
    try {
      const result = await retryClassification(productId)
      if (result.success) {
        showToast('Classification retry initiated', 'success')
        fetchData()
      } else {
        showToast(result.error?.message || 'Failed to retry', 'error')
      }
    } catch (error) {
      console.error('Error retrying classification:', error)
      showToast('An error occurred', 'error')
    }
  }

  const clearAllFilters = () => {
    setFilter('all')
    setClassificationFilter('')
    setSearch('')
    setVendorFilter('')
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Classification Agent</h1>
            <p className="text-secondary-600">
              UK medicine classification validation for product compliance
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && <ClassificationStats stats={stats} loading={loading} />}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">All Vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ClassificationFilter)}
            className="px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Classification Type Filter */}
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value as ClassificationType | '')}
            className="px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="not_medicine">Not Medicine</option>
            <option value="gsl">GSL</option>
            <option value="pharmacy">Pharmacy Medicine</option>
            <option value="pom">POM</option>
            <option value="unclear">Unclear</option>
          </select>
        </div>

        {/* Clear Filters & Refresh */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-secondary-100">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-secondary-600 hover:text-secondary-900 flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Clear all filters
            </button>
          )}
          <div className={hasActiveFilters ? '' : 'ml-auto'}>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-secondary-700 bg-white border border-secondary-300 rounded-lg hover:bg-secondary-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-secondary-600">
        Showing {products.length} of {totalCount.toLocaleString()} products
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-secondary-200 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-secondary-200 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-secondary-200 rounded w-3/4" />
                  <div className="h-3 bg-secondary-200 rounded w-1/4" />
                  <div className="h-3 bg-secondary-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No products found</h3>
          <p className="mt-2 text-secondary-600">
            Try adjusting your filters or search query
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {products.map((product) => (
              <ClassificationCard
                key={product.id}
                product={product}
                isAdmin={true}
                onAccept={handleAcceptClick}
                onReject={handleRejectClick}
                onRetry={handleRetry}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}

      {/* About Section */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">
          About Classification Agent
        </h2>
        <p className="text-secondary-600 mb-4">
          The Classification Agent uses AI to validate UK medicine classifications,
          ensuring products comply with regulatory requirements. It categorizes products
          based on their medical status and licensing requirements.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <h3 className="font-medium text-secondary-900">Classification Types</h3>
            <ul className="text-secondary-600 space-y-1 list-disc list-inside">
              <li><strong>Not Medicine</strong> - Non-medicinal products</li>
              <li><strong>GSL</strong> - General Sales List medicines</li>
              <li><strong>Pharmacy</strong> - Pharmacy-only medicines</li>
              <li><strong>POM</strong> - Prescription Only Medicines</li>
              <li><strong>Unclear</strong> - Needs manual review</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-secondary-900">Actions</h3>
            <ul className="text-secondary-600 space-y-1 list-disc list-inside">
              <li><strong>Accept</strong> - Approve AI classification</li>
              <li><strong>Reject</strong> - Override with correct type</li>
              <li><strong>Retry</strong> - Re-run classification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ManualOverrideDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedProduct(null)
        }}
        onConfirm={handleDialogConfirm}
        mode={dialogMode}
        productName={selectedProduct?.name || 'Unknown Product'}
      />

      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="classification"
        onSuccess={() => showToast('Guidelines updated successfully', 'success')}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </div>
  )
}

export default ClassificationAgentPage
