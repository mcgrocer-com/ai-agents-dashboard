import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SHOPIFY_STORE_URL = 'https://mcgrocer-com.myshopify.com';
const SHOPIFY_API_VERSION = '2024-10';

interface PushBlogRequest {
  blogId: string;  // Shopify blog ID (e.g., "gid://shopify/Blog/74558931119")
  title: string;
  content: string;  // HTML content
  summary?: string;  // Excerpt/summary HTML for blog listing page
  metaTitle?: string;
  metaDescription?: string;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  author?: string;
  tags?: string[];
  publishedAt?: string;  // ISO date string, or null for draft
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Handle DELETE request for removing from Shopify
  if (req.method === 'DELETE') {
    try {
      const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
      if (!SHOPIFY_API_KEY) {
        throw new Error('SHOPIFY_API_KEY environment variable not set');
      }

      const { articleId } = await req.json();
      if (!articleId) {
        return new Response(
          JSON.stringify({ error: 'articleId is required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Build GraphQL ID from numeric ID
      const articleGid = `gid://shopify/Article/${articleId}`;

      // GraphQL mutation to delete article
      const graphqlMutation = `
        mutation {
          articleDelete(id: "${articleGid}") {
            deletedArticleId
            userErrors {
              field
              message
            }
          }
        }
      `;

      const shopifyResponse = await fetch(
        `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
          },
          body: JSON.stringify({ query: graphqlMutation }),
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

      if (result.data.articleDelete.userErrors && result.data.articleDelete.userErrors.length > 0) {
        console.error('User errors:', result.data.articleDelete.userErrors);
        return new Response(
          JSON.stringify({
            error: 'Validation errors',
            details: result.data.articleDelete.userErrors
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

      console.log(`✓ Article deleted: ${result.data.articleDelete.deletedArticleId}`);

      return new Response(
        JSON.stringify({
          success: true,
          deletedArticleId: result.data.articleDelete.deletedArticleId,
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
      console.error('Error in articleDelete:', error);
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
  }

  // Handle PUT request for updating existing article
  if (req.method === 'PUT') {
    try {
      const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
      if (!SHOPIFY_API_KEY) {
        throw new Error('SHOPIFY_API_KEY environment variable not set');
      }

      const requestData = await req.json();
      const { articleId, ...updateData } = requestData;

      if (!articleId) {
        return new Response(
          JSON.stringify({ error: 'articleId is required for updates' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      console.log('Updating blog article:', articleId);

      // Build GraphQL ID from numeric ID
      const articleGid = `gid://shopify/Article/${articleId}`;
      const author = updateData.author || 'McGrocer Team';

      // Build metafields array for SEO
      const metafields: string[] = [];
      if (updateData.metaTitle) {
        metafields.push(`{
          namespace: "global"
          key: "title_tag"
          value: "${updateData.metaTitle.replace(/"/g, '\\"')}"
          type: "single_line_text_field"
        }`);
      }
      if (updateData.metaDescription) {
        metafields.push(`{
          namespace: "global"
          key: "description_tag"
          value: "${updateData.metaDescription.replace(/"/g, '\\"')}"
          type: "multi_line_text_field"
        }`);
      }

      const metafieldsInput = metafields.length > 0
        ? `metafields: [${metafields.join(', ')}]`
        : '';

      const graphqlMutation = `
        mutation {
          articleUpdate(
            id: "${articleGid}"
            article: {
              title: "${updateData.title.replace(/"/g, '\\"')}"
              body: ${JSON.stringify(updateData.content)}
              ${updateData.summary ? `summary: ${JSON.stringify(updateData.summary)}` : ''}
              author: {
                name: "${author.replace(/"/g, '\\"')}"
              }
              ${updateData.featuredImageUrl ? `image: {
                url: "${updateData.featuredImageUrl}"
                ${updateData.featuredImageAlt ? `altText: "${updateData.featuredImageAlt.replace(/"/g, '\\"')}"` : ''}
              }` : ''}
              ${updateData.tags && updateData.tags.length > 0 ? `tags: ${JSON.stringify(updateData.tags)}` : ''}
              ${metafieldsInput}
            }
          ) {
            article {
              id
              title
              handle
              summary
              tags
              publishedAt
              updatedAt
              image {
                url
                altText
              }
              metafields(first: 10) {
                nodes {
                  namespace
                  key
                  value
                }
              }
              blog {
                id
                title
                handle
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const shopifyResponse = await fetch(
        `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
          },
          body: JSON.stringify({ query: graphqlMutation }),
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

      if (result.data.articleUpdate.userErrors && result.data.articleUpdate.userErrors.length > 0) {
        console.error('User errors:', result.data.articleUpdate.userErrors);
        return new Response(
          JSON.stringify({
            error: 'Validation errors',
            details: result.data.articleUpdate.userErrors
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

      const article = result.data.articleUpdate.article;
      console.log(`✓ Blog article updated: ${article.handle}`);

      return new Response(
        JSON.stringify({
          success: true,
          article: {
            id: article.id,
            title: article.title,
            handle: article.handle,
            summary: article.summary,
            tags: article.tags,
            url: `${SHOPIFY_STORE_URL}/blogs/${article.blog.handle}/${article.handle}`,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            blog: article.blog,
            metafields: article.metafields?.nodes || [],
          }
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
      console.error('Error in articleUpdate:', error);
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
  }

  try {
    // Get API key from environment
    const SHOPIFY_API_KEY = Deno.env.get('SHOPIFY_API_KEY');
    if (!SHOPIFY_API_KEY) {
      throw new Error('SHOPIFY_API_KEY environment variable not set');
    }

    // Parse request body
    const requestData: PushBlogRequest = await req.json();

    if (!requestData.blogId || !requestData.title || !requestData.content) {
      return new Response(
        JSON.stringify({ error: 'blogId, title, and content are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('Creating blog article as DRAFT:', requestData.title);
    console.log('Fields to set:', {
      summary: requestData.summary ? 'provided' : 'not provided',
      metaTitle: requestData.metaTitle,
      metaDescription: requestData.metaDescription,
      tags: requestData.tags,
    });

    // Build GraphQL mutation for creating blog article
    // Note: SEO fields are set via metafields (global.title_tag and global.description_tag)
    const author = requestData.author || 'McGrocer Team';

    // Build metafields array for SEO
    const metafields: string[] = [];
    if (requestData.metaTitle) {
      metafields.push(`{
        namespace: "global"
        key: "title_tag"
        value: "${requestData.metaTitle.replace(/"/g, '\\"')}"
        type: "single_line_text_field"
      }`);
    }
    if (requestData.metaDescription) {
      metafields.push(`{
        namespace: "global"
        key: "description_tag"
        value: "${requestData.metaDescription.replace(/"/g, '\\"')}"
        type: "multi_line_text_field"
      }`);
    }

    const metafieldsInput = metafields.length > 0
      ? `metafields: [${metafields.join(', ')}]`
      : '';

    const graphqlMutation = `
      mutation {
        articleCreate(
          article: {
            blogId: "${requestData.blogId}"
            title: "${requestData.title.replace(/"/g, '\\"')}"
            body: ${JSON.stringify(requestData.content)}
            ${requestData.summary ? `summary: ${JSON.stringify(requestData.summary)}` : ''}
            author: {
              name: "${author.replace(/"/g, '\\"')}"
            }
            ${requestData.featuredImageUrl ? `image: {
              url: "${requestData.featuredImageUrl}"
              ${requestData.featuredImageAlt ? `altText: "${requestData.featuredImageAlt.replace(/"/g, '\\"')}"` : ''}
            }` : ''}
            ${requestData.tags && requestData.tags.length > 0 ? `tags: ${JSON.stringify(requestData.tags)}` : ''}
            ${metafieldsInput}
            isPublished: false
          }
        ) {
          article {
            id
            title
            handle
            summary
            tags
            publishedAt
            createdAt
            image {
              url
              altText
            }
            metafields(first: 10) {
              nodes {
                namespace
                key
                value
              }
            }
            blog {
              id
              title
              handle
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log('Executing GraphQL mutation...');

    // Call Shopify GraphQL API
    const shopifyResponse = await fetch(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_API_KEY,
        },
        body: JSON.stringify({ query: graphqlMutation }),
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

    // Check for user errors
    if (result.data.articleCreate.userErrors && result.data.articleCreate.userErrors.length > 0) {
      console.error('User errors:', result.data.articleCreate.userErrors);
      return new Response(
        JSON.stringify({
          error: 'Validation errors',
          details: result.data.articleCreate.userErrors
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

    const article = result.data.articleCreate.article;
    console.log(`✓ Blog article created as DRAFT: ${article.handle}`);
    console.log(`✓ Summary: ${article.summary ? 'saved' : 'not set'}`);
    console.log(`✓ Tags: ${article.tags?.join(', ') || 'none'}`);
    console.log(`✓ Metafields saved:`, article.metafields?.nodes || []);

    return new Response(
      JSON.stringify({
        success: true,
        article: {
          id: article.id,
          title: article.title,
          handle: article.handle,
          summary: article.summary,
          tags: article.tags,
          url: `${SHOPIFY_STORE_URL}/blogs/${article.blog.handle}/${article.handle}`,
          publishedAt: article.publishedAt,
          createdAt: article.createdAt,
          blog: article.blog,
          metafields: article.metafields?.nodes || [],
          status: 'draft',
        }
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
    console.error('Error in shopify-push-blog:', error);

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
