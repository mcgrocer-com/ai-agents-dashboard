/**
 * SeoTab Component
 *
 * Displays SEO optimization agent results with full details.
 */

import { StatusBadge } from '@/components/ui/StatusBadge'
import { RetryButton } from '@/components/ui/RetryButton'
import { Tag, FileText, Link, Wrench, AlertCircle, MessageSquare } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'

interface SeoTabProps {
  productId: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  seoResult?: any
  optimizedTitle?: string | null
  optimizedDescription?: string | null
  keywordsUsed?: string[] | null
  reasoning?: string | null
  confidence?: number | null
  processingCost?: number | null
  toolsUsed?: Record<string, any> | null
  errorMessage?: string | null
  feedback?: string | null
  updatedAt?: string
  onRetry?: () => void
}

export function SeoTab({
  productId,
  status,
  seoResult,
  optimizedTitle,
  optimizedDescription,
  keywordsUsed,
  reasoning,
  confidence,
  toolsUsed,
  errorMessage,
  feedback,
  updatedAt,
  onRetry,
}: SeoTabProps) {
  // Extract data from seoResult if it exists (backward compatibility)
  const title = optimizedTitle || seoResult?.title || seoResult?.optimized_title
  const metaDescription = optimizedDescription || seoResult?.meta_description || seoResult?.optimized_description

  // Parse keywords if it's a JSON string
  let keywords = keywordsUsed || seoResult?.keywords || seoResult?.keywords_used || []
  if (typeof keywords === 'string') {
    try {
      const parsed = JSON.parse(keywords)
      keywords = Array.isArray(parsed) ? parsed : []
    } catch {
      keywords = []
    }
  }

  const seoReasoning = reasoning || seoResult?.reasoning
  const slug = seoResult?.slug
  const ogTitle = seoResult?.og_title
  const ogDescription = seoResult?.og_description
  const altText = seoResult?.alt_text

  if (status === 'pending') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status} />
        <p className="mt-4 text-gray-500">SEO optimization pending</p>
      </div>
    )
  }

  if (status === 'failed' && errorMessage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <RetryButton
              productId={productId}
              agentType="seo"
              agentName="SEO Agent"
              onRetry={onRetry}
            />
          </div>
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
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {(status === 'complete' || status === 'failed') && (
            <RetryButton
              productId={productId}
              agentType="seo"
              agentName="SEO Agent"
              onRetry={onRetry}
            />
          )}
        </div>
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

      {/* SEO Title */}
      {title && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Optimized SEO Title
          </h3>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-900 font-medium">{title}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{title.length}</span> characters
              </p>
              {title.length >= 50 && title.length <= 60 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Optimal Length
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meta Description */}
      {metaDescription && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Optimized Meta Description
          </h3>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <p className="text-gray-900">{metaDescription}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{metaDescription.length}</span> characters
              </p>
              {metaDescription.length >= 150 && metaDescription.length <= 160 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Optimal Length
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keywords */}
      {keywords && keywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            Keywords ({keywords.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 rounded-full border border-purple-200"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* URL Slug */}
      {slug && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Link className="h-5 w-5 text-green-500" />
            URL Slug
          </h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-mono text-gray-900">{slug}</p>
          </div>
        </div>
      )}

      {/* Open Graph */}
      {(ogTitle || ogDescription) && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Open Graph Tags
          </h3>
          <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
            {ogTitle && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  OG Title
                </p>
                <p className="text-sm text-gray-900">{ogTitle}</p>
              </div>
            )}
            {ogDescription && (
              <div className={ogTitle ? 'pt-3 border-t border-gray-300' : ''}>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  OG Description
                </p>
                <p className="text-sm text-gray-900">{ogDescription}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Alt Text */}
      {altText && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Image Alt Text
          </h3>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-gray-900">{altText}</p>
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {seoReasoning && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            SEO AI Reasoning
          </h3>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-gray-800 whitespace-pre-wrap">{seoReasoning}</p>
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {confidence !== null && confidence !== undefined && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Confidence Score
          </h3>
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${confidence * 100}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-lg font-bold text-gray-900">
                {(confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tools Used Summary */}
      {toolsUsed && Object.keys(toolsUsed).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tools Used</p>
              <p className="text-lg font-semibold text-gray-900">
                {Object.keys(toolsUsed).length} tool(s)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tools Used Details */}
      {toolsUsed && Object.keys(toolsUsed).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-gray-500" />
            Tools Details
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(toolsUsed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
