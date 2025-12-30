/**
 * EditProductDialog Component
 *
 * Dialog for editing basic product information.
 */

import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { productsService } from '@/services/products.service'
import { CloudUpload, CheckCircle, AlertCircle } from 'lucide-react'

export interface EditProductData {
  name: string
  price: number
  original_price: number
  description: string
  stock_status: string
  main_image?: string
  // Set to null to reset AI-generated fields when name/description changes
  ai_title?: string | null
  ai_description?: string | null
}

interface EditProductDialogProps {
  open: boolean
  onClose: () => void
  product: {
    id?: string
    name?: string
    price?: number
    original_price?: number
    description?: string
    stock_status?: string
    main_image?: string
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
    main_image: product.main_image || '',
  })

  // Track original values to detect changes
  const [originalName, setOriginalName] = useState(product.name || '')
  const [originalDescription, setOriginalDescription] = useState(product.description || '')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Reset form data when dialog opens or product changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: product.name || '',
        price: product.price || 0,
        original_price: product.original_price || 0,
        description: product.description || '',
        stock_status: product.stock_status || 'In Stock',
        main_image: product.main_image || '',
      })
      // Store original values for change detection
      setOriginalName(product.name || '')
      setOriginalDescription(product.description || '')
      // Reset upload status
      setUploadStatus('idle')
      setUploadError(null)
    }
  }, [open, product])

  // Handle image upload to Supabase
  const handleUploadImage = async () => {
    if (!formData.main_image || !product.id) return

    setUploading(true)
    setUploadStatus('idle')
    setUploadError(null)

    try {
      const result = await productsService.uploadProductImageFromUrl(formData.main_image, product.id)

      if (result.success && result.url !== formData.main_image) {
        setFormData((prev) => ({ ...prev, main_image: result.url }))
        setUploadStatus('success')
      } else if (!result.success) {
        setUploadStatus('error')
        setUploadError(result.error || 'Upload failed')
      } else {
        // URL didn't change (already hosted)
        setUploadStatus('success')
      }
    } catch (error) {
      setUploadStatus('error')
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Check if image is already on Supabase
  const isImageOnSupabase = formData.main_image?.includes('supabase.co')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if name or description was modified
    const nameChanged = formData.name !== originalName
    const descriptionChanged = formData.description !== originalDescription

    // If name or description changed, reset AI-generated fields to trigger regeneration
    const dataToSave: EditProductData = {
      ...formData,
      ...(nameChanged || descriptionChanged
        ? { ai_title: null, ai_description: null }
        : {}),
    }

    await onSave(dataToSave)
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

        {/* Main Image */}
        <div>
          <label htmlFor="main_image" className="block text-sm font-medium text-secondary-700 mb-1">
            Product Image
          </label>
          <input
            id="main_image"
            type="url"
            value={formData.main_image || ''}
            onChange={(e) => {
              handleChange('main_image', e.target.value)
              setUploadStatus('idle')
              setUploadError(null)
            }}
            className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter image URL"
          />
          {formData.main_image && (
            <div className="mt-2 flex items-start gap-3">
              <img
                src={formData.main_image}
                alt="Product preview"
                className="h-32 w-32 object-cover rounded-lg border border-secondary-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={uploading || isImageOnSupabase || !product.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isImageOnSupabase
                      ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                      : uploading
                        ? 'bg-secondary-100 text-secondary-500 cursor-wait'
                        : 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100'
                  }`}
                  title={
                    isImageOnSupabase
                      ? 'Image already hosted on Supabase'
                      : 'Upload image to Supabase storage'
                  }
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Uploading...</span>
                    </>
                  ) : isImageOnSupabase ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>On Supabase</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Upload to Supabase</span>
                    </>
                  )}
                </button>
                {uploadStatus === 'success' && !isImageOnSupabase && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Uploaded successfully
                  </p>
                )}
                {uploadStatus === 'error' && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {uploadError || 'Upload failed'}
                  </p>
                )}
                <p className="text-xs text-secondary-500">
                  {isImageOnSupabase ? 'Hosted on Supabase CDN' : 'External image URL'}
                </p>
              </div>
            </div>
          )}
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
