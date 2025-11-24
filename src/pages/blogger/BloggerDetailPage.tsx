/**
 * BloggerDetailPage
 * View and manage a single blog post
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Send, Archive, ArchiveRestore, Eye } from 'lucide-react';
import { BlogPreview } from '@/components/blogger';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Toast } from '@/components/ui/Toast';
import { getBlogById, deleteBlog, updateBlogStatus, updateBlog } from '@/services/blogger/blogs.service';
import { publishBlogToShopify, unpublishBlogFromShopify, fetchShopifyBlogs } from '@/services/blogger/shopify.service';
import type { BlogWithRelations, ShopifyBlog } from '@/types/blogger';

export function BloggerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogWithRelations | null>(null);
  const [shopifyBlogs, setShopifyBlogs] = useState<ShopifyBlog[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (id) {
      loadBlog();
      loadShopifyBlogs();
    }
  }, [id]);

  const loadBlog = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const result = await getBlogById(id);
      if (result.success && result.data) {
        setBlog(result.data);
      }
    } catch (error) {
      console.error('Error loading blog:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadShopifyBlogs = async () => {
    try {
      const result = await fetchShopifyBlogs(10);
      if (result.success && result.data) {
        setShopifyBlogs(result.data.blogs);
        // Set default to first blog if available
        if (result.data.blogs.length > 0) {
          setSelectedBlogId(result.data.blogs[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading Shopify blogs:', error);
    }
  };

  const handleEdit = () => {
    navigate(`/blogger/${id}/edit`);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!id || !blog) return;

    setIsDeleting(true);
    try {
      // If blog was published to Shopify, delete from Shopify first
      if (blog.shopify_article_id) {
        const shopifyResult = await unpublishBlogFromShopify(blog.shopify_article_id);
        if (!shopifyResult.success) {
          setToast({
            message: `Failed to delete from Shopify: ${shopifyResult.error?.message || 'Unknown error'}. Blog will still be deleted locally.`,
            type: 'error'
          });
          // Continue with local deletion even if Shopify deletion fails
        }
      }

      // Delete from local database
      const result = await deleteBlog(id);
      if (result.success) {
        setToast({ message: 'Blog deleted successfully!', type: 'success' });
        navigate('/blogger');
      } else {
        setToast({ message: `Failed to delete blog: ${result.error?.message || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Error deleting blog:', error);
      setToast({ message: `Error deleting blog: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePublishClick = () => {
    setShowPublishDialog(true);
  };

  const confirmPublish = async () => {
    if (!id || !blog || !selectedBlogId) return;

    setIsPublishing(true);
    try {
      // Publish to Shopify
      const result = await publishBlogToShopify({
        blogId: selectedBlogId,
        title: blog.title,
        content: blog.content,
        metaTitle: blog.meta_title,
        metaDescription: blog.meta_description,
        featuredImageUrl: blog.featured_image_url || undefined,
        featuredImageAlt: blog.featured_image_alt || undefined,
        author: blog.persona?.name || 'McGrocer Team',
        tags: blog.primary_keyword ? [blog.primary_keyword.keyword] : [],
        publishedAt: new Date().toISOString(),
      });

      if (result.success && result.data) {
        // Extract numeric ID from Shopify GID (e.g., "gid://shopify/Article/123456789" -> 123456789)
        const articleIdMatch = result.data.article.id.match(/\/(\d+)$/);
        const shopifyArticleId = articleIdMatch ? parseInt(articleIdMatch[1]) : null;

        // Update blog status and save Shopify article ID
        await updateBlogStatus(id, 'published');
        if (shopifyArticleId) {
          await updateBlog(id, { shopify_article_id: shopifyArticleId });
        }
        loadBlog();
        setToast({ message: 'Blog published successfully to Shopify!', type: 'success' });
      } else {
        setToast({ message: `Failed to publish blog: ${result.error?.message || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Error publishing blog:', error);
      setToast({ message: `Error publishing blog: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setIsPublishing(false);
      setShowPublishDialog(false);
    }
  };

  const handleUnpublish = async () => {
    if (!id || !blog?.shopify_article_id) return;

    setIsPublishing(true);
    try {
      const result = await unpublishBlogFromShopify(blog.shopify_article_id);

      if (result.success) {
        // Update blog status and clear Shopify article ID
        await updateBlogStatus(id, 'draft');
        await updateBlog(id, { shopify_article_id: null });
        loadBlog();
        setToast({ message: 'Blog unpublished successfully from Shopify!', type: 'success' });
      } else {
        setToast({ message: `Failed to unpublish blog: ${result.error?.message || 'Unknown error'}`, type: 'error' });
      }
    } catch (error) {
      console.error('Error unpublishing blog:', error);
      setToast({ message: `Error unpublishing blog: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    if (!id || !blog) return;

    const newStatus = blog.status === 'archived' ? 'draft' : 'archived';
    const result = await updateBlogStatus(id, newStatus);
    if (result.success) {
      loadBlog();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4
            border-gray-300 border-t-blue-600 mb-4"
          />
          <p className="text-gray-600">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Blog not found</h2>
          <button
            onClick={() => navigate('/blogger')}
            className="text-blue-600 hover:underline"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/blogger')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Blogs
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>

            {blog.status === 'draft' && (
              <button
                onClick={handlePublishClick}
                disabled={isPublishing || shopifyBlogs.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                  flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Publish to Shopify
              </button>
            )}

            {blog.status === 'published' && (
              <button
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700
                  flex items-center gap-2 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                {isPublishing ? 'Unpublishing...' : 'Unpublish'}
              </button>
            )}

            <button
              onClick={handleArchive}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700
                flex items-center gap-2"
            >
              {blog.status === 'archived' ? (
                <>
                  <ArchiveRestore className="w-4 h-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Archive
                </>
              )}
            </button>

            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700
                flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <BlogPreview blog={blog} />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Blog"
        message={
          blog?.shopify_article_id
            ? "Are you sure you want to delete this blog? This will also remove it from Shopify. This action cannot be undone."
            : "Are you sure you want to delete this blog? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Publish to Shopify
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Shopify Blog
                </label>
                <select
                  value={selectedBlogId}
                  onChange={(e) => setSelectedBlogId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {shopifyBlogs.map((shopifyBlog) => (
                    <option key={shopifyBlog.id} value={shopifyBlog.id}>
                      {shopifyBlog.title} ({shopifyBlog.handle})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose which Shopify blog to publish this article to
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Title:</strong> {blog?.title}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Author:</strong> {blog?.persona?.name || 'McGrocer Team'}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Words:</strong> {blog?.word_count || 'N/A'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPublishDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={isPublishing}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPublish}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  disabled={isPublishing || !selectedBlogId}
                >
                  {isPublishing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
