/**
 * CategoryTab Component
 *
 * Displays category mapping agent results with full details.
 * Matches WeightDimensionTab styling and structure.
 */

import React from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Layers, Wrench, AlertCircle, ChevronRight, MessageSquare } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

interface CategoryTabProps {
  status: 'pending' | 'processing' | 'complete' | 'failed'
  categoryMapped?: string | null
  breadcrumbs?: any
  reasoning?: string | null
  confidence?: number | null
  processingCost?: number | null
  toolsUsed?: Record<string, any> | null
  errorMessage?: string | null
  feedback?: string | null
  updatedAt?: string
}

export function CategoryTab({
  status,
  categoryMapped,
  breadcrumbs,
  reasoning,
  confidence,
  toolsUsed,
  errorMessage,
  feedback,
  updatedAt,
}: CategoryTabProps) {
  if (status === 'pending') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status} />
        <p className="mt-4 text-gray-500">
          Category mapping pending
        </p>
      </div>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          {updatedAt && (
            <p className="text-sm text-gray-500">
              Updated: {formatDateTime(updatedAt)}
            </p>
          )}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Processing Failed</h3>
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          </div>
        </div>
        {feedback && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Retry Feedback</h3>
                <p className="text-sm text-blue-800">{feedback}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        {updatedAt && (
          <p className="text-sm text-gray-500">
            Updated: {formatDateTime(updatedAt)}
          </p>
        )}
      </div>

      {/* Feedback Display */}
      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Retry Feedback</h3>
              <p className="text-sm text-blue-800">{feedback}</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Overview */}
      {categoryMapped && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Overview</h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            {/* Category */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Mapped Category</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {categoryMapped}
              </p>
              {confidence !== null && confidence !== undefined && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Category Confidence</span>
                    <span className="text-xs font-semibold text-green-700">{(confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Breadcrumbs/Path */}
      {breadcrumbs && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            Category Path
          </h3>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            {(() => {
              // Parse breadcrumbs if it's a JSON string
              let parsedBreadcrumbs = breadcrumbs
              if (typeof breadcrumbs === 'string') {
                try {
                  // Try to parse as JSON array
                  const parsed = JSON.parse(breadcrumbs)
                  if (Array.isArray(parsed)) {
                    parsedBreadcrumbs = parsed
                  }
                } catch {
                  // Not JSON, check if it's a path string
                  if (breadcrumbs.includes('>')) {
                    parsedBreadcrumbs = breadcrumbs.split('>').map((c: string) => c.trim())
                  } else {
                    parsedBreadcrumbs = [breadcrumbs]
                  }
                }
              }

              // Now render the parsed breadcrumbs
              if (Array.isArray(parsedBreadcrumbs)) {
                return (
                  <div className="flex flex-wrap items-center gap-3">
                    {parsedBreadcrumbs.map((crumb: string, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="px-4 py-2 bg-white border border-blue-300 rounded-lg shadow-sm hover:shadow-md transition-shadow text-sm font-medium text-gray-900">
                          {crumb}
                        </div>
                        {idx < parsedBreadcrumbs.length - 1 && (
                          <ChevronRight className="h-5 w-5 text-blue-400 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )
              } else if (typeof parsedBreadcrumbs === 'object') {
                // Object format: display as formatted JSON
                return (
                  <div className="space-y-2">
                    {Object.entries(parsedBreadcrumbs).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3">
                        <span className="text-sm font-medium text-blue-700 min-w-[100px]">{key}:</span>
                        <span className="text-sm text-gray-900 flex-1">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              } else {
                // Fallback: display as string
                return <p className="text-gray-900">{String(parsedBreadcrumbs)}</p>
              }
            })()}
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {reasoning && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Category AI Reasoning
          </h3>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-gray-800 whitespace-pre-wrap">{reasoning}</p>
          </div>
        </div>
      )}

      {/* Category Tools Used */}
      {toolsUsed && Object.keys(toolsUsed).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-green-500" />
            Category Tools Used
          </h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(toolsUsed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
