/**
 * RawDataTab Component
 *
 * Displays raw JSON data from product scraping.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface RawDataTabProps {
  data: any
}

export function RawDataTab({ data }: RawDataTabProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Scraped Data (JSON)
        </h3>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm
            text-gray-600 bg-gray-100 border border-gray-300 rounded-md
            hover:bg-gray-200 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy JSON
            </>
          )}
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-w-full">
        <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap break-words min-w-0">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
