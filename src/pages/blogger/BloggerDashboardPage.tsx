/**
 * BloggerDashboardPage
 * Main dashboard for listing and managing blogs
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import { BlogList } from '@/components/blogger';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { getUserBlogs, deleteBlog, duplicateBlog, getBlogStats } from '@/services/blogger/blogs.service';
import type { BlogWithRelations, BlogFilters, BlogStatus } from '@/types/blogger';

export function BloggerDashboardPage() {
  const navigate = useNavigate();

  const [blogs, setBlogs] = useState<BlogWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BlogStatus | 'all'>('all');
  const [stats, setStats] = useState({ total: 0, drafts: 0, published: 0, archived: 0 });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadBlogs();
    loadStats();
  }, [statusFilter, searchQuery]);

  const loadBlogs = async () => {
    setIsLoading(true);
    try {
      const filters: BlogFilters = {
        status: statusFilter,
        search: searchQuery || undefined,
      };

      const result = await getUserBlogs(filters);
      if (result.success && result.data) {
        setBlogs(result.data.data);
      }
    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    const result = await getBlogStats();
    if (result.success && result.data) {
      setStats(result.data);
    }
  };

  const handleView = (id: string) => {
    navigate(`/blogger/${id}`);
  };

  const handleEdit = (id: string) => {
    const blog = blogs.find(b => b.id === id);
    navigate(`/blogger/${id}/edit`, { state: { blog } });
  };

  const handleDelete = (id: string) => {
    setBlogToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!blogToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteBlog(blogToDelete);
      if (result.success) {
        loadBlogs();
        loadStats();
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setBlogToDelete(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicateBlog(id);
    if (result.success) {
      loadBlogs();
      loadStats();
    }
  };

  const handleCreateNew = () => {
    navigate('/blogger/create');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blog Manager</h1>
            <p className="text-sm text-gray-600 mt-1">
              Create and manage AI-powered blog posts
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
              flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create New Blog
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Total Blogs</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Drafts</p>
            <p className="text-2xl font-bold text-gray-700">{stats.drafts}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Published</p>
            <p className="text-2xl font-bold text-green-600">{stats.published}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Archived</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.archived}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2
              w-5 h-5 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blogs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BlogStatus | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-md
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <button
            onClick={loadBlogs}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50
              flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Blog List */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8">
        <BlogList
          blogs={blogs}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          isLoading={isLoading}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Blog"
        message="Are you sure you want to delete this blog? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
