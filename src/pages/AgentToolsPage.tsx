/**
 * AgentToolsPage Component
 *
 * Displays and manages external tools used by AI agents.
 * Shows health status, usage statistics, and configuration for:
 * - Serper API (web search)
 * - OpenAI Vision API (image analysis)
 * - Category Agent (Gemini AI)
 * - Weight & Dimension Agent (Gemini AI)
 * - SEO Agent (Gemini AI)
 * - Supabase (database and storage)
 *
 * Status is stored in database and automatically loaded.
 * Users can force a health check by clicking "Check All Tools".
 */

import { useState, useEffect } from 'react'
import { Search, Database, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, Sparkles, Weight, ScanSearch, Brain, Globe } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'
import { apiHealthService, type AgentToolStatus } from '@/services'

// Map key types to their UI configuration
const toolConfigs: Record<string, { icon: any; color: string; description: string; docsUrl: string }> = {
  'serper-key': {
    icon: Search,
    color: 'blue',
    description: 'Web search and SERP data for product research and competitive analysis',
    docsUrl: 'https://serper.dev/docs',
  },
  'openai-vision': {
    icon: Brain,
    color: 'teal',
    description: 'OpenAI GPT-4 Vision for advanced image understanding and analysis',
    docsUrl: 'https://platform.openai.com/docs/guides/vision',
  },
  'category-key': {
    icon: Sparkles,
    color: 'indigo',
    description: 'Gemini AI for product categorization and taxonomy mapping',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  'weight-and-dimension-key': {
    icon: Weight,
    color: 'emerald',
    description: 'Gemini AI for extracting product weight and dimension specifications',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  'seo-agent-key': {
    icon: ScanSearch,
    color: 'violet',
    description: 'Gemini AI for generating optimized product titles and descriptions',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  'supabase-key': {
    icon: Database,
    color: 'green',
    description: 'Database, authentication, and storage backend for all agent data',
    docsUrl: 'https://supabase.com/docs',
  },
  'decodo-key': {
    icon: Globe,
    color: 'blue',
    description: 'Decodo API for Google Suggest keyword research and competitive intelligence',
    docsUrl: 'https://decodo.com',
  },
}

export function AgentToolsPage() {
  const [tools, setTools] = useState<AgentToolStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Load tools status from database
  const loadToolsStatus = async () => {
    try {
      console.log('Loading tools status from database...')
      const toolsData = await apiHealthService.getAllToolsStatus()
      console.log('Tools data received:', toolsData)
      setTools(toolsData)
    } catch (error: any) {
      console.error('Error loading tools status:', error)
      setToast({ message: `Failed to load tools status: ${error.message}`, type: 'error' })
    } finally {
      setInitialLoad(false)
    }
  }

  // Force check all tools (calls Edge Function which updates database)
  const checkAllTools = async () => {
    setLoading(true)

    try {
      setToast({ message: 'Checking all tools...', type: 'info' })

      console.log('Calling checkAllKeys...')
      // Call Edge Function to check all keys (this updates the database)
      const results = await apiHealthService.checkAllKeys()
      console.log('Check results:', results)

      // Wait a moment for database to be fully updated
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Reload from database to get updated statuses
      console.log('Reloading tools status...')
      await loadToolsStatus()

      setToast({ message: 'All tools checked successfully', type: 'success' })
    } catch (error: any) {
      console.error('Error checking tools:', error)
      setToast({ message: `Failed to check tools: ${error.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Check a single tool
  const checkSingleTool = async (keyType: string) => {
    try {
      // Optimistically set to checking
      setTools((prevTools) =>
        prevTools.map((tool) =>
          tool.key_type === keyType
            ? { ...tool, status: 'checking' as const }
            : tool
        )
      )

      setToast({ message: `Checking ${keyType}...`, type: 'info' })

      // Call Edge Function to check this key (this updates the database)
      await apiHealthService.checkKeyHealth(keyType as any)

      // Reload from database to get updated status
      await loadToolsStatus()

      setToast({ message: `${keyType} check completed`, type: 'success' })
    } catch (error: any) {
      console.error(`Error checking ${keyType}:`, error)
      setToast({ message: `Failed to check ${keyType}: ${error.message}`, type: 'error' })
      // Reload to reset to actual status
      await loadToolsStatus()
    }
  }

  // Load tools on mount
  useEffect(() => {
    loadToolsStatus()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'down':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'checking':
        return <LoadingSpinner size="sm" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Operational'
      case 'degraded':
        return 'Degraded'
      case 'down':
        return 'Down'
      case 'checking':
        return 'Checking...'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; icon: string; button: string }> = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        button: 'bg-blue-600 hover:bg-blue-700',
      },
      teal: {
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        icon: 'text-teal-600',
        button: 'bg-teal-600 hover:bg-teal-700',
      },
      indigo: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        icon: 'text-indigo-600',
        button: 'bg-indigo-600 hover:bg-indigo-700',
      },
      emerald: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600',
        button: 'bg-emerald-600 hover:bg-emerald-700',
      },
      violet: {
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        icon: 'text-violet-600',
        button: 'bg-violet-600 hover:bg-violet-700',
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        button: 'bg-green-600 hover:bg-green-700',
      },
    }
    return colors[color] || colors.blue
  }

  const formatResponseTime = (ms?: number | null) => {
    if (!ms || ms === 0) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatLastChecked = (timestamp?: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  if (initialLoad) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-9 w-48 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-5 w-96 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Tools Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              {/* Card Header Skeleton */}
              <div className="bg-gray-100 border-b border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
                    <div>
                      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body Skeleton */}
              <div className="p-4 space-y-4">
                {/* Description */}
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
                </div>

                {/* Status */}
                <div>
                  <div className="h-3 w-12 bg-gray-200 rounded animate-pulse mb-1" />
                  <div className="h-9 bg-gray-200 rounded animate-pulse" />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="h-9 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div>
                    <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="h-9 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
                  <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Tools</h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage external tools used by AI agents
          </p>
        </div>
        <button
          onClick={checkAllTools}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Check All Tools</span>
        </button>
      </div>

      {/* Tools Grid */}
      {tools.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tools found</h3>
          <p className="text-gray-600 mb-4">
            No agent tools are configured in the database.
          </p>
          <button
            onClick={checkAllTools}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Check All Tools</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const config = toolConfigs[tool.key_type]
            if (!config) return null

            const colors = getColorClasses(config.color)
            const Icon = config.icon

            return (
            <div
              key={tool.key_type}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className={`${colors.bg} border-b ${colors.border} p-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-white rounded-lg border ${colors.border}`}>
                      <Icon className={`h-6 w-6 ${colors.icon}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{tool.key_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(tool.status)}
                        <span className="text-sm font-medium">
                          {getStatusText(tool.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Description */}
                <p className="text-sm text-gray-600">{config.description}</p>

                {/* Status Message */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Status
                  </label>
                  <div className={`px-3 py-2 border rounded text-sm ${getStatusColor(tool.status)}`}>
                    {tool.message || 'Waiting to check...'}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Response Time
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-700">
                      {formatResponseTime(tool.response_time)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Last Checked
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
                      {formatLastChecked(tool.last_checked)}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {tool.error_message && (
                  <div>
                    <label className="block text-xs font-medium text-red-600 mb-1">
                      Error Details
                    </label>
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-mono break-all">
                      {tool.error_message}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => checkSingleTool(tool.key_type)}
                    disabled={tool.status === 'checking'}
                    className={`flex items-center justify-center gap-2 px-3 py-2 ${colors.button} text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50`}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${tool.status === 'checking' ? 'animate-spin' : ''}`} />
                    <span>Test</span>
                  </button>
                  <a
                    href={config.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Docs</span>
                  </a>
                </div>
              </div>
            </div>
          )
        })}
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
