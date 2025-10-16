/**
 * SeoKeywordsUpload Component
 *
 * Allows users to upload SEO keywords to the seo_keywords table.
 * SEO agent uses these keywords to refine generated content.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'
import { Tag, Upload, X, Plus, Trash2, Search } from 'lucide-react'

interface ExistingKeyword {
  id: string
  keyword: string
  category: string | null
  priority: number | null
  usage_count: number | null
  is_active: boolean | null
  created_at: string
}

interface SeoKeywordsUploadProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SeoKeywordsUpload({ open, onClose, onSuccess }: SeoKeywordsUploadProps) {
  const [keywords, setKeywords] = useState<string[]>([''])
  const [category, setCategory] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existingKeywords, setExistingKeywords] = useState<ExistingKeyword[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Fetch existing keywords when dialog opens
  useEffect(() => {
    if (open) {
      fetchExistingKeywords()
    }
  }, [open])

  const fetchExistingKeywords = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('seo_keywords')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setExistingKeywords(data || [])
    } catch (error: any) {
      console.error('Error fetching keywords:', error)
      setToast({ message: `Failed to load keywords: ${error.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords]
    newKeywords[index] = value
    setKeywords(newKeywords)
  }

  const handleAddKeyword = () => {
    setKeywords([...keywords, ''])
  }

  const handleRemoveKeyword = (index: number) => {
    if (keywords.length > 1) {
      const newKeywords = keywords.filter((_, i) => i !== index)
      setKeywords(newKeywords)
    }
  }

  const handleDeleteKeyword = async (id: string) => {
    setDeleting(id)

    try {
      const { error } = await supabase
        .from('seo_keywords')
        .delete()
        .eq('id', id)

      if (error) throw error

      setToast({ message: 'Keyword deleted successfully!', type: 'success' })

      // Refresh the list
      await fetchExistingKeywords()
    } catch (error: any) {
      console.error('Error deleting keyword:', error)
      setToast({ message: `Failed to delete: ${error.message}`, type: 'error' })
    } finally {
      setDeleting(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Filter out empty keywords
    const validKeywords = keywords.filter((k) => k.trim() !== '')

    if (validKeywords.length === 0) {
      setToast({ message: 'Please add at least one keyword', type: 'error' })
      return
    }

    setUploading(true)

    try {
      // Insert keywords into seo_keywords table
      const keywordRecords = validKeywords.map((keyword) => ({
        keyword: keyword.trim(),
        category: category.trim() || null,
        is_active: true,
        priority: 1,
        usage_count: 0,
      }))

      const { error } = await supabase.from('seo_keywords').insert(keywordRecords)

      if (error) throw error

      setToast({
        message: `Successfully uploaded ${validKeywords.length} keyword(s)!`,
        type: 'success'
      })

      // Reset form
      setKeywords([''])
      setCategory('')

      // Refresh existing keywords list
      await fetchExistingKeywords()

      // Switch to view tab to show the new keywords
      setActiveTab('view')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error uploading keywords:', error)
      setToast({ message: `Failed to upload: ${error.message}`, type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading && !loading) {
      setKeywords([''])
      setCategory('')
      setSearchTerm('')
      setActiveTab('add')
      onClose()
    }
  }

  // Filter existing keywords based on search term
  const filteredExistingKeywords = existingKeywords.filter((kw) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      kw.keyword.toLowerCase().includes(searchLower) ||
      (kw.category && kw.category.toLowerCase().includes(searchLower))
    )
  })

  return (
    <>
      <Dialog open={open} onClose={handleClose} title="SEO Keywords Manager">
        <div className="space-y-6">
          {/* Info Box */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Tag className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800">
                <p className="font-medium">SEO Content Refinement</p>
                <p className="mt-1">
                  SEO agent will use these keywords to refine and optimize generated product titles and descriptions.
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('add')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'add'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Keywords</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'view'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>View Keywords ({existingKeywords.length})</span>
              </div>
            </button>
          </div>

          {/* Add Keywords Tab */}
          {activeTab === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Category (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Electronics, Fashion, Home & Garden"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Group keywords by category for better organization
                </p>
              </div>

              {/* Keywords List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {keywords.map((keyword, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        placeholder={`Keyword ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={uploading}
                      />
                      {keywords.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(index)}
                          disabled={uploading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Remove keyword"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddKeyword}
                  disabled={uploading}
                  className="mt-3 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Another Keyword</span>
                </button>
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload Keywords</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* View Keywords Tab */}
          {activeTab === 'view' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search keywords or categories..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Keywords List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : filteredExistingKeywords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No keywords found</p>
                  <p className="text-sm mt-1">
                    {searchTerm ? 'Try a different search term' : 'Add your first keyword to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredExistingKeywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{kw.keyword}</span>
                          {kw.category && (
                            <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                              {kw.category}
                            </span>
                          )}
                          {!kw.is_active && (
                            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {kw.priority !== null && (
                            <span>Priority: {kw.priority}</span>
                          )}
                          {kw.usage_count !== null && (
                            <span>Used: {kw.usage_count} times</span>
                          )}
                          <span>Added: {new Date(kw.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeyword(kw.id)}
                        disabled={deleting === kw.id}
                        className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete keyword"
                      >
                        {deleting === kw.id ? (
                          <LoadingSpinner size="sm" className="border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              {!loading && existingKeywords.length > 0 && (
                <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
                  Showing {filteredExistingKeywords.length} of {existingKeywords.length} keywords
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
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

