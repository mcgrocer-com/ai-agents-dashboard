-- ============================================================================
-- Migration: Create Blogger Feature Tables
-- Description: Creates database schema for AI Blogger feature with personas,
--              templates, keywords, blogs, and product associations
-- Date: 2025-11-18
-- ============================================================================

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create slug generation function
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ language 'plpgsql';

-- ============================================================================
-- Table 1: blogger_personas
-- Purpose: Store 6 writer personas with professional context
-- ============================================================================
CREATE TABLE blogger_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT NOT NULL,
    expertise TEXT NOT NULL,
    context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER update_blogger_personas_updated_at
    BEFORE UPDATE ON blogger_personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table 2: blogger_templates
-- Purpose: Store 9 blog templates with structure and AI prompts
-- ============================================================================
CREATE TABLE blogger_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    h1_template TEXT NOT NULL,
    content_structure TEXT NOT NULL,
    seo_rules TEXT NOT NULL,
    prompt_template TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add trigger for updated_at
CREATE TRIGGER update_blogger_templates_updated_at
    BEFORE UPDATE ON blogger_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Table 3: blogger_keywords
-- Purpose: Cache keyword research data
-- ============================================================================
CREATE TABLE blogger_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    topic TEXT NOT NULL,
    search_volume INTEGER,
    cpc DECIMAL(10,2),
    competition TEXT CHECK (competition IN ('low', 'medium', 'high')),
    intent TEXT CHECK (intent IN ('transactional', 'informational', 'navigational')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for blogger_keywords
CREATE INDEX idx_blogger_keywords_keyword ON blogger_keywords(keyword);
CREATE INDEX idx_blogger_keywords_topic ON blogger_keywords(topic);
CREATE INDEX idx_blogger_keywords_user_id ON blogger_keywords(user_id);

-- ============================================================================
-- Table 4: blogger_blogs
-- Purpose: Store blog posts with full metadata and status
-- ============================================================================
CREATE TABLE blogger_blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES blogger_personas(id),
    template_id UUID NOT NULL REFERENCES blogger_templates(id),
    primary_keyword_id UUID REFERENCES blogger_keywords(id),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    markdown_content TEXT,
    meta_title TEXT NOT NULL,
    meta_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    shopify_article_id BIGINT,
    shopify_blog_id BIGINT,
    published_at TIMESTAMPTZ,
    seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
    readability_score INTEGER CHECK (readability_score >= 0 AND readability_score <= 100),
    word_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for blogger_blogs
CREATE INDEX idx_blogger_blogs_user_id ON blogger_blogs(user_id);
CREATE INDEX idx_blogger_blogs_status ON blogger_blogs(status);
CREATE INDEX idx_blogger_blogs_slug ON blogger_blogs(slug);
CREATE INDEX idx_blogger_blogs_created_at ON blogger_blogs(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_blogger_blogs_updated_at
    BEFORE UPDATE ON blogger_blogs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to auto-generate slug if not provided
CREATE OR REPLACE FUNCTION auto_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug = generate_slug(NEW.title);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER blogger_blogs_auto_slug
    BEFORE INSERT OR UPDATE ON blogger_blogs
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_slug();

-- ============================================================================
-- Table 5: blogger_blog_products
-- Purpose: Associate blogs with McGrocer products
-- ============================================================================
CREATE TABLE blogger_blog_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID NOT NULL REFERENCES blogger_blogs(id) ON DELETE CASCADE,
    product_handle TEXT NOT NULL,
    product_title TEXT NOT NULL,
    product_url TEXT NOT NULL,
    image_url TEXT,
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for blogger_blog_products
CREATE INDEX idx_blogger_blog_products_blog_id ON blogger_blog_products(blog_id);
CREATE INDEX idx_blogger_blog_products_product_handle ON blogger_blog_products(product_handle);

-- ============================================================================
-- Seed Data: 6 Personas
-- ============================================================================
INSERT INTO blogger_personas (name, role, bio, expertise, context_data) VALUES
(
    'Harriet "Harry" Greene',
    'Lifestyle & Food Culture Writer',
    'Lifestyle columnist with 16+ years capturing the heart of British food culture',
    'British traditions, nostalgic storytelling, rural-to-urban food journeys',
    '{"years_experience": 16, "location": "Edinburgh to London", "writing_style": "warm, conversational", "specialty": "nostalgia around British staples", "methodology": "anecdotal interviews from local market vendors, personal experience", "purpose": "help readers feel emotionally connected to UK groceries", "career_milestone": "Authored From Farm Lane to Your Cupboard series", "best_templates": ["How-to Post", "Beginner''s Guide", "Ultimate Guide"]}'::jsonb
),
(
    'Alistair Malik',
    'B2B & Supply Chain Copywriter',
    'B2B copywriter with 20 years of experience in e-commerce logistics and supply chain communication',
    'Cross-border shipping, procurement, logistics cost optimization',
    '{"years_experience": 20, "location": "Birmingham", "background": "mixed Scottish-Pakistani heritage", "writing_style": "direct, fact-based", "methodology": "data analysis, shipping stats, vendor cost breakdowns", "purpose": "demystify cross-border shipping and logistical prowess", "career_milestone": "Created Global Cart, Local Solutions series saving clients 25%", "best_templates": ["Review Post", "Statistics / Data-Focused Post", "Case Study"]}'::jsonb
),
(
    'Priya Moore',
    'Food & Cultural Journalist',
    'Writer with 15+ years exploring multicultural British cuisine and diaspora flavor blending',
    'Cross-cultural food writing, diaspora recipes, fusion cooking',
    '{"years_experience": 15, "location": "Manchester to London", "background": "British-Indian ancestry", "writing_style": "vibrant, inclusive", "methodology": "culinary research meets personal heritage, interviews diaspora families", "purpose": "showcase McGrocer as bridge for global fusion", "career_milestone": "Penned Spice & Scones cultural piece", "best_templates": ["List Post", "Response Post", "Comparison Post"]}'::jsonb
),
(
    'Lola Adeyemi',
    'SEO & Content Marketing Specialist',
    'London-based digital marketer with 16+ years leading SEO-driven content strategies for e-commerce brands',
    'SEO content marketing, keyword optimization, SERP strategy',
    '{"years_experience": 16, "location": "Liverpool to London", "writing_style": "analytical, strategic", "methodology": "keyword research with SEO tools, LSI keywords, structured data", "purpose": "boost organic discovery for British groceries", "career_milestone": "Created Global Tastes, Local Ranks campaign doubling organic traffic", "best_templates": ["Beginner''s Guide", "How-to Post", "List Post"]}'::jsonb
),
(
    'Nathan White',
    'Investigative Journalist & Culture Commentator',
    'Investigative journalist with 17+ years analyzing UK consumer behavior, ethical sourcing, and sustainability issues',
    'Consumer activism, retail ethics, deep supply chain analysis',
    '{"years_experience": 17, "location": "Bristol", "writing_style": "thorough, hard-hitting, transparent", "methodology": "detailed research, interviews, industry data cross-checking", "purpose": "ensure transparency in supply chains and product origins", "career_milestone": "Published Inside the British E-Grocery Scene multi-part piece", "best_templates": ["Review Post", "Case Study", "Ultimate Guide"]}'::jsonb
),
(
    'Dr. Emily Francis',
    'Health & Wellness Writer',
    'Health and wellness writer with a Ph.D. in Nutrition Science and 17+ years bridging scientific research with consumer-friendly health writing',
    'Nutritional science, diet-specific writing, allergen management, child nutrition',
    '{"years_experience": 17, "location": "Bath, UK", "credentials": "Ph.D. in Nutrition Science", "writing_style": "measured, medical-oriented", "methodology": "references official UK dietary guidelines, academic papers", "purpose": "help health-conscious shoppers trust specialized dietary needs", "career_milestone": "Wrote widely cited Healthy Plate, British Made piece", "best_templates": ["Statistics / Data-Focused Post", "Response Post", "Comparison Post"]}'::jsonb
);

-- ============================================================================
-- Seed Data: 9 Blog Templates
-- ============================================================================
INSERT INTO blogger_templates (name, description, h1_template, content_structure, seo_rules, prompt_template, notes) VALUES
(
    'How-to Post',
    'Step-by-step instructional guide',
    'How to {{primary_keyword}} Effectively: A Step-by-Step Guide',
    'Intro (Who is this for & Why it matters); H2: Tools and Materials You Need; H2–H3: Step-by-Step Instructions (Step 1–N); H2: Expert Tips, Common Pitfalls & Warnings; H2: Final Thoughts and Encouragement to Try It Now',
    'Primary keyword in H1 and first 100 words; each step should be keyword-optimized; CTA: Try it now [link]. Use descriptive, SEO-rich H2s.',
    'Write a human-like, detailed How-to Post for {{persona}} on {{primary_keyword}}, with expanded steps, expert insights, and a clear CTA. Use keyword-rich H2 headings, avoid robotic tone, and no conclusion heading. Minimum 1500 words.',
    'Include a byline like I am {{persona}}, with over 15 years of experience in...; explain How and Why behind the method; share personal insights or credible references.'
),
(
    'List Post',
    'Top N items or recommendations',
    'Top N {{primary_keyword}} You Should not Miss in {{year}}',
    'Intro (Hook + Who it is for); H2–H3: List Items with Rich Descriptions, Real Use Cases, Pros & Cons, Internal Links; H2: How to Select the Best Option for Your Needs; H2: Explore More and Final Recommendations',
    'Keyword in title & each list item heading; use bold/anchor tags in key places; CTA: Explore more.',
    'Generate a highly engaging List Post for persona {{persona}}: Top N {{primary_keyword}}, with SEO-optimized H2s, use cases, pros/cons, and final call to explore more. Minimum 1500 words.',
    'Start with persona intro + expertise; show how each item was tested or evaluated; explain reasons and context. Add credibility to each point.'
),
(
    'Beginner''s Guide',
    'Comprehensive introduction for newcomers',
    'Beginner''s Guide to Mastering {{primary_keyword}} in {{year}}',
    'Intro (Context + Purpose); H2: What Is {{primary_keyword}} and Why It is Important; H2: The Core Concepts Every Beginner Must Know; H2: Getting Started with Confidence (Steps, Tools, Resources); H2: Frequently Asked Questions (Max 6 Questions, Answered Clearly); H2: Wrapping Up with Your First Steps Forward',
    'Keyword in H1, intro, and throughout; include FAQ with long-tail phrases; CTA: Download beginner checklist [link].',
    'Create a friendly, helpful Beginner''s Guide for {{persona}}: {{primary_keyword}}, structured with easy explanations, 6 FAQ questions answered, and resource links. Minimum 1500 words.',
    'Persona is a helpful guide/educator; clarify why this topic matters; ensure structure is clear and supportive. Link beginner-friendly resources.'
),
(
    'Review Post',
    'In-depth product or service review',
    '{{Product}} Review in {{year}}: Is This the Right Choice for You?',
    'Intro (Your Credentials + Review Purpose); H2: In-Depth Product Overview and Technical Specs; H2: Pros, Cons, and User Experience; H2: Real-World Testing Results and Analysis; H2: Comparing with Alternatives in the Market; H2: Final Verdict: Who Should Buy This?',
    'Keyword in title and headings; product links where relevant; CTA: Shop now on McGrocer.',
    'Compose a deeply insightful Review Post by {{persona}}: {{product}} Review, based on real testing, with SEO-optimized structure and clear verdict. Minimum 1500 words.',
    'Introduce persona and role in testing; explain how you evaluated the product; use real data, quotes, or experiences. Offer honest pros/cons.'
),
(
    'Statistics / Data-Focused Post',
    'Data-driven insights and analysis',
    '{{Year}} {{primary_keyword}} Statistics and Insights That Matter',
    'Intro (Why This Data Matters Now); H2: Key Trends & Surprising Findings You Should Know; H2: Easy-to-Read Charts, Graphs, and Raw Tables; H2: What the Data Tells Us (Detailed Analysis); H2: Implications for {{industry or audience}}; H2: Final Takeaways and Downloadable Report',
    'Use keyword + statistics in H1 and sections; image alt-text; internal data links; CTA: Explore our product range.',
    'Produce a rich, human-style Data-Focused Post for {{persona}}: {{year}} {{primary_keyword}} Statistics, with easy charts, sharp analysis, and expert takeaways. Minimum 1500 words.',
    'Persona should introduce how data was gathered; cite tools/methodology; explain relevance. Use visuals with alt text and accessible commentary.'
),
(
    'Response Post',
    'Expert response to questions or controversies',
    'An Expert Response to {{query}} — Here is What You Should Know',
    'Intro (Who You Are + Context); H2: What Was Said and Why It Matters; H2: Critical Breakdown and Response with Evidence; H2: Fact-Based Clarifications & Supportive Data; H2: Final Thoughts on the Issue',
    'Include query as exact phrase in H1; quote sources; CTA: What is your take? Join the discussion [link].',
    'Write a professional and engaging Response Post for {{persona}}: In Response to {{query}}, including analysis, context, and balanced evidence. Minimum 1500 words.',
    'Persona should show authority; explain topic context clearly; ensure emotional neutrality; include citations or visual evidence.'
),
(
    'Ultimate Guide / Comprehensive Post',
    'Exhaustive resource on a topic',
    'The Ultimate Guide to {{primary_keyword}} in {{year}}: Everything You Need to Know',
    'Intro (Who You Are, Why This Guide Exists); H2: What Is {{primary_keyword}} and Why Is It Important?; H2: A Brief History and Industry Evolution; H2–H3: Subtopics and Strategic Insights (2–4 sections); H2: Best Practices, Tools & Frameworks You Can Use; H2: Frequently Asked Questions (Limit 6, Fully Answered); H2: Final Thoughts and Links to Further Learning',
    'Keyword in title, intro, TOC with jump links; H2/H3 structure must be logical and rich; CTAs after key sections.',
    'Craft a comprehensive, structured Ultimate Guide for {{persona}} on {{primary_keyword}}, with deep insights, 6 FAQs, and strong reader guidance. Minimum 1500 words.',
    'Showcase persona expertise; explain sources of research; build trust with practical insights. Include visuals and diagrams if possible.'
),
(
    'Case Study',
    'Real-world example with results',
    'Case Study: How {{project}} Achieved {{result}} Using Smart Strategies',
    'Intro (Set the Stage with Persona Role); H2: The Challenge Faced and Its Context; H2: The Step-by-Step Solution We Implemented; H2: Key Results and Measurable Impact (Use Data); H2: Lessons We Learned That Others Can Use; H2: What is Next and Where to Go From Here',
    'Use case study and keyword in H1; embed images or charts with captions; CTA: Download the full case study.',
    'Build a rich, real-world Case Study by {{persona}}: How {{project}} Achieved {{result}}, focusing on challenges, actions, and outcomes with practical insights. Minimum 1500 words.',
    'Use real data, timeline details, and persona involvement; share what worked and did not; show replicable strategies.'
),
(
    'Comparison Post',
    'Side-by-side comparison of options',
    'Top {{N}} {{primary_keyword}} Compared Side-by-Side: Which One Is Right for You?',
    'Intro (Why Compare These Options + Persona Intro); H2–H3: Comparison of Each Option (Description, Pros, Cons, Use Case, Link); H2: How to Make the Right Choice for Your Needs; H2: Final Verdict and Recommendations',
    'Keyword in title and each product H2; anchor links in TOC; CTA: Shop the full comparison on McGrocer.',
    'Generate a Comparison Post for {{persona}}: Top {{N}} {{primary_keyword}}, comparing each with pros, cons, and tailored recommendations. Minimum 1500 words.',
    'Persona should explain experience with all tools/products; explain testing methodology and what matters most in the comparison.'
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE blogger_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogger_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogger_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogger_blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogger_blog_products ENABLE ROW LEVEL SECURITY;

-- blogger_personas policies (public read, no write)
CREATE POLICY "Public read access for personas"
    ON blogger_personas FOR SELECT
    TO authenticated
    USING (true);

-- blogger_templates policies (public read, no write)
CREATE POLICY "Public read access for templates"
    ON blogger_templates FOR SELECT
    TO authenticated
    USING (true);

-- blogger_keywords policies (users manage their own)
CREATE POLICY "Users can view their own keywords"
    ON blogger_keywords FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create keywords"
    ON blogger_keywords FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keywords"
    ON blogger_keywords FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keywords"
    ON blogger_keywords FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- blogger_blogs policies (users manage their own)
CREATE POLICY "Users can view their own blogs"
    ON blogger_blogs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create blogs"
    ON blogger_blogs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blogs"
    ON blogger_blogs FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blogs"
    ON blogger_blogs FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- blogger_blog_products policies (via blog ownership)
CREATE POLICY "Users can view products from their own blogs"
    ON blogger_blog_products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM blogger_blogs
            WHERE blogger_blogs.id = blogger_blog_products.blog_id
            AND blogger_blogs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add products to their own blogs"
    ON blogger_blog_products FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM blogger_blogs
            WHERE blogger_blogs.id = blogger_blog_products.blog_id
            AND blogger_blogs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update products from their own blogs"
    ON blogger_blog_products FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM blogger_blogs
            WHERE blogger_blogs.id = blogger_blog_products.blog_id
            AND blogger_blogs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete products from their own blogs"
    ON blogger_blog_products FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM blogger_blogs
            WHERE blogger_blogs.id = blogger_blog_products.blog_id
            AND blogger_blogs.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE blogger_personas IS 'Stores 6 writer personas with professional background and expertise for E-E-A-T compliance';
COMMENT ON TABLE blogger_templates IS 'Stores 9 blog templates with structure, SEO rules, and AI prompt templates';
COMMENT ON TABLE blogger_keywords IS 'Caches keyword research data to avoid repeated API calls';
COMMENT ON TABLE blogger_blogs IS 'Stores all blog posts with full metadata, SEO data, and Shopify integration';
COMMENT ON TABLE blogger_blog_products IS 'Associates blogs with McGrocer products for internal linking';
