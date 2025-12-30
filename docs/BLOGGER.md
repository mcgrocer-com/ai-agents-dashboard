# Blogger - AI-Powered Blog Content Generator

## Overview

The Blogger feature is an AI-powered blog content generation platform that creates high-quality, E-E-A-T compliant blog posts for the McGrocer e-commerce website. It combines persona-driven writing, competitive intelligence, and Shopify CMS integration to produce SEO-optimized content.

## Purpose

Generate professional blog content that:
- Drives organic traffic through SEO-optimized articles
- Builds brand authority with E-E-A-T compliant content (Experience, Expertise, Authoritativeness, Trustworthiness)
- Links to McGrocer products for internal SEO and conversions
- Maintains consistent brand voice through writer personas

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLOGGER ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   FRONTEND UI    │    │   AI SERVICES    │    │  EXTERNAL APIs   │       │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤       │
│  │ BloggerCreatePage│───▶│ gemini-content   │───▶│ Google Gemini    │       │
│  │ BloggerDashboard │    │ ai.service       │    │ Decodo (Keywords)│       │
│  │ BloggerDetailPage│    │ shopify.service  │    │ Shopify GraphQL  │       │
│  │ 6-Step Wizard    │    │ seo-validator    │    │ Railway API      │       │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘       │
│           │                      │                        │                  │
│           │                      │                        │                  │
│           ▼                      ▼                        ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      SUPABASE BACKEND                                 │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  blogger_personas │ blogger_templates │ blogger_blogs │ blogger_keywords │
│  │  (6 personas)     │ (9 templates)     │ (user blogs)  │ (cached data)   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6-Step Blog Creation Wizard

### Step 1: Topic Input
Enter the blog topic and optional description. The AI uses this to research keywords and generate content.

### Step 2: Persona Selection
Choose from 6 professionally-crafted writer personas, each with unique expertise:

| Persona | Role | Specialty |
|---------|------|-----------|
| Harriet Greene | Lifestyle & Food Writer | British food culture, nostalgia |
| Alistair Malik | B2B & Supply Chain | Logistics, e-commerce |
| Priya Moore | Food & Cultural Journalist | Multicultural cuisine, fusion |
| Lola Adeyemi | SEO & Content Marketing | Keyword optimization, SERP strategy |
| Nathan White | Investigative Journalist | Consumer ethics, sustainability |
| Dr. Emily Francis | Health & Wellness Writer | Nutrition science, dietary needs |

### Step 3: Template Selection
Choose from 9 blog templates with pre-defined structures:

| Template | Purpose | Structure |
|----------|---------|-----------|
| How-to Post | Step-by-step guides | Intro → Tools → Steps → Tips → CTA |
| List Post | Top N recommendations | Intro → Items → Selection Guide → CTA |
| Beginner's Guide | Newcomer introduction | What/Why → Concepts → Getting Started → FAQ |
| Review Post | Product/service review | Overview → Pros/Cons → Testing → Verdict |
| Statistics Post | Data-driven insights | Trends → Charts → Analysis → Takeaways |
| Response Post | Expert response | Context → Breakdown → Evidence → Thoughts |
| Ultimate Guide | Comprehensive resource | History → Subtopics → Best Practices → FAQ |
| Case Study | Real-world example | Challenge → Solution → Results → Lessons |
| Comparison Post | Side-by-side comparison | Options → Comparison → Choice Guide → Verdict |

### Step 4: Content Generation
AI generates the blog content using:
1. **Keyword Research** - Discovers high-value keywords via Decodo Google Suggest
2. **Competitive Intelligence** - Scrapes top-ranking articles for insights
3. **Product Integration** - Searches McGrocer products for internal linking
4. **Content Generation** - Gemini AI writes persona-driven content
5. **SEO Validation** - Iterative fixes for meta tags, headings, links

### Step 5: SEO Optimization
Fine-tune SEO elements:
- Meta title (50-60 characters)
- Meta description (140-160 characters)
- Primary keyword placement
- Internal links to McGrocer products
- Real-time SEO score (0-100)
- Readability score (Flesch Reading Ease)

### Step 6: Publish
- Save as draft in Supabase
- Publish directly to Shopify CMS
- Update existing Shopify articles

## Services

### Frontend Services (`src/services/blogger/`)

