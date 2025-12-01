/**
 * Bulk Classification Dialog
 * Allows updating multiple products' classifications at once
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import type { ClassificationType } from '@/types/classification'

interface BulkClassificationDialogProps {
  isOpen: boolean
  selectedCount: number
  onClose: () => void
  onSave: (classification: ClassificationType, reason: string) => Promise<void>
  isLoading: boolean
}

export function BulkClassificationDialog({
  isOpen,
  selectedCount,
  onClose,
  onSave,
  isLoading
}: BulkClassificationDialogProps) {
  const [classification, setClassification] = useState<ClassificationType>('not_medicine')
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  const handleSave = async () => {
    if (!reason.trim()) {
      return
    }
    await onSave(classification, reason)
  }

  const handleClose = () => {
    if (!isLoading) {
      setReason('')
      setClassification('not_medicine')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-secondary-200">
          <div>
            <h2 className="text-xl font-bold text-secondary-900">
              Update Classification
            </h2>
            <p className="text-sm text-secondary-600 mt-1">
              Updating {selectedCount} product{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Classification Type */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Classification Type
            </label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as ClassificationType)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="not_medicine">Not Medicine</option>
              <option value="gsl">GSL (General Sales List)</option>
              <option value="pharmacy">Pharmacy Medicine</option>
              <option value="pom">POM (Prescription Only)</option>
              <option value="unclear">Unclear</option>
            </select>
            <p className="text-xs text-secondary-500 mt-1">
              {classification === 'not_medicine' && 'Non-medicinal product - ACCEPTED'}
              {classification === 'gsl' && 'Over-the-counter medicine - ACCEPTED'}
              {classification === 'pharmacy' && 'Pharmacy-only medicine - REJECTED'}
              {classification === 'pom' && 'Prescription required - REJECTED'}
              {classification === 'unclear' && 'Unclear classification - REJECTED'}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              placeholder="Explain why you are changing the classification for these products..."
              rows={4}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-secondary-500 mt-1">
              This reason will be applied to all {selectedCount} selected product{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Warning */}
          {(classification === 'pharmacy' || classification === 'pom' || classification === 'unclear') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> These products will be marked as REJECTED and removed from the processing queue.
                Agent data will be preserved in case you need to reclassify them later.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-secondary-200 bg-secondary-50">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-secondary-700 bg-white border border-secondary-300 rounded-lg hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || !reason.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Updating...' : `Update ${selectedCount} Product${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
