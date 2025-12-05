/**
 * ContentEditor Component
 * Markdown editor with live preview
 */

import { useState, useEffect, useRef } from 'react';
import { Eye, Code, Cpu, CheckCircle, AlertCircle, Info, XCircle, RefreshCw } from 'lucide-react';
import type { ProcessingLog } from '@/services/blogger/gemini-content.service';

interface ContentEditorProps {
  content: string;
  markdownContent: string;
  onChange: (content: string, markdown: string) => void;
  isLoading?: boolean;
  processingLogs?: ProcessingLog[];
}

export function ContentEditor({
  content,
  markdownContent,
  onChange,
  isLoading = false,
  processingLogs = [],
}: ContentEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Content Editor</h3>
        <div className="flex gap-2 items-center">
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
