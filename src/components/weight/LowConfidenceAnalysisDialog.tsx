/**
 * LowConfidenceAnalysisDialog Component
 *
 * Displays weight and dimension confidence analysis with summary stats and vendor breakdown.
 * Includes separate reset functionality for weight and dimensions.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  RotateCcw,
  Loader2,
  Eye,
  ArrowLeft,
  Package,
  Scale,
  Ruler,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/useToast'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DebouncedSearchInput } from '@/components/ui/DebouncedSearchInput'
import { formatCurrency } from '@/lib/utils/format'

interface LowConfidenceProduct {
  id: string
  scraped_product_id: string | null
  url: string
  vendor: string | null
  weight: number | null
  weight_confidence: number | null
  dimension_confidence: number | null
  height: number | null
  width: number | null
  length: number | null
  item_code: string | null
  updated_at: string | null
  weight_and_dimension_status: string
  scraped_products: {
    name: string | null
    main_image: string | null
    price: number | null
    stock_status: string | null
  } | null
}

interface ConfidenceStats {
  total: number
  weightVeryLow: number
  weightLow: number
  weightHigh: number
  dimensionVeryLow: number
  dimensionLow: number
  dimensionHigh: number
}

interface VendorBreakdown {
  vendor: string
  weightVeryLow: number
  weightLow: number
  weightTotal: number
  dimensionVeryLow: number
  dimensionLow: number
  dimensionTotal: number
}

interface LowConfidenceAnalysisDialogProps {
  open: boolean
  onClose: () => void
}

type AnalysisTab = 'weight' | 'dimension'
type ConfidenceLevel = 'veryLow' | 'low'

export function LowConfidenceAnalysisDialog({ open, onClose }: LowConfidenceAnalysisDialogProps) {
  const [stats, setStats] = useState<ConfidenceStats | null>(null)
  const [vendorBreakdown, setVendorBreakdown] = useState<VendorBreakdown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resettingVendor, setResettingVendor] = useState<{
    vendor: string
    type: AnalysisTab
    level: ConfidenceLevel
  } | null>(null)
  const [resetMenuOpen, setResetMenuOpen] = useState<string | null>(null)
  const [viewingVendor, setViewingVendor] = useState<{ vendor: string; type: AnalysisTab } | null>(null)
  const [vendorProducts, setVendorProducts] = useState<LowConfidenceProduct[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [activeTab, setActiveTab] = useState<AnalysisTab>('weight')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const { showToast } = useToast()
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Use RPC for accurate counts in a single query
      const { data: statsData, error: statsError } = await supabase.rpc('get_weight_confidence_stats')

      if (statsError) throw statsError
      setStats(statsData)

      // Use RPC for vendor breakdown to avoid row limit issues
      const { data: vendorData, error: vendorError } = await supabase.rpc(
        'get_weight_confidence_vendor_breakdown'
      )

      if (vendorError) throw vendorError

      // RPC returns the data already aggregated and sorted
      setVendorBreakdown(vendorData || [])
    } catch (err) {
      console.error('Error fetching confidence data:', err)
      setError('Failed to load confidence analysis')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchVendorProducts = useCallback(
    async (vendor: string, type: AnalysisTab, searchTerm?: string) => {
      setIsLoadingProducts(true)

      try {
        const confidenceField = type === 'weight' ? 'weight_confidence' : 'dimension_confidence'

        let query = supabase
          .from('pending_products')
          .select(
            `
            id, scraped_product_id, url, vendor, weight, weight_confidence, dimension_confidence,
            height, width, length, item_code, updated_at, weight_and_dimension_status,
            scraped_products!inner (name, main_image, price, stock_status)
          `
          )
          .eq('vendor', vendor)
          .eq('weight_and_dimension_status', 'complete')
          .lte(confidenceField, 0.75)

        // Add search filter if search term provided
        if (searchTerm?.trim()) {
          query = query.ilike('scraped_products.name', `%${searchTerm}%`)
        }

        const { data, error: fetchError } = await query
          .order(confidenceField, { ascending: true })
          .limit(100)

        if (fetchError) throw fetchError

        const normalized = (data || []).map((d: any) => ({
          ...d,
          scraped_products: Array.isArray(d.scraped_products)
            ? d.scraped_products[0] ?? null
            : d.scraped_products ?? null,
        })) as LowConfidenceProduct[]

        setVendorProducts(normalized)
      } catch (err) {
        console.error('Error fetching vendor products:', err)
        showToast('Failed to load products', 'error')
      } finally {
        setIsLoadingProducts(false)
      }
    },
    [showToast]
  )

  const handleViewVendor = async (vendor: string, type: AnalysisTab) => {
    setViewingVendor({ vendor, type })
    setProductSearchTerm('')
    await fetchVendorProducts(vendor, type)
  }

  const handleBackToOverview = () => {
    setViewingVendor(null)
    setVendorProducts([])
    setProductSearchTerm('')
  }

  // Handle search - fetch from database with search term
  const handleProductSearch = useCallback(
    (term: string) => {
      setProductSearchTerm(term)
      if (viewingVendor) {
        fetchVendorProducts(viewingVendor.vendor, viewingVendor.type, term)
      }
    },
    [viewingVendor, fetchVendorProducts]
  )

  const handleResetWeight = async (vendor: string, level: ConfidenceLevel) => {
    setResettingVendor({ vendor, type: 'weight', level })
    setResetMenuOpen(null)

    try {
      let query = supabase
        .from('pending_products')
        .update({
          weight_and_dimension_status: 'pending',
          weight: null,
          weight_confidence: null,
          weight_reason: null,
          weightTools: null,
          volumetric_weight: null,
          weight_cost: null,
        })
        .eq('vendor', vendor)
        .eq('weight_and_dimension_status', 'complete')

      // Apply different filters based on confidence level
      if (level === 'veryLow') {
        query = query.lt('weight_confidence', 0.5)
      } else {
        query = query.gte('weight_confidence', 0.5).lte('weight_confidence', 0.75)
      }

      const { error: updateError } = await query

      if (updateError) throw updateError

      const levelLabel = level === 'veryLow' ? 'very low (<0.5)' : 'low (0.5-0.75)'
      showToast(`Reset ${vendor} ${levelLabel} confidence weight data for reprocessing`, 'success')
      await fetchData()
    } catch (err) {
      console.error('Error resetting weight:', err)
      showToast(`Failed to reset ${vendor} weight data`, 'error')
    } finally {
      setResettingVendor(null)
    }
  }

  const handleResetDimension = async (vendor: string, level: ConfidenceLevel) => {
    setResettingVendor({ vendor, type: 'dimension', level })
    setResetMenuOpen(null)

    try {
      let query = supabase
        .from('pending_products')
        .update({
          weight_and_dimension_status: 'pending',
          height: null,
          width: null,
          length: null,
          volumetric_weight: null,
          dimension_confidence: null,
          dimension_reason: null,
          dimensionToolsUsed: null,
        })
        .eq('vendor', vendor)
        .eq('weight_and_dimension_status', 'complete')

      // Apply different filters based on confidence level
      if (level === 'veryLow') {
        query = query.lt('dimension_confidence', 0.5)
      } else {
        query = query.gte('dimension_confidence', 0.5).lte('dimension_confidence', 0.75)
      }

      const { error: updateError } = await query

      if (updateError) throw updateError

      const levelLabel = level === 'veryLow' ? 'very low (<0.5)' : 'low (0.5-0.75)'
      showToast(`Reset ${vendor} ${levelLabel} confidence dimension data for reprocessing`, 'success')
      await fetchData()
    } catch (err) {
      console.error('Error resetting dimensions:', err)
      showToast(`Failed to reset ${vendor} dimension data`, 'error')
    } finally {
      setResettingVendor(null)
    }
  }

  useEffect(() => {
    if (open) {
      fetchData()
    } else {
      // Reset state when dialog closes
      setResetMenuOpen(null)
    }
  }, [open, fetchData])

  // Close reset menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-reset-menu]')) {
        setResetMenuOpen(null)
      }
    }

    if (resetMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [resetMenuOpen])

  // Close reset menu when tab changes
  useEffect(() => {
    setResetMenuOpen(null)
  }, [activeTab])

  if (!open) return null

  const totalWeightLow = (stats?.weightVeryLow ?? 0) + (stats?.weightLow ?? 0)
  const totalDimensionLow = (stats?.dimensionVeryLow ?? 0) + (stats?.dimensionLow ?? 0)

  // Filter vendors based on active tab
  const filteredVendors = vendorBreakdown.filter((v) =>
    activeTab === 'weight' ? v.weightTotal > 0 : v.dimensionTotal > 0
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {viewingVendor ? (
                <>
                  <button
                    onClick={handleBackToOverview}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to overview"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {viewingVendor.vendor} - Low {viewingVendor.type === 'weight' ? 'Weight' : 'Dimension'} Confidence
                    </h2>
                    <p className="text-sm text-gray-500">Showing up to 100 products with confidence ≤ 0.75</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Weight & Dimension Analysis</h2>
                    <p className="text-sm text-gray-500">Products with low confidence estimations</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!viewingVendor && (
                <button
                  onClick={fetchData}
                  disabled={isLoading}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
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
            {viewingVendor ? (
              // Product List View
              <div className="space-y-4">
                {/* Search Input */}
                <DebouncedSearchInput
                  placeholder="Search products by name..."
                  onSearch={handleProductSearch}
                  size="sm"
                />

                {/* Results count */}
                {!isLoadingProducts && (
                  <p className="text-sm text-gray-500">
                    Showing {vendorProducts.length} products
                    {productSearchTerm && ` matching "${productSearchTerm}"`}
                  </p>
                )}

                {/* Product List */}
                {isLoadingProducts ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24" />
                    ))}
                  </div>
                ) : vendorProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {productSearchTerm ? `No products matching "${productSearchTerm}"` : 'No products found'}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                    {vendorProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        highlightType={viewingVendor.type}
                        onClick={() => {
                          onClose()
                          navigate(`/scraper-agent/${product.scraped_product_id}`)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
            ) : isLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-24" />
                  ))}
                </div>
                <div className="animate-pulse bg-gray-100 rounded-lg h-64" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('weight')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'weight'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Scale className="w-4 h-4" />
                    Weight ({totalWeightLow.toLocaleString()})
                  </button>
                  <button
                    onClick={() => setActiveTab('dimension')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'dimension'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Ruler className="w-4 h-4" />
                    Dimension ({totalDimensionLow.toLocaleString()})
                  </button>
                </div>

                {/* Summary Stats */}
                {activeTab === 'weight' ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Analyzed" value={stats?.total ?? 0} color="blue" />
                    <StatCard
                      label="Very Low (<0.5)"
                      value={stats?.weightVeryLow ?? 0}
                      percentage={stats?.total ? ((stats.weightVeryLow / stats.total) * 100).toFixed(1) : '0'}
                      color="red"
                    />
                    <StatCard
                      label="Low (0.5-0.75)"
                      value={stats?.weightLow ?? 0}
                      percentage={stats?.total ? ((stats.weightLow / stats.total) * 100).toFixed(1) : '0'}
                      color="amber"
                    />
                    <StatCard
                      label="High (>0.75)"
                      value={stats?.weightHigh ?? 0}
                      percentage={stats?.total ? ((stats.weightHigh / stats.total) * 100).toFixed(1) : '0'}
                      color="green"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Analyzed" value={stats?.total ?? 0} color="blue" />
                    <StatCard
                      label="Very Low (<0.5)"
                      value={stats?.dimensionVeryLow ?? 0}
                      percentage={stats?.total ? ((stats.dimensionVeryLow / stats.total) * 100).toFixed(1) : '0'}
                      color="red"
                    />
                    <StatCard
                      label="Low (0.5-0.75)"
                      value={stats?.dimensionLow ?? 0}
                      percentage={stats?.total ? ((stats.dimensionLow / stats.total) * 100).toFixed(1) : '0'}
                      color="amber"
                    />
                    <StatCard
                      label="High (>0.75)"
                      value={stats?.dimensionHigh ?? 0}
                      percentage={stats?.total ? ((stats.dimensionHigh / stats.total) * 100).toFixed(1) : '0'}
                      color="green"
                    />
                  </div>
                )}

                {/* Vendor Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Vendor Breakdown (
                    {activeTab === 'weight' ? totalWeightLow.toLocaleString() : totalDimensionLow.toLocaleString()} low
                    confidence products)
                  </h3>

                  {filteredVendors.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No low confidence products found</div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Vendor
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Low
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Very Low (&lt;0.5)
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Low (0.5-0.75)
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredVendors.map((row) => {
                            const total = activeTab === 'weight' ? row.weightTotal : row.dimensionTotal
                            const veryLow = activeTab === 'weight' ? row.weightVeryLow : row.dimensionVeryLow
                            const low = activeTab === 'weight' ? row.weightLow : row.dimensionLow
                            const isResetting =
                              resettingVendor?.vendor === row.vendor && resettingVendor?.type === activeTab

                            return (
                              <tr
                                key={row.vendor}
                                className={`hover:bg-gray-50 ${total > 100 ? 'bg-amber-50' : ''}`}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="font-medium text-gray-900">{row.vendor}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <span className="font-semibold text-gray-900">{total.toLocaleString()}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  {veryLow > 0 ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                      {veryLow.toLocaleString()}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <span className="text-amber-600 font-medium">{low.toLocaleString()}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => handleViewVendor(row.vendor, activeTab)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                      title={`View ${total} low confidence products`}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View
                                    </button>
                                    {/* Reset Dropdown */}
                                    <div className="relative" data-reset-menu>
                                      <button
                                        onClick={() =>
                                          setResetMenuOpen(resetMenuOpen === row.vendor ? null : row.vendor)
                                        }
                                        disabled={resettingVendor !== null}
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                          activeTab === 'weight'
                                            ? 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                                            : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                                        }`}
                                        title={`Reset ${activeTab} data for reprocessing`}
                                      >
                                        {isResetting ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <RotateCcw className="w-3.5 h-3.5" />
                                        )}
                                        Reset
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                      {resetMenuOpen === row.vendor && (
                                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                                          <div className="py-1">
                                            <button
                                              onClick={() =>
                                                activeTab === 'weight'
                                                  ? handleResetWeight(row.vendor, 'veryLow')
                                                  : handleResetDimension(row.vendor, 'veryLow')
                                              }
                                              disabled={veryLow === 0}
                                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              <span>Very Low (&lt;0.5)</span>
                                              <span className="text-xs text-red-600 font-medium">
                                                {veryLow.toLocaleString()}
                                              </span>
                                            </button>
                                            <button
                                              onClick={() =>
                                                activeTab === 'weight'
                                                  ? handleResetWeight(row.vendor, 'low')
                                                  : handleResetDimension(row.vendor, 'low')
                                              }
                                              disabled={low === 0}
                                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              <span>Low (0.5-0.75)</span>
                                              <span className="text-xs text-amber-600 font-medium">
                                                {low.toLocaleString()}
                                              </span>
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  percentage,
  color,
}: {
  label: string
  value: number
  percentage?: string
  color: 'blue' | 'red' | 'amber' | 'green'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }

  const valueColorClasses = {
    blue: 'text-blue-900',
    red: 'text-red-900',
    amber: 'text-amber-900',
    green: 'text-green-900',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColorClasses[color]}`}>{value.toLocaleString()}</p>
      {percentage && <p className="text-xs mt-1 opacity-75">{percentage}% of total</p>}
    </div>
  )
}

