/**
 * AgentVendorStatistics Component
 *
 * Displays agent-specific statistics for products in the pending_products table.
 * Shows metrics for a specific agent filtered by vendor (pending, processing, complete, failed).
 * Used on Category, Weight & Dimension, and SEO agent pages.
 */

import { useEffect, useState } from 'react'
import { Clock, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { scraperProductsService } from '@/services/scraperProducts.service'
import type { AgentVendorStatistics as AgentVendorStats } from '@/types/statistics'
import type { AgentType } from '@/services/agents.service'

interface AgentVendorStatisticsProps {
  agentType: AgentType
  vendor: string
}

export function AgentVendorStatistics({ agentType, vendor }: AgentVendorStatisticsProps) {
  const [stats, setStats] = useState<AgentVendorStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!vendor) {
      setStats(null)
      setIsLoading(false)
      return
    }

    fetchStatistics()
  }, [vendor, agentType])

  const fetchStatistics = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await scraperProductsService.getAgentVendorStatistics(agentType, vendor)
      if (data) {
        setStats(data)
      } else {
        setError('Failed to load statistics')
      }
    } catch (err) {
      console.error('Error fetching agent vendor statistics:', err)
      setError('An error occurred while loading statistics')
    } finally {
      setIsLoading(false)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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
      title: 'Pending',
      value: stats.pending,
      total: stats.totalProducts,
      icon: Clock,
      color: 'yellow' as const,
      description: 'Waiting to be processed',
    },
    {
      title: 'Processing',
      value: stats.processing,
      total: stats.totalProducts,
      icon: Loader2,
      color: 'blue' as const,
      description: 'Currently being processed',
    },
    {
      title: 'Complete',
      value: stats.complete,
      total: stats.totalProducts,
      icon: CheckCircle,
      color: 'green' as const,
      description: 'Successfully processed',
    },
    {
      title: 'Failed',
      value: stats.failed,
      total: stats.totalProducts,
      icon: XCircle,
      color: 'red' as const,
      description: 'Processing failed',
    },
  ]

  const colorClasses = {
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
  }

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <div className="mb-6">
      {/* Vendor Header */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-secondary-900 capitalize">
          {vendor === 'all' ? 'All Vendors' : vendor} Statistics
        </h2>
        <p className="text-sm text-secondary-600">
          Total Products in queue: {stats.totalProducts.toLocaleString()}
        </p>
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
    </div>
  )
}
