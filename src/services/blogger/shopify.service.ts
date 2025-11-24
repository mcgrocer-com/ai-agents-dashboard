/**
 * Blogger Shopify Service
 * Handles Shopify product search and blog publishing
 */

import type {
  ShopifyProduct,
  ShopifyProductSearchResponse,
  ShopifyPublishRequest,
  ShopifyPublishResponse,
  ShopifyBlogsResponse,
  ShopifyBlogArticle,
  ShopifyArticlesResponse,
  ServiceResponse,
} from '@/types/blogger';

const SHOPIFY_STORE_URL = 'https://mcgrocer-com.myshopify.com';
const SHOPIFY_API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || '';
const SHOPIFY_API_VERSION = '2024-10';
const SUPABASE_EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

/**
 * Search for Shopify products using Supabase Edge Function
 * This proxies the request to avoid CORS issues
 */
export async function searchProducts(
  query: string,
  limit: number = 10
): Promise<ServiceResponse<ShopifyProductSearchResponse>> {
  try {
    const searchUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-product-search?query=${encodeURIComponent(query)}&limit=${limit}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Product search failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      data: { products: data.products || [], total: data.total || 0 },
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Get product by handle
 * NOTE: This will have CORS issues when called from browser.
 */
export async function getProductByHandle(
  handle: string
): Promise<ServiceResponse<ShopifyProduct>> {
  try {
    const response = await fetch(`${SHOPIFY_STORE_URL}/products/${handle}.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Product fetch failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const product = data.product;

    return {
      data: {
        id: product.id?.toString() || handle,
        handle: product.handle || handle,
        title: product.title || '',
        url: `${SHOPIFY_STORE_URL}/products/${product.handle}`,
        price: product.variants?.[0]?.price || '',
        vendor: product.vendor || '',
        product_type: product.product_type || '',
        image_url: product.images?.[0]?.src || '',
        description: product.body_html || '',
        available: product.variants?.some((v: any) => v.available) || false,
        product_id: product.id,
      },
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Publish blog to Shopify using Supabase Edge Function
 */
export async function publishBlogToShopify(
  request: ShopifyPublishRequest
): Promise<ServiceResponse<ShopifyPublishResponse>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-publish-blog`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blog publish failed: ${response.status} ${errorText}`);
    }

    const data: ShopifyPublishResponse = await response.json();
    return {
      data,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error publishing blog to Shopify:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Update published blog on Shopify using Supabase Edge Function
 */
export async function updateBlogOnShopify(
  articleId: number,
  request: ShopifyPublishRequest
): Promise<ServiceResponse<ShopifyPublishResponse>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-publish-blog`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ ...request, articleId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blog update failed: ${response.status} ${errorText}`);
    }

    const data: ShopifyPublishResponse = await response.json();
    return {
      data,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error updating blog on Shopify:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Unpublish/delete blog from Shopify using Supabase Edge Function
 */
export async function unpublishBlogFromShopify(
  articleId: number
): Promise<ServiceResponse<void>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-publish-blog`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ articleId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blog deletion failed: ${response.status} ${errorText}`);
    }

    return {
      data: null,
      error: null,
      success: true
    };
  } catch (error) {
    console.error('Error unpublishing blog from Shopify:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

// ============================================================================
// GraphQL API Functions
// ============================================================================

/**
 * Helper function to make GraphQL requests to Shopify Admin API
 */
async function shopifyGraphQLRequest<T>(query: string): Promise<ServiceResponse<T>> {
  try {
    const endpoint = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return {
      data: result.data as T,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('GraphQL request error:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Fetch all blogs from Shopify using Supabase Edge Function
 */
export async function fetchShopifyBlogs(
  limit: number = 10
): Promise<ServiceResponse<ShopifyBlogsResponse>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-blogs?limit=${limit}`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Shopify blogs: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      data: {
        blogs: data.blogs || [],
        total: data.total || 0,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error fetching Shopify blogs:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Search for related blog articles by topic/keyword
 * This fetches articles and filters by content relevance
 */
export async function searchRelatedBlogArticles(
  searchTerm: string,
  limit: number = 10
): Promise<ServiceResponse<ShopifyArticlesResponse>> {
  const query = `
    query {
      articles(first: ${limit}, query: "${searchTerm}") {
        nodes {
          id
          title
          handle
          publishedAt
          tags
          blog {
            id
            title
            handle
          }
        }
      }
    }
  `;

  const response = await shopifyGraphQLRequest<{
    articles: { nodes: ShopifyBlogArticle[] }
  }>(query);

  if (!response.success || !response.data) {
    return {
      data: null,
      error: response.error,
      success: false,
    };
  }

  return {
    data: {
      articles: response.data.articles.nodes.map(article => ({
        ...article,
        content: '',
        excerpt: '',
      })),
      total: response.data.articles.nodes.length,
    },
    error: null,
    success: true,
  };
}

/**
 * Fetch articles from a specific blog by blog ID
 */
export async function fetchBlogArticlesById(
  blogId: string,
  limit: number = 10
): Promise<ServiceResponse<ShopifyArticlesResponse>> {
  const query = `
    query {
      blog(id: "${blogId}") {
        articles(first: ${limit}) {
          nodes {
            id
            title
            handle
            publishedAt
            tags
            blog {
              id
              title
              handle
            }
          }
        }
      }
    }
  `;

  const response = await shopifyGraphQLRequest<{
    blog: { articles: { nodes: ShopifyBlogArticle[] } }
  }>(query);

  if (!response.success || !response.data) {
    return {
      data: null,
      error: response.error,
      success: false,
    };
  }

  return {
    data: {
      articles: response.data.blog.articles.nodes.map(article => ({
        ...article,
        content: '',
        excerpt: '',
      })),
      total: response.data.blog.articles.nodes.length,
    },
    error: null,
    success: true,
  };
}

/**
 * Generate related blog links for AI agent embedding
 * Returns formatted markdown links for blog content
 * Uses Supabase Edge Function to avoid CORS issues
 */
export async function generateRelatedBlogLinks(
  topic: string,
  limit: number = 5
): Promise<ServiceResponse<Array<{ title: string; url: string; markdown: string }>>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-blog-articles?topic=${encodeURIComponent(topic)}&limit=${limit}`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      data: data.links || [],
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error generating related blog links:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Fetch all published blogs from Shopify
 * Uses Supabase Edge Function to avoid CORS issues
 */
export async function fetchPublishedBlogs(
  limit: number = 50
): Promise<ServiceResponse<ShopifyArticlesResponse>> {
  try {
    const edgeFunctionUrl = `${SUPABASE_EDGE_FUNCTION_URL}/shopify-published-blogs?limit=${limit}`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch published blogs: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    return {
      data: {
        articles: data.articles || [],
        total: data.total || 0,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
