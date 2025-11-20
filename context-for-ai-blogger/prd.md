# Product Requirements Document (PRD): McGrocer Automated AI Blog Creator (v2.0 Feature Integration)

**Project Name:** McGrocer Automated AI Blog Creator with Persona-Based Bloggers
**Version:** 2.0 (Integration into existing AI Dashboard)
**Date:** October 26, 2023
**Target Audience:** Development Agent / Engineering Team
**Goal:** To build a system that generates high-quality, people-first content for McGrocer, achieving Google's E-E-A-T compliance (Experience, Expertise, Authoritativeness, Trustworthiness) by using deeply developed, persona-based writers.

---

## 1. Project Overview & Scope

### 1.1 Key Objectives

1. **People-First Content & E-E-A-T:** Produce original, in-depth blogs that explicitly identify the author persona ("Who"), disclose the methodology ("How"), and state the purpose ("Why"), ensuring credibility and trust.
2. **SEO Alignment & Visibility:** Guide content generation using keyword research (search volume, competition) and competitive analysis (Top 3 ranking content retrieval) to maximize SERP visibility.
3. **Commerce Integration:** Implement mandatory features for internal product linking using the McGrocer catalog (via Shopify API) and hard-removal of outbound commerce links (e.g., Amazon, Boots).
4. **Advanced AI Generation:** Leverage advanced prompt modulation (Intent-Based, Location-Aware) and humanization techniques (Perplexity Optimization, Burstiness Maximization) to generate content that reads naturally and resists AI detection.

### 1.2 Technology Stack (Updated)

- **Frontend:** React (Integration into existing AI Dashboard)
- **Backend & Database:** Supabase (Handling core database, authentication, and API endpoints, replacing PostgreSQL/FastAPI structure suggested previously)
- **Vector Storage:** Supabase (Utilizing built-in PostgreSQL vector capabilities, replacing Pinecone for persona context embeddings and competitive data storage)
- **AI Providers:** OpenAI GPT-4 Turbo and Anthropic Claude 3 (used interchangeably for model rotation and diversity)
- **CMS Integration:** Shopify Admin API (for publishing and product data retrieval)

---

## 2. Functional Requirements (FR)

### FR 1: Keyword Identification & Research

- **FR 1.1 Automated Discovery:** System must connect to Google APIs (Console, Ads, Analytics) to automatically collect high-ranking keywords.
- **FR 1.2 Storage:** Keyword metadata (search volume, CPC, competition level) must be stored in Supabase.
- **FR 1.3 Single Focus:** Content generation must focus on a single primary keyword per blog for clarity and depth.
- **FR 1.4 Intent Classification:** The system must classify keywords as Transactional, Informational, or Navigational to adjust tone, CTA, and structure accordingly.

### FR 2: Competitive & Article Research

- **FR 2.1 Top 3 Retrieval:** System must query Google to retrieve the top 3 ranking content pages for the chosen primary keyword.
- **FR 2.2 Data Storage:** Reference data (title, headings, small excerpt) must be stored in Supabase for competitive insight.
- **FR 2.3 Originality Mandate:** AI draft generation must provide original perspectives and significant additional value, using the competitive data for structure but ensuring no copying.

### FR 3: Persona & Templating System

