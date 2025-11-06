/**
 * CopyrightTab Component
 *
 * Displays copyright detection agent results with full details.
 */

import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  Shield,
  Image,
  FileText,
  Wrench,
  AlertCircle,
  MessageSquare,
  CheckCircle,
  TrendingUp,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

interface CopyrightTabProps {
  status: 'pending' | 'processing' | 'complete' | 'failed' | null
  nonCopyrightImages?: string[] | null
  nonCopyrightDesc?: string | null
  confidence?: number | null
  reasoning?: string | null
  toolsUsed?: Record<string, any> | null
  errorMessage?: string | null
  feedback?: string | null
  updatedAt?: string
}

export function CopyrightTab({
  status,
  nonCopyrightImages,
  nonCopyrightDesc,
  confidence,
  reasoning,
  toolsUsed,
  errorMessage,
  feedback,
  updatedAt,
}: CopyrightTabProps) {
  if (!status || status === 'pending') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status || 'pending'} />
        <p className="mt-4 text-gray-500">Copyright detection pending</p>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status} />
        <p className="mt-4 text-gray-500">Copyright detection in progress...</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        {updatedAt && (
          <p className="text-sm text-gray-500">
            Updated: {formatDateTime(updatedAt)}
          </p>
        )}
      </div>

      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              Copyright Detection Complete
            </h3>
            <p className="text-sm text-green-800">
              Copyright analysis has been completed successfully.
            </p>
          </div>
        </div>
      </div>

      {/* Non-Copyright Images */}
      {nonCopyrightImages && nonCopyrightImages.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Image className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">
              Non-Copyright Images ({nonCopyrightImages.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonCopyrightImages.map((imageUrl, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-gray-50 aspect-square flex items-center justify-center"
              >
                <img
                  src={imageUrl}
                  alt={`Non-copyright image ${index + 1}`}
                  className="w-full h-full object-contain cursor-pointer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext fill="%236b7280" font-family="sans-serif" font-size="14" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                  }}
                  onClick={() => window.open(imageUrl, '_blank')}
                  title="Click to view full image"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Copyright Description */}
      {nonCopyrightDesc && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                Non-Copyright Description
              </h3>
              <div
                className="text-sm text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: nonCopyrightDesc }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {confidence !== null && confidence !== undefined && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Confidence Score</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      confidence >= 0.8
                        ? 'bg-green-500'
                        : confidence >= 0.6
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
                <span className="text-lg font-semibold text-gray-900 min-w-[3rem]">
                  {(confidence * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                Agent Reasoning
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reasoning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tools Used */}
      {toolsUsed && Object.keys(toolsUsed).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Tools Used</h3>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <pre className="whitespace-pre-wrap text-gray-700 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(toolsUsed, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
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
