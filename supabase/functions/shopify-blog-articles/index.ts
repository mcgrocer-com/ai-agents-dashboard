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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const topic = url.searchParams.get('topic') || url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '5');

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic parameter is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Build GraphQL query
    const graphqlQuery = `
      query {
        articles(first: ${limit}, query: "${topic}") {
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

    console.log('Fetching related articles for topic:', topic);

    // Call Shopify GraphQL API
    const shopifyResponse = await fetch(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_API_KEY,
        },
        body: JSON.stringify({ query: graphqlQuery }),
      }
    );

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

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      console.error('GraphQL errors:', result.errors);
      return new Response(
        JSON.stringify({
          error: 'GraphQL errors',
          details: result.errors
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Transform to our link format
    const articles = result.data.articles.nodes;
    const links = articles.map((article: any) => {
      const url = `${SHOPIFY_STORE_URL}/blogs/${article.blog.handle}/${article.handle}`;
      return {
        title: article.title,
        url: url,
        markdown: `[${article.title}](${url})`,
        blog: article.blog,
        publishedAt: article.publishedAt,
        tags: article.tags,
      };
    });

    console.log(`Found ${links.length} related articles for topic: ${topic}`);

    return new Response(
      JSON.stringify({
        links,
        total: links.length,
        topic,
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
    console.error('Error in shopify-blog-articles:', error);

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
