/**
 * ProcessingQueue Component
 *
 * Shows queue overview for products awaiting each agent.
 */

import type { AgentMetrics } from '@/types/database'
import { AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'
import { Link } from 'react-router-dom'

interface ProcessingQueueProps {
  categoryAgent: AgentMetrics
  weightAgent: AgentMetrics
  seoAgent: AgentMetrics
  copyrightAgent?: AgentMetrics | undefined
  faqAgent?: AgentMetrics | undefined
}

export function ProcessingQueue({
  categoryAgent,
  weightAgent,
  seoAgent,
  copyrightAgent,
  faqAgent,
}: ProcessingQueueProps) {
  const queues = [
    {
      name: 'Category Mapper',
      pending: categoryAgent.pending,
      complete: categoryAgent.complete,
      color: 'blue',
      href: '/agents/category',
    },
    {
      name: 'Weight & Dimension',
      pending: weightAgent.pending,
      complete: weightAgent.complete,
      color: 'green',
      href: '/agents/weight',
    },
    {
      name: 'SEO Optimizer',
      pending: seoAgent.pending,
      complete: seoAgent.complete,
      color: 'purple',
      href: '/agents/seo',
    },
    ...(copyrightAgent
      ? [
          {
            name: 'Copyright Detection',
            pending: copyrightAgent.pending,
            complete: copyrightAgent.complete,
            color: 'orange',
            href: '/agents/copyright',
          },
        ]
      : []),
    ...(faqAgent
      ? [
          {
            name: 'FAQ Generator',
            pending: faqAgent.pending,
            complete: faqAgent.complete,
            color: 'teal',
            href: '/agents/faq',
          },
        ]
      : []),
  ]

  const totalPending = queues.reduce((sum, q) => sum + (q.pending || 0), 0)
  const totalComplete = queues.reduce((sum, q) => sum + (q.complete || 0), 0)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-[500px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Processing Queue
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="text-gray-600">
              {formatNumber(totalPending)} Pending
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">
              {formatNumber(totalComplete)} Complete
            </span>
          </div>
        </div>
      </div>

      {totalPending === 0 && totalComplete === 0 ? (
        <div className="text-center py-8 flex-1 flex items-center justify-center">
          <div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
              <AlertCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Queue is empty</p>
            <p className="text-xs text-gray-500 mt-1">
              All products have been processed
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto content-start">
          {queues.map((queue) => (
            <QueueItem key={queue.name} {...queue} />
          ))}
        </div>
      )}
    </div>
  )
}

interface QueueItemProps {
  name: string
  pending: number
  complete: number
  color: string
  href: string
}

function QueueItem({
  name,
  pending,
  complete,
  color,
  href,
}: QueueItemProps) {
  const total = (pending || 0) + (complete || 0)
  const completePercentage = total > 0 ? ((complete || 0) / total) * 100 : 0

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    teal: 'bg-teal-500',
  }

  return (
    <Link
      to={href}
      className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">{name}</span>
        <span className="text-xs text-gray-500">{formatNumber(total)} total</span>
      </div>

      <div className="flex gap-2 mb-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              colorClasses[color as keyof typeof colorClasses]
            } transition-all duration-300`}
            style={{ width: `${completePercentage}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-yellow-600">{formatNumber(pending)} pending</span>
        <span className="text-green-600">{formatNumber(complete)} complete</span>
      </div>
    </Link>
  )
}
