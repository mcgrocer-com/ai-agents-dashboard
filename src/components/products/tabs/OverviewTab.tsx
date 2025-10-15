/**
 * OverviewTab Component
 *
 * Displays basic product information and description.
 */

import { formatDateTime } from '@/lib/utils/format'

interface OverviewTabProps {
  description?: string
  createdAt?: string
  updatedAt?: string
}

export function OverviewTab({
  description,
  createdAt,
  updatedAt,
}: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {description && (
        <div
          className="text-gray-700 prose prose-sm max-w-none
            [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-900 [&_h4]:mb-2 [&_h4]:mt-4
            [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: description }}
        />
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
