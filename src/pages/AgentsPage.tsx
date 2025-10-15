/**
 * AgentsPage Component
 *
 * Agent management and monitoring.
 */

import { useAgentMetrics, useTriggerAgent } from '@/hooks'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { AgentType } from '@/services'

export function AgentsPage() {
  const { metrics, isLoading } = useAgentMetrics()
  const { trigger, loading: triggering } = useTriggerAgent()

  const handleTrigger = async (agentType: AgentType) => {
    const result = await trigger({
      agentType,
      batchSize: 10,
      testMode: false,
    })

    if (result.success) {
      alert(`${agentType} agent triggered successfully!`)
    } else {
      alert(`Failed to trigger agent: ${result.error?.message}`)
    }
  }

  const agentIcons: Record<string, string> = {
    category: '🏷️',
    weight_dimension: '⚖️',
    seo: '🔍',
    scraper: '🤖',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary-900">AI Agents</h1>
        <p className="text-secondary-600 mt-2">
          Monitor and manage AI processing agents
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : metrics && metrics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((agent: any) => {
            const agentType = agent.agent_type as AgentType
            const icon = agentIcons[agentType] || '🤖'

            return (
              <div
                key={agentType}
                className="bg-white p-6 rounded-lg shadow-sm border border-secondary-200"
              >
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-lg font-bold text-secondary-900 capitalize">
                  {agentType.replace('_', ' & ')} Agent
                </h3>
                <p className="text-sm text-secondary-600 mt-2">
                  Status: <span className="text-green-600">Active</span>
                </p>
                <div className="mt-4 pt-4 border-t border-secondary-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Pending:</span>
                    <span className="font-medium text-secondary-900">
                      {agent.pending_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Processing:</span>
                    <span className="font-medium text-blue-600">
                      {agent.processing_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Completed:</span>
                    <span className="font-medium text-green-600">
                      {agent.complete_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Failed:</span>
                    <span className="font-medium text-red-600">
                      {agent.failed_count || 0}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleTrigger(agentType)}
                  disabled={triggering}
                  className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {triggering ? (
                    <>
                      <LoadingSpinner
                        size="sm"
                        className="border-white border-t-transparent"
                      />
                      <span>Triggering...</span>
                    </>
                  ) : (
                    <span>Trigger Agent</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg shadow-sm border border-secondary-200">
          <p className="text-secondary-600 text-center">
            No agent metrics available
          </p>
        </div>
      )}
    </div>
  )
}
