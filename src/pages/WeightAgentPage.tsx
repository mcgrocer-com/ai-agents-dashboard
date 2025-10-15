/**
 * WeightAgentPage Component
 *
 * Weight & dimension agent monitoring - uses reusable AgentMonitoringPage component.
 * Includes warehouse data upload for priority weight information.
 */

import { useState } from 'react'
import { AgentMonitoringPage, type AgentConfig } from '@/components/pages/AgentMonitoringPage'
import { WarehouseDataUpload } from '@/components/warehouse/WarehouseDataUpload'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { Scale, Database, MessageSquare } from 'lucide-react'

// Configuration for Weight Agent
const weightAgentConfig: AgentConfig = {
  // Header
  title: 'Weight & Dimension Agent',
  subtitle: 'AI-powered weight and dimension estimation',
  icon: Scale,
  iconBgColor: 'bg-purple-100',
  iconColor: 'text-purple-600',
  primaryColor: 'purple',

  // About section
  aboutTitle: 'About Weight & Dimension Agent',
  aboutDescription: 'The Weight & Dimension agent uses AI and 3D model processing to estimate product weights and dimensions. It analyzes product images, descriptions, and available data to provide accurate shipping and logistics information.',
  keyFeatures: [
    '3D model analysis for dimension estimation',
    'Weight prediction using ML models',
    'Packaging size recommendations',
    'Shipping cost optimization suggestions',
    'Priority warehouse data integration',
  ],

  // Filters
  filterColumns: [
    { label: 'Weight (kg)', value: 'weight', type: 'number' },
    { label: 'Height (cm)', value: 'height', type: 'number' },
    { label: 'Width (cm)', value: 'width', type: 'number' },
    { label: 'Length (cm)', value: 'length', type: 'number' },
    { label: 'Vendor', value: 'vendor', type: 'text' },
    { label: 'Confidence', value: 'weight_confidence', type: 'number' },
    { label: 'Item Code', value: 'item_code', type: 'text' },
  ],
  defaultStatus: 'complete',

  // Retry dialog feedback field
  feedbackFieldLabel: 'weight_feedback',
}

export function WeightAgentPage() {
  const [showWarehouseUpload, setShowWarehouseUpload] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)

  return (
    <>
      {/* Action Buttons - Positioned above the page */}
      <div className="mb-6 flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
        <button
          onClick={() => setShowWarehouseUpload(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <Database className="h-4 w-4" />
          <span>Upload Warehouse Data</span>
        </button>
      </div>

      {/* Agent Monitoring Page */}
      <AgentMonitoringPage agentType="weight_dimension" config={weightAgentConfig} />

      {/* Warehouse Data Upload Dialog */}
      <WarehouseDataUpload
        open={showWarehouseUpload}
        onClose={() => setShowWarehouseUpload(false)}
        onSuccess={() => {
          console.log('Warehouse data uploaded successfully')
        }}
      />

      {/* Agent Guidelines Dialog */}
      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="weight_dimension"
        onSuccess={() => {
          console.log('Guidelines sent successfully')
        }}
      />
    </>
  )
}
