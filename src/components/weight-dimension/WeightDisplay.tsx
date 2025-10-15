'use client'

/**
 * WeightDisplay Component
 *
 * Displays product weight with unit conversion (kg/lbs).
 */

interface WeightDisplayProps {
  weight: number
  unit?: 'kg' | 'lbs'
  showBoth?: boolean
}

export default function WeightDisplay({
  weight,
  unit = 'kg',
  showBoth = false,
}: WeightDisplayProps) {
  if (!weight || weight === 0) {
    return <span className="text-gray-400">-</span>
  }

  const weightInKg = unit === 'lbs' ? weight * 0.453592 : weight
  const weightInLbs = unit === 'kg' ? weight * 2.20462 : weight

  if (showBoth) {
    return (
      <div className="text-sm">
        <div className="font-semibold text-gray-900">
          {weightInKg.toFixed(2)} kg
        </div>
        <div className="text-xs text-gray-500">
          ({weightInLbs.toFixed(2)} lbs)
        </div>
      </div>
    )
  }

  return (
    <span className="text-sm font-semibold text-gray-900">
      {weight.toFixed(2)} {unit}
    </span>
  )
}
