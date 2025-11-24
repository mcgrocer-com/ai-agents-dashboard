/**
 * BlogCard Component
 * Displays a blog item with status and actions
 */

import { Calendar, Eye, Edit, Trash2, Copy, FileImage } from 'lucide-react';
import type { BlogWithRelations, BlogStatus } from '@/types/blogger';

interface BlogCardProps {
  blog: BlogWithRelations;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const STATUS_STYLES: Record<BlogStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  published: { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
  archived: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Archived' },
};

export function BlogCard({
  blog,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
}: BlogCardProps) {
  const statusStyle = STATUS_STYLES[blog.status];
  const formattedDate = new Date(blog.created_at).toLocaleDateString();

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Featured Image */}
      <div className="w-full h-48 overflow-hidden bg-gray-100">
        {blog.featured_image_url ? (
          <img
            src={blog.featured_image_url}
            alt={blog.featured_image_alt || blog.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <FileImage className="w-16 h-16 text-gray-400" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-lg line-clamp-2 flex-1">
            {blog.title}
          </h3>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
        </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          {blog.word_count && (
            <span>{blog.word_count.toLocaleString()} words</span>
          )}
        </div>

        {blog.persona && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Persona:</span> {blog.persona.name}
          </p>
        )}

        {blog.template && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Template:</span> {blog.template.name}
          </p>
        )}
      </div>

        <div className="flex gap-2 pt-3 border-t border-gray-200">
          <button
            onClick={() => onView(blog.id)}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100
              rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={() => onEdit(blog.id)}
            className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100
              rounded-md hover:bg-blue-200 flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onDuplicate(blog.id)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100
              rounded-md hover:bg-gray-200"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(blog.id)}
            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100
              rounded-md hover:bg-red-200"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
