/**
 * SeoAgentPage Component
 *
 * SEO optimization agent monitoring - uses reusable AgentMonitoringPage component.
 * Includes SEO keywords upload for content refinement.
 */

import { useState } from 'react'
import { AgentMonitoringPage, type AgentConfig } from '@/components/pages/AgentMonitoringPage'
import { SeoKeywordsUpload } from '@/components/seo/SeoKeywordsUpload'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { Sparkles, Tag, MessageSquare } from 'lucide-react'

// Configuration for SEO Agent
const seoAgentConfig: AgentConfig = {
  // Header
  title: 'SEO Optimization Agent',
  subtitle: 'AI-powered SEO content generation and optimization',
  icon: Sparkles,
  iconBgColor: 'bg-indigo-100',
  iconColor: 'text-indigo-600',
  primaryColor: 'indigo',

  // About section
  aboutTitle: 'About SEO Optimizer',
  aboutDescription: 'The SEO Optimizer agent uses AI to enhance product titles and descriptions for better search engine visibility. It analyzes keywords, competitive data, and SEO best practices to generate optimized content.',
  keyFeatures: [
    'AI-powered title and description generation',
    'Keyword research and optimization',
    'Plagiarism detection and content uniqueness',
    'SEO score calculation and recommendations',
    'Meta tag optimization',
    'Custom keyword integration',
  ],

  // Filters
  filterColumns: [
    { label: 'SEO Title', value: 'seo_title', type: 'text' },
    { label: 'Vendor', value: 'vendor', type: 'text' },
    { label: 'Cost', value: 'seo_cost', type: 'number' },
    { label: 'Item Code', value: 'item_code', type: 'text' },
  ],
  defaultStatus: 'complete',

  // Retry dialog feedback field
  feedbackFieldLabel: 'seo_feedback',
}

export function SeoAgentPage() {
  const [showKeywordsUpload, setShowKeywordsUpload] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)

  return (
    <>
      {/* Action Buttons - Positioned above the page */}
      <div className="mb-6 flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
        <button
          onClick={() => setShowKeywordsUpload(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Tag className="h-4 w-4" />
          <span>Upload Keywords</span>
        </button>
      </div>

      {/* Agent Monitoring Page */}
      <AgentMonitoringPage agentType="seo" config={seoAgentConfig} />

      {/* SEO Keywords Upload Dialog */}
      <SeoKeywordsUpload
        open={showKeywordsUpload}
        onClose={() => setShowKeywordsUpload(false)}
        onSuccess={() => {
          console.log('Keywords uploaded successfully')
        }}
      />

      {/* Agent Guidelines Dialog */}
      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="seo"
        onSuccess={() => {
          console.log('Guidelines sent successfully')
        }}
      />
    </>
  )
}
