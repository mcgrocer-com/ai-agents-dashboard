/**
 * WarehouseDataUpload Component
 *
 * Allows users to upload weight and dimension data to the warehouse table.
 * Weight agent prioritizes this data before online sources or 3D model estimation.
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'
import { Package, Upload } from 'lucide-react'

interface WarehouseDataUploadProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function WarehouseDataUpload({ open, onClose, onSuccess }: WarehouseDataUploadProps) {
  const [formData, setFormData] = useState({
    item_code: '',
    name: '',
    weight: '',
    width: '',
    height: '',
    length: '',
  })
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.item_code.trim()) {
      setToast({ message: 'Item code is required', type: 'error' })
      return
    }

    if (!formData.name.trim()) {
      setToast({ message: 'Product name is required', type: 'error' })
      return
    }

    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      setToast({ message: 'Valid weight is required', type: 'error' })
      return
    }

    setUploading(true)

    try {
      // Insert into warehouse table
      const { error } = await supabase.from('warehouse').insert({
        item_code: formData.item_code.trim(),
        name: formData.name.trim(),
        weight: parseFloat(formData.weight),
        width: formData.width ? parseFloat(formData.width) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        length: formData.length ? parseFloat(formData.length) : null,
      })

      if (error) throw error

      setToast({ message: 'Warehouse data uploaded successfully!', type: 'success' })

      // Reset form
      setFormData({
        item_code: '',
        name: '',
        weight: '',
        width: '',
        height: '',
        length: '',
      })

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }

      // Close dialog after short delay
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      console.error('Error uploading warehouse data:', error)
      setToast({ message: `Failed to upload: ${error.message}`, type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setFormData({
        item_code: '',
        name: '',
        weight: '',
        width: '',
        height: '',
        length: '',
      })
      onClose()
    }
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} title="Upload Warehouse Data">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Priority Data Source</p>
                <p className="mt-1">
                  Weight agent will prioritize this warehouse data before attempting online searches or 3D model estimation.
                </p>
              </div>
            </div>
          </div>

          {/* Item Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.item_code}
              onChange={(e) => handleInputChange('item_code', e.target.value)}
              placeholder="e.g., PROD-12345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={uploading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier for the product
            </p>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Samsung Galaxy S21"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={uploading}
              required
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              placeholder="e.g., 0.169"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={uploading}
              required
            />
          </div>

          {/* Dimensions Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Width (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.width}
                onChange={(e) => handleInputChange('width', e.target.value)}
                placeholder="e.g., 7.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={uploading}
              />
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.height}
                onChange={(e) => handleInputChange('height', e.target.value)}
                placeholder="e.g., 15.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={uploading}
              />
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Length (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.length}
                onChange={(e) => handleInputChange('length', e.target.value)}
                placeholder="e.g., 0.8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={uploading}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload Data</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}
