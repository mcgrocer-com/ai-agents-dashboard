/**
 * EditProductDialog Component
 *
 * Dialog for editing basic product information.
 */

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export interface EditProductData {
  name: string
  price: number
  original_price: number
  description: string
  stock_status: string
}

interface EditProductDialogProps {
  open: boolean
  onClose: () => void
  product: {
    name?: string
    price?: number
    original_price?: number
    description?: string
    stock_status?: string
  }
  onSave: (data: EditProductData) => Promise<void>
  saving?: boolean
}

export function EditProductDialog({
  open,
  onClose,
  product,
  onSave,
  saving = false,
}: EditProductDialogProps) {
  const [formData, setFormData] = useState<EditProductData>({
    name: product.name || '',
    price: product.price || 0,
    original_price: product.original_price || 0,
    description: product.description || '',
    stock_status: product.stock_status || 'In Stock',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(formData)
  }

  const handleChange = (field: keyof EditProductData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit Product">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-secondary-700 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter product name"
          />
        </div>

        {/* Price */}
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-secondary-700 mb-1">
            Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500">£</span>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
              required
              className="w-full pl-8 pr-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Original Price (Selling Price) */}
        <div>
          <label htmlFor="original_price" className="block text-sm font-medium text-secondary-700 mb-1">
            Selling Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-500">£</span>
            <input
              id="original_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.original_price}
              onChange={(e) => handleChange('original_price', parseFloat(e.target.value) || 0)}
              required
              className="w-full pl-8 pr-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-secondary-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder="Enter product description"
          />
        </div>

        {/* Stock Status */}
        <div>
          <label htmlFor="stock_status" className="block text-sm font-medium text-secondary-700 mb-1">
            Stock Status <span className="text-red-500">*</span>
          </label>
          <select
            id="stock_status"
            value={formData.stock_status}
            onChange={(e) => handleChange('stock_status', e.target.value)}
            required
            className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="In Stock">In Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-secondary-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
