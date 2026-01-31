import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SHOPIFY_STORE_URL = 'https://mcgrocer-com.myshopify.com';

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  url: string;
  price: string;
  vendor: string;
  product_type: string;
  type: string;
  image: string;
  body: string;
  available: boolean;
  tags?: string[];
  featured_image?: {
    url: string;
    alt: string;
  };
}

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
    // Parse query parameters
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Call Shopify's search suggest API
    const shopifyUrl = `${SHOPIFY_STORE_URL}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=${limit}`;

    console.log('Fetching from Shopify:', shopifyUrl);

    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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

    const rawData = await shopifyResponse.json();

    // Parse Shopify's nested response structure
    const shopifyProducts: ShopifyProduct[] = rawData.resources?.results?.products || [];

    // Transform to our product format - lean payload for AI context
    const products = shopifyProducts.map((p) => {
      const handle = p.url?.split('/products/')[1]?.split('?')[0] || '';

      return {
        title: p.title || '',
        url: `${SHOPIFY_STORE_URL}${p.url || ''}`,
        handle,
        image_url: p.image || p.featured_image?.url || '',
        product_type: p.product_type || p.type || '',
      };
    });

    console.log(`Found ${products.length} products for query: ${query}`);

    return new Response(
      JSON.stringify({
        products,
        total: products.length,
        query,
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
    console.error('Error in shopify-product-search:', error);

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
