/**
 * BlogPreview Component
 * Full blog preview with metadata and rendered content
 */

import { Calendar, User, FileText, TrendingUp } from 'lucide-react';
import type { BlogWithRelations } from '@/types/blogger';

interface BlogPreviewProps {
  blog: BlogWithRelations;
}

export function BlogPreview({ blog }: BlogPreviewProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with metadata */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{blog.title}</h1>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {blog.created_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(blog.created_at).toLocaleDateString()}</span>
            </div>
          )}

          {blog.persona && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{blog.persona.name}</span>
            </div>
          )}

          {blog.template && (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>{blog.template.name}</span>
            </div>
          )}

          {blog.word_count && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>{blog.word_count.toLocaleString()} words</span>
            </div>
          )}
        </div>

        {/* SEO Metadata */}
        {(blog.meta_title || blog.meta_description) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {blog.meta_title && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-700 mb-1">Meta Title</p>
                <p className="text-sm text-gray-900">{blog.meta_title}</p>
              </div>
            )}
            {blog.meta_description && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Meta Description</p>
                <p className="text-sm text-gray-900">{blog.meta_description}</p>
              </div>
            )}
          </div>
        )}

        {/* Scores */}
        {(blog.seo_score !== null || blog.readability_score !== null) && (
          <div className="mt-4 flex gap-4">
            {blog.seo_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">SEO Score:</span>
                <span className="text-sm font-semibold text-blue-600">
                  {blog.seo_score}/100
                </span>
              </div>
            )}
            {blog.readability_score !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700">Readability:</span>
                <span className="text-sm font-semibold text-green-600">
                  {blog.readability_score}/100
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Blog content */}
      <div className="px-6 py-8">
        <div
          className="prose prose-sm md:prose-base lg:prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
      </div>
    </div>
  );
}
