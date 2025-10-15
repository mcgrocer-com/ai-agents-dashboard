/**
 * ProductTabs Component
 *
 * Tabbed interface for product details.
 */

import { useState, type ReactNode } from 'react'

export interface Tab {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

interface ProductTabsProps {
  tabs: Tab[]
}

export function ProductTabs({ tabs }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '')

  const activeTabContent = tabs.find(t => t.id === activeTab)?.content

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Tab Headers */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap
                border-b-2 transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTabContent}
      </div>
    </div>
  )
}
