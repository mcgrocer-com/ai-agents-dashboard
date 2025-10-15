'use client'

/**
 * DimensionDisplay Component
 *
 * Displays product dimensions in a formatted way (W × H × D).
 */

interface DimensionDisplayProps {
  width?: number
  height?: number
  depth?: number
  unit?: string
}

export default function DimensionDisplay({
  width,
  height,
  depth,
  unit = 'cm',
}: DimensionDisplayProps) {
  if (!width && !height && !depth) {
    return <span className="text-gray-400">-</span>
  }

  const formatDim = (value?: number) =>
    value !== null && value !== undefined && typeof value === 'number' ? value.toFixed(1) : '?'

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-mono text-gray-900">
        {formatDim(width)} × {formatDim(height)} × {formatDim(depth)}
      </span>
      <span className="text-xs text-gray-500">{unit}</span>
    </div>
  )
}
