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
  product_title: string
  main_keyword: string | null
  kw1: string | null
  kw2: string | null
  kw3: string | null
  kw4: string | null
  created_at: string
  updated_at: string
}

interface ImportKeyword {
  product_title: string
  main_keyword?: string | null
  kw1?: string | null
  kw2?: string | null
  kw3?: string | null
  kw4?: string | null
}

interface SeoKeywordsUploadProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function SeoKeywordsUpload({ open, onClose, onSuccess }: SeoKeywordsUploadProps) {
  const [productTitle, setProductTitle] = useState('')
  const [mainKeyword, setMainKeyword] = useState('')
  const [kw1, setKw1] = useState('')
  const [kw2, setKw2] = useState('')
  const [kw3, setKw3] = useState('')
  const [kw4, setKw4] = useState('')
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
        query = query.or(`product_title.ilike.%${searchTerm}%,main_keyword.ilike.%${searchTerm}%,kw1.ilike.%${searchTerm}%,kw2.ilike.%${searchTerm}%,kw3.ilike.%${searchTerm}%,kw4.ilike.%${searchTerm}%`)
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

    // Validate required fields
    if (!productTitle.trim()) {
      setToast({ message: 'Please enter a product title', type: 'error' })
      return
    }

    // At least one keyword should be provided
    if (!mainKeyword.trim() && !kw1.trim() && !kw2.trim() && !kw3.trim() && !kw4.trim()) {
      setToast({ message: 'Please add at least one keyword', type: 'error' })
      return
    }

    setUploading(true)

    try {
      // Insert keyword record into seo_keywords table
      const keywordRecord = {
        product_title: productTitle.trim(),
        main_keyword: mainKeyword.trim() || null,
        kw1: kw1.trim() || null,
        kw2: kw2.trim() || null,
        kw3: kw3.trim() || null,
        kw4: kw4.trim() || null,
      }

      const { error } = await supabase.from('seo_keywords').insert([keywordRecord])

      if (error) throw error

      setToast({
        message: 'Successfully added product keywords!',
        type: 'success'
      })

      // Reset form
      setProductTitle('')
      setMainKeyword('')
      setKw1('')
      setKw2('')
      setKw3('')
      setKw4('')

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
      setProductTitle('')
      setMainKeyword('')
      setKw1('')
      setKw2('')
      setKw3('')
      setKw4('')
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
    const hasHeader = firstLine.includes('product') || firstLine.includes('keyword')
    const dataLines = hasHeader ? lines.slice(1) : lines

    const keywords: ImportKeyword[] = []

    for (const line of dataLines) {
      // Simple CSV parsing (handles basic cases)
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))

      if (values[0]) {
        const keyword: ImportKeyword = {
          product_title: values[0],
          main_keyword: values[1] || null,
          kw1: values[2] || null,
          kw2: values[3] || null,
          kw3: values[4] || null,
          kw4: values[5] || null,
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
      throw new Error('JSON must be an array of product keyword objects')
    }

    return data.map((item: any) => ({
      product_title: item.product_title || item.productTitle || '',
      main_keyword: item.main_keyword || item.mainKeyword || null,
      kw1: item.kw1 || null,
      kw2: item.kw2 || null,
      kw3: item.kw3 || null,
      kw4: item.kw4 || null,
    })).filter((kw: ImportKeyword) => kw.product_title.trim() !== '')
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

    // Process each row - each row is one product with multiple keywords
    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue

      // Extract product title (column A)
      const productTitle = row[0] ? String(row[0]).trim() : ''

      // Skip if no product title
      if (!productTitle) continue

      // Skip if it's a header row
      if (productTitle.toLowerCase().includes('product') ||
          productTitle.toLowerCase().includes('title')) {
        continue
      }

      // Extract keywords from columns B-F (Main Keyword, KW1, KW2, KW3, KW4)
      const mainKeyword = row[1] ? String(row[1]).trim() : null
      const kw1 = row[2] ? String(row[2]).trim() : null
      const kw2 = row[3] ? String(row[3]).trim() : null
      const kw3 = row[4] ? String(row[4]).trim() : null
      const kw4 = row[5] ? String(row[5]).trim() : null

      // Create one record per product
      keywords.push({
        product_title: productTitle,
        main_keyword: mainKeyword || null,
        kw1: kw1 || null,
        kw2: kw2 || null,
        kw3: kw3 || null,
        kw4: kw4 || null,
      })
    }

    return keywords
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
        product_title: kw.product_title.trim(),
        main_keyword: kw.main_keyword?.trim() || null,
        kw1: kw.kw1?.trim() || null,
        kw2: kw.kw2?.trim() || null,
        kw3: kw.kw3?.trim() || null,
        kw4: kw.kw4?.trim() || null,
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
        message: `Successfully imported ${keywordRecords.length} product(s) with keywords!`,
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
                <span>View Products ({totalKeywordsCount.toLocaleString()})</span>
              </div>
            </button>
          </div>

