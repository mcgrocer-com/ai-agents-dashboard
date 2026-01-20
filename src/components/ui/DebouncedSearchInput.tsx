/**
 * DebouncedSearchInput Component
 *
 * Reusable search input with debouncing for efficient search operations.
 * Separates UI state from search state to provide immediate feedback while
 * preventing excessive API calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'

interface DebouncedSearchInputProps {
  placeholder?: string
  onSearch: (term: string) => void
  debounceMs?: number
  className?: string
  initialValue?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function DebouncedSearchInput({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 400,
  className = '',
  initialValue = '',
  disabled = false,
  size = 'md',
}: DebouncedSearchInputProps) {
  const [inputValue, setInputValue] = useState(initialValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchTermRef = useRef(initialValue)

  // Debounce effect - waits for user to stop typing before triggering search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (inputValue !== lastSearchTermRef.current) {
        lastSearchTermRef.current = inputValue
        onSearch(inputValue)
      }
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [inputValue, debounceMs, onSearch])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
    lastSearchTermRef.current = ''
    onSearch('')
  }, [onSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear()
      }
    },
    [handleClear]
  )

  const sizeClasses = {
    sm: 'py-1.5 pl-8 pr-8 text-sm',
    md: 'py-2 pl-10 pr-10',
    lg: 'py-3 pl-12 pr-12 text-lg',
  }

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const iconLeftPos = {
    sm: 'left-2.5',
    md: 'left-3',
    lg: 'left-4',
  }

  const iconRightPos = {
    sm: 'right-2',
    md: 'right-3',
    lg: 'right-4',
  }

  return (
    <div className={`relative ${className}`}>
      <Search
        className={`absolute ${iconLeftPos[size]} top-1/2 -translate-y-1/2 ${iconSizes[size]} text-secondary-400`}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full ${sizeClasses[size]} border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className={`absolute ${iconRightPos[size]} top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 transition-colors`}
          title="Clear search"
          type="button"
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </div>
  )
}
