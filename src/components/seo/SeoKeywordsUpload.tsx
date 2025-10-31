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
import { Tag, Upload, X, Plus, Trash2, Search, FileUp } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ExistingKeyword {
  id: string
  keyword: string
  category: string | null
  priority: number | null
  usage_count: number | null
  is_active: boolean | null
  created_at: string
}

interface ImportKeyword {
  keyword: string
  category?: string | null
  priority?: number | null
  is_active?: boolean
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
  const [totalKeywordsCount, setTotalKeywordsCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'add' | 'view' | 'import'>('add')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  // Import-related state 
  const [importPreview, setImportPreview] = useState<ImportKeyword[]>([])
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Fetch existing keywords when dialog opens or search term changes
  useEffect(() => {
    if (open) {
      fetchExistingKeywords()
    }
  }, [open, searchTerm])

  const fetchExistingKeywords = async () => {
    setLoading(true)
    try {
      // Build query with search filter
      let query = supabase
        .from('seo_keywords')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100) // Fetch only 100 records for display

      // Apply search filter on server side
      if (searchTerm) {
        query = query.or(`keyword.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      setExistingKeywords(data || [])
      setTotalKeywordsCount(count || 0)
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

  const handleClearAllKeywords = async () => {
    setClearingAll(true)

    try {
      const { error } = await supabase
        .from('seo_keywords')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

      if (error) throw error

      setToast({ message: `Successfully deleted all ${totalKeywordsCount.toLocaleString()} keywords!`, type: 'success' })

      // Refresh the list
      await fetchExistingKeywords()

      // Close confirmation dialog
      setShowClearConfirm(false)
    } catch (error: any) {
      console.error('Error clearing all keywords:', error)
      setToast({ message: `Failed to clear keywords: ${error.message}`, type: 'error' })
    } finally {
      setClearingAll(false)
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
    if (!uploading && !loading && !importing) {
      setKeywords([''])
      setCategory('')
      setSearchTerm('')
      setActiveTab('add') 
      setImportPreview([])
      setParseError(null)
      onClose()
    }
  }

  // Parse CSV file
  const parseCSV = (text: string): ImportKeyword[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) throw new Error('File is empty')

    // Check if first line is header
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('keyword')
    const dataLines = hasHeader ? lines.slice(1) : lines

    const keywords: ImportKeyword[] = []

    for (const line of dataLines) {
      // Simple CSV parsing (handles basic cases)
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))

      if (values[0]) {
        const keyword: ImportKeyword = {
          keyword: values[0],
          category: values[1] || null,
          priority: values[2] ? parseInt(values[2]) : 1,
          is_active: values[3] ? values[3].toLowerCase() === 'true' : true
        }

        // Validate priority
        if (keyword.priority && (keyword.priority < 1 || keyword.priority > 5)) {
          keyword.priority = 1
        }

        keywords.push(keyword)
      }
    }

    return keywords
  }

  // Parse JSON file
  const parseJSON = (text: string): ImportKeyword[] => {
    const data = JSON.parse(text)

    if (!Array.isArray(data)) {
      throw new Error('JSON must be an array of keyword objects')
    }

    return data.map((item: any) => ({
      keyword: item.keyword || '',
      category: item.category || null,
      priority: item.priority ? Math.min(Math.max(parseInt(item.priority), 1), 5) : 1,
      is_active: item.is_active !== undefined ? Boolean(item.is_active) : true
    })).filter((kw: ImportKeyword) => kw.keyword.trim() !== '')
  }

  // Parse Excel file
  const parseExcel = (arrayBuffer: ArrayBuffer): ImportKeyword[] => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (data.length === 0) {
      throw new Error('Excel file is empty')
    }

    const keywords: ImportKeyword[] = []

    // Check if first row looks like a header
    const firstRow = data[0]
    const hasHeader = firstRow.some((cell: any) =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('keyword') ||
       cell.toLowerCase().includes('product') ||
       cell.toLowerCase().includes('kw'))
    )

    const startRow = hasHeader ? 1 : 0

    // Process each row
    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Extract product title (column A) for category
      const productTitle = row[0] ? String(row[0]).trim() : null

      // Extract keywords from columns B-F (Main Keyword, KW1, KW2, KW3, KW4)
      const keywordColumns = [1, 2, 3, 4, 5] // Column indices for B, C, D, E, F

      for (const colIndex of keywordColumns) {
        const keywordValue = row[colIndex]
        if (keywordValue && String(keywordValue).trim()) {
          const keywordText = String(keywordValue).trim()

          // Skip if it's a header value
          if (keywordText.toLowerCase().includes('keyword') ||
              keywordText.toLowerCase() === 'kw1' ||
              keywordText.toLowerCase() === 'kw2' ||
              keywordText.toLowerCase() === 'kw3' ||
              keywordText.toLowerCase() === 'kw4') {
            continue
          }

          keywords.push({
            keyword: keywordText,
            category: productTitle || null,
            priority: 1,
            is_active: true
          })
        }
      }
    }

    // Remove duplicates
    const uniqueKeywords = keywords.reduce((acc, curr) => {
      const exists = acc.some(kw =>
        kw.keyword.toLowerCase() === curr.keyword.toLowerCase() &&
        kw.category === curr.category
      )
      if (!exists) {
        acc.push(curr)
      }
      return acc
    }, [] as ImportKeyword[])

    return uniqueKeywords
  }

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
 
    setParseError(null)
    setImportPreview([])

    try {
      let parsedKeywords: ImportKeyword[] = []

      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        parsedKeywords = parseCSV(text)
      } else if (file.name.endsWith('.json')) {
        const text = await file.text()
        parsedKeywords = parseJSON(text)
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer()
        parsedKeywords = parseExcel(arrayBuffer)
      } else {
        throw new Error('Unsupported file format. Please use .csv, .json, .xlsx, or .xls')
      }

      if (parsedKeywords.length === 0) {
        throw new Error('No valid keywords found in file')
      }

      setImportPreview(parsedKeywords)
      setToast({
        message: `Successfully parsed ${parsedKeywords.length} keyword(s)`,
        type: 'success'
      })
    } catch (error: any) {
      setParseError(error.message) 
      setToast({ message: `Failed to parse file: ${error.message}`, type: 'error' })
    }
  }

  // Handle import
  const handleImport = async () => {
    if (importPreview.length === 0) {
      setToast({ message: 'No keywords to import', type: 'error' })
      return
    }

    setImporting(true)

    try {
      const keywordRecords = importPreview.map(kw => ({
        keyword: kw.keyword.trim(),
        category: kw.category?.trim() || null,
        is_active: kw.is_active !== undefined ? kw.is_active : true,
        priority: kw.priority || 1,
        usage_count: 0,
      }))

      // Step 1: Clear all existing keywords
      console.log('Clearing all existing keywords...')
      const { error: deleteError } = await supabase
        .from('seo_keywords')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records

      if (deleteError) {
        throw new Error(`Failed to clear existing keywords: ${deleteError.message}`)
      }

      console.log('Existing keywords cleared successfully')

      // Step 2: Insert all new keywords
      console.log(`Inserting ${keywordRecords.length} new keywords...`)
      const { error: insertError } = await supabase
        .from('seo_keywords')
        .insert(keywordRecords)

      if (insertError) {
        throw new Error(`Failed to insert keywords: ${insertError.message}`)
      }

      console.log('New keywords inserted successfully')

      setToast({
        message: `Successfully imported ${keywordRecords.length} keyword(s)!`,
        type: 'success'
      })

      // Reset import state 
      setImportPreview([])
      setParseError(null)

      // Refresh existing keywords list
      await fetchExistingKeywords()

      // Switch to view tab to show the new keywords
      setActiveTab('view')

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Error importing keywords:', error)
      setToast({ message: `Failed to import: ${error.message}`, type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  // No need for client-side filtering since we're using server-side search

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
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'import'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                <span>Import</span>
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
                <span>View Keywords ({totalKeywordsCount.toLocaleString()})</span>
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

          {/* Import Keywords Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* File Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={importing}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: Excel (.xlsx, .xls), CSV, JSON
                </p>

                {/* Parse Error */}
                {parseError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{parseError}</p>
                  </div>
                )}
              </div>

              {/* File Format Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 text-sm mb-2">File Format</h4>
                <div className="space-y-3 text-xs text-gray-600">
                  <div>
                    <p className="font-medium text-gray-700">Excel Format (.xlsx, .xls):</p>
                    <div className="mt-1 p-2 bg-white rounded border border-gray-200 overflow-x-auto">
                      <table className="text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-2 py-1">Product title</th>
                            <th className="border border-gray-300 px-2 py-1">Main Keyword</th>
                            <th className="border border-gray-300 px-2 py-1">KW1</th>
                            <th className="border border-gray-300 px-2 py-1">KW2</th>
                            <th className="border border-gray-300 px-2 py-1">KW3</th>
                            <th className="border border-gray-300 px-2 py-1">KW4</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-2 py-1">Product 1</td>
                            <td className="border border-gray-300 px-2 py-1">keyword 1</td>
                            <td className="border border-gray-300 px-2 py-1">keyword 2</td>
                            <td className="border border-gray-300 px-2 py-1">keyword 3</td>
                            <td className="border border-gray-300 px-2 py-1">keyword 4</td>
                            <td className="border border-gray-300 px-2 py-1">keyword 5</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-gray-600 mt-2">
                        • Product title (Column A) becomes the category<br/>
                        • Keywords are extracted from columns B-F<br/>
                        • Duplicate keywords are automatically removed
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">CSV Format:</p>
                    <pre className="mt-1 p-2 bg-white rounded border border-gray-200 overflow-x-auto">
keyword,category,priority,is_active
example keyword,Electronics,1,true
another keyword,Fashion,2,true
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">JSON Format:</p>
                    <pre className="mt-1 p-2 bg-white rounded border border-gray-200 overflow-x-auto">
{JSON.stringify([
  { keyword: 'example keyword', category: 'Electronics', priority: 1, is_active: true }
], null, 2)}
                    </pre>
                  </div>
                  <div className="pt-2 border-t border-gray-300">
                    <p className="font-medium text-gray-700 mb-1">Field Descriptions:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><span className="font-medium">keyword</span>: The SEO keyword (required)</li>
                      <li><span className="font-medium">category</span>: Product category (optional)</li>
                      <li><span className="font-medium">priority</span>: Priority level 1-5 (optional, defaults to 1)</li>
                      <li><span className="font-medium">is_active</span>: Whether keyword is active (optional, defaults to true)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              {importPreview.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 text-sm mb-3">
                    Preview ({importPreview.length} keywords)
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {importPreview.slice(0, 50).map((kw, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{kw.keyword}</span>
                            {kw.category && (
                              <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                                {kw.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>Priority: {kw.priority || 1}</span>
                            <span>Active: {kw.is_active ? 'Yes' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {importPreview.length > 50 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        ... and {importPreview.length - 50} more keywords
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={importing}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || importPreview.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Import {importPreview.length > 0 ? `${importPreview.length} Keywords` : 'Keywords'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* View Keywords Tab */}
          {activeTab === 'view' && (
            <div className="space-y-4">
              {/* Search Bar and Actions */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search keywords or categories..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                {totalKeywordsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={clearingAll}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {/* Keywords List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : existingKeywords.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Tag className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="font-medium">No keywords found</p>
                  <p className="text-sm mt-1">
                    {searchTerm ? 'Try a different search term' : 'Add your first keyword to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {existingKeywords.map((kw) => (
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
              {!loading && totalKeywordsCount > 0 && (
                <div className="text-sm text-gray-600 text-center pt-4 border-t border-gray-200">
                  Showing {existingKeywords.length} of {totalKeywordsCount.toLocaleString()} keywords
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

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear All Keywords?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete all <span className="font-semibold">{totalKeywordsCount.toLocaleString()}</span> keywords? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearingAll}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllKeywords}
                    disabled={clearingAll}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {clearingAll ? (
                      <>
                        <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>Delete All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

