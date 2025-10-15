/**
 * WeightDimensionFilters Component
 *
 * Filter controls for weight-dimension agent page (vendor, status, weight, dimensions).
 * Client Component for interactivity with URL-based state management.
 */

'use client'

import { useLocation, useNavigate } from 'react-router-dom';

interface WeightDimensionFiltersProps {
  vendors: string[]
}

export default function WeightDimensionFilters({ vendors }: WeightDimensionFiltersProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const handleFilterChange = (key: string, value: string) => {
    const currentValue = searchParams.get(key) ?? ''

    // Only update if value actually changed
    if (value !== currentValue) {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page') // Reset to page 1 when filter changes
      navigate(`?${params.toString()}`)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 flex-1">
      {/* Vendor Filter */}
      <select
        value={searchParams.get('vendor') ?? ''}
        onChange={(e) => handleFilterChange('vendor', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[150px]"
      >
        <option value="">All Vendors</option>
        {vendors.map((vendor) => (
          <option key={vendor} value={vendor}>
            {vendor}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={searchParams.get('status') ?? ''}
        onChange={(e) => handleFilterChange('status', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[130px]"
      >
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="complete">Complete</option>
        <option value="failed">Failed</option>
      </select>

      {/* Weight Filter */}
      <select
        value={searchParams.get('weight') ?? ''}
        onChange={(e) => handleFilterChange('weight', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[140px]"
      >
        <option value="">All Weight</option>
        <option value="has_weight">Has Weight</option>
        <option value="no_weight">No Weight</option>
      </select>

      {/* Dimensions Filter */}
      <select
        value={searchParams.get('dimensions') ?? ''}
        onChange={(e) => handleFilterChange('dimensions', e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[160px]"
      >
        <option value="">All Dimensions</option>
        <option value="has_dimensions">Has Dimensions</option>
        <option value="no_dimensions">No Dimensions</option>
      </select>
    </div>
  )
}
