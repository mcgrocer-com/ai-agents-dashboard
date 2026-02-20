/**
 * Classification Badge Component
 * Displays UK medicine classification status with color-coded badges
 */

import type { ClassificationType } from '@/types/classification'

interface ClassificationBadgeProps {
  classification: ClassificationType | null
  rejected: boolean
}

const ClassificationBadge = ({ classification, rejected }: ClassificationBadgeProps) => {
  if (!classification) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Unclassified
      </span>
    )
  }

  const badgeStyles = {
    not_medicine: {
      className: 'bg-blue-100 text-blue-800',
      label: 'Not Medicine'
    },
    gsl: {
      className: 'bg-green-100 text-green-800',
      label: 'GSL - Allowed'
    },
    pharmacy: {
      className: 'bg-red-100 text-red-800',
      label: 'Pharmacy Only'
    },
    pom: {
      className: 'bg-red-900 text-white',
      label: 'Prescription Only'
    },
    unclear: {
      className: 'bg-orange-100 text-orange-800',
      label: 'Unclear'
    },
    cbd: {
      className: 'bg-purple-100 text-purple-800',
      label: 'CBD Product'
    },
    tobacco: {
      className: 'bg-amber-100 text-amber-800',
      label: 'Tobacco/Vape'
    },
    fresh_perishable: {
      className: 'bg-cyan-100 text-cyan-800',
      label: 'Fresh/Perishable'
    }
  }

  const style = badgeStyles[classification]

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.className}`}>
      {style.label}
      {rejected && (
        <span className="ml-1 text-[10px] font-bold">✕</span>
      )}
    </span>
  )
}

export default ClassificationBadge
