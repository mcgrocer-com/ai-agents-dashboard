/**
 * DashboardPage Component
 *
 * Main dashboard overview with metrics, agent status, and activity.
 * Uses optimized realtime updates for live data synchronization.
 */

import { useAgentMetrics, useDashboardRealtime } from '@/hooks'
import { LiveMetrics } from '@/components/dashboard/LiveMetrics'
import { AgentStatusCard } from '@/components/dashboard/AgentStatusCard'
import { ProcessingQueue } from '@/components/dashboard/ProcessingQueue'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { JobQueueManager } from '@/components/dashboard/JobQueueManager'
import { Tag, Scale, FileText, Shield, HelpCircle } from 'lucide-react'

export function DashboardPage() {
  // Enable realtime updates for entire dashboard
  useDashboardRealtime()

  const { metrics: agentMetrics } = useAgentMetrics()

  // Find specific agent metrics
  const categoryAgent = agentMetrics?.find((a) => a.agentType === 'category')
  const weightAgent = agentMetrics?.find((a) => a.agentType === 'weight_dimension')
  const seoAgent = agentMetrics?.find((a) => a.agentType === 'seo')
  const copyrightAgent = agentMetrics?.find((a) => a.agentType === 'copyright') || {
    agentType: 'copyright' as const,
    totalProducts: 0,
    pending: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    avgConfidence: 0,
    totalCost: 0,
    lastRun: null,
  }
  const faqAgent = agentMetrics?.find((a) => a.agentType === 'faq') || {
    agentType: 'faq' as const,
    totalProducts: 0,
    pending: 0,
    processing: 0,
    complete: 0,
    failed: 0,
    avgConfidence: 0,
    totalCost: 0,
    lastRun: null,
  }

  return (
    <div className="space-y-6">
      {/* Header with Manage Tasks Button */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Overview of AI workflow processing
          </p>
        </div>
        <JobQueueManager />
      </div>

      {/* Live Metrics Cards - No loading spinner, uses shimmer in component */}
      <LiveMetrics />

      {/* Agent Status Cards - Show shimmer while loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {!categoryAgent || !weightAgent || !seoAgent ? (
          // Shimmer loading skeleton
          <>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg p-3 animate-pulse"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-gray-200 rounded-lg"></div>
                    <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  </div>
                  <div className="h-2 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j}>
                      <div className="h-2 w-10 bg-gray-200 rounded mb-1"></div>
                      <div className="h-4 w-12 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="grid grid-cols-4 gap-1">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="text-center">
                        <div className="h-2 w-8 bg-gray-200 rounded mb-1 mx-auto"></div>
                        <div className="h-3 w-10 bg-gray-200 rounded mx-auto"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <AgentStatusCard
              agent={categoryAgent}
              icon={Tag}
              color="blue"
              name="Category Mapper"
            />
            <AgentStatusCard
              agent={weightAgent}
              icon={Scale}
              color="green"
              name="Weight & Dimension"
            />
            <AgentStatusCard
              agent={seoAgent}
              icon={FileText}
              color="purple"
              name="SEO Optimizer"
            />
            <AgentStatusCard
              agent={copyrightAgent}
              icon={Shield}
              color="orange"
              name="Copyright Detector"
            />
            <AgentStatusCard
              agent={faqAgent}
              icon={HelpCircle}
              color="teal"
              name="FAQ Generator"
            />
          </>
        )}
      </div>

      {/* Processing Queue and Recent Activity - Show shimmer while loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!categoryAgent || !weightAgent || !seoAgent ? (
          // Shimmer loading skeleton
          <>
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-[500px] animate-pulse"
              >
                <div className="h-6 w-40 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded"></div>
                      <div className="flex-1">
                        <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <ProcessingQueue
              categoryAgent={categoryAgent}
              weightAgent={weightAgent}
              seoAgent={seoAgent}
              copyrightAgent={copyrightAgent}
              faqAgent={faqAgent}
            />
            <RecentActivity />
          </>
        )}
      </div>
    </div>
  )
}
