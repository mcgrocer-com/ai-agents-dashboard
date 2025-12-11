/**
 * VendorSelectionDialog Component
 *
 * Modal for selecting which vendors to sync to ERPNext.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, ChevronDown } from 'lucide-react'
import type { SyncDataSource } from '@/services/user.service'

interface VendorOption {
  name: string
  count: number
  syncCount?: number
}

interface VendorSelectionDialogProps {
  open: boolean
  onClose: () => void
  vendors: VendorOption[]
  selectedVendors: string[]
  prioritizeCopyright: boolean
  dataSource: SyncDataSource
  onSave: (vendors: string[], prioritizeCopyright: boolean, dataSource: SyncDataSource) => Promise<void>
  loading?: boolean
}

const DATA_SOURCE_OPTIONS: { value: SyncDataSource; label: string; description: string }[] = [
  { value: 'All', label: 'All', description: 'Sync products regardless of ERPNext data source' },
  { value: 'Scrapper', label: 'Scrapper', description: 'Only sync products where ERPNext data_source is Scrapper' },
]

export function VendorSelectionDialog({
  open,
  onClose,
  vendors,
  selectedVendors,
  prioritizeCopyright = false,
  dataSource = 'All',
  onSave,
  loading = false,
}: VendorSelectionDialogProps) {
  const [selected, setSelected] = useState<string[]>(selectedVendors)
  const [isPrioritizeCopyright, setIsPrioritizeCopyright] = useState(prioritizeCopyright)
  const [selectedDataSource, setSelectedDataSource] = useState<SyncDataSource>(dataSource)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(selectedVendors)
    setIsPrioritizeCopyright(prioritizeCopyright)
    setSelectedDataSource(dataSource)
  }, [selectedVendors, prioritizeCopyright, dataSource, open])

  if (!open) return null

  const toggleVendor = (vendorName: string) => {
    setSelected((prev) =>
      prev.includes(vendorName)
        ? prev.filter((v) => v !== vendorName)
        : [...prev, vendorName]
    )
  }

  const selectAll = () => {
    setSelected(vendors.map((v) => v.name))
  }

  const deselectAll = () => {
    setSelected([])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(selected, isPrioritizeCopyright, selectedDataSource)
      onClose()
    } catch (error) {
      console.error('Failed to save vendor preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const allSelected = selected.length === vendors.length
  const noneSelected = selected.length === 0

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Configure Sync Vendors
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-600 mb-4">
            Select which vendors to sync to ERPNext. Uncheck all to sync all vendors.
          </p>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectAll}
              disabled={allSelected || saving}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={deselectAll}
              disabled={noneSelected || saving}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400"
            >
              Deselect All
            </button>
          </div>

          {/* Vendor List */}
          <div className="space-y-2">
            {vendors.map((vendor) => (
              <label
                key={vendor.name}
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(vendor.name)}
                  onChange={() => toggleVendor(vendor.name)}
                  disabled={saving}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {vendor.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {vendor.syncCount !== undefined
                        ? `${vendor.syncCount.toLocaleString()} / ${vendor.count.toLocaleString()}`
                        : vendor.count.toLocaleString()
                      } products
                    </span>
                  </div>
                </div>
                {selected.includes(vendor.name) && (
                  <Check className="w-4 h-4 text-primary-600 ml-2" />
                )}
              </label>
            ))}
          </div>

          {noneSelected && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 p-2 rounded">
              No vendors selected - all vendors will be synced
            </p>
          )}

          {/* Data Source Dropdown */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              ERPNext Data Source Filter
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Only update products where ERPNext item's data_source matches this setting
            </p>
            <div className="relative">
              <select
                value={selectedDataSource}
                onChange={(e) => setSelectedDataSource(e.target.value as SyncDataSource)}
                disabled={saving}
                className="w-full appearance-none p-3 pr-10 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
              >
                {DATA_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {DATA_SOURCE_OPTIONS.find(o => o.value === selectedDataSource)?.description}
            </p>
          </div>

          {/* Prioritize Copyright Checkbox */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrioritizeCopyright}
                onChange={(e) => setIsPrioritizeCopyright(e.target.checked)}
                disabled={saving}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Prioritize Copyright Products
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sync products with completed copyright check first
                </p>
              </div>
              {isPrioritizeCopyright && (
                <Check className="w-4 h-4 text-primary-600 ml-2" />
              )}
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
