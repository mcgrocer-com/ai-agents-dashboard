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
    const limit = parseInt(url.searchParams.get('limit') || '10');

    console.log('Fetching Shopify blogs...');

    // Build GraphQL query
    const graphqlQuery = `
      query {
        blogs(first: ${limit}) {
          nodes {
            id
            title
            handle
            commentPolicy
          }
        }
      }
    `;

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

    const blogs = result.data.blogs.nodes;
    console.log(`Found ${blogs.length} blogs`);

    return new Response(
      JSON.stringify({
        blogs,
        total: blogs.length,
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
    console.error('Error in shopify-blogs:', error);

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
