/**
 * CopyrightAgentPage Component
 *
 * Copyright detection and image validation agent page.
 * Displays products with copyright processing status and results.
 */

import { AgentMonitoringPage } from '@/components/pages/AgentMonitoringPage'
import { Shield } from 'lucide-react'
import type { AgentConfig } from '@/components/pages/AgentMonitoringPage'

export function CopyrightAgentPage() {
  const config: AgentConfig = {
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
      {
        value: 'copyright_confidence',
        label: 'Confidence',
        type: 'number',
      },
      {
        value: 'vendor',
        label: 'Vendor',
        type: 'text',
      },
      {
        value: 'item_code',
        label: 'Item Code',
        type: 'text',
      },
    ],
    defaultStatus: 'complete',

    // Retry dialog feedback field name
    feedbackFieldLabel: 'Copyright Feedback',
  }

  return <AgentMonitoringPage agentType="copyright" config={config} />
}