| Service | Purpose |
|---------|---------|
| `gemini-content.service.ts` | Main AI content generation with function calling |
| `ai.service.ts` | Keyword research, article scraping, SEO scoring |
| `shopify.service.ts` | Shopify product search and blog publishing |
| `seo-validator.service.ts` | SEO validation and auto-fixing |
| `blogs.service.ts` | CRUD operations for blogs |
| `personas.service.ts` | Persona management |
| `templates.service.ts` | Template management |
| `keywords.service.ts` | Keyword caching |
| `images.service.ts` | Image rehosting to Supabase Storage |
| `system-prompt.ts` | Dynamic system prompt builder |

### Edge Functions (`supabase/functions/`)

| Function | Purpose | API Docs |
|----------|---------|----------|
| `shopify-product-search` | Search McGrocer products | [README](../supabase/functions/shopify-product-search/README.md) |
| `shopify-blogs` | List Shopify blogs | [README](../supabase/functions/shopify-blogs/README.md) |
| `shopify-blog-articles` | List blog articles | [README](../supabase/functions/shopify-blog-articles/README.md) |
| `shopify-push-blog` | Publish to Shopify | [README](../supabase/functions/shopify-push-blog/README.md) |
| `decodo-proxy` | Keyword research via Google Suggest | [README](../supabase/functions/decodo-proxy/README.md) |
| `scrape-article` | Scrape competitor articles | [README](../supabase/functions/scrape-article/README.md) |
| `blog-preview` | Generate preview HTML | [README](../supabase/functions/blog-preview/README.md) |

## AI Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI CONTENT GENERATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. KEYWORD RESEARCH                                                         │
│     ├── Call Decodo Google Suggest API                                       │
│     ├── Get relevance scores (0-1250)                                        │
│     └── Select primary keyword                                               │
│                                                                              │
│  2. COMPETITIVE INTELLIGENCE                                                 │
│     ├── Search UK Google for top articles                                    │
│     ├── Scrape 3-10 articles in parallel                                     │
│     ├── Extract content, headings, word counts                               │
│     └── Analyze competitor strategies                                        │
│                                                                              │
│  3. PRODUCT SEARCH                                                           │
│     ├── Search McGrocer Shopify catalog                                      │
│     ├── Find relevant products (3-5 queries)                                 │
│     └── Get URLs for internal linking                                        │
│                                                                              │
│  4. CONTENT GENERATION                                                       │
│     ├── Build system prompt with persona + template                          │
│     ├── Include competitor insights                                          │
│     ├── Generate HTML content (1500+ words)                                  │
│     └── Embed product links naturally                                        │
│                                                                              │
│  5. SEO VALIDATION (Iterative)                                               │
│     ├── Check meta title/description length                                  │
│     ├── Verify keyword placement                                             │
│     ├── Validate heading hierarchy (no H1, H2→H3→H4)                         │
│     ├── Count internal links                                                 │
│     └── Auto-fix issues (up to 10 iterations)                                │
│                                                                              │
│  6. OUTPUT                                                                   │
│     ├── HTML content                                                         │
│     ├── Markdown version                                                     │
│     ├── Meta title & description                                             │
│     ├── Excerpt (100-200 chars)                                              │
│     ├── Tags (3-6)                                                           │
│     ├── SEO score                                                            │
│     └── Processing logs                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Keyword Research System

The keyword research system uses Google Suggest via the Decodo API to discover high-value keywords.

### Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KEYWORD RESEARCH PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER INPUT                                                               │
│     └── Topic: "baby oil"                                                    │
│                                                                              │
│  2. DECODO GOOGLE SUGGEST API                                                │
│     ├── Call: POST /functions/v1/decodo-proxy                                │
│     ├── Target: google_suggest                                               │
│     └── Parse: false (get raw response with scores)                          │
│                                                                              │
│  3. RESPONSE PARSING                                                         │
│     ├── [0] Original query: "baby oil"                                       │
│     ├── [1] Suggestions: ["baby oil", "baby oil for skin", ...]              │
│     └── [4] Relevance scores: {"google:suggestrelevance": [1250, 601, ...]}  │
│                                                                              │
│  4. SCORE CONVERSION                                                         │
│     ├── Relevance: 0-1250 (higher = more popular/trending)                   │
│     ├── Difficulty: 100 - (relevance / 10) (lower = easier to rank)          │
│     └── Volume proxy: Use relevance score as search volume indicator         │
│                                                                              │
│  5. OUTPUT                                                                   │
│     └── [{keyword, volume, difficulty}, ...]                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Relevance Score Interpretation

