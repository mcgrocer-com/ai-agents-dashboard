/**
 * RetryButton Component
 *
 * Button to retry agent processing with optional feedback.
 */

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { agentsService, type AgentType } from '@/services/agents.service'
import { LoadingSpinner } from './LoadingSpinner'
import { Dialog } from './Dialog'

interface RetryButtonProps {
  productId: string
  agentType: AgentType
  agentName: string
  onRetry?: () => void
  className?: string
}

export function RetryButton({
  productId,
  agentType,
  agentName,
  onRetry,
  className = '',
}: RetryButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRetry = async () => {
    setRetrying(true)
    setError(null)

    try {
      const result = await agentsService.retryAgent({
        productId,
        agentType,
        feedback: feedback || undefined,
      })

      if (result.error) {
        setError(result.error.message)
      } else {
        setShowDialog(false)
        setFeedback('')
        // Call the onRetry callback to refresh the page data
        if (onRetry) {
          onRetry()
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retry')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className={`px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm font-medium ${className}`}
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>

      <Dialog
        open={showDialog}
        onClose={() => !retrying && setShowDialog(false)}
        title={`Retry ${agentName}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-secondary-700">
            This will reset the processing status and queue this product for re-processing by the{' '}
            {agentName}.
          </p>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Optional Feedback
              <span className="text-xs text-secondary-500 font-normal ml-2">
                (helps improve future processing)
              </span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., The category was incorrect, The weight seems too high, etc."
              rows={4}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              disabled={retrying}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-secondary-200">
            <button
              onClick={() => setShowDialog(false)}
              disabled={retrying}
              className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {retrying ? (
                <>
                  <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                  <span>Retrying...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  <span>Retry Processing</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