          {/* Add Keywords Tab */}
          {activeTab === 'add' && (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Product Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="e.g., Organic Baby Formula"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The product title for keyword grouping
                </p>
              </div>

              {/* Keywords */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Keywords
                </label>

                {/* Main Keyword */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Main Keyword
                  </label>
                  <input
                    type="text"
                    value={mainKeyword}
                    onChange={(e) => setMainKeyword(e.target.value)}
                    placeholder="Primary keyword"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={uploading}
                  />
                </div>

                {/* KW1 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Keyword 1
                  </label>
                  <input
                    type="text"
                    value={kw1}
                    onChange={(e) => setKw1(e.target.value)}
                    placeholder="Additional keyword 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={uploading}
                  />
                </div>

                {/* KW2 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Keyword 2
                  </label>
                  <input
                    type="text"
                    value={kw2}
                    onChange={(e) => setKw2(e.target.value)}
                    placeholder="Additional keyword 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={uploading}
                  />
                </div>

                {/* KW3 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Keyword 3
                  </label>
                  <input
                    type="text"
                    value={kw3}
                    onChange={(e) => setKw3(e.target.value)}
                    placeholder="Additional keyword 3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={uploading}
                  />
                </div>

                {/* KW4 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Keyword 4
                  </label>
                  <input
                    type="text"
                    value={kw4}
                    onChange={(e) => setKw4(e.target.value)}
                    placeholder="Additional keyword 4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={uploading}
                  />
                </div>

                <p className="text-xs text-gray-500">
                  At least one keyword is required
                </p>
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
                            <td className="border border-gray-300 px-2 py-1">Organic Baby Formula</td>
                            <td className="border border-gray-300 px-2 py-1">organic formula</td>
                            <td className="border border-gray-300 px-2 py-1">baby formula</td>
                            <td className="border border-gray-300 px-2 py-1">infant formula</td>
                            <td className="border border-gray-300 px-2 py-1">organic baby food</td>
                            <td className="border border-gray-300 px-2 py-1">ready to feed formula</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-gray-600 mt-2">
                        • Each row represents one product with its keywords<br/>
                        • Column A: Product title (required)<br/>
                        • Columns B-F: Main Keyword, KW1, KW2, KW3, KW4
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">CSV Format:</p>
                    <pre className="mt-1 p-2 bg-white rounded border border-gray-200 overflow-x-auto">
product_title,main_keyword,kw1,kw2,kw3,kw4
Organic Baby Formula,organic formula,baby formula,infant formula,organic baby food,ready to feed
Natural Toddler Milk,toddler milk,organic toddler,natural milk,baby milk,
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">JSON Format:</p>
                    <pre className="mt-1 p-2 bg-white rounded border border-gray-200 overflow-x-auto">
{JSON.stringify([
  {
    product_title: 'Organic Baby Formula',
    main_keyword: 'organic formula',
    kw1: 'baby formula',
    kw2: 'infant formula',
    kw3: 'organic baby food',
    kw4: 'ready to feed'
  }
], null, 2)}
                    </pre>
                  </div>
                  <div className="pt-2 border-t border-gray-300">
                    <p className="font-medium text-gray-700 mb-1">Field Descriptions:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><span className="font-medium">product_title</span>: The product title (required)</li>
                      <li><span className="font-medium">main_keyword</span>: Primary SEO keyword (optional)</li>
                      <li><span className="font-medium">kw1</span>: Additional keyword 1 (optional)</li>
                      <li><span className="font-medium">kw2</span>: Additional keyword 2 (optional)</li>
                      <li><span className="font-medium">kw3</span>: Additional keyword 3 (optional)</li>
                      <li><span className="font-medium">kw4</span>: Additional keyword 4 (optional)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              {importPreview.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 text-sm mb-3">
                    Preview ({importPreview.length} products)
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    {importPreview.slice(0, 50).map((kw, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white border border-gray-200 rounded text-sm"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900">{kw.product_title}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          {kw.main_keyword && (
                            <div>
                              <span className="font-medium">Main:</span> {kw.main_keyword}
                            </div>
                          )}
                          {kw.kw1 && (
                            <div>
                              <span className="font-medium">KW1:</span> {kw.kw1}
                            </div>
                          )}
                          {kw.kw2 && (
                            <div>
                              <span className="font-medium">KW2:</span> {kw.kw2}
                            </div>
                          )}
                          {kw.kw3 && (
                            <div>
                              <span className="font-medium">KW3:</span> {kw.kw3}
                            </div>
                          )}
                          {kw.kw4 && (
                            <div>
                              <span className="font-medium">KW4:</span> {kw.kw4}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {importPreview.length > 50 && (
                      <p className="text-xs text-gray-500 text-center pt-2">
                        ... and {importPreview.length - 50} more products
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
                      <span>Import {importPreview.length > 0 ? `${importPreview.length} Products` : 'Products'}</span>
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
                    {searchTerm ? 'Try a different search term' : 'Add your first product keywords to get started'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {existingKeywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-gray-900">{kw.product_title}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          {kw.main_keyword && (
                            <div>
                              <span className="font-medium">Main:</span> {kw.main_keyword}
                            </div>
                          )}
                          {kw.kw1 && (
                            <div>
                              <span className="font-medium">KW1:</span> {kw.kw1}
                            </div>
                          )}
                          {kw.kw2 && (
                            <div>
                              <span className="font-medium">KW2:</span> {kw.kw2}
                            </div>
                          )}
                          {kw.kw3 && (
                            <div>
                              <span className="font-medium">KW3:</span> {kw.kw3}
                            </div>
                          )}
                          {kw.kw4 && (
                            <div>
                              <span className="font-medium">KW4:</span> {kw.kw4}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          <span>Added: {new Date(kw.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteKeyword(kw.id)}
                        disabled={deleting === kw.id}
                        className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete product keywords"
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
                  Showing {existingKeywords.length} of {totalKeywordsCount.toLocaleString()} products
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear All Products?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete all <span className="font-semibold">{totalKeywordsCount.toLocaleString()}</span> products? This action cannot be undone.
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

