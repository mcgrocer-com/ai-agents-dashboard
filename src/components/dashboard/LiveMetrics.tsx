/**
 * LiveMetrics Component
 *
 * Displays real-time dashboard metrics that update automatically
 * using SWR for data fetching and realtime subscriptions.
 * Updates are triggered by useDashboardRealtime hook in parent component.
 */

import { Package, Activity, TrendingUp } from 'lucide-react'
import { useDashboardMetrics } from '@/hooks'
import { formatNumber, formatPercentage } from '@/lib/utils/format'
import { StatCard } from './StatCard'

export function LiveMetrics() {
  const { metrics, isLoading, error } = useDashboardMetrics()

  if (isLoading && !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">
          Error loading metrics. Please refresh the page.
        </p>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Partial Sanitized"
        value={formatNumber(metrics.partialSanitized)}
        icon={Package}
        color="blue"
        subtitle="Weight & Category complete"
      />
      <StatCard
        title="Full Sanitized"
        value={formatNumber(metrics.fullSanitized)}
        icon={Package}
        color="green"
        subtitle="All agents complete"
      />
      <StatCard
        title="Processing"
        value={formatNumber(metrics.processingProducts)}
        icon={Activity}
        color="yellow"
        subtitle="Across all agents"
      />
      <StatCard
        title="Success Rate"
        value={formatPercentage(metrics.successRate)}
        icon={TrendingUp}
        color="indigo"
        subtitle="Average of all agents"
      />
    </div>
  )
}
