/**
 * CopyrightAgentPage Component
 *
 * Copyright detection and image validation agent page.
 * Displays products with copyright processing status and results.
 */

import { useState } from 'react'
import { AgentMonitoringPage } from '@/components/pages/AgentMonitoringPage'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { Shield, MessageSquare } from 'lucide-react'
import type { AgentConfig } from '@/components/pages/AgentMonitoringPage'

// Configuration for Copyright Agent
const copyrightAgentConfig: AgentConfig = {
  // Header configuration
  title: 'Copyright Agent',
  subtitle: 'AI-powered copyright detection and image validation',
  icon: Shield,
  iconBgColor: 'bg-orange-100',
  iconColor: 'text-orange-600',
  primaryColor: 'orange',

  // About section
  aboutTitle: 'About Copyright Agent',
  aboutDescription:
    'The Copyright Agent uses advanced AI to detect copyrighted content in product images and descriptions, ensuring compliance with intellectual property laws. It identifies non-copyright images and provides detailed validation reasoning.',
  keyFeatures: [
    'Detects copyrighted content in images',
    'Identifies non-copyright images for safe use',
    'Validates image licensing and usage rights',
    'Provides detailed reasoning and confidence scores',
    'Suggests alternative non-copyright images',
    'Ensures legal compliance for product listings',
  ],

  // Filters
  filterColumns: [
    { value: 'copyright_confidence', label: 'Confidence', type: 'number' },
    { value: 'vendor', label: 'Vendor', type: 'text' },
    { value: 'item_code', label: 'Item Code', type: 'text' },
  ],
  defaultStatus: 'complete',

  // Retry dialog feedback field name
  feedbackFieldLabel: 'Copyright Feedback',
}

export function CopyrightAgentPage() {
  const [showGuidelines, setShowGuidelines] = useState(false)

  return (
    <>
      {/* Action Buttons - Positioned above the page */}
      <div className="mb-6 flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
      </div>

      {/* Agent Monitoring Page */}
      <AgentMonitoringPage agentType="copyright" config={copyrightAgentConfig} />

      {/* Agent Guidelines Dialog */}
      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="copyright"
        onSuccess={() => {
          console.log('Guidelines sent successfully')
        }}
      />
    </>
  )
}
