/**
 * VendorStatistics Component
 *
 * Displays vendor-specific statistics for products in the pending_products table.
 * Shows metrics for category/weight completion, full data completion, ERPNext sync status.
 */

import { useEffect, useState } from 'react'
import { CheckCircle, Database, CloudUpload, AlertCircle, Send, Info, RefreshCw, RotateCcw } from 'lucide-react'
import { scraperProductsService } from '@/services/scraperProducts.service'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/useToast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import type { VendorStatistics as VendorStats } from '@/types/statistics'

interface VendorStatisticsProps {
  vendor: string
}

export function VendorStatistics({ vendor }: VendorStatisticsProps) {
  const { showToast } = useToast()
  const [stats, setStats] = useState<VendorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPushing, setIsPushing] = useState(false)
  const [isResyncing, setIsResyncing] = useState(false)
  const [isSendingToCopyright, setIsSendingToCopyright] = useState(false)
  const [showCopyrightConfirm, setShowCopyrightConfirm] = useState(false)
  const [showResyncConfirm, setShowResyncConfirm] = useState(false)
  const [showPushToQueueConfirm, setShowPushToQueueConfirm] = useState(false)

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

  const handlePushToPending = () => {
    if (!vendor || vendor === 'all') return
    setShowPushToQueueConfirm(true)
  }

  const confirmPushToPending = async () => {
    setIsPushing(true)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke('manual-push-to-pending', {
        body: { vendor }
      })

      if (funcError) throw funcError

      if (data.success) {
        showToast(`Successfully queued ${data.stats?.successfully_inserted || 0} products for processing`, 'success')
        // Refresh statistics after successful push
        setTimeout(() => {
          fetchStatistics()
        }, 1000)
      } else {
        showToast(data.error || 'Failed to push products to queue', 'error')
      }
    } catch (err) {
      console.error('Error pushing to pending:', err)
      showToast('An error occurred while pushing products to queue', 'error')
    } finally {
      setIsPushing(false)
    }
  }

  const handleResyncToErpNext = () => {
    if (!vendor || vendor === 'all') return
    setShowResyncConfirm(true)
  }

  const confirmResyncToErpNext = async () => {
    setIsResyncing(true)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke('resync-vendor-to-erpnext', {
        body: { vendor }
      })

      if (funcError) throw funcError

      if (data.success) {
        showToast(`Successfully reset ${data.stats?.successfully_reset || 0} products for ERPNext resync`, 'success')
        // Refresh statistics after successful resync
        setTimeout(() => {
          fetchStatistics()
        }, 1000)
      } else {
        showToast(data.error || 'Failed to reset products for ERPNext resync', 'error')
      }
    } catch (err) {
      console.error('Error resyncing to ERPNext:', err)
      showToast('An error occurred while resyncing products to ERPNext', 'error')
    } finally {
      setIsResyncing(false)
    }
  }

  const handleSendToCopyright = () => {
    if (!vendor || vendor === 'all') return
    setShowCopyrightConfirm(true)
  }

  const confirmSendToCopyright = async () => {
    setIsSendingToCopyright(true)
    setError(null)

    try {
      const { data, error: funcError } = await supabase.functions.invoke('reset-vendor-copyright', {
        body: { vendor }
      })

      if (funcError) throw funcError

      if (data.success) {
        showToast(`Successfully sent ${data.stats?.updated_count || 0} products to Copyright Agent`, 'success')
        // Refresh statistics after successful reset
        setTimeout(() => {
          fetchStatistics()
        }, 1000)
      } else {
        showToast(data.error || 'Failed to send products to Copyright Agent', 'error')
      }
    } catch (err) {
      console.error('Error sending to Copyright Agent:', err)
      showToast('An error occurred while sending products to Copyright Agent', 'error')
    } finally {
      setIsSendingToCopyright(false)
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
      description: `Yesterday: ${stats.syncedYesterday} | This week: ${stats.syncedThisWeek}`,
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

        {/* Send to Queue and Resync Buttons - Only show for specific vendors */}
        {vendor !== 'all' && (
          <div className="flex items-center gap-2">

            
          <button
            onClick={handleResyncToErpNext}
            disabled={isResyncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Resyncing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Resync to ERPNext</span>
              </>
            )}
          </button>

          <button
            onClick={handleSendToCopyright}
            disabled={isSendingToCopyright}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSendingToCopyright ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Send to Copyright Agent</span>
              </>
            )}
          </button>

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

           <div className="relative group">
            
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-800"
              aria-label="Information about Actions"
            >
              <Info className="w-4 h-4" />
            </button>

            
            {/* Tooltip */}
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 shadow-lg">
              <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              <p className="font-medium mb-2">Available Actions</p>
              <div className="space-y-2">
                <div>
                  <p className="font-medium text-gray-200">Send to Queue</p>
                  <p className="text-gray-300">
                    Push products from this vendor to the pending queue for AI agent processing (category, weight/dimension, and SEO optimization).
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-200">Resync to ERPNext</p>
                  <p className="text-gray-300">
                    Reset sync status for all products from this vendor, forcing them to be re-synced to ERPNext in the next sync cycle.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-200">Send to Copyright Agent</p>
                  <p className="text-gray-300">
                    Send all products from this vendor to the Copyright Agent for processing. This will reset their copyright status to pending and queue them for copyright detection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>


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

      {/* Resync to ERPNext Confirmation Dialog */}
      <ConfirmationDialog
        open={showResyncConfirm}
        onClose={() => setShowResyncConfirm(false)}
        onConfirm={confirmResyncToErpNext}
        title="Resync to ERPNext"
        message={`Are you sure you want to resync all ${vendor} products to ERPNext?\n\nThis will reset their sync status and force them to be re-synced in the next sync cycle.`}
        confirmText="Resync"
        cancelText="Cancel"
        variant="info"
        loading={isResyncing}
      />

      {/* Copyright Confirmation Dialog */}
      <ConfirmationDialog
        open={showCopyrightConfirm}
        onClose={() => setShowCopyrightConfirm(false)}
        onConfirm={confirmSendToCopyright}
        title="Send to Copyright Agent"
        message={`Are you sure you want to send all ${vendor} products to the Copyright Agent?\n\nThis will reset their copyright status to pending and queue them for processing.`}
        confirmText="Send to Agent"
        cancelText="Cancel"
        variant="warning"
        loading={isSendingToCopyright}
      />

      {/* Push to Queue Confirmation Dialog */}
      <ConfirmationDialog
        open={showPushToQueueConfirm}
        onClose={() => setShowPushToQueueConfirm(false)}
        onConfirm={confirmPushToPending}
        title="Send to Processing Queue"
        message={`Are you sure you want to send all ${vendor} products to the processing queue?\n\nThis will queue them for AI agent processing (category, weight/dimension, and SEO optimization).`}
        confirmText="Send to Queue"
        cancelText="Cancel"
        variant="info"
        loading={isPushing}
      />
    </div>
  )
}
