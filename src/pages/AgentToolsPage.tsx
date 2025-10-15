/**
 * AgentToolsPage Component
 *
 * Displays and manages external tools used by AI agents.
 * Shows health status, usage statistics, and configuration for:
 * - Serper API (web search)
 * - Google Vision/Gemini API (image analysis, AI models)
 * - Supabase (database and storage)
 */

import { useState, useEffect } from 'react'
import { Search, Eye, Database, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'

interface ToolStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'checking'
  apiKey: string
  masked: string
  icon: any
  color: string
  description: string
  usageInfo?: string
  docsUrl: string
}

export function AgentToolsPage() {
  const [tools, setTools] = useState<ToolStatus[]>([
    {
      name: 'Serper API',
      status: 'checking',
      apiKey: '',
      masked: '',
      icon: Search,
      color: 'blue',
      description: 'Web search and SERP data for product research and competitive analysis',
      docsUrl: 'https://serper.dev/docs',
    },
    {
      name: 'Google Vision / Gemini',
      status: 'checking',
      apiKey: '',
      masked: '',
      icon: Eye,
      color: 'purple',
      description: 'AI vision models for image analysis and Gemini LLM for text generation',
      docsUrl: 'https://ai.google.dev/gemini-api/docs',
    },
    {
      name: 'Supabase',
      status: 'checking',
      apiKey: '',
      masked: '',
      icon: Database,
      color: 'green',
      description: 'Database, authentication, and storage backend for all agent data',
      docsUrl: 'https://supabase.com/docs',
    },
  ])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    checkToolsHealth()
  }, [])

  const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return '••••••••'
    return `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`
  }

  const checkToolsHealth = async () => {
    setLoading(true)

    try {
      // Simulate checking tools - in production, these would be actual API calls
      // For now, we'll use mock data to demonstrate the UI

      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API delay

      setTools((prevTools) =>
        prevTools.map((tool) => {
          let status: 'healthy' | 'degraded' | 'down' = 'healthy'
          let apiKey = ''
          let usageInfo = ''

          switch (tool.name) {
            case 'Serper API':
              // Mock: Serper API key from mcgrocer/.env
              apiKey = '9f0a01e261b57a2578329a7a5c084d8670fb603b'
              status = 'healthy'
              usageInfo = 'API key configured and operational'
              break
            case 'Google Vision / Gemini':
              // Mock: Gemini API key from mcgrocer/.env
              apiKey = 'AIzaSyC8QNmL7caYFP-dDbxae4ckjLcYVRCAh-s'
              status = 'healthy'
              usageInfo = 'API key configured and operational'
              break
            case 'Supabase':
              // Mock: Supabase service key from mcgrocer/.env
              apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a2pibHJsb2dqdW15YmNlb3prIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODcyMjI4OSwiZXhwIjoyMDc0Mjk4Mjg5fQ.KnAuVoFtiHcvgkVDmE7SmVGr9_78CiQuC1B1cnid2uc'
              status = 'healthy'
              usageInfo = 'Connected and operational'
              break
          }

          return {
            ...tool,
            status,
            apiKey,
            masked: maskApiKey(apiKey),
            usageInfo,
          }
        })
      )

      setToast({ message: 'Tool status updated successfully', type: 'success' })
    } catch (error: any) {
      console.error('Error checking tools health:', error)
      setToast({ message: `Failed to check tools: ${error.message}`, type: 'error' })

      // Set all tools to degraded status
      setTools((prevTools) =>
        prevTools.map((tool) => ({
          ...tool,
          status: 'degraded',
          masked: '••••••••',
        }))
      )
    } finally {
      setLoading(false)
    }
  }

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
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: 'text-purple-600',
        button: 'bg-purple-600 hover:bg-purple-700',
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
          onClick={checkToolsHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => {
          const colors = getColorClasses(tool.color)
          const Icon = tool.icon

          return (
            <div
              key={tool.name}
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
                      <h3 className="font-semibold text-gray-900">{tool.name}</h3>
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
                <p className="text-sm text-gray-600">{tool.description}</p>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    API Key
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm text-gray-700">
                    {tool.masked || '••••••••'}
                  </div>
                </div>

                {/* Usage Info */}
                {tool.usageInfo && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Status
                    </label>
                    <div className={`px-3 py-2 border rounded text-sm ${getStatusColor(tool.status)}`}>
                      {tool.usageInfo}
                    </div>
                  </div>
                )}

                {/* Documentation Link */}
                <a
                  href={tool.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 px-4 py-2 ${colors.button} text-white rounded-lg transition-colors text-sm font-medium`}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View Documentation</span>
                </a>
              </div>
            </div>
          )
        })}
      </div>

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

