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
  color: 'blue' | 'green' | 'purple' | 'orange' | 'teal'
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
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    icon: 'bg-teal-100 text-teal-600',
    text: 'text-teal-900',
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
      className={`${colors.bg} border ${colors.border} rounded-lg p-3 hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.icon}`}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className={`text-sm font-semibold ${colors.text}`}>{name}</h3>
        </div>
        <span className="text-[10px] text-gray-500">
          {agent.lastRun
            ? `${new Date(agent.lastRun).toLocaleDateString()}`
            : 'Never run'}
        </span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-gray-600">Total</p>
          <p className="text-sm font-bold text-gray-900">
            {formatNumber(agent.totalProducts)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">Success</p>
          <p className="text-sm font-bold text-gray-900">{formatPercentage(successRate)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">Confidence</p>
          <p className="text-sm font-bold text-gray-900">
            {formatPercentage(agent.avgConfidence)}
          </p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="pt-2 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-1 text-center">
          <div>
            <p className="text-[10px] text-gray-500">Pending</p>
            <p className="text-xs font-semibold text-yellow-600">
              {formatNumber(agent.pending)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Active</p>
            <p className="text-xs font-semibold text-blue-600">
              {formatNumber(agent.processing)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Done</p>
            <p className="text-xs font-semibold text-green-600">
              {formatNumber(agent.complete)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Failed</p>
            <p className="text-xs font-semibold text-red-600">
              {formatNumber(agent.failed)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
