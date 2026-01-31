/**
 * FaqTab Component
 *
 * Displays FAQ agent results with expandable Q&A accordion.
 */

import { useState } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  HelpCircle,
  Wrench,
  AlertCircle,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils/format'
import type { FaqItem } from '@/types'

interface FaqTabProps {
  status: 'pending' | 'processing' | 'complete' | 'failed' | null
  faq?: FaqItem[] | null
  confidence?: number | null
  reasoning?: string | null
  toolsUsed?: Record<string, unknown> | null
  errorMessage?: string | null
  updatedAt?: string
}

export function FaqTab({
  status,
  faq,
  confidence,
  reasoning,
  toolsUsed,
  errorMessage,
  updatedAt,
}: FaqTabProps) {
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set([0]))

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // Parse FAQ if it's a JSON string
  let parsedFaq = faq
  if (typeof faq === 'string') {
    try {
      parsedFaq = JSON.parse(faq)
    } catch {
      parsedFaq = []
    }
  }

  if (!status || status === 'pending') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status || 'pending'} />
        <p className="mt-4 text-gray-500">FAQ generation pending</p>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="text-center py-12">
        <StatusBadge status={status} />
        <p className="mt-4 text-gray-500">FAQ generation in progress...</p>
      </div>
    )
  }

  if (status === 'failed') {
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
              <p className="text-sm text-red-800">{errorMessage || 'An error occurred during FAQ generation'}</p>
            </div>
          </div>
        </div>
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
              FAQ Generation Complete
            </h3>
            <p className="text-sm text-green-800">
              {parsedFaq && parsedFaq.length > 0
                ? `Generated ${parsedFaq.length} FAQ${parsedFaq.length === 1 ? '' : 's'} for this product.`
                : 'FAQ analysis has been completed.'}
            </p>
          </div>
        </div>
      </div>

      {/* FAQ List */}
      {parsedFaq && parsedFaq.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
            <HelpCircle className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">
              Frequently Asked Questions ({parsedFaq.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {parsedFaq.map((item: FaqItem, index: number) => (
              <div key={index} className="bg-white">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900">{item.question}</span>
                  </div>
                  {expandedFaqs.has(index) ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFaqs.has(index) && (
                  <div className="px-4 pb-4 pl-[3.25rem]">
                    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {confidence !== null && confidence !== undefined && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-teal-600" />
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
            <MessageSquare className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Agent Reasoning</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reasoning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tools Used */}
      {toolsUsed && Object.keys(toolsUsed).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Wrench className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
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
    </div>
  )
}
