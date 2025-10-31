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
  isDefault?: boolean
  dropdownOptions?: Array<{ label: string; value: string }>
  lockOperator?: boolean
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
  allColumns?: FilterColumn[]
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
  allColumns,
}: AdvancedFilterBuilderProps) {
  // Use allColumns for default filters if provided, otherwise use columns
  const defaultFilterColumns = allColumns || columns
  const addFilter = () => {
    const firstColumn = columns[0]
    const defaultValue = firstColumn?.type === 'number' ? '0' : ''

    const newFilter: FilterRule = {
      id: `filter-${Date.now()}-${Math.random()}`,
      column: firstColumn?.value || '',
      operator: '=',
      value: defaultValue,
      isDefault: false,
    }
    onFiltersChange([...filters, newFilter])
  }

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter((f) => f.id !== id))
  }

  const updateFilter = (id: string, field: keyof FilterRule, value: string) => {
    onFiltersChange(
      filters.map((f) => {
        if (f.id !== id) return f

        // If changing column, update value to appropriate default if needed
        if (field === 'column') {
          const newColumn = columns.find((c) => c.value === value)
          const currentValue = f.value

          // If switching to a number column and current value is empty, set to '0'
          if (newColumn?.type === 'number' && currentValue === '') {
            return { ...f, [field]: value, value: '0' }
          }
        }

        return { ...f, [field]: value }
      })
    )
  }

  const clearAllFilters = () => {
    // Only clear user-added filters, keep default filters
    onFiltersChange(filters.filter((f) => f.isDefault))
  }

  // Separate default and user filters
  const userFilters = filters.filter((f) => !f.isDefault)
  const hasUserFilters = userFilters.length > 0

  const getColumnType = (columnValue: string, isDefault: boolean = false): string => {
    const columnList = isDefault ? defaultFilterColumns : columns
    return columnList.find((c) => c.value === columnValue)?.type || 'text'
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
        <>
          {/* Default Filters - shown at top with distinct styling */}
          {filters.filter((f) => f.isDefault).map((filter) => (
            <div
              key={filter.id}
              className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 p-3 rounded-lg"
            >
              {/* Column Selector - disabled for default filters */}
              <select
                value={filter.column}
                disabled
                className="flex-1 px-3 py-2 border border-yellow-300 bg-yellow-50 rounded-md text-sm cursor-not-allowed opacity-75"
              >
                {defaultFilterColumns.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label}
                  </option>
                ))}
              </select>

              {/* Operator Selector - locked if lockOperator is true */}
              <select
                value={filter.operator}
                onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                disabled={filter.lockOperator}
                className={`w-32 px-3 py-2 border border-yellow-300 rounded-md text-sm ${
                  filter.lockOperator
                    ? 'bg-yellow-50 cursor-not-allowed opacity-75'
                    : 'bg-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent'
                }`}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value - Dropdown if dropdownOptions provided, otherwise input */}
              {operatorNeedsValue(filter.operator) && (
                filter.dropdownOptions ? (
                  <select
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 border border-yellow-300 bg-white rounded-md focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
                  >
                    {filter.dropdownOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={getColumnType(filter.column, true) === 'number' ? 'number' : 'text'}
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                    placeholder="Enter a value"
                    className="flex-1 px-3 py-2 border border-yellow-300 bg-white rounded-md focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
                  />
                )
              )}

              {/* Lock indicator instead of remove button */}
              <div className="p-2 text-yellow-600" title="Default filter (cannot be removed)">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          ))}

          {/* User Filters */}
          {filters.filter((f) => !f.isDefault).map((filter) => (
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
          ))}
        </>
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

        {hasUserFilters && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-2 text-sm text-secondary-600 hover:text-secondary-700 hover:bg-secondary-100 rounded-md transition-colors"
          >
            Clear user filters
          </button>
        )}
      </div>
    </div>
  )
}
