/**
 * Blogger Blogs Service
 * Handles CRUD operations for blog posts
 */

import { supabase } from '@/lib/supabase/client';
import { rehostAllImages } from './images.service';
import type {
  BloggerBlog,
  BlogWithRelations,
  BlogFilters,
  BlogStatus,
  ServiceResponse,
  PaginatedResponse,
} from '@/types/blogger';

/**
 * Normalize UUID by adding hyphens if missing
 * Converts: 4f20e00125dcc24a622aa63ac84c32a4
 * To: 4f20e001-25dc-c24a-622a-a63ac84c32a4
 */
function normalizeUuid(uuid: string): string {
  // Remove any existing hyphens
  const cleaned = uuid.replace(/-/g, '');
  // Add hyphens in the correct positions (8-4-4-4-12)
  return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12, 16)}-${cleaned.slice(16, 20)}-${cleaned.slice(20, 32)}`;
}

/**
 * Create a new blog post
 */
export async function createBlog(
  blog: Omit<BloggerBlog, 'id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<ServiceResponse<BloggerBlog>> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error('User not authenticated'),
        success: false,
      };
    }

    // Create the blog first to get the ID
    const { data, error } = await supabase
      .from('blogger_blogs')
      .insert({
        ...blog,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating blog:', error);
      return { data: null, error, success: false };
    }

    // Rehost external images to Supabase storage
    if (data.content) {
      try {
        const { content: rehostedContent, rehostedCount } = await rehostAllImages(
          data.content,
          data.id
        );

        if (rehostedCount > 0) {
          console.log(`[Blog Create] Rehosted ${rehostedCount} external images`);

          // Update blog with rehosted content
          const { data: updatedData, error: updateError } = await supabase
            .from('blogger_blogs')
            .update({ content: rehostedContent })
            .eq('id', data.id)
            .select()
            .single();

          if (updateError) {
            console.warn('Failed to update blog with rehosted images:', updateError);
            // Continue with original content if update fails
          } else {
            return { data: updatedData, error: null, success: true };
          }
        }
      } catch (rehostError) {
        console.warn('Image rehosting failed, continuing with original URLs:', rehostError);
        // Continue with original content if rehosting fails
      }
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error creating blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get user's blogs with optional filters and pagination
 */
export async function getUserBlogs(
  filters?: BlogFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<ServiceResponse<PaginatedResponse<BlogWithRelations>>> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error('User not authenticated'),
        success: false,
      };
    }

    // Build query
    // Note: We don't alias blogger_keywords as 'primary_keyword' since that would
    // overwrite the primary_keyword TEXT column. Use keyword_relation instead.
    let query = supabase
      .from('blogger_blogs')
      .select(
        `
        *,
        persona:blogger_personas(*),
        template:blogger_templates(*)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id);

    // Apply filters
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters?.persona_id) {
      query = query.eq('persona_id', filters.persona_id);
    }

    if (filters?.template_id) {
      query = query.eq('template_id', filters.template_id);
    }

    if (filters?.search) {
      // Check if search looks like a UUID for exact matching (performance optimization)
      const isUuidFormat = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(filters.search);

      if (isUuidFormat) {
        // Normalize UUID to add hyphens for exact match (PostgreSQL UUID format)
        const normalizedUuid = normalizeUuid(filters.search);
        // Use exact match for UUID (much faster than ilike)
        query = query.or(
          `id.eq.${normalizedUuid},title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
        );
      } else {
        // Use pattern matching for text search only
        query = query.or(
          `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
        );
      }
    }

    // Apply sorting
    const sortBy = filters?.sort_by || 'created_at';
    const sortOrder = filters?.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching blogs:', error);
      return { data: null, error, success: false };
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 0;

    return {
      data: {
        data: data || [],
        total: count || 0,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching blogs:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get a single blog by ID with all relations
 */
export async function getBlogById(
  id: string
): Promise<ServiceResponse<BlogWithRelations>> {
  try {
    // Note: We don't alias blogger_keywords as 'primary_keyword' since that would
    // overwrite the primary_keyword TEXT column on the blog.
    const { data, error } = await supabase
      .from('blogger_blogs')
      .select(
        `
        *,
        persona:blogger_personas(*),
        template:blogger_templates(*),
        products:blogger_blog_products(*)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching blog:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Update a blog post
 */
export async function updateBlog(
  id: string,
  updates: Partial<
    Omit<BloggerBlog, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  >
): Promise<ServiceResponse<BloggerBlog>> {
  try {
    // If content is being updated, rehost external images first
    if (updates.content) {
      try {
        const { content: rehostedContent, rehostedCount } = await rehostAllImages(
          updates.content,
          id
        );

        if (rehostedCount > 0) {
          console.log(`[Blog Update] Rehosted ${rehostedCount} external images`);
          updates.content = rehostedContent;
        }
      } catch (rehostError) {
        console.warn('Image rehosting failed, continuing with original URLs:', rehostError);
        // Continue with original content if rehosting fails
      }
    }

    const { data, error } = await supabase
      .from('blogger_blogs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating blog:', error);
      return { data: null, error, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error updating blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete a blog post (local database only)
 */
export async function deleteBlog(id: string): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('blogger_blogs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting blog:', error);
      return { data: null, error, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete a blog post with Shopify synchronization
 * This function handles both local and Shopify deletion
 */
export async function deleteBlogWithShopify(
  id: string
): Promise<ServiceResponse<{ shopifyDeleted: boolean; localDeleted: boolean; warnings?: string[] }>> {
  const warnings: string[] = [];
  let shopifyDeleted = false;
  let localDeleted = false;

  try {
    // First, fetch the blog to check if it's published to Shopify
    const { data: blog, error: fetchError } = await supabase
      .from('blogger_blogs')
      .select('shopify_article_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching blog for deletion:', fetchError);
      return {
        data: null,
        error: fetchError,
        success: false,
      };
    }

    // If blog is published to Shopify, delete from Shopify first
    if (blog?.shopify_article_id) {
      try {
        const { removeBlogFromShopify } = await import('./shopify.service');
        const shopifyResult = await removeBlogFromShopify(blog.shopify_article_id);

        if (shopifyResult.success) {
          shopifyDeleted = true;
        } else {
          warnings.push(
            `Failed to delete from Shopify: ${shopifyResult.error?.message || 'Unknown error'}. Continuing with local deletion.`
          );
        }
      } catch (error) {
        console.error('Error deleting from Shopify:', error);
        warnings.push(
          `Error deleting from Shopify: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing with local deletion.`
        );
      }
    }

    // Delete from local database
    const deleteResult = await deleteBlog(id);

    if (deleteResult.success) {
      localDeleted = true;
    } else {
      return {
        data: null,
        error: deleteResult.error || new Error('Failed to delete blog from local database'),
        success: false,
      };
    }

    return {
      data: {
        shopifyDeleted,
        localDeleted,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error deleting blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Duplicate a blog post
 */
export async function duplicateBlog(
  id: string
): Promise<ServiceResponse<BloggerBlog>> {
  try {
    // Fetch the original blog
    const { data: original, error: fetchError } = await supabase
      .from('blogger_blogs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      console.error('Error fetching blog to duplicate:', fetchError);
      return { data: null, error: fetchError, success: false };
    }

    // Create a duplicate with modified title
    const {
      id: _id,
      created_at: _created,
      updated_at: _updated,
      slug: _slug,
      shopify_article_id: _article,
      shopify_blog_id: _blog,
      published_at: _published,
      ...blogData
    } = original;

    const duplicate = {
      ...blogData,
      title: `${original.title} (Copy)`,
      status: 'draft' as BlogStatus,
    };

    return await createBlog(duplicate);
  } catch (error) {
    console.error('Unexpected error duplicating blog:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Update blog status
 */
export async function updateBlogStatus(
  id: string,
  status: BlogStatus
): Promise<ServiceResponse<BloggerBlog>> {
  const updates: Partial<BloggerBlog> = { status };

  // If publishing, set published_at timestamp
  if (status === 'published') {
    updates.published_at = new Date().toISOString();
  }

  return await updateBlog(id, updates);
}

/**
 * Get blog statistics for user
 */
export async function getBlogStats(): Promise<
  ServiceResponse<{
    total: number;
    drafts: number;
    published: number;
    archived: number;
  }>
> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error('User not authenticated'),
        success: false,
      };
    }

    const { data, error } = await supabase
      .from('blogger_blogs')
      .select('status')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching blog stats:', error);
      return { data: null, error, success: false };
    }

    const stats = {
      total: data.length,
      drafts: data.filter((b) => b.status === 'draft').length,
      published: data.filter((b) => b.status === 'published').length,
      archived: data.filter((b) => b.status === 'archived').length,
    };

    return { data: stats, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching blog stats:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