function ProductCard({
  product,
  highlightType,
  onClick,
}: {
  product: LowConfidenceProduct
  highlightType: AnalysisTab
  onClick: () => void
}) {
  const productData = product.scraped_products

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

  const getStockBadge = (status: string | null) => {
    if (!status) return null
    const isInStock = status.toLowerCase().includes('in stock') || status.toLowerCase().includes('available')
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${
          isInStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {status}
      </span>
    )
  }

  const confidence = highlightType === 'weight' ? product.weight_confidence : product.dimension_confidence

  return (
    <div onClick={onClick} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex items-start gap-4">
        {/* Product Image */}
        {productData?.main_image ? (
          <img
            src={productData.main_image}
            alt={productData.name || 'Product'}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border border-gray-200"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0 border border-blue-200">
            <Package className="w-10 h-10 text-blue-400" />
          </div>
        )}

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Name and Time */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate text-base">
              {productData?.name || product.item_code || 'Unnamed Product'}
            </h3>
            {product.updated_at && (
              <span className="text-xs text-gray-500 font-medium flex-shrink-0">
                {formatRelativeTime(product.updated_at)}
              </span>
            )}
          </div>

          {/* Vendor and Item Code */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            {product.vendor && <span className="font-medium">{product.vendor}</span>}
            {product.vendor && product.item_code && <span className="text-gray-400">•</span>}
            {product.item_code && (
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{product.item_code}</span>
            )}
          </div>

          {/* Metadata Row: Price, Stock, Status, Confidence */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {productData?.price && (
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(productData.price)}</span>
            )}
            {productData?.stock_status && getStockBadge(productData.stock_status)}
            <StatusBadge status={product.weight_and_dimension_status as any} />
            {confidence !== null && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  confidence >= 0.8
                    ? 'bg-green-100 text-green-700'
                    : confidence >= 0.6
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-orange-100 text-orange-700'
                }`}
              >
                {(confidence * 100).toFixed(0)}% {highlightType} confidence
              </span>
            )}
          </div>

          {/* Weight & Dimensions Row */}
          {(product.weight || product.height || product.width || product.length) && (
            <div className="flex items-center gap-3 text-sm">
              {product.weight && (
                <div className="flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-purple-600" />
                  <span className="text-gray-700 font-medium">{Number(product.weight).toFixed(2)} kg</span>
                </div>
              )}
              {(product.height || product.width || product.length) && (
                <>
                  {product.weight && <span className="text-gray-400">•</span>}
                  <span className="text-xs text-gray-600">
                    Dims: {product.length || '?'} × {product.width || '?'} × {product.height || '?'} cm
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
