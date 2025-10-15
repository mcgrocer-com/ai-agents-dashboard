'use client'

/**
 * ConfidenceIndicator Component
 *
 * Visual confidence indicator for individual measurements.
 */

interface ConfidenceIndicatorProps {
  confidence: number
  label: string
}

export default function ConfidenceIndicator({
  confidence,
  label,
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100)

  const getBarColor = () => {
    if (confidence < 0.5) return 'bg-red-500'
    if (confidence < 0.8) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
