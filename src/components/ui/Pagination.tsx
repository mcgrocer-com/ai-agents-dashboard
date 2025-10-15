/**
 * Pagination Component
 *
 * Provides pagination controls with previous/next buttons, page info, and page size selector.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export function Pagination({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalCount)

  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(e.target.value, 10)
    onPageSizeChange(newPageSize)
    // Reset to page 1 when changing page size
    onPageChange(1)
  }

  const handleJumpToPage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const pageInput = formData.get('page') as string
    const page = parseInt(pageInput, 10)

    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }

    // Reset input
    e.currentTarget.reset()
  }

  if (totalCount === 0) {
    return null
  }

  return (
    <div className="bg-white border-t border-secondary-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Page Info */}
        <div className="flex items-center gap-4">
          <p className="text-sm text-secondary-700">
            Showing <span className="font-medium">{startIndex}</span> to{' '}
            <span className="font-medium">{endIndex}</span> of{' '}
            <span className="font-medium">{totalCount.toLocaleString()}</span> results
          </p>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-secondary-700">
              Per page:
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="px-2 py-1 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-4">
          {/* Jump to Page */}
          <form onSubmit={handleJumpToPage} className="flex items-center gap-2">
            <label htmlFor="jump-to-page" className="text-sm text-secondary-700">
              Page:
            </label>
            <input
              type="number"
              id="jump-to-page"
              name="page"
              min="1"
              max={totalPages}
              placeholder={currentPage.toString()}
              className="w-16 px-2 py-1 border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm text-center"
            />
            <span className="text-sm text-secondary-700">of {totalPages}</span>
            <button
              type="submit"
              className="px-3 py-1 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
            >
              Go
            </button>
          </form>

          {/* Previous/Next Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-secondary-700 bg-white border border-secondary-300 rounded-md hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-secondary-700 bg-white border border-secondary-300 rounded-md hover:bg-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
