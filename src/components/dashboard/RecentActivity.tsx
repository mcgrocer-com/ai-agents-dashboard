/**
 * RecentActivity Component
 *
 * Displays recent product processing activity with real-time updates.
 * Includes tabs for processing/complete and filters for agents and vendors.
 * Uses optimized realtime subscriptions for live updates.
 */

import { useState, useEffect, useCallback } from 'react'
import { Activity } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils/format'
import { useNavigate } from 'react-router-dom'
import { activityStatsService } from '@/services'
import { useRecentActivityRealtime } from '@/hooks'
import type { RecentActivity as RecentActivityType, AgentStatus } from '@/types'
import type { AgentFilter, ActivityStats } from '@/services/activityStats.service'

type TabType = 'processing' | 'complete'
type DateFilterType = 'today' | 'thisMonth' | 'lastMonth'

export function RecentActivity() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('processing')
  const [dateFilter, setDateFilter] = useState<DateFilterType>('today')
  const [processingActivities, setProcessingActivities] = useState<RecentActivityType[]>([])
  const [completeActivities, setCompleteActivities] = useState<RecentActivityType[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activityStats, setActivityStats] = useState<ActivityStats>({
    today: 0,
    thisMonth: 0,
    lastMonth: 0,
  })
  const [selectedAgents, setSelectedAgents] = useState<AgentFilter[]>([
    'category',
    'weight_dimension',
  ])
  const [selectedVendor, setSelectedVendor] = useState<string>('')
  const [vendors, setVendors] = useState<Array<{ vendor: string; count: number }>>([])

  const handleProductClick = useCallback(
    (productId: string) => {
      navigate(`/scraper-agent/${productId}`, { state: { from: 'dashboard' } })
    },
    [navigate]
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAgentColor = (agent: string) => {
    if (agent.includes('Category')) return 'text-blue-600'
    if (agent.includes('Weight') || agent.includes('Dimension')) return 'text-green-600'
    if (agent.includes('SEO')) return 'text-purple-600'
    return 'text-gray-600'
  }
  const fetchCompleteActivities = async () => {
    const { data, error } = await activityStatsService.getRecentProductsByVendor(
      selectedVendor || null,
      selectedAgents,
      20
    )

    if (error) {
      console.error('Error fetching activities:', error)
      return
    }

    if (data) {
      const freshActivities: RecentActivityType[] = []

      data.forEach((item: any) => {
        const productName = item.product_name || 'Product'
        const vendor = item.vendor || ''
        const imageUrl = item.main_image || ''

        // Category agent activity
        if (item.category_status && item.category_status !== 'pending') {
          freshActivities.push({
            id: `cat-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Category Mapper',
            status: item.category_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // Weight & Dimension agent activity
        if (
          item.weight_and_dimension_status &&
          item.weight_and_dimension_status !== 'pending'
        ) {
          freshActivities.push({
            id: `weight-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Weight & Dimension',
            status: item.weight_and_dimension_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // SEO agent activity
        if (item.seo_status && item.seo_status !== 'pending') {
          freshActivities.push({
            id: `seo-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'SEO Optimizer',
            status: item.seo_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }
      })

      // Sort by timestamp
      freshActivities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setCompleteActivities(freshActivities)
    }
  }

  const fetchProcessingActivities = async () => {
    // Processing tab - fetch processing activities using service
    const { data, error } = await activityStatsService.getProcessingProducts(30)

    if (error) {
      console.error('Error fetching activities:', error)
      return
    }

    if (data) {
      const freshActivities: RecentActivityType[] = []

      data.forEach((item: any) => {
        // RPC returns flattened data with product_name, vendor, main_image directly
        const productName = item.product_name || 'Product'
        const vendor = item.vendor || ''
        const imageUrl = item.main_image || ''

        // Category agent activity
        if (item.category_status && item.category_status !== 'pending') {
          freshActivities.push({
            id: `cat-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Category Mapper',
            status: item.category_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // Weight & Dimension agent activity
        if (
          item.weight_and_dimension_status &&
          item.weight_and_dimension_status !== 'pending'
        ) {
          freshActivities.push({
            id: `weight-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'Weight & Dimension',
            status: item.weight_and_dimension_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }

        // SEO agent activity
        if (item.seo_status && item.seo_status !== 'pending') {
          freshActivities.push({
            id: `seo-${item.id}`,
            productName,
            vendor,
            imageUrl,
            agent: 'SEO Optimizer',
            status: item.seo_status as AgentStatus,
            timestamp: item.updated_at ?? '',
            productId: item.scraped_product_id || item.id,
          })
        }
      })

      // Sort by timestamp
      freshActivities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setProcessingActivities(freshActivities)
    }

  }

  // Function to fetch aggregated statistics
  const refreshStats = useCallback(async () => {
    const stats = await activityStatsService.getCompleteActivityStats(
      selectedAgents,
      selectedVendor || undefined
    )
    setActivityStats(stats)
  }, [selectedAgents, selectedVendor])

  // Function to fetch and update activities
  const refreshActivities = useCallback(async () => {
     
    try {
      // Fetch aggregated stats
      await refreshStats()

      // Fetch recent activities for display using RPC for reliable vendor and agent filtering

      fetchCompleteActivities()
      fetchProcessingActivities()



    } catch (error) {
      console.error('Error refreshing activities:', error)
    } finally {
      
    }
  }, [refreshStats, activeTab, selectedVendor, selectedAgents])


  // Enable realtime updates - triggers refreshActivities when database changes
  useRecentActivityRealtime(refreshActivities)

  // Load initial stats on mount
  useEffect(() => {
    refreshStats()
  }, [refreshStats])

  // Reload vendors when agent selection changes
  useEffect(() => {
    if (activeTab === 'complete') {
      activityStatsService.getVendors(selectedAgents).then(setVendors)
    }
  }, [selectedAgents, activeTab])

  // Refresh activities when vendor or agent selection changes
  useEffect(() => {
    if (activeTab === 'complete') {
      refreshActivities()
    }
  }, [selectedVendor, selectedAgents, activeTab, refreshActivities])

  // Initial load for processing tab
  useEffect(() => {
    if (activeTab === 'processing') {
      refreshActivities()
    }
  }, [activeTab, refreshActivities])

  // Date filter helper functions (using UTC to match database timestamps)
  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getUTCDate() === today.getUTCDate() &&
      date.getUTCMonth() === today.getUTCMonth() &&
      date.getUTCFullYear() === today.getUTCFullYear()
    )
  }

  const isThisMonth = (date: Date) => {
    const today = new Date()
    return (
      date.getUTCMonth() === today.getUTCMonth() &&
      date.getUTCFullYear() === today.getUTCFullYear()
    )
  }

  const isLastMonth = (date: Date) => {
    const today = new Date()
    const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    return (
      date.getUTCMonth() === lastMonth.getUTCMonth() &&
      date.getUTCFullYear() === lastMonth.getUTCFullYear()
    )
  }

  const filterByDate = (activity: RecentActivityType) => {
    const activityDate = new Date(activity.timestamp)
    switch (dateFilter) {
      case 'today':
        return isToday(activityDate)
      case 'thisMonth':
        return isThisMonth(activityDate)
      case 'lastMonth':
        return isLastMonth(activityDate)
      default:
        return true
    }
  }

  // Filter and sort by tab
  const allProcessingActivities = processingActivities
    .filter((activity) => activity.status === 'processing')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const allCompleteActivities = completeActivities
    .filter((activity) => activity.status === 'complete')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Get filtered activities based on selected date filter (for display only)
  const filteredCompleteActivities =
    activeTab === 'complete' ? allCompleteActivities.filter(filterByDate) : allCompleteActivities

  // Get counts - use aggregated stats for complete, activities.length for processing
  const processingCount = allProcessingActivities.length
  const completeTodayCount = activityStats.today
  const completeThisMonthCount = activityStats.thisMonth
  const completeLastMonthCount = activityStats.lastMonth

  // Now slice for display (limit to 20 items displayed)
  const displayProcessingActivities = allProcessingActivities.slice(0, 20)
  const displayCompleteActivities = filteredCompleteActivities.slice(0, 20)

  const sortedActivities = activeTab === 'processing' ? displayProcessingActivities : displayCompleteActivities

  // Format count for display (show 20+ if over 20)
  const formatCount = (count: number) => (count > 20 ? '20+' : count.toString())
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </h2>
        {completeActivities.length + processingActivities.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-gray-500">Live</span>
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('processing')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'processing'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Processing ({formatCount(processingCount)})
        </button>
        <button
          onClick={() => setActiveTab('complete')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'complete'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Complete
        </button>
      </div>

      {/* Agent and Vendor Filters - Only show when Complete tab is active */}
      {activeTab === 'complete' && (
        <div className="mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="text-xs font-medium text-gray-700">Filter by Agent:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAgents.includes('category')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAgents([...selectedAgents, 'category'])
                  } else {
                    setSelectedAgents(selectedAgents.filter((a) => a !== 'category'))
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-blue-600 font-medium">Category</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAgents.includes('weight_dimension')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAgents([...selectedAgents, 'weight_dimension'])
                  } else {
                    setSelectedAgents(selectedAgents.filter((a) => a !== 'weight_dimension'))
                  }
                }}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-xs text-green-600 font-medium">Weight & Dimension</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAgents.includes('seo')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedAgents([...selectedAgents, 'seo'])
                  } else {
                    setSelectedAgents(selectedAgents.filter((a) => a !== 'seo'))
                  }
                }}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-xs text-purple-600 font-medium">SEO</span>
            </label>

            {/* Vendor dropdown */}
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs font-medium text-gray-700">Vendor:</span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.vendor} value={v.vendor}>
                    {v.vendor.charAt(0).toUpperCase() + v.vendor.slice(1)} ({v.count})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'today'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
            >
              Today ({completeTodayCount})
            </button>
            <button
              onClick={() => setDateFilter('thisMonth')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'thisMonth'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
            >
              This Month ({completeThisMonthCount})
            </button>
            <button
              onClick={() => setDateFilter('lastMonth')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dateFilter === 'lastMonth'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
            >
              Last Month ({completeLastMonthCount})
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {isRefreshing ? (
          // Shimmer loading skeleton
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="flex items-start gap-3 pb-3 border-b animate-pulse"
            >
              {/* Image skeleton */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded bg-gray-200"></div>
              </div>

              {/* Content skeleton */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
                </div>
                <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  <div className="h-3 w-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))
        ) : sortedActivities.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8 flex items-center justify-center h-full">
            No {activeTab} activity
          </div>
        ) : (
          sortedActivities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => handleProductClick(activity.productId)}
              className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0 pt-1 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
            >
              {/* Product Image */}
              <div className="flex-shrink-0 relative overflow-visible">
                {activity.imageUrl ? (
                  <img
                    src={activity.imageUrl}
                    alt={activity.productName}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">No img</span>
                  </div>
                )}
                {/* Pulsing indicator for processing items */}
                {activity.status === 'processing' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                )}
              </div>

              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${getAgentColor(activity.agent)}`}>
                    {activity.agent}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      activity.status
                    )}`}
                  >
                    {activity.status}
                  </span>
                </div>
                <p className="text-sm text-gray-900 font-medium truncate">
                  {activity.productName || `Product ${activity.productId}`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 capitalize">{activity.vendor}</span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
