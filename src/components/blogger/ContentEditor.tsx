/**
 * ContentEditor Component
 * Markdown editor with live preview
 */

import { useState } from 'react';
import { Eye, Code } from 'lucide-react';

interface ContentEditorProps {
  content: string;
  markdownContent: string;
  onChange: (content: string, markdown: string) => void;
  isLoading?: boolean;
}

export function ContentEditor({
  content,
  markdownContent,
  onChange,
  isLoading = false,
}: ContentEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Content Editor</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('edit')}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2
              ${
                viewMode === 'edit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Code className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2
              ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
        </div>
      </div>

      {viewMode === 'edit' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Markdown Content
            </label>
            <textarea
              value={markdownContent}
              onChange={(e) => onChange(content, e.target.value)}
              disabled={isLoading}
              placeholder="Write your blog content in Markdown..."
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 rounded-md font-mono text-sm
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HTML Content (Auto-generated)
            </label>
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value, markdownContent)}
              disabled={isLoading}
              placeholder="HTML version of your content..."
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-md font-mono text-sm
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:opacity-50 disabled:cursor-not-allowed resize-y"
            />
          </div>
        </div>
      ) : (
        <div className="border border-gray-300 rounded-md p-6 bg-white min-h-[500px]">
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: content || '<p>No content to preview</p>' }}
          />
        </div>
      )}
    </div>
  );
}
