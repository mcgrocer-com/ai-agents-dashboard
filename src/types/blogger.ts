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
  avatar_url?: string;
  tone?: string;
  writing_style?: string;
  context_data?: PersonaContextData;
  user_id?: string | null; // null = system persona, UUID = user-created
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
  h1_template?: string;
  content_structure: string;
  seo_rules?: string;
  prompt_template?: string;
  notes?: string | null;
  user_id?: string | null; // null = system template, UUID = user-created
  created_at: string;
  updated_at: string;
}

/**
 * Helper to check if a persona or template is user-created (editable)
 */
export const isUserCreated = (item: { user_id?: string | null }): boolean =>
  item.user_id !== null && item.user_id !== undefined;

/**
 * Keyword competition level
 */
export type KeywordCompetition = 'low' | 'medium' | 'high' | number;

/**
 * Keyword search intent
 */
export type KeywordIntent = 'transactional' | 'informational' | 'navigational' | string;

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
  primary_keyword: string | null; // Primary keyword stored directly as text
  title: string;
  slug: string;
  content: string;
  markdown_content: string | null;
  meta_title: string;
  meta_description: string;
  excerpt: string | null;              // Blog excerpt for listing pages (100-200 chars)
  tags: string[] | null;               // SEO tags for blog categorization
  featured_image_url: string | null;
  featured_image_alt: string | null;
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
  // Note: primary_keyword is now a TEXT column on BloggerBlog, not a relation
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
  featured_image_url?: string;
  featured_image_alt?: string;

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
    volume?: number;
    difficulty?: number;
    search_volume?: number;
    competition?: KeywordCompetition;
    cpc?: number;
    intent?: KeywordIntent;
  }>;
  related_topics?: string[];
}

/**
 * External API response for meta data generation
 */
export interface MetaDataResponse {
  title?: string;
  description?: string;
  keywords?: string[];
  meta_title?: string;
  meta_description?: string;
  suggested_h1?: string;
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
  word_count?: number;
  estimated_seo_score?: number;
  estimated_readability?: number;
  meta?: {
    title: string;
    description: string;
    keywords: string[];
  };
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
  blogId: string;  // Shopify blog ID (e.g., "gid://shopify/Blog/74558931119")
  title: string;
  content: string;
  summary?: string;  // Excerpt/summary for blog listing page (HTML)
  metaTitle?: string;
  metaDescription?: string;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  author?: string;
  tags?: string[];
  publishedAt?: string;  // ISO date string
}

/**
 * Shopify publish response
 */
export interface ShopifyPublishResponse {
  article: {
    id: string;
    title: string;
    handle: string;
    url: string;
    publishedAt: string;
    createdAt: string;
    blog: {
      id: string;
      title: string;
      handle: string;
    };
  };
}

/**
 * Shopify blog from GraphQL API
 */
export interface ShopifyBlog {
  id: string;
  title: string;
  handle: string;
  commentPolicy?: string;
}

/**
 * Shopify blog article from GraphQL API
 */
export interface ShopifyBlogArticle {
  id: string;
  title: string;
  handle: string;
  content: string;
  excerpt?: string;
  publishedAt?: string;
  tags?: string[];
  image?: {
    url: string;
    altText?: string;
  };
  blog?: {
    id: string;
    title: string;
    handle: string;
  };
}

/**
 * Shopify blogs response from GraphQL
 */
export interface ShopifyBlogsResponse {
  blogs: ShopifyBlog[];
  total: number;
}

/**
 * Shopify articles response from GraphQL
 */
export interface ShopifyArticlesResponse {
  articles: ShopifyBlogArticle[];
  total: number;
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

// ============================================================================
// SEO Score Types
// ============================================================================

/**
 * Individual criterion in SEO score breakdown
 */
export interface SeoScoreCriterion {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  message: string;
}

/**
 * SEO score with criteria breakdown
 */
export interface SeoScoreBreakdown {
  score: number;
  maxScore: number;
  criteria: SeoScoreCriterion[];
}

// ============================================================================
// Context File Types
// ============================================================================

/**
 * Supported context file types
 */
export type ContextFileType = 'txt' | 'json' | 'csv' | 'xlsx' | 'pdf' | 'docx';

/**
 * Imported context file for AI generation
 */
export interface ContextFile {
  name: string;
  type: ContextFileType;
  size: number;
  content: string;
  uploadedAt: number;
}

// ============================================================================
// Persona & Template Form Types (for Create/Edit Modals)
// ============================================================================

/**
 * Input type for creating a persona (omits auto-generated fields)
 */
export interface CreatePersonaInput {
  name: string;
  role: string;
  bio: string;
  expertise: string;
  context_data: PersonaContextData;
}

/**
 * Input type for updating a persona (all fields optional)
 */
export type UpdatePersonaInput = Partial<CreatePersonaInput>;

/**
 * Flattened form data for persona create/edit modal
 */
export interface PersonaFormData {
  name: string;
  role: string;
  bio: string;
  expertise: string;
  // Context data fields (flattened for form)
  years_experience: number;
  location: string;
  background: string;
  credentials: string;
  writing_style: string;
  specialty: string;
  methodology: string;
  purpose: string;
  career_milestone: string;
  best_templates: string[];
}

/**
 * Input type for creating a template (omits auto-generated fields)
 */
export interface CreateTemplateInput {
  name: string;
  description: string;
  h1_template: string;
  content_structure: string;
  seo_rules: string;
  prompt_template: string;
  notes?: string | null;
}

/**
 * Input type for updating a template (all fields optional)
 */
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

/**
 * Form data for template create/edit modal
 */
export interface TemplateFormData {
  name: string;
  description: string;
  h1_template: string;
  content_structure: string;
  seo_rules: string;
  prompt_template: string;
  notes: string;
}
