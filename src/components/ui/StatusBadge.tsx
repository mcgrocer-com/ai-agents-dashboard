/**
 * StatusBadge Component
 *
 * Displays agent processing status with appropriate colors.
 */

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'complete' | 'failed'
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'complete':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'complete':
        return 'Complete'
      case 'failed':
        return 'Failed'
      case 'processing':
        return 'Processing'
      default:
        return 'Pending'
    }
  }

  return (
    <span
      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusStyles()} ${className}`}
    >
      {getStatusText()}
    </span>
  )
}
