/**
 * Manual Override Dialog Component
 * Allows admin to manually override classification decisions
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ClassificationType } from '@/types/classification'

interface ManualOverrideDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, classification?: ClassificationType) => void
  mode: 'accept' | 'reject'
  productName: string
}

const ManualOverrideDialog = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
  productName
}: ManualOverrideDialogProps) => {
  const [reason, setReason] = useState('')
  const [classification, setClassification] = useState<ClassificationType>('unclear')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert('Please provide a reason for the manual override')
      return
    }

    onConfirm(reason, mode === 'reject' ? classification : undefined)
    setReason('')
    setClassification('unclear')
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {mode === 'accept' ? 'Accept Product' : 'Reject Product'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to {mode === 'accept' ? 'accept' : 'reject'}{' '}
              <span className="font-medium text-gray-900">{productName}</span>?
            </p>

            {/* Classification Type (only for reject mode) */}
            {mode === 'reject' && (
              <div className="mb-4">
                <label htmlFor="classification" className="block text-sm font-medium text-gray-700 mb-2">
                  Classification Type
                </label>
                <select
                  id="classification"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as ClassificationType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="unclear">Unclear</option>
                  <option value="pharmacy">Pharmacy Medicine (P)</option>
                  <option value="pom">Prescription Only (POM)</option>
                </select>
              </div>
            )}

            {/* Reason */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Override
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Explain why you are overriding the classification..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                mode === 'accept'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {mode === 'accept' ? 'Accept Product' : 'Reject Product'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ManualOverrideDialog
