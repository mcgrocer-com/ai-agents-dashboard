/**
 * FaqAgentPage Component
 *
 * FAQ generation agent page - uses reusable AgentMonitoringPage component.
 */

import { useState } from 'react'
import { AgentMonitoringPage } from '@/components/pages/AgentMonitoringPage'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { HelpCircle, MessageSquare } from 'lucide-react'
import type { AgentConfig } from '@/components/pages/AgentMonitoringPage'

// Configuration for FAQ Agent
const faqAgentConfig: AgentConfig = {
  // Header configuration
  title: 'FAQ Agent',
  subtitle: 'AI-powered FAQ generation for product pages',
  icon: HelpCircle,
  iconBgColor: 'bg-teal-100',
  iconColor: 'text-teal-600',
  primaryColor: 'teal',

  // About section
  aboutTitle: 'About FAQ Agent',
  aboutDescription:
    'The FAQ Agent uses AI to generate relevant frequently asked questions and answers for products. It analyzes product details, common customer inquiries, and industry knowledge to create helpful FAQ content that improves customer experience and SEO.',
  keyFeatures: [
    'Generates relevant product-specific FAQs',
    'Analyzes product details and descriptions',
    'Creates SEO-friendly question and answer pairs',
    'Provides confidence scoring for generated content',
    'Supports multiple FAQ formats',
    'Integrates with product knowledge base',
  ],

  // Filters
  filterColumns: [
    { value: 'faq_confidence', label: 'Confidence', type: 'number' },
    { value: 'vendor', label: 'Vendor', type: 'text' },
    { value: 'item_code', label: 'Item Code', type: 'text' },
    { value: 'faq_cost', label: 'Cost', type: 'number' },
  ],
  defaultStatus: 'complete',

  // Retry dialog feedback field name
  feedbackFieldLabel: 'FAQ Feedback',
}

export function FaqAgentPage() {
  const [showGuidelines, setShowGuidelines] = useState(false)

  return (
    <>
      {/* Action Buttons - Positioned above the page */}
      <div className="mb-6 flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
      </div>

      {/* Agent Monitoring Page */}
      <AgentMonitoringPage agentType="faq" config={faqAgentConfig} />

      {/* Agent Guidelines Dialog */}
      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="faq"
        onSuccess={() => {
          console.log('Guidelines sent successfully')
        }}
      />
    </>
  )
}
