/**
 * BloggerDetailPage
 * View and manage a single blog post
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Send, Archive, ArchiveRestore, Eye } from 'lucide-react';
import { BlogPreview } from '@/components/blogger';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { getBlogById, deleteBlog, updateBlogStatus } from '@/services/blogger/blogs.service';
import { publishBlogToShopify, unpublishBlogFromShopify } from '@/services/blogger/shopify.service';
import type { BlogWithRelations } from '@/types/blogger';

export function BloggerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadBlog();
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

  const handleEdit = () => {
    navigate(`/blogger/${id}/edit`);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const result = await deleteBlog(id);
      if (result.success) {
        navigate('/blogger');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePublish = async () => {
    if (!id || !blog) return;

    setIsPublishing(true);
    try {
      // Publish to Shopify
      const result = await publishBlogToShopify({
        title: blog.title,
        content: blog.content,
        author: blog.persona?.name || 'Admin',
        tags: blog.primary_keyword ? [blog.primary_keyword.keyword] : [],
        meta_title: blog.meta_title,
        meta_description: blog.meta_description,
      });

      if (result.success && result.data) {
        // Update blog status
        await updateBlogStatus(id, 'published');
        loadBlog();
      }
    } catch (error) {
      console.error('Error publishing blog:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!id || !blog?.shopify_article_id) return;

    setIsPublishing(true);
    try {
      await unpublishBlogFromShopify(blog.shopify_article_id);
      await updateBlogStatus(id, 'draft');
      loadBlog();
    } catch (error) {
      console.error('Error unpublishing blog:', error);
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
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                  flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isPublishing ? 'Publishing...' : 'Publish to Shopify'}
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
        message="Are you sure you want to delete this blog? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
