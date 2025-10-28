/**
 * OverviewTab Component
 *
 * Displays basic product information and description.
 */

import { formatDateTime } from '@/lib/utils/format'

interface OverviewTabProps {
  description?: string
  aiTitle?: string
  aiDescription?: string
  metaTitle?: string
  metaDescription?: string
  createdAt?: string
  updatedAt?: string
}

export function OverviewTab({
  description,
  aiTitle,
  aiDescription,
  metaTitle,
  metaDescription,
  createdAt,
  updatedAt,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {description && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Product Description</h3>
          <div
            className="text-gray-700 prose prose-sm max-w-none
              [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-900 [&_h4]:mb-2 [&_h4]:mt-4
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </div>
      )}

      {/* AI Title */}
      {aiTitle && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Generated Title</h3>
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-gray-900 font-medium">{aiTitle}</p>
            <div className="mt-3 pt-3 border-t border-emerald-200">
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{aiTitle.length}</span> characters
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Description */}
      {aiDescription && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Generated Description</h3>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <div
              className="text-gray-900 prose prose-sm max-w-none
                [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-900 [&_h4]:mb-2 [&_h4]:mt-4
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
                [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-3
                [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-3
                [&_li]:text-sm [&_li]:mb-1
                [&_strong]:font-semibold [&_strong]:text-gray-900
                [&_em]:italic"
              dangerouslySetInnerHTML={{ __html: aiDescription }}
            />
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{aiDescription.length}</span> characters
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meta Title */}
      {metaTitle && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Meta Title</h3>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-900 font-medium">{metaTitle}</p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{metaTitle.length}</span> characters
              </p>
              {metaTitle.length >= 50 && metaTitle.length <= 60 && (
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
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Meta Description</h3>
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

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        {createdAt && (
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDateTime(createdAt)}
            </p>
          </div>
        )}
        {updatedAt && (
          <div>
            <p className="text-sm text-gray-500">Last Updated</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDateTime(updatedAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