| Score Range | Meaning | SEO Difficulty |
|-------------|---------|----------------|
| 1000-1250 | Very high relevance (trending/popular) | Low (0-20) |
| 600-999 | High relevance | Medium (20-50) |
| 300-599 | Moderate relevance | Medium-High (50-75) |
| 0-299 | Lower relevance | High (75-100) |

### Implementation

```javascript
// ai.service.ts - researchKeywords()
const response = await callDecodoProxy({
  target: 'google_suggest',
  query: topic,
  parse: false  // Get raw response with relevance scores
});

// Parse response
const contentArray = JSON.parse(data.results[0].content);
const suggestions = contentArray[1];  // Keyword suggestions
const relevanceScores = contentArray[4]?.['google:suggestrelevance'] || [];

// Convert to keyword objects
keywords = suggestions.map((suggestion, index) => ({
  keyword: suggestion,
  volume: relevanceScores[index] || 0,  // Use relevance as volume proxy
  difficulty: Math.round(100 - (relevanceScores[index] / 10))
}));
```

---

## Competitive Article Scraping

The system scrapes top-ranking articles to analyze competitor content strategies.

### Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ARTICLE SCRAPING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. GOOGLE SEARCH (via Decodo)                                               │
│     ├── Query: "{keyword} article" (focuses on editorial content)            │
│     ├── Target: google_search                                                │
│     ├── Region: UK (gl: 'uk', domain: google.co.uk)                          │
│     └── Date filter: qdr:y (past year for freshness)                         │
│                                                                              │
│  2. CACHE CHECK (scraped_articles_cache table)                               │
│     ├── Hash URL → Check for non-expired entry                               │
│     ├── HIT: Return cached content, increment hit_count                      │
│     └── MISS: Proceed to scraping                                            │
│                                                                              │
│  3. DECODO WEB SCRAPER                                                       │
│     ├── Fetch raw HTML with anti-bot bypass                                  │
│     ├── Desktop user agent                                                   │
│     └── Returns full page HTML                                               │
│                                                                              │
│  4. GEMINI LLM EXTRACTION                                                    │
│     ├── Pre-clean: Remove scripts, styles, SVGs, comments                    │
│     ├── Limit to ~100KB to stay within token limits                          │
│     ├── Extract: title, text, headings, summary                              │
│     └── Separate regex extraction for images (LLM misses these)              │
│                                                                              │
│  5. CACHE STORE                                                              │
│     ├── Store extracted content                                              │
│     ├── TTL: 7 days                                                          │
│     └── Upsert on URL conflict                                               │
│                                                                              │
│  6. FALLBACK (if Decodo fails)                                               │
│     └── Stagehand on RunPod (if VITE_RUNPOD_API_URL configured)              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Schema

```sql
scraped_articles_cache (
  id UUID PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  url_hash TEXT NOT NULL,          -- Fast lookup hash
  title TEXT,
  text TEXT,                        -- Extracted article content
  headings TEXT[],                  -- Section headings array
  summary TEXT,                     -- AI-generated summary
  word_count INTEGER,
  html_size INTEGER,
  scrape_duration_ms INTEGER,
  extract_duration_ms INTEGER,
  images JSONB,                     -- [{src, alt, caption, summary}]
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,           -- TTL: 7 days
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
)
```

### Image Extraction

Images are extracted separately from LLM processing (LLM tends to miss them):

1. **Priority 1**: Extract from `<figure>` tags (usually article images with captions)
2. **Priority 2**: Extract from standalone `<img>` tags
3. **Filter out**: logos, icons, avatars, tracking pixels
4. **Limit**: Maximum 10 images per article

### Batch Processing

```javascript
// scrapeArticlesBatch() - Parallel processing
const results = await Promise.all(
  urls.map(url => scrapeWithDecodo(url))
);

// Returns: { url, title, text, wordCount, headings, images, success, cached }
```

---

## SEO Grading System

The SEO validator uses AI agents to validate and fix content for Yoast SEO compliance.

### Grading Scale

| Grade | Score | Description |
|-------|-------|-------------|
| **A** | 90-100 | Excellent - Fully optimized |
| **B** | 80-89 | Good - Minor improvements possible |
| **C** | 70-79 | Average - Needs optimization |
| **D** | 60-69 | Below average - Significant issues |
| **F** | 0-59 | Failing - Major problems |

### Issue Severity & Point Deductions

