/**
 * AgentStatusCard Component
 *
 * Displays agent-specific metrics and status information.
 */

import type { LucideIcon } from 'lucide-react'
import type { AgentMetrics } from '@/types/database'
import { formatNumber, formatPercentage } from '@/lib/utils/format'

interface AgentStatusCardProps {
  agent: AgentMetrics
  icon: LucideIcon
  color: 'blue' | 'green' | 'purple' | 'orange'
  name: string
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-900',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-900',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-900',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-900',
  },
}

export function AgentStatusCard({
  agent,
  icon: Icon,
  color,
  name,
}: AgentStatusCardProps) {
  const colors = colorClasses[color]
  // Calculate success rate as complete / (complete + failed)
  // Only count finished items, not pending/processing
  const finishedItems = agent.complete + agent.failed
  const successRate = finishedItems > 0 ? agent.complete / finishedItems : 0

  return (
    <div
      className={`${colors.bg} border ${colors.border} rounded-lg p-6 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.icon}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className={`font-semibold ${colors.text}`}>{name}</h3>
        </div>
        <span className="text-xs text-gray-500">
          {agent.lastRun
            ? `Last: ${new Date(agent.lastRun).toLocaleDateString()}`
            : 'Never run'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-600">Total Products</p>
          <p className="text-lg font-bold text-gray-900">
            {formatNumber(agent.totalProducts)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Success Rate</p>
          <p className="text-lg font-bold text-gray-900">{formatPercentage(successRate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Avg Confidence</p>
          <p className="text-lg font-bold text-gray-900">
            {formatPercentage(agent.avgConfidence)}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-sm font-semibold text-yellow-600">
              {formatNumber(agent.pending)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Processing</p>
            <p className="text-sm font-semibold text-blue-600">
              {formatNumber(agent.processing)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Complete</p>
            <p className="text-sm font-semibold text-green-600">
              {formatNumber(agent.complete)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Failed</p>
            <p className="text-sm font-semibold text-red-600">
              {formatNumber(agent.failed)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
