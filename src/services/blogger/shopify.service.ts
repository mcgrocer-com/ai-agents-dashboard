/**
 * Blogger Shopify Service
 * Handles Shopify product search and blog publishing
 */

import type {
  ShopifyProduct,
  ShopifyProductSearchResponse,
  ShopifyPublishRequest,
  ShopifyPublishResponse,
  ServiceResponse,
} from '@/types/blogger';

const SHOPIFY_STORE_URL = 'https://mcgrocer-com.myshopify.com';
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
 * Publish blog to Shopify
 * TODO: Implement backend API endpoint with Shopify Admin API credentials
 * This requires Admin API access which cannot be done from the browser
 */
export async function publishBlogToShopify(
  request: ShopifyPublishRequest
): Promise<ServiceResponse<ShopifyPublishResponse>> {
  try {
    // TODO: Replace with actual backend API endpoint
    throw new Error('Backend API for blog publishing not implemented. This requires Shopify Admin API credentials.');

    /* Example implementation when backend is ready:
    const response = await fetch(`/api/shopify/blogs/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Blog publish failed: ${response.status} ${errorText}`);
    }

    const data: ShopifyPublishResponse = await response.json();
    return { data, error: null, success: true };
    */
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
 * Update published blog on Shopify
 * TODO: Implement backend API endpoint with Shopify Admin API credentials
 */
export async function updateBlogOnShopify(
  articleId: number,
  request: ShopifyPublishRequest
): Promise<ServiceResponse<ShopifyPublishResponse>> {
  try {
    // TODO: Replace with actual backend API endpoint
    throw new Error('Backend API for blog updates not implemented. This requires Shopify Admin API credentials.');
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
 * Unpublish/delete blog from Shopify
 * TODO: Implement backend API endpoint with Shopify Admin API credentials
 */
export async function unpublishBlogFromShopify(
  articleId: number
): Promise<ServiceResponse<void>> {
  try {
    // TODO: Replace with actual backend API endpoint
    throw new Error('Backend API for blog deletion not implemented. This requires Shopify Admin API credentials.');
  } catch (error) {
    console.error('Error unpublishing blog from Shopify:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
