import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SHOPIFY_STORE_URL = 'https://mcgrocer-com.myshopify.com';
const SHOPIFY_API_VERSION = '2024-10';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Get API key from environment
    const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
    if (!SHOPIFY_API_KEY) {
      throw new Error('SHOPIFY_API_KEY environment variable not set');
    }

    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const blogId = url.searchParams.get('blog_id');  // Optional: filter by blog ID

    console.log('Fetching draft blogs from Shopify using REST API...');

    // First, fetch all blogs to get their titles and handles
    const blogsResponse = await fetch(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/blogs.json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_API_KEY,
        },
      }
    );

    let blogMap: Record<number, { title: string; handle: string }> = {};
    if (blogsResponse.ok) {
      const blogsResult = await blogsResponse.json();
      const blogs = blogsResult.blogs || [];
      blogs.forEach((blog: any) => {
        blogMap[blog.id] = { title: blog.title, handle: blog.handle };
      });
      console.log(`Loaded ${Object.keys(blogMap).length} blogs for mapping`);
    }

    // Use REST API to fetch draft articles (GraphQL doesn't support filtering by published_status)
    let restEndpoint = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/articles.json?published_status=unpublished&limit=${limit}`;

    if (blogId) {
      restEndpoint = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/blogs/${blogId}/articles.json?published_status=unpublished&limit=${limit}`;
    }

    const shopifyResponse = await fetch(restEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_API_KEY,
      },
    });

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error('Shopify API error:', errorText);
      return new Response(
        JSON.stringify({
          error: `Shopify API error: ${shopifyResponse.status}`,
          details: errorText
        }),
        {
          status: shopifyResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const result = await shopifyResponse.json();
    const articles = result.articles || [];

    // Transform to our format (REST API returns different structure than GraphQL)
    const draftBlogs = articles.map((article: any) => {
      // Extract excerpt from body_html if available (first 200 chars)
      let excerpt = '';
      if (article.body_html) {
        // Strip HTML tags for excerpt
        const textContent = article.body_html.replace(/<[^>]*>/g, '').trim();
        excerpt = textContent.substring(0, 200);
        if (textContent.length > 200) excerpt += '...';
      }

      // Get blog info from our map
      const blogInfo = blogMap[article.blog_id] || { title: 'Unknown', handle: '' };

      return {
        id: `gid://shopify/Article/${article.id}`,
        numericId: article.id,
        title: article.title,
        handle: article.handle,
        excerpt: excerpt,
        content: article.body_html || '',
        url: `${SHOPIFY_STORE_URL}/blogs/${blogInfo.handle}/${article.handle}`,
        publishedAt: article.published_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
        tags: article.tags ? article.tags.split(',').map((t: string) => t.trim()) : [],
        image: article.image ? {
          url: article.image.src,
          altText: article.image.alt || ''
        } : null,
        author: { name: article.author },
        blog: {
          id: `gid://shopify/Blog/${article.blog_id}`,
          title: blogInfo.title,
          handle: blogInfo.handle
        },
        status: 'draft',
      };
    });

    console.log(`Found ${draftBlogs.length} draft articles`);

    return new Response(
      JSON.stringify({
        articles: draftBlogs,
        total: draftBlogs.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in shopify-published-blogs:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
