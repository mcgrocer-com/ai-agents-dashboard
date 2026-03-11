/**
 * ExportValidationDialog Component
 *
 * Dialog for exporting validation issue products as a JSON file for rescraping.
 * Calls the export-validation-errors edge function to fetch ALL matching products
 * server-side (no Supabase client row cap).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, X, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { ScrapedProduct, ValidationErrorCategory } from '@/types'

interface ExportField {
  key: keyof ScrapedProduct
  label: string
  description: string
  defaultSelected: boolean
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'url', label: 'URL', description: 'Product page URL (required for rescraping)', defaultSelected: true },
  { key: 'product_id', label: 'Product ID', description: 'Unique product identifier', defaultSelected: true },
  { key: 'vendor', label: 'Vendor', description: 'Source vendor name', defaultSelected: true },
  { key: 'validation_error', label: 'Validation Error', description: 'The validation error message', defaultSelected: true },
  { key: 'name', label: 'Name', description: 'Product name', defaultSelected: false },
  { key: 'price', label: 'Price', description: 'Current price', defaultSelected: false },
  { key: 'original_price', label: 'Original Price', description: 'Original/RRP price', defaultSelected: false },
  { key: 'main_image', label: 'Main Image', description: 'Main image URL', defaultSelected: false },
  { key: 'category', label: 'Category', description: 'Product category', defaultSelected: false },
  { key: 'stock_status', label: 'Stock Status', description: 'In stock / out of stock', defaultSelected: false },
  { key: 'ean_code', label: 'EAN Code', description: 'Barcode / EAN', defaultSelected: false },
  { key: 'created_at', label: 'Created At', description: 'When the product was first scraped', defaultSelected: false },
  { key: 'updated_at', label: 'Updated At', description: 'Last update timestamp', defaultSelected: false },
]

interface ExportValidationDialogProps {
  open: boolean
  onClose: () => void
  totalCount: number
  errorCategory?: ValidationErrorCategory
  categoryLabel?: string
}

export function ExportValidationDialog({
  open,
  onClose,
  totalCount,
  errorCategory,
  categoryLabel,
}: ExportValidationDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<keyof ScrapedProduct>>(
    () => new Set(EXPORT_FIELDS.filter((f) => f.defaultSelected).map((f) => f.key))
  )
  const [isExporting, setIsExporting] = useState(false)

  if (!open) return null

  const toggleField = (key: keyof ScrapedProduct) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedFields(new Set(EXPORT_FIELDS.map((f) => f.key)))
  }

  const selectNone = () => {
    setSelectedFields(new Set())
  }

  const handleExport = async () => {
    if (selectedFields.size === 0) return

    setIsExporting(true)
    try {
      const { data, error } = await supabase.functions.invoke('export-validation-errors', {
        body: {
          fields: Array.from(selectedFields),
          error_category: errorCategory || undefined,
        },
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Export failed')

      const json = JSON.stringify(data.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().slice(0, 10)
      const suffix = errorCategory ? `-${errorCategory}` : ''
      a.download = `validation-errors-rescrape${suffix}-${timestamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      console.error('[ExportValidationDialog] Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isExporting) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={!isExporting ? onClose : undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Export for Rescraping</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalCount} product{totalCount !== 1 ? 's' : ''} with validation errors
              {categoryLabel ? ` (${categoryLabel})` : ''}
            </p>
          </div>
          <button onClick={onClose} disabled={isExporting} className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Field selection */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Select fields to include:</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Select all
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={selectNone} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Clear all
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {EXPORT_FIELDS.map((field) => {
              const isSelected = selectedFields.has(field.key)
              return (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary-700' : 'text-gray-700'}`}>
                      {field.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{field.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <span className="text-xs text-gray-500">{selectedFields.size} fields selected</span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedFields.size === 0 || isExporting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Exporting...' : `Export All ${totalCount} Products`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
