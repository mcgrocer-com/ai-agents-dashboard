/**
 * VendorStatistics Component
 *
 * Displays vendor-specific statistics for products in the pending_products table.
 * Shows metrics for category/weight completion, full data completion, ERPNext sync status.
 */

import { useEffect, useState } from 'react'
import { CheckCircle, Database, CloudUpload, AlertCircle, Send, Info } from 'lucide-react'
import { scraperProductsService } from '@/services/scraperProducts.service'
import { supabase } from '@/lib/supabase/client'
import type { VendorStatistics as VendorStats } from '@/types/statistics'

interface VendorStatisticsProps {
  vendor: string
}

export function VendorStatistics({ vendor }: VendorStatisticsProps) {
  const [stats, setStats] = useState<VendorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPushing, setIsPushing] = useState(false)
  const [pushSuccess, setPushSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!vendor) {
      setStats(null)
      setIsLoading(false)
      return
    }

    fetchStatistics()
  }, [vendor])

  const fetchStatistics = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await scraperProductsService.getVendorStatistics(vendor)
      if (data) {
        setStats(data)
      } else {
        setError('Failed to load statistics')
      }
    } catch (err) {
      console.error('Error fetching vendor statistics:', err)
      setError('An error occurred while loading statistics')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePushToPending = async () => {
    if (!vendor || vendor === 'all') return

    setIsPushing(true)
    setPushSuccess(null)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke('manual-push-to-pending', {
        body: { vendor }
      })

      if (funcError) throw funcError

      if (data.success) {
        setPushSuccess(`Successfully queued ${data.stats?.successfully_inserted || 0} products for processing`)
        // Refresh statistics after successful push
        setTimeout(() => {
          fetchStatistics()
        }, 1000)
      } else {
        setError(data.error || 'Failed to push products to queue')
      }
    } catch (err) {
      console.error('Error pushing to pending:', err)
      setError('An error occurred while pushing products to queue')
    } finally {
      setIsPushing(false)
      // Clear success message after 5 seconds
      setTimeout(() => {
        setPushSuccess(null)
      }, 5000)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  // No data
  if (!stats) {
    return null
  }

  const statCards = [
    {
      title: 'Category & Weight',
      value: stats.withCategoryAndWeight,
      total: stats.totalProducts,
      icon: CheckCircle,
      color: 'green' as const,
      description: 'Products with category and weight data',
    },
    {
      title: 'All Data Complete',
      value: stats.withAllData,
      total: stats.totalProducts,
      icon: Database,
      color: 'indigo' as const,
      description: 'Products with category, weight, and SEO data',
    },
    {
      title: 'Synced to ERPNext',
      value: stats.syncedToErpNext,
      total: stats.totalProducts,
      icon: CloudUpload,
      color: 'blue' as const,
      description: 'Successfully synced products',
    },
    {
      title: 'Failed to Sync',
      value: stats.failedToSync,
      total: stats.totalProducts,
      icon: AlertCircle,
      color: 'red' as const,
      description: 'Products with sync errors',
    },
  ]

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    red: 'bg-red-100 text-red-600',
  }

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <div className="mb-4">
      {/* Vendor Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 capitalize">
            {vendor === 'all' ? 'All Vendors' : vendor} Statistics
          </h2>
          <p className="text-sm text-secondary-600">
            Total Products in queue: {stats.totalProducts.toLocaleString()}
          </p>
        </div>

        {/* Send to Queue Button with Tooltip - Only show for specific vendors */}
        {vendor !== 'all' && (
          <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-800"
              aria-label="Information about Send to Queue"
            >
              <Info className="w-4 h-4" />
            </button>
            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 shadow-lg">
              <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              <p className="font-medium mb-1">Send to Queue</p>
              <p className="text-gray-300">
                Push products from this vendor to the pending queue for AI agent processing (category, weight/dimension, and SEO optimization).
              </p>
            </div>
          </div>

          <button
            onClick={handlePushToPending}
            disabled={isPushing}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPushing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send all to Queue</span>
              </>
            )}
          </button>
        </div>
        )}
      </div>

      {/* Success Message */}
      {pushSuccess && (
        <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">{pushSuccess}</p>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-secondary-600 font-medium">{card.title}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-secondary-900">
                    {card.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-secondary-500">
                    ({calculatePercentage(card.value, card.total)}%)
                  </p>
                </div>
                <p className="text-xs text-secondary-500 mt-1">{card.description}</p>
              </div>
              <div className={`p-3 rounded-lg ${colorClasses[card.color]}`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
