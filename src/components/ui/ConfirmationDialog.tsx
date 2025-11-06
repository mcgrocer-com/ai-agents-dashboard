/**
 * ConfirmationDialog Component
 *
 * A reusable confirmation dialog that displays a message and asks the user to confirm or cancel an action.
 * Supports different variants (danger, warning, info) with appropriate styling.
 */

import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

interface ConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}: ConfirmationDialogProps) {
  if (!open) return null

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      Icon: AlertTriangle,
      buttonBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      Icon: AlertCircle,
      buttonBg: 'bg-orange-600 hover:bg-orange-700',
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      Icon: Info,
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
    },
  }

  const style = variantStyles[variant]
  const IconComponent = style.Icon

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      handleCancel()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
      onClick={!loading ? handleCancel : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 ${style.iconBg} rounded-full flex items-center justify-center`}
          >
            <IconComponent className={`w-5 h-5 ${style.iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${style.buttonBg}`}
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
