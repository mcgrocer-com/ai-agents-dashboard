/**
 * VendorSelectionDialog Component
 *
 * Modal for selecting which vendors to sync to ERPNext.
 */

import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'

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
  onSave: (vendors: string[]) => Promise<void>
  loading?: boolean
}

export function VendorSelectionDialog({
  open,
  onClose,
  vendors,
  selectedVendors,
  onSave,
  loading = false,
}: VendorSelectionDialogProps) {
  const [selected, setSelected] = useState<string[]>(selectedVendors)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(selectedVendors)
  }, [selectedVendors, open])

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
      await onSave(selected)
      onClose()
    } catch (error) {
      console.error('Failed to save vendor preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const allSelected = selected.length === vendors.length
  const noneSelected = selected.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
        <div className="p-6">
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
          <div className="space-y-2 max-h-96 overflow-y-auto">
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
    </div>
  )
}
