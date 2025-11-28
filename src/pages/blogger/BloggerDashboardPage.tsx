/**
 * BloggerDashboardPage
 * Main dashboard for listing and managing blogs
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, RefreshCw, ExternalLink, FileImage } from 'lucide-react';
import { BlogList } from '@/components/blogger';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ShimmerLoader } from '@/components/ui/ShimmerLoader';
import { Toast } from '@/components/ui/Toast';
import { getUserBlogs, deleteBlogWithShopify, duplicateBlog, getBlogStats } from '@/services/blogger/blogs.service';
import { fetchPublishedBlogs } from '@/services/blogger/shopify.service';
import type { BlogWithRelations, BlogFilters, BlogStatus, ShopifyBlogArticle } from '@/types/blogger';

export function BloggerDashboardPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'my-blogs' | 'shopify'>('my-blogs');
  const [blogs, setBlogs] = useState<BlogWithRelations[]>([]);
  const [shopifyBlogs, setShopifyBlogs] = useState<ShopifyBlogArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingShopify, setIsLoadingShopify] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BlogStatus | 'all'>('all');
  const [stats, setStats] = useState({ total: 0, drafts: 0, published: 0, archived: 0 });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (activeTab === 'my-blogs') {
      loadBlogs();
      loadStats();
    } else {
      loadShopifyBlogs();
    }
  }, [activeTab, statusFilter, searchQuery]);

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

  const loadShopifyBlogs = async () => {
    setIsLoadingShopify(true);
    try {
      const result = await fetchPublishedBlogs(50);
      if (result.success && result.data) {
        setShopifyBlogs(result.data.articles);
      }
    } catch (error) {
      console.error('Error loading Shopify blogs:', error);
    } finally {
      setIsLoadingShopify(false);
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
      const result = await deleteBlogWithShopify(blogToDelete);

      if (result.success) {
        // Show success message
        setToast({ message: 'Blog deleted successfully!', type: 'success' });

        // Show warnings if Shopify deletion failed
        if (result.data?.warnings && result.data.warnings.length > 0) {
          setTimeout(() => {
            setToast({
              message: result.data!.warnings![0],
              type: 'info'
            });
          }, 3000);
        }

        loadBlogs();
        loadStats();
      } else {
        setToast({
          message: `Failed to delete blog: ${result.error?.message || 'Unknown error'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error deleting blog:', error);
      setToast({
        message: `Error deleting blog: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
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

        {/* Tabs */}
        <div className="flex gap-4 mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('my-blogs')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'my-blogs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Blogs
          </button>
          <button
            onClick={() => setActiveTab('shopify')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'shopify'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Shopify Drafts
          </button>
        </div>

        {/* Stats - Only show for My Blogs tab */}
        {activeTab === 'my-blogs' && (
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
              <p className="text-xs text-gray-600 mb-1">Saved to Shopify</p>
              <p className="text-2xl font-bold text-green-600">{stats.published}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">Archived</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.archived}</p>
            </div>
          </div>
        )}

        {/* Filters - Only show for My Blogs tab */}
        {activeTab === 'my-blogs' && (
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
                <option value="published">Saved to Shopify</option>
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
        )}

        {/* Shopify Refresh Button */}
        {activeTab === 'shopify' && (
          <div className="flex justify-end">
            <button
              onClick={loadShopifyBlogs}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50
                flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8">
        {activeTab === 'my-blogs' ? (
          <BlogList
            blogs={blogs}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            isLoading={isLoading}
          />
        ) : (
          <div className="space-y-4">
            {isLoadingShopify ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ShimmerLoader key={i} type="blog-card" />
                ))}
              </div>
            ) : shopifyBlogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No drafts found on Shopify</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shopifyBlogs.map((article) => {
                  // Extract numeric ID from GID format (gid://shopify/Article/123456789)
                  const numericId = (article as any).numericId || article.id.split('/').pop();
                  const adminUrl = `https://mcgrocer-com.myshopify.com/admin/articles/${numericId}`;
                  return (
                    <div
                      key={article.id}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Featured Image */}
                      <div className="w-full h-48 overflow-hidden bg-gray-100">
                        {article.image?.url ? (
                          <img
                            src={article.image.url}
                            alt={article.image.altText || article.title}
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
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                            {article.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>Blog: {article.blog?.title || 'Unknown'}</span>
                          {article.publishedAt && (
                            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {article.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {article.tags.length > 3 && (
                              <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                                +{article.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <a
                          href={adminUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Edit in Shopify
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Blog"
        message="Are you sure you want to delete this blog? If saved to Shopify, it will also be removed from there."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={5000}
        />
      )}
    </div>
  );
}
