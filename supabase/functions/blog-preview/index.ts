import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper to escape HTML entities for safe rendering
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to strip HTML tags for meta description
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Generate the full HTML page with SEO meta tags
function generateHtmlPage(blog: {
  id: string;
  title: string;
  meta_title: string;
  meta_description: string;
  content: string;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  primary_keyword?: string | null;
  created_at: string;
  updated_at: string;
  persona?: { name: string; role: string } | null;
}, baseUrl: string): string {
  const canonicalUrl = `${baseUrl}/functions/v1/blog-preview/${blog.id}`;
  const title = escapeHtml(blog.meta_title || blog.title);
  const description = escapeHtml(blog.meta_description || stripHtml(blog.content).substring(0, 160));
  const image = blog.featured_image_url || '';
  const imageAlt = escapeHtml(blog.featured_image_alt || title);
  const author = blog.persona?.name || 'McGrocer';
  const keywords = blog.primary_keyword ? escapeHtml(blog.primary_keyword) : '';
  const publishedDate = new Date(blog.created_at).toISOString();
  const modifiedDate = new Date(blog.updated_at).toISOString();

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  ${keywords ? `<meta name="keywords" content="${keywords}">` : ''}
  <meta name="author" content="${escapeHtml(author)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  <meta property="og:site_name" content="McGrocer">
  <meta property="og:locale" content="en_GB">
  <meta property="article:published_time" content="${publishedDate}">
  <meta property="article:modified_time" content="${modifiedDate}">
  <meta property="article:author" content="${escapeHtml(author)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ''}
  ${image ? `<meta name="twitter:image:alt" content="${imageAlt}">` : ''}

  <!-- Canonical (self-referencing) -->
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:url" content="${canonicalUrl}">

  <!-- Favicon -->
  <link rel="icon" type="image/png" href="https://mcgrocer.com/favicon.ico">

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }
    .preview-banner {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-size: 14px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .preview-banner a {
      color: #fef08a;
      text-decoration: underline;
    }
    header {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 40px 20px;
      text-align: center;
    }
    header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: #0f172a;
      max-width: 800px;
      margin: 0 auto 16px;
      line-height: 1.2;
    }
    .meta-info {
      color: #64748b;
      font-size: 14px;
    }
    .meta-info span { margin: 0 8px; }
    .featured-image {
      width: 100%;
      max-height: 500px;
      object-fit: cover;
    }
    article {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    article h2 {
      font-size: 1.75rem;
      font-weight: 600;
      color: #0f172a;
      margin: 32px 0 16px;
    }
    article h3 {
      font-size: 1.35rem;
      font-weight: 600;
      color: #1e293b;
      margin: 24px 0 12px;
    }
    article p {
      margin-bottom: 16px;
      color: #334155;
    }
    article ul, article ol {
      margin: 16px 0;
      padding-left: 24px;
    }
    article li {
      margin-bottom: 8px;
      color: #334155;
    }
    article a {
      color: #6366f1;
      text-decoration: underline;
    }
    article img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 20px 0;
    }
    article strong { font-weight: 600; }
    article em { font-style: italic; }
    .seo-debug {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      margin: 40px auto;
      max-width: 800px;
      font-size: 13px;
    }
    .seo-debug h3 {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
    }
    .seo-debug table {
      width: 100%;
      border-collapse: collapse;
    }
    .seo-debug td {
      padding: 6px 0;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .seo-debug td:first-child {
      font-weight: 500;
      color: #64748b;
      width: 140px;
    }
    .seo-debug td:last-child {
      color: #334155;
      word-break: break-word;
    }
    footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 30px 20px;
      text-align: center;
      color: #64748b;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="preview-banner">
    SEO Preview Mode - Use <a href="https://yoast.com/tools/seo-checker/" target="_blank">Yoast SEO Checker</a> to analyze this page
  </div>

  <header>
    <h1>${title}</h1>
    <div class="meta-info">
      <span>By ${escapeHtml(author)}</span>
      <span>|</span>
      <span>${new Date(blog.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </div>
  </header>

  ${image ? `<img src="${image}" alt="${imageAlt}" class="featured-image">` : ''}

  <article>
    ${blog.content}
  </article>

  <div class="seo-debug">
    <h3>SEO Meta Data (for debugging)</h3>
    <table>
      <tr><td>Title</td><td>${title} (${blog.meta_title?.length || 0} chars)</td></tr>
      <tr><td>Description</td><td>${description} (${blog.meta_description?.length || 0} chars)</td></tr>
      <tr><td>Primary Keyword</td><td>${keywords || 'Not set'}</td></tr>
      <tr><td>Author</td><td>${escapeHtml(author)}</td></tr>
      <tr><td>Featured Image</td><td>${image ? 'Yes' : 'No'}</td></tr>
      <tr><td>Word Count</td><td>${stripHtml(blog.content).split(/\s+/).length}</td></tr>
    </table>
  </div>

  <footer>
    <p>McGrocer Blog Preview - This page is for SEO testing purposes only</p>
  </footer>
</body>
</html>`;
}

// Generate error page
function generateErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #334155;
    }
    .error-box {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    h1 { color: #ef4444; margin-bottom: 16px; }
    p { margin: 0; }
  </style>
</head>
<body>
  <div class="error-box">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      generateErrorPage('Method Not Allowed', 'Only GET requests are supported'),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    // Extract blog ID from URL path: /blog-preview/{id}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const blogId = pathParts[pathParts.length - 1];

    if (!blogId || blogId === 'blog-preview') {
      return new Response(
        generateErrorPage('Blog ID Required', 'Please provide a blog ID in the URL: /blog-preview/{blog-id}'),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(blogId)) {
      return new Response(
        generateErrorPage('Invalid Blog ID', 'The provided blog ID is not a valid UUID format'),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Blog Preview] Missing Supabase credentials');
      return new Response(
        generateErrorPage('Configuration Error', 'Server is not properly configured'),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the blog with persona data
    const { data: blog, error } = await supabase
      .from('blogger_blogs')
      .select(`
        id,
        title,
        content,
        meta_title,
        meta_description,
        featured_image_url,
        featured_image_alt,
        primary_keyword,
        created_at,
        updated_at,
        persona:blogger_personas(name, role)
      `)
      .eq('id', blogId)
      .single();

    if (error || !blog) {
      console.error('[Blog Preview] Database error:', error);
      return new Response(
        generateErrorPage('Blog Not Found', `No blog found with ID: ${blogId}`),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Generate and return the HTML page
    const html = generateHtmlPage(blog, supabaseUrl);

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[Blog Preview] Error:', error);
    return new Response(
      generateErrorPage('Server Error', error instanceof Error ? error.message : 'An unexpected error occurred'),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
});
