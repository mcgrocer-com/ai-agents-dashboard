/**
 * Classification Stats Component
 * Displays dashboard metrics for classification agent
 */

import { CheckCircle, XCircle, Package } from 'lucide-react'
import type { ClassificationStats as ClassificationStatsType } from '@/types/classification'

interface ClassificationStatsProps {
  stats: ClassificationStatsType
  loading?: boolean
}

const ClassificationStatsDisplay = ({ stats, loading }: ClassificationStatsProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <div className="h-4 bg-secondary-200 rounded w-1/2 mb-4" />
            <div className="h-8 bg-secondary-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      name: 'Total Products',
      value: stats.total.toLocaleString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      name: 'Accepted',
      value: stats.accepted.toLocaleString(),
      percentage: stats.acceptedPercentage.toFixed(1) + '%',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'Rejected',
      value: stats.rejected.toLocaleString(),
      percentage: stats.rejectedPercentage.toFixed(1) + '%',
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm p-6 border border-secondary-200">
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${stat.bgColor} rounded-lg p-3`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500 truncate">{stat.name}</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-secondary-900">{stat.value}</div>
                    {stat.percentage && (
                      <div className="ml-2 text-sm text-secondary-500">({stat.percentage})</div>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Classification Breakdown */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-secondary-200">
        <h3 className="text-sm font-medium text-secondary-900 mb-4">Classification Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg">
            <span className="text-xs text-secondary-600 mb-1">Not Medicine</span>
            <span className="text-lg font-semibold text-blue-600">
              {stats.byType.not_medicine.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg">
            <span className="text-xs text-secondary-600 mb-1">GSL</span>
            <span className="text-lg font-semibold text-green-600">
              {stats.byType.gsl.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-xs text-secondary-600 mb-1">Pharmacy</span>
            <span className="text-lg font-semibold text-yellow-600">
              {stats.byType.pharmacy.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg">
            <span className="text-xs text-secondary-600 mb-1">POM</span>
            <span className="text-lg font-semibold text-red-600">
              {stats.byType.pom.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 bg-orange-50 rounded-lg">
            <span className="text-xs text-secondary-600 mb-1">Unclear</span>
            <span className="text-lg font-semibold text-orange-600">
              {stats.byType.unclear.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassificationStatsDisplay
