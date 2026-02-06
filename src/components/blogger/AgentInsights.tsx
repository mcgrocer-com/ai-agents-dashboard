/**
 * AgentInsights Component
 * Displays agent workflow summary: keywords, articles, products
 */

import { Brain, Search, FileText, Package, Zap, Clock } from 'lucide-react';
import type { ProcessingLog } from '@/services/blogger/gemini-content.service';

interface AgentInsightsProps {
  processingLogs?: ProcessingLog[];
  selectedKeyword?: string;
  articlesAnalyzed?: number;
  productLinks?: string[];
  wordCount?: number;
  generationTime?: number | null; // Generation time in seconds
}

export function AgentInsights({
  processingLogs = [],
  selectedKeyword,
  articlesAnalyzed = 0,
  productLinks = [],
  wordCount = 0,
  generationTime = null,
}: AgentInsightsProps) {
  // Format time for display
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };
  // Extract insights from processing logs
  const keywordResearchCalls = processingLogs.filter(
    log => log.type === 'function_call' && log.message.includes('researchKeywords')
  ).length;

  const articleResearchCalls = processingLogs.filter(
    log => log.type === 'function_call' && log.message.includes('getTopRankingArticles')
  ).length;

  const productSearchCalls = processingLogs.filter(
    log => log.type === 'function_call' && log.message.includes('searchProducts')
  ).length;

  const totalFunctionCalls = processingLogs.filter(
    log => log.type === 'function_call'
  ).length;

  // Don't show if no data available
  if (!selectedKeyword && articlesAnalyzed === 0 && productLinks.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Agent Workflow Summary</h3>
        </div>
        {generationTime !== null && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-blue-200 shadow-sm">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{formatTime(generationTime)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Keyword Research */}
        <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-semibold text-gray-700">Keyword Research</h4>
          </div>
          <p className="text-2xl font-bold text-blue-600 mb-1">
            {selectedKeyword ? '1' : '0'}
          </p>
          <p className="text-xs text-gray-600 mb-2">
            {keywordResearchCalls} research {keywordResearchCalls === 1 ? 'call' : 'calls'}
          </p>
          {selectedKeyword && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Selected Keyword:</p>
              <p className="text-sm font-medium text-gray-900 truncate" title={selectedKeyword}>
                "{selectedKeyword}"
              </p>
            </div>
          )}
        </div>

        {/* Articles Analyzed */}
        <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-green-600" />
            <h4 className="text-sm font-semibold text-gray-700">Articles Analyzed</h4>
          </div>
          <p className="text-2xl font-bold text-green-600 mb-1">
            {articlesAnalyzed}
          </p>
          <p className="text-xs text-gray-600">
            {articleResearchCalls} research {articleResearchCalls === 1 ? 'call' : 'calls'}
          </p>
          {articlesAnalyzed > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Competitive intelligence from top-ranking content
              </p>
            </div>
          )}
        </div>

        {/* Products Used */}
        <div className="bg-white rounded-lg p-4 border border-purple-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-purple-600" />
            <h4 className="text-sm font-semibold text-gray-700">Products Linked</h4>
          </div>
          <p className="text-2xl font-bold text-purple-600 mb-1">
            {productLinks.length}
          </p>
          <p className="text-xs text-gray-600">
            {productSearchCalls} search {productSearchCalls === 1 ? 'call' : 'calls'}
          </p>
          {productLinks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Real McGrocer product links embedded
              </p>
            </div>
          )}
        </div>

        {/* Function Calls Summary */}
        <div className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-orange-600" />
            <h4 className="text-sm font-semibold text-gray-700">Agent Activity</h4>
          </div>
          <p className="text-2xl font-bold text-orange-600 mb-1">
            {totalFunctionCalls}
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Total function calls
          </p>
          {wordCount > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Content Generated:</p>
              <p className="text-sm font-medium text-gray-900">
                {wordCount.toLocaleString()} words
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Breakdown (Collapsible) */}
      {processingLogs.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-800 flex items-center gap-2">
            <span>View Detailed Processing Log ({processingLogs.length} events)</span>
          </summary>
          <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3 max-h-60 overflow-y-auto">
            <div className="space-y-1 font-mono text-xs">
              {processingLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded ${
                    log.type === 'success'
                      ? 'bg-green-50 text-green-800'
                      : log.type === 'warning'
                      ? 'bg-yellow-50 text-yellow-800'
                      : log.type === 'function_call'
                      ? 'bg-blue-50 text-blue-800'
                      : log.type === 'function_response'
                      ? 'bg-indigo-50 text-indigo-800'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-gray-400 mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-semibold mr-2">[{log.type.toUpperCase()}]</span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
