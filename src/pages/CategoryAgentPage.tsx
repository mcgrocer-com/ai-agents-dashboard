/**
 * CategoryAgentPage Component
 *
 * Category mapping agent monitoring - uses reusable AgentMonitoringPage component.
 * Includes category hierarchy viewer for evaluation.
 */

import { useState } from 'react'
import { AgentMonitoringPage, type AgentConfig } from '@/components/pages/AgentMonitoringPage'
import { CategoryHierarchyViewer } from '@/components/category/CategoryHierarchyViewer'
import { AgentGuidelinesDialog } from '@/components/agents/AgentGuidelinesDialog'
import { Tag, FolderTree, MessageSquare } from 'lucide-react'

// Configuration for Category Agent
const categoryAgentConfig: AgentConfig = {
  // Header
  title: 'Category Mapper Agent',
  subtitle: 'AI-powered product categorization and mapping',
  icon: Tag,
  iconBgColor: 'bg-blue-100',
  iconColor: 'text-blue-600',
  primaryColor: 'blue',

  // About section
  aboutTitle: 'About Category Mapper',
  aboutDescription: 'The Category Mapper agent uses AI to automatically categorize products by analyzing product titles, descriptions, and metadata. It maps products to a standardized taxonomy for better organization and searchability.',
  keyFeatures: [
    'Intelligent product categorization using CrewAI framework',
    'Multi-level category hierarchy mapping',
    'Confidence scoring for each categorization',
    'Automatic fallback to manual review for low-confidence items',
    'Hierarchical category evaluation tool',
  ],

  // Filters
  filterColumns: [
    { label: 'Category', value: 'category', type: 'text' },
    { label: 'Vendor', value: 'vendor', type: 'text' },
    { label: 'Confidence', value: 'category_confidence', type: 'number' },
    { label: 'Item Code', value: 'item_code', type: 'text' },
  ],
  defaultStatus: 'complete',

  // Retry dialog feedback field
  feedbackFieldLabel: 'category_feedback',
}

export function CategoryAgentPage() {
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [showGuidelines, setShowGuidelines] = useState(false)

  return (
    <>
      {/* Action Buttons - Positioned above the page */}
      <div className="mb-6 flex gap-3 justify-end">
        <button
          onClick={() => setShowGuidelines(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Send Guidelines</span>
        </button>
        <button
          onClick={() => setShowHierarchy(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <FolderTree className="h-4 w-4" />
          <span>View Category Hierarchy</span>
        </button>
      </div>

      {/* Agent Monitoring Page */}
      <AgentMonitoringPage agentType="category" config={categoryAgentConfig} />

      {/* Category Hierarchy Viewer */}
      <CategoryHierarchyViewer
        open={showHierarchy}
        onClose={() => setShowHierarchy(false)}
      />

      {/* Agent Guidelines Dialog */}
      <AgentGuidelinesDialog
        open={showGuidelines}
        onClose={() => setShowGuidelines(false)}
        agentType="category"
        onSuccess={() => {
          console.log('Guidelines sent successfully')
        }}
      />
    </>
  )
}
