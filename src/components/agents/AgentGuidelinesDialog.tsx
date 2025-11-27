/**
 * AgentGuidelinesDialog Component
 *
 * Allows users to send guidelines/instructions to agents.
 * Agent type is automatically set based on where the component is used.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Toast } from '@/components/ui/Toast'
import { MessageSquare, Send, Info, Edit } from 'lucide-react'
import type { AgentType } from '@/services/agents.service'

interface AgentGuidelinesDialogProps {
  open: boolean
  onClose: () => void
  agentType: AgentType
  onSuccess?: () => void
}

const agentNames: Record<AgentType, string> = {
  category: 'Category Mapper',
  weight_dimension: 'Weight & Dimension',
  seo: 'SEO Optimizer',
  scraper: 'Scraper',
  copyright: 'Copyright Agent',
  classification: 'Classification Agent',
}

const agentColors: Record<AgentType, string> = {
  category: 'blue',
  weight_dimension: 'purple',
  seo: 'indigo',
  scraper: 'green',
  copyright: 'orange',
  classification: 'emerald',
}

export function AgentGuidelinesDialog({
  open,
  onClose,
  agentType,
  onSuccess
}: AgentGuidelinesDialogProps) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const agentName = agentNames[agentType]
  const agentColor = agentColors[agentType]

  // Fetch existing guideline when dialog opens
  useEffect(() => {
    if (open) {
      fetchExistingGuideline()
    }
  }, [open, agentType])

  const fetchExistingGuideline = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agent_resource')
        .select('*')
        .eq('agent_type', agentType)
        .eq('resource_type', 'guideline')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned

      if (data) {
        setExistingId(data.id)
        setTitle(data.title || '')
        setMessage(data.content || '')
        setIsEditing(true)
      } else {
        setExistingId(null)
        setTitle('')
        setMessage('')
        setIsEditing(false)
      }
    } catch (error: any) {
      console.error('Error fetching existing guideline:', error)
      // Don't show error toast for missing guidelines
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setToast({ message: 'Please enter a title', type: 'error' })
      return
    }

    if (!message.trim()) {
      setToast({ message: 'Please enter a guideline message', type: 'error' })
      return
    }

    setSending(true)

    try {
      if (isEditing && existingId) {
        // Update existing guideline
        const { error } = await supabase
          .from('agent_resource')
          .update({
            title: title.trim(),
            content: message.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)

        if (error) throw error

        setToast({
          message: `Guideline updated for ${agentName} successfully!`,
          type: 'success'
        })
      } else {
        // Insert new guideline into agent_resource table
        const { error } = await supabase.from('agent_resource').insert({
          agent_type: agentType,
          resource_type: 'guideline',
          title: title.trim(),
          content: message.trim(),
          is_active: true,
          version: 1,
        })

        if (error) throw error

        setToast({
          message: `Guideline sent to ${agentName} successfully!`,
          type: 'success'
        })
      }

      // Reset form
      setTitle('')
      setMessage('')
      setExistingId(null)
      setIsEditing(false)

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }

      // Close dialog after short delay
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      console.error('Error sending guideline:', error)
      setToast({ message: `Failed to send guideline: ${error.message}`, type: 'error' })
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    if (!sending && !loading) {
      setTitle('')
      setMessage('')
      setExistingId(null)
      setIsEditing(false)
      onClose()
    }
  }

  const getColorClasses = (color: string) => ({
    bg: `bg-${color}-50`,
    border: `border-${color}-200`,
    text: `text-${color}-800`,
    icon: `text-${color}-600`,
    button: `bg-${color}-600 hover:bg-${color}-700`,
  })

  const colors = getColorClasses(agentColor)

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        title={isEditing ? `Edit Guidelines for ${agentName}` : `Send Guidelines to ${agentName}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
              <div className="flex items-start gap-2">
                {isEditing ? (
                  <Edit className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
                ) : (
                  <Info className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
                )}
                <div className={`text-sm ${colors.text}`}>
                  <p className="font-medium">
                    {isEditing ? 'Edit Existing Guideline' : 'Agent Guidelines'}
                  </p>
                  <p className="mt-1">
                    {isEditing
                      ? `Update the existing guideline for ${agentName} agent.`
                      : `Provide instructions or guidelines that the ${agentName} agent should follow when processing products.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Agent Type Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Agent
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className={`h-5 w-5 ${colors.icon}`} />
                  <span className="font-medium text-gray-900">{agentName}</span>
                  <span className="text-xs text-gray-500 ml-auto">({agentType})</span>
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Product Naming Guidelines, Quality Standards"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={sending}
                required
              />
            </div>

            {/* Guideline Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guideline Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Enter guidelines for ${agentName}...\n\nExamples:\n- Always prioritize accuracy over speed\n- Use specific terminology for technical products\n- Follow brand naming conventions\n- Consider regional variations`}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={sending}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific and clear. The agent will use these guidelines during processing.
              </p>
            </div>

            {/* Character Count */}
            <div className="text-xs text-gray-500 text-right">
              {message.length} characters
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={sending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className={`px-4 py-2 ${colors.button} text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2`}
              >
                {sending ? (
                  <>
                    <LoadingSpinner size="sm" className="border-white border-t-transparent" />
                    <span>{isEditing ? 'Updating...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    {isEditing ? <Edit className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    <span>{isEditing ? 'Update Guideline' : 'Send Guideline'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
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

