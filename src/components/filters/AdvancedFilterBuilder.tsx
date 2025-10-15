/**
 * AdvancedFilterBuilder Component
 *
 * Supabase-style filter builder with column/operator/value selectors.
 * Supports multiple filter rules with add/remove functionality.
 */

import { Plus, X } from 'lucide-react'

export interface FilterRule {
  id: string
  column: string
  operator: string
  value: string
}

export interface FilterColumn {
  label: string
  value: string
  type: 'text' | 'number' | 'date'
}

interface AdvancedFilterBuilderProps {
  columns: FilterColumn[]
  filters: FilterRule[]
  onFiltersChange: (filters: FilterRule[]) => void
  onApply?: () => void
}

const OPERATORS = [
  { label: '=', value: '=' },
  { label: '≠', value: '≠' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: 'contains', value: 'contains' },
  { label: 'starts with', value: 'starts with' },
  { label: 'ends with', value: 'ends with' },
  { label: 'is null', value: 'is null' },
  { label: 'is not null', value: 'is not null' },
]

export function AdvancedFilterBuilder({
  columns,
  filters,
  onFiltersChange,
}: AdvancedFilterBuilderProps) {
  const addFilter = () => {
    const newFilter: FilterRule = {
      id: `filter-${Date.now()}-${Math.random()}`,
      column: columns[0]?.value || '',
      operator: '=',
      value: '',
    }
    onFiltersChange([...filters, newFilter])
  }

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id))
  }

  const updateFilter = (id: string, field: keyof FilterRule, value: string) => {
    onFiltersChange(
      filters.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    )
  }

  const clearAllFilters = () => {
    onFiltersChange([])
  }

  const getColumnType = (columnValue: string): string => {
    return columns.find((c) => c.value === columnValue)?.type || 'text'
  }

  // Check if operator requires value input
  const operatorNeedsValue = (operator: string): boolean => {
    return operator !== 'is null' && operator !== 'is not null'
  }

  return (
    <div className="space-y-3">
      {filters.length === 0 ? (
        <p className="text-sm text-secondary-500 text-center py-8">
          No filters applied. Click "Add filter" to get started.
        </p>
      ) : (
        filters.map((filter) => (
          <div
            key={filter.id}
            className="flex items-center gap-2 bg-secondary-50 p-3 rounded-lg"
          >
            {/* Column Selector */}
            <select
              value={filter.column}
              onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
              className="flex-1 px-3 py-2 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              {columns.map((col) => (
                <option key={col.value} value={col.value}>
                  {col.label}
                </option>
              ))}
            </select>

            {/* Operator Selector */}
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
              className="w-32 px-3 py-2 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value Input */}
            {operatorNeedsValue(filter.operator) && (
              <input
                type={getColumnType(filter.column) === 'number' ? 'number' : 'text'}
                value={filter.value}
                onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                placeholder="Enter a value"
                className="flex-1 px-3 py-2 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            )}

            {/* Remove Button */}
            <button
              onClick={() => removeFilter(filter.id)}
              className="p-2 text-secondary-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              aria-label="Remove filter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={addFilter}
          className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add filter
        </button>

        {filters.length > 0 && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-secondary-600 hover:text-secondary-700 hover:bg-secondary-100 rounded-md transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
