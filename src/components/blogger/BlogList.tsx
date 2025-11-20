/**
 * BlogList Component
 * Grid/list view of blogs with filtering
 */

import { BlogCard } from './BlogCard';
import type { BlogWithRelations } from '@/types/blogger';

interface BlogListProps {
  blogs: BlogWithRelations[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  isLoading?: boolean;
}

export function BlogList({
  blogs,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  isLoading = false,
}: BlogListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4
            border-gray-300 border-t-blue-600 mb-4"
          />
          <p className="text-gray-600">Loading blogs...</p>
        </div>
      </div>
    );
  }

  if (blogs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full
          bg-gray-100 mb-4"
        >
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No blogs found</h3>
        <p className="text-gray-600 mb-4">
          Get started by creating your first blog post.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {blogs.map((blog) => (
        <BlogCard
          key={blog.id}
          blog={blog}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}
