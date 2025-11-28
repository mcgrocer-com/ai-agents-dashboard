/**
 * ContentEditor Component
 * Markdown editor with live preview
 */

import { useState, useEffect, useRef } from 'react';
import { Eye, Code, Sparkles, RefreshCw, Cpu, CheckCircle, AlertCircle, Info, Settings, XCircle } from 'lucide-react';
import type { ProcessingLog } from '@/services/blogger/gemini-content.service';

interface ContentEditorProps {
  content: string;
  markdownContent: string;
  onChange: (content: string, markdown: string) => void;
  onGenerate?: () => void;
  onSettingsClick?: () => void;
  isLoading?: boolean;
  processingLogs?: ProcessingLog[];
}

export function ContentEditor({
  content,
  markdownContent,
  onChange,
  onGenerate,
  onSettingsClick,
  isLoading = false,
  processingLogs = [],
}: ContentEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const hasContent = content.length > 0 && content !== 'zxzxz';
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [processingLogs]);

  const getLogIcon = (type: ProcessingLog['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'function_call':
        return <Cpu className="w-4 h-4 text-blue-600" />;
      case 'function_response':
        return <CheckCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLogColor = (type: ProcessingLog['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'function_call':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'function_response':
        return 'text-blue-600 bg-blue-50/50 border-blue-100';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate Button - Prominent if no content */}
      {onGenerate && !hasContent && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 text-center">
          <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">
            Ready to Generate Your Blog Content
          </h4>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Click the button below to generate high-quality, SEO-optimized content using Gemini AI with your selected persona and template.
          </p>

          <div className="flex items-center justify-center gap-3">
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium transition-all"
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
            )}
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-md hover:shadow-lg transition-all"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Content...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Content with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Content Editor</h3>
        <div className="flex gap-2 items-center">
          {onGenerate && hasContent && onSettingsClick && (
            <button
              onClick={onSettingsClick}
              disabled={isLoading}
              className="px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          )}
          {onGenerate && hasContent && (
            <button
              onClick={onGenerate}
              disabled={isLoading}
              className="px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2
              ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {viewMode === 'edit' ? (
              <>
                <Eye className="w-4 h-4" />
                Preview
              </>
            ) : (
              <>
                <Code className="w-4 h-4" />
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Logs - Show during generation (both new and regenerate) */}
      {isLoading && (
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Agent Processing Log
            <span className="text-xs text-gray-500 font-normal">(In Progress...)</span>
          </h4>
          <div ref={logsContainerRef} className="space-y-2 max-h-80 overflow-y-auto">
            {processingLogs.length === 0 ? (
              <div className="flex items-center gap-2 p-3 text-sm text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Initializing AI agent and preparing to generate content...</span>
              </div>
            ) : (
              processingLogs.map((log, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-2 rounded-md border ${getLogColor(log.type)} text-xs`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="break-words font-mono">{log.message}</p>
                  </div>
                  <div className="flex-shrink-0 text-[10px] text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'edit' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            HTML Content
          </label>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value, markdownContent)}
            disabled={isLoading}
            placeholder="HTML content of your blog post..."
            rows={25}
            className="w-full px-4 py-3 border border-gray-300 rounded-md font-mono text-sm
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed resize-y"
          />
        </div>
      ) : (
        <div className="border border-gray-300 rounded-md p-6 bg-white min-h-[500px]">
          <div
            className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600"
            dangerouslySetInnerHTML={{ __html: content || '<p>No content to preview</p>' }}
          />
        </div>
      )}
    </div>
  );
}