- **FR 3.1 Persona Integration:** System must integrate the six deeply developed personas, including: Harriet Greene, Alistair Malik, Priya Moore, Lola Adeyemi, Nathan White, and Dr. Emily Francis.
- **FR 3.2 Context Loading:** Before generation, the system must load the persona's comprehensive metadata ecosystem, including Professional Foundation, Experiential Knowledge, Current Market Intelligence, and Technical Expertise Depth.
- **FR 3.3 Expertise Embedding:** The writing protocol must embed expertise through specific actions and anecdotes ("During last month's supplier audit in Kent...") rather than generic declarations.
- **FR 3.4 Template Usage:** The user must select from the nine specialized blog templates (e.g., How-to Post, List Post, Beginner's Guide, Case Study) to structure the AI generation.
- **FR 3.5 Persona Introductions (Critical Fix):** The system must hard-remove artificial persona introductions in the body text; attribution should be managed via the CMS template.
- **FR 3.6 Persona Fusion (Future/Advanced):** The system should support a "Persona Fusion Mode" allowing two personas to co-author a piece, splitting responsibilities based on domain expertise (e.g., Dr. Emily + Alistair).

### FR 4: AI Content Generation & Optimization

- **FR 4.1 Generation:** AI (GPT-4 Turbo/Claude 3) must generate a complete draft incorporating the Who (byline), How (methodology disclosure), and Why (purpose statement).
- **FR 4.2 Geo-Targeting:** Content must be modulated to the user's likely location (e.g., expats in UAE or NYC), tailoring examples, tone, and product relevance.
- **FR 4.3 Structured Frameworks:** The AI must use strategic writing frameworks like AIDA or PAS within each section to ensure strategic and emotionally resonant output.
- **FR 4.4 Internal Linking (Crucial):**
  - System must integrate the Shopify API to fetch real product data from the McGrocer catalog.
  - The AI must detect product references (e.g., Schär, Kendamil) and auto-insert internal hyperlinks to McGrocer's own product pages.
  - A fallback mechanism must suggest a similar collection if the specific product is unavailable.
  - Hard-remove all outbound commerce references (e.g., links to Amazon or Boots).
- **FR 4.5 SEO Elements:** The generated content must include optimized meta title, meta description, H1-H3 heading structure, alt-text prompts, and a FAQ section with corresponding Schema markup (JSON-LD).

### FR 5: Validation and Quality Assurance

- **FR 5.1 Plagiarism Check:** Content must be automatically scanned via a Plagiarism Detection API to ensure minimal duplication (<5% overlap).
- **FR 5.2 Readability:** The system must ensure high readability, targeting a score of 80%+ by simplifying syntax and shortening sentences.
- **FR 5.3 Citation Mandate:** All drafts must include real citations linking to verified brand sources or reliable third-party authorities (e.g., NHS, WebMD, Trustpilot) for any health or product claims.
- **FR 5.4 Formatting:** Generated content must be structured with scannability in mind, automatically integrating bullet points, tip boxes, product cards, and warnings/disclaimers.
- **FR 5.5 Final Approval:** A workflow must exist for the user/editor to review flagged quality points, make manual edits, and give final approval before publishing.

### FR 6: CMS Integration & Feedback Loop

- **FR 6.1 Publishing:** The system must connect to McGrocer's CMS via the Shopify Admin API to automatically post or schedule the finalized content (HTML/Markdown).
- **FR 6.2 Performance Tracking:** A dashboard must be implemented to track key performance metrics post-publish, including SERP ranking, CTR, conversions, AOV, and time on page.
- **FR 6.3 Adaptive AI:** A feedback_handler mechanism must be developed to feed blog performance data back into the AI generation system to guide future prompts and refine prompt weights.

---

## 3. Non-Functional Requirements (NFR)

- **NFR 3.1 Performance:** Draft generation (approx. 1,500 words) must complete in < 5 seconds. Top 3 ranking content retrieval must be completed in < 10 seconds.
- **NFR 3.2 Scalability:** The architecture must support multiple simultaneous blog generation requests, leveraging Supabase and cloud functions effectively.
- **NFR 3.3 Reliability:** The system must ensure 99.9% uptime, with fallbacks (caching via Redis or equivalent) if external APIs (Google, AI models) rate-limit or fail.
- **NFR 3.4 Security:** Secure handling of API keys (OpenAI, Google, Shopify) is required. Compliance with data privacy regulations (e.g., anonymization of user data) must be implemented.
- **NFR 3.5 Maintainability:** Modular microservices structure (Keyword Manager, Content Generator, Quality Assurance) is required for ease of maintenance and versioning.

---

## 4. Implementation Roadmap and Phases

The project implementation will follow a 7-phase model, leveraging the existing AI dashboard (React) and Supabase architecture. The estimated total duration for completion is approximately 3 weeks.

| Phase | Duration (Estimate) | Key Focus Area | Key Deliverables & Activities |
|-------|---------------------|----------------|-------------------------------|
| **Phase 1: Architecture & Data Foundation** | 2 Days | Supabase Setup | Set up Supabase (DB & Vector Store), replacing PostgreSQL/Pinecone. Define schemas for Personas, Keywords, Blogs, and SEO Data. Define core React component structure for the new dashboard feature. |
| **Phase 2: Keyword Discovery & Research** | 1 Week | Data Integration | Integrate Google APIs (Console, Ads, Analytics) for automated keyword collection. Build logic to fetch and store the Top 3 ranking content structures for analysis. Implement Intent-Based Prompting logic. |
| **Phase 3: Persona Integration & Templating** | 2 Days | E-E-A-T Foundation | Load Six Persona Profiles (e.g., Dr. Emily Francis, Lola Adeyemi) with deep contextual knowledge. Define the Nine Blog Templates. Develop AI agent instructions for "Who, How, Why" embedding and E-E-A-T cues. |
| **Phase 4: AI Content Creation & Commerce Integration** | 3 Days | Core Generation | Implement API calls for content generation (GPT-4/Claude 3). Integrate Shopify API to fetch product catalog data. Implement logic for auto-inserting internal product links and hard-removing outbound commerce links. |
| **Phase 5: Validation & Quality Assurance** | 3 Days | Compliance & Safety | Integrate Plagiarism Detection API (must achieve <5% overlap). Implement checks for SEO compliance (headings, meta) and Readability (target 80%+). Enforce the inclusion of real citations (NHS, WebMD) for claims. |
| **Phase 6: CMS Publishing & Tracking** | 3 Days | Deployment & Metrics | Develop Shopify Admin API integration for automatic blog publishing. Create the Performance Dashboard component in React to track SERP ranking, CTR, and conversions. Implement the Adaptive AI Feedback Loop system. |
| **Phase 7: Deployment & Advanced Enhancements** | 5 Days | Refinement & Scaling | Optimize the system for speed (<5s draft time) and reliability. Implement Location-Aware Modulation. Develop and deploy context updating mechanisms (Market Intelligence updates). |

---

## 5. Acceptance Criteria

The feature is considered accepted when the following criteria are met:

1. **Persona Authenticity:** Every generated blog features a credible persona, naturally weaving in their professional background (e.g., Alistair Malik's B2B supply chain experience) and E-E-A-T markers through context, without explicit generic introductions.
2. **Commerce Compliance:** The system successfully fetches McGrocer product data and automatically inserts internal hyperlinks to relevant product pages upon detection. The system proactively removes all external commerce links.
3. **Quality Standards:** Content is original (passing plagiarism checks with <5% overlap), factually accurate, and includes real, verifiable external citations (NHS, WebMD, etc.) when making health or product claims.
4. **SEO & Structure:** The content is fully optimized, including appropriate meta tags, FAQ Schema markup, and natural keyword density (1–1.5%).
5. **Performance:** The content generation endpoint meets the speed requirement of < 5 seconds for a standard draft.
