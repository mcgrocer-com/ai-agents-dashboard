/**
 * TypeScript type definitions for Blogger feature
 * Maps to Supabase database schema
 */

// ============================================================================
// Database Types
// ============================================================================

/**
 * Persona context data stored in JSONB
 */
export interface PersonaContextData {
  years_experience: number;
  location: string;
  background?: string;
  credentials?: string;
  writing_style: string;
  specialty?: string;
  methodology: string;
  purpose: string;
  career_milestone: string;
  best_templates: string[];
}

/**
 * Writer persona for E-E-A-T compliance
 */
export interface BloggerPersona {
  id: string;
  name: string;
  role: string;
  bio: string;
  expertise: string;
  context_data: PersonaContextData;
  created_at: string;
  updated_at: string;
}

/**
 * Blog template with structure and AI prompts
 */
export interface BloggerTemplate {
  id: string;
  name: string;
  description: string;
  h1_template: string;
  content_structure: string;
  seo_rules: string;
  prompt_template: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Keyword competition level
 */
export type KeywordCompetition = 'low' | 'medium' | 'high';

/**
 * Keyword search intent
 */
export type KeywordIntent = 'transactional' | 'informational' | 'navigational';

/**
 * Cached keyword research data
 */
export interface BloggerKeyword {
  id: string;
  keyword: string;
  topic: string;
  search_volume: number | null;
  cpc: number | null;
  competition: KeywordCompetition | null;
  intent: KeywordIntent | null;
  user_id: string | null;
  created_at: string;
}

/**
 * Blog post status
 */
export type BlogStatus = 'draft' | 'published' | 'archived';

/**
 * Complete blog post with metadata
 */
export interface BloggerBlog {
  id: string;
  user_id: string;
  persona_id: string;
  template_id: string;
  primary_keyword_id: string | null;
  title: string;
  slug: string;
  content: string;
  markdown_content: string | null;
  meta_title: string;
  meta_description: string;
  status: BlogStatus;
  shopify_article_id: number | null;
  shopify_blog_id: number | null;
  published_at: string | null;
  seo_score: number | null;
  readability_score: number | null;
  word_count: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Product association for internal linking
 */
export interface BloggerBlogProduct {
  id: string;
  blog_id: string;
  product_handle: string;
  product_title: string;
  product_url: string;
  image_url: string | null;
  position: number | null;
  created_at: string;
}

// ============================================================================
// Extended Types with Relationships
// ============================================================================

/**
 * Blog with expanded persona and template
 */
export interface BlogWithRelations extends BloggerBlog {
  persona?: BloggerPersona;
  template?: BloggerTemplate;
  primary_keyword?: BloggerKeyword;
  products?: BloggerBlogProduct[];
}

// ============================================================================
// Form & UI Types
// ============================================================================

/**
 * Blog creation wizard step
 */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Blog creation form data
 */
export interface BlogFormData {
  // Step 1: Topic Input
  topic: string;
  description: string;

  // Step 2: Persona Selection
  persona_id: string;

  // Step 3: Template Selection
  template_id: string;

  // Step 4: Keyword Research
  primary_keyword: string;
  keywords: string[];

  // Step 5: Meta Data
  meta_title: string;
  meta_description: string;

  // Step 6: Content
  content: string;
  markdown_content?: string;

  // Step 7: SEO
  seo_score?: number;
  readability_score?: number;

  // Step 8: Images & Links
  selected_products: BloggerBlogProduct[];

  // Step 9: Publish
  status: BlogStatus;
}

/**
 * Blog filters for dashboard
 */
export interface BlogFilters {
  status?: BlogStatus | 'all';
  persona_id?: string;
  template_id?: string;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
}

// ============================================================================
// External API Types (Railway Backend)
// ============================================================================

/**
 * External API response for keyword research
 */
export interface KeywordResearchResponse {
  keywords: Array<{
    keyword: string;
    search_volume: number;
    competition: KeywordCompetition;
    cpc: number;
    intent: KeywordIntent;
  }>;
}

/**
 * External API response for meta data generation
 */
export interface MetaDataResponse {
  meta_title: string;
  meta_description: string;
  suggested_h1: string;
}

/**
 * External API request for blog content generation
 */
export interface GenerateBlogRequest {
  topic: string;
  persona_id: string;
  template_id: string;
  keywords: string[];
  products?: string[];
}

/**
 * External API response for blog content generation
 */
export interface GenerateBlogResponse {
  content: string;
  markdown: string;
  word_count: number;
  estimated_seo_score: number;
  estimated_readability: number;
}

/**
 * Shopify product search result
 */
export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  url: string;
  price?: string;
  vendor?: string;
  product_type?: string;
  image_url?: string;
  description?: string;
  available?: boolean;
  product_id?: number;
}

/**
 * Shopify product search response
 */
export interface ShopifyProductSearchResponse {
  products: ShopifyProduct[];
  total: number;
}

/**
 * Shopify publish request
 */
export interface ShopifyPublishRequest {
  title: string;
  content: string;
  meta_title: string;
  meta_description: string;
  author: string;
  blog_id?: number;
  tags?: string[];
}

/**
 * Shopify publish response
 */
export interface ShopifyPublishResponse {
  article_id: number;
  blog_id: number;
  url: string;
  published_at: string;
}

// ============================================================================
// Service Response Types
// ============================================================================

/**
 * Generic service response wrapper
 */
export interface ServiceResponse<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