| Severity | Point Deduction | Examples |
|----------|-----------------|----------|
| **Critical** | -25 points | Empty meta title, AI self-introduction in content |
| **Error** | -15 points | Title too long, missing keyword, placeholder links |
| **Warning** | -5 points | Excerpt too short, missing alt text |
| **Info** | -1 point | Suggestions for improvement |

### Validation Categories

| Category | What's Checked | AI Agent Validates |
|----------|----------------|---------------------|
| **Title** | Length (50-60 chars), keyword inclusion, readability | ✓ |
| **Description** | Length (140-160 chars), keyword, CTA, no AI patterns | ✓ |
| **Excerpt** | Length (100-200 chars), uniqueness from description | ✓ |
| **Headings** | No H1, sequential hierarchy (H2→H3→H4), no empty | ✓ |
| **Links** | No placeholders (#, PRODUCT_URL), external rel="nofollow" | ✓ |
| **Images** | Alt text present and descriptive | ✓ |
| **AI Content** | No self-intro, no reasoning leaks, no meta bleed | ✓ |
| **Tags** | 3-7 relevant tags, includes primary keyword | ✓ |

### AI Content Detection Patterns

The validator detects and flags these AI-generated patterns:

**Critical (Must Remove):**
- Self-introduction: "I am a writer/blogger", "My name is...", "With X years of experience"
- AI reasoning: "I selected this keyword because...", "Based on my analysis..."
- Meta bleed: "Selected keyword: ...", "SEO Strategy: ...", "Word count: ..."

**Warning (Should Improve):**
- Weak openings: "In this article, we will...", "Let's dive into..."
- Generic phrases: "This blog post covers...", "Here's what you need to know..."

### Iterative Fix Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SEO FIX ITERATION LOOP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Initial Validation                                                          │
│     └── Score: 65/100 (Grade: D)                                             │
│                                                                              │
│  Iteration 1                                                                 │
│     ├── Issues: Title too long, missing keyword in description               │
│     ├── AI Fix Agent: Generate fixes                                         │
│     ├── Apply fixes                                                          │
│     └── Re-validate: Score 78/100 (Grade: C)                                 │
│                                                                              │
│  Iteration 2                                                                 │
│     ├── Issues: External links missing nofollow                              │
│     ├── AI Fix Agent: Add rel="nofollow" to external links                   │
│     ├── Apply content fixes                                                  │
│     └── Re-validate: Score 92/100 (Grade: A) ✓                               │
│                                                                              │
│  STOP: Target score (90+) achieved                                           │
│                                                                              │
│  Configuration:                                                              │
│     ├── Max iterations: 5-10 (user configurable)                             │
│     ├── Target score: 90 (Grade A)                                           │
│     └── Best version tracking (prevents score regression)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Score Calculation

```javascript
// seo-validator.service.ts
calculateScore(): number {
  let score = 100;
  for (const issue of this.issues) {
    switch (issue.severity) {
      case 'critical': score -= 25; break;
      case 'error': score -= 15; break;
      case 'warning': score -= 5; break;
      case 'info': score -= 1; break;
    }
  }
  return Math.max(0, score);
}
```

### Readability Score (Flesch Reading Ease)

The system also calculates readability using an approximation of the Flesch Reading Ease formula:

```javascript
// Score = 206.835 - (1.015 × avg words per sentence) - (84.6 × avg syllables per word)
// Normalized to 0-100 where higher = easier to read

| Score | Difficulty | Grade Level |
|-------|------------|-------------|
| 90-100 | Very Easy | 5th grade |
| 80-89 | Easy | 6th grade |
| 70-79 | Fairly Easy | 7th grade |
| 60-69 | Standard | 8th-9th grade |
| 50-59 | Fairly Difficult | 10th-12th grade |
| 30-49 | Difficult | College |
| 0-29 | Very Difficult | College graduate |
```

---

## Database Schema

### Tables

```sql
-- Writer personas (6 pre-seeded)
blogger_personas (
  id, name, role, bio, expertise, context_data, user_id
)

-- Blog templates (9 pre-seeded)
blogger_templates (
  id, name, description, h1_template, content_structure,
  seo_rules, prompt_template, notes, user_id
)

-- Cached keyword research
blogger_keywords (
  id, keyword, topic, search_volume, cpc, competition, intent, user_id
)

-- Blog posts
blogger_blogs (
  id, user_id, persona_id, template_id, primary_keyword,
  title, slug, content, markdown_content,
  meta_title, meta_description, excerpt, tags,
  featured_image_url, featured_image_alt,
  status, shopify_article_id, shopify_blog_id, published_at,
  seo_score, readability_score, word_count
)

-- Product associations
blogger_blog_products (
  id, blog_id, product_handle, product_title, product_url, image_url, position
)
```

### Row Level Security
- Personas & Templates: Public read, user-created items editable
- Keywords: User owns their cached keywords
- Blogs: User owns their blog posts
- Products: Access via blog ownership

## External APIs

| API | Purpose | Authentication |
|-----|---------|----------------|
| **Google Gemini** | AI content generation | `VITE_GEMINI_API_KEY` |
| **Decodo** | Keyword research (Google Suggest) | Proxy via Edge Function |
| **Shopify GraphQL** | Product search, blog publishing | `SHOPIFY_API_KEY` |
| **Railway API** | Alternative blog generation | Public endpoint |

## Configuration

### Environment Variables

```bash
# Required
VITE_GEMINI_API_KEY=           # Google Gemini AI
VITE_SUPABASE_URL=             # Supabase project
VITE_SUPABASE_ANON_KEY=        # Supabase client key
SHOPIFY_API_KEY=               # Shopify Admin API

# Optional
VITE_RUNPOD_API_URL=           # Stagehand fallback for scraping
```

### Gemini Models

The system uses model fallback for reliability:
1. `gemini-3-pro-preview` (default, most powerful)
2. `gemini-2.5-flash` (fast, stable)
3. `gemini-2.0-flash` (proven alternative)
4. `gemini-2.5-pro` (more powerful)
5. `gemini-flash-latest` (latest features)

## Final Output

A complete blog post ready for Shopify includes:

| Field | Description | Example |
|-------|-------------|---------|
| `content` | HTML blog content | `<h2>Introduction</h2><p>...</p>` |
| `markdown` | Markdown version | `## Introduction\n\n...` |
| `meta_title` | SEO title (50-60 chars) | `Best Baby Oil UK 2025: Expert Guide` |
| `meta_description` | SEO description (140-160 chars) | `Discover the best baby oil...` |
| `excerpt` | Listing preview (100-200 chars) | `Our expert guide to...` |
| `tags` | SEO tags (3-6) | `["baby care", "skincare"]` |
| `primary_keyword` | Target keyword | `best baby oil uk` |
| `word_count` | Content length | `1850` |
| `seo_score` | SEO quality (0-100) | `85` |
| `readability_score` | Flesch score (0-100) | `72` |
| `shopify_article_id` | Published article ID | `123456789` |

## UI Components

### Pages (`src/pages/blogger/`)
- **BloggerDashboardPage** - Blog list with filtering, search, stats
- **BloggerCreatePage** - 6-step creation wizard
- **BloggerDetailPage** - Single blog view with actions

### Components (`src/components/blogger/`)
- **BlogWizard** - Multi-step form container
- **PersonaSelector** - Persona grid selection
- **TemplateSelector** - Template grid selection
- **ContentGenerationChat** - AI generation with live logs
- **ContentEditor** - Markdown/HTML editor with preview
- **SeoOptimizer** - Meta editor with scoring
- **BlogPreview** - Full blog preview
- **BlogCard** - Blog list item with actions
- **AgentInsights** - AI processing insights

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/blogger` | Dashboard | Blog list and management |
| `/blogger/create` | Create | New blog wizard |
| `/blogger/:id` | Detail | View single blog |
| `/blogger/:id/edit` | Edit | Edit existing blog |

## Best Practices

### Content Quality
- Minimum 1500 words per blog post
- Natural keyword placement (1-2% density)
- 3-6 internal links to McGrocer products
- Proper heading hierarchy (H2 → H3 → H4)
- Include FAQ section when appropriate

### SEO Guidelines
- Meta title: 50-60 characters with primary keyword
- Meta description: 140-160 characters with CTA
- Primary keyword in first 100 words
- Alt text for all images
- Related articles section for internal linking

### E-E-A-T Compliance
- Use appropriate persona for topic
- Include persona credentials in content
- Cite sources and data where applicable
- Show expertise through detailed analysis
- Build trust with transparent methodology

## Related Documentation

- [Edge Functions README](../supabase/functions/README.md) - API documentation
- [Shopify Functions](../supabase/functions/SHOPIFY_FUNCTIONS.md) - Shopify integration
- [FRONTEND.md](../FRONTEND.md) - Frontend architecture

---

**Last Updated**: 2025-12-30
