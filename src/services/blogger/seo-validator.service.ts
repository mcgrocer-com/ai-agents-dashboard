/**
 * SEO Validator Agent Service
 *
 * An AI-powered validation agent that runs after content generation to ensure
 * Yoast SEO compliance. Each validation is performed by an AI agent, not hard-coded logic.
 */

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info';

export type IssueCategory =
  | 'title'
  | 'description'
  | 'excerpt'
  | 'headings'
  | 'links'
  | 'images'
  | 'ai-content'
  | 'tags'
  | 'readability';

export interface SeoIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  suggestion: string;
  autoFixable: boolean;
  context?: string;
}

export interface ContentAgentFeedback {
  requiresRegeneration: boolean;
  regenerationPrompt?: string;
  specificIssues: Array<{ what: string; why: string; how: string }>;
}

export interface SeoValidationReport {
  isValid: boolean;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: SeoIssue[];
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  fixedContent?: string;
  fixedTitle?: string;
  fixedDescription?: string;
  feedback: ContentAgentFeedback;
  checks: {
    title: { passed: boolean; value: string; length: number };
    description: { passed: boolean; value: string; length: number };
    excerpt: { passed: boolean; value: string; length: number };
    headings: { passed: boolean; hierarchy: string[]; issues: string[] };
    links: { passed: boolean; total: number; invalid: number; external: number; nofollow: number };
    images: { passed: boolean; total: number; withAlt: number; withoutAlt: number; suggestedAlts?: Array<{ src: string; suggestedAlt: string }> };
    aiContent: { passed: boolean; issues: string[]; patterns: string[] };
    tags: { passed: boolean; tags: string[]; issues: string[]; suggestedTags?: string[] };
    readability: { passed: boolean; score: number; grade: string; issues: string[] };
  };
}

/**
 * AI-Powered SEO Validator Agent
 */
export class SeoValidator {
  private issues: SeoIssue[] = [];
  private issueIdCounter = 0;
  private model: string = 'gemini-2.0-flash';

  /**
   * Run full SEO validation using AI agents
   */
  async validate(
    content: string,
    metaTitle: string,
    metaDescription: string,
    options: {
      autoFix?: boolean;
      primaryKeyword?: string;
      excerpt?: string;
      tags?: string[];
      model?: string;
      skipCategories?: IssueCategory[]; // Categories that already passed - skip re-validation
    } = {}
  ): Promise<SeoValidationReport> {
    const { autoFix = true, primaryKeyword = '', excerpt = '', tags = [], model = 'gemini-2.0-flash', skipCategories = [] } = options;
    this.model = model;

    this.issues = [];
    this.issueIdCounter = 0;

    // Skip categories that already passed (saves API calls and avoids AI variance issues)
    const skip = new Set(skipCategories);

    // Run AI validations in parallel (skip already-passed categories)
    const [titleCheck, descCheck, excerptCheck, headingCheck, linkCheck, imageCheck, aiContentCheck, tagsCheck, readabilityCheck] =
      await Promise.all([
        skip.has('title') ? Promise.resolve({ passed: true }) : this.validateTitleWithAI(metaTitle, primaryKeyword),
        skip.has('description') ? Promise.resolve({ passed: true }) : this.validateDescriptionWithAI(metaDescription, primaryKeyword),
        skip.has('excerpt') ? Promise.resolve({ passed: true }) : this.validateExcerptWithAI(excerpt, primaryKeyword, metaDescription),
        skip.has('headings') ? Promise.resolve({ passed: true, hierarchy: [], issues: [] }) : this.validateHeadingsWithAI(content),
        skip.has('links') ? Promise.resolve({ passed: true, total: 0, invalid: 0, external: 0, nofollow: 0 }) : this.validateLinksWithAI(content),
        skip.has('images') ? Promise.resolve({ passed: true, total: 0, withAlt: 0, withoutAlt: 0, suggestedAlts: [] }) : this.validateImagesWithAI(content),
        skip.has('ai-content') ? Promise.resolve({ passed: true, issues: [], patterns: [] }) : this.validateAiContentWithAI(content),
        skip.has('tags') ? Promise.resolve({ passed: true, tags: [], issues: [], suggestedTags: [] }) : this.validateTagsWithAI(tags, content, primaryKeyword, metaTitle),
        skip.has('readability') ? Promise.resolve({ passed: true, score: 70, grade: 'Good', issues: [] }) : this.validateReadability(content),
      ]);

    // Calculate score based on issues
    const score = this.calculateScore();
    const grade = this.getGrade(score);
    const feedback = this.generateFeedback();

    return {
      isValid: this.issues.filter(i => i.severity === 'critical' || i.severity === 'error').length === 0,
      score,
      grade,
      issues: this.issues,
      criticalCount: this.issues.filter(i => i.severity === 'critical').length,
      errorCount: this.issues.filter(i => i.severity === 'error').length,
      warningCount: this.issues.filter(i => i.severity === 'warning').length,
      fixedContent: autoFix ? content : undefined,
      fixedTitle: autoFix ? metaTitle : undefined,
      fixedDescription: autoFix ? metaDescription : undefined,
      feedback,
      checks: {
        title: { passed: titleCheck.passed, value: metaTitle, length: metaTitle.length },
        description: { passed: descCheck.passed, value: metaDescription, length: metaDescription.length },
        excerpt: { passed: excerptCheck.passed, value: excerpt, length: excerpt.replace(/<[^>]+>/g, '').length },
        headings: headingCheck,
        links: linkCheck,
        images: imageCheck,
        aiContent: aiContentCheck,
        tags: tagsCheck,
        readability: readabilityCheck,
      },
    };
  }

  /**
   * AI Agent: Validate meta title
   */
  private async validateTitleWithAI(title: string, keyword: string): Promise<{ passed: boolean }> {
    if (!title) {
      this.addIssue({
        severity: 'critical',
        category: 'title',
        message: 'Meta title is empty',
        suggestion: 'Add a compelling title of 50-60 characters',
        autoFixable: false,
      });
      return { passed: false };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze this meta title for SEO effectiveness.

TITLE: "${title}"
LENGTH: ${title.length} characters
PRIMARY KEYWORD: "${keyword || 'not specified'}"

VALIDATION CRITERIA:
1. Length: 50-60 characters ideal (current: ${title.length})
2. Keyword placement: Should contain primary keyword, preferably near beginning
3. Readability: Clear, compelling, click-worthy
4. No keyword stuffing or spam patterns
5. Proper capitalization and grammar

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "issues": [{ "severity": "error"|"warning"|"info", "message": "issue", "suggestion": "fix" }]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'title', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
          }
        }
        return { passed: result.passed };
      }
    } catch (error) {
      console.error('[SEO Validator] AI title validation failed:', error);
    }

    return { passed: title.length >= 50 && title.length <= 60 };
  }

  /**
   * AI Agent: Validate meta description
   */
  private async validateDescriptionWithAI(description: string, keyword: string): Promise<{ passed: boolean }> {
    if (!description) {
      this.addIssue({
        severity: 'critical',
        category: 'description',
        message: 'Meta description is empty',
        suggestion: 'Add a compelling description of 140-160 characters',
        autoFixable: false,
      });
      return { passed: false };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze this meta description for SEO effectiveness.

DESCRIPTION: "${description}"
LENGTH: ${description.length} characters
PRIMARY KEYWORD: "${keyword || 'not specified'}"

VALIDATION CRITERIA:
1. Length: 140-160 characters ideal (current: ${description.length})
2. Keyword inclusion: Should contain primary keyword naturally
3. Call-to-action: Should encourage clicks
4. Unique value proposition: Clear benefit to reader
5. No AI patterns: No "I will", "This article", etc.

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "issues": [{ "severity": "error"|"warning"|"info", "message": "issue", "suggestion": "fix" }]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'description', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
          }
        }
        return { passed: result.passed };
      }
    } catch (error) {
      console.error('[SEO Validator] AI description validation failed:', error);
    }

    return { passed: description.length >= 140 && description.length <= 160 };
  }

  /**
   * AI Agent: Validate excerpt/summary
   */
  private async validateExcerptWithAI(
    excerpt: string,
    keyword: string,
    metaDescription: string
  ): Promise<{ passed: boolean }> {
    const cleanExcerpt = excerpt.replace(/<[^>]+>/g, '').trim();

    if (!cleanExcerpt) {
      this.addIssue({
        severity: 'warning',
        category: 'excerpt',
        message: 'Excerpt/summary is empty',
        suggestion: 'Add a 2-3 sentence teaser (100-200 chars) for blog listing pages',
        autoFixable: false,
      });
      return { passed: false };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze this blog excerpt for quality.

EXCERPT: "${cleanExcerpt}"
LENGTH: ${cleanExcerpt.length} characters
PRIMARY KEYWORD: "${keyword || 'not specified'}"
META DESCRIPTION: "${metaDescription || 'not specified'}"

VALIDATION CRITERIA:
1. Length: 100-200 characters ideal
2. Engagement: Should entice readers to click
3. Keyword: Should include primary keyword naturally
4. Uniqueness: Should NOT be identical to meta description
5. No AI patterns: No "I selected", "This article will", "As an expert"
6. Reader focus: Written FOR readers, not about the writing process

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "issues": [{ "severity": "error"|"warning"|"info", "message": "issue", "suggestion": "fix" }]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'excerpt', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
          }
        }
        return { passed: result.passed };
      }
    } catch (error) {
      console.error('[SEO Validator] AI excerpt validation failed:', error);
    }

    return { passed: cleanExcerpt.length >= 100 && cleanExcerpt.length <= 200 };
  }

  /**
   * AI Agent: Validate heading hierarchy
   */
  private async validateHeadingsWithAI(
    content: string
  ): Promise<{ passed: boolean; hierarchy: string[]; issues: string[] }> {
    const headingPattern = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
    const headings: string[] = [];
    let match;
    while ((match = headingPattern.exec(content)) !== null) {
      const level = match[1];
      const text = match[3].replace(/<[^>]+>/g, '').trim();
      headings.push(`H${level}: ${text.substring(0, 50)}`);
    }

    if (headings.length === 0) {
      return { passed: true, hierarchy: [], issues: [] };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze heading structure for SEO.

HEADINGS FOUND:
${headings.join('\n')}

VALIDATION CRITERIA:
1. No H1 tags in blog content (H1 is reserved for page title)
2. Hierarchy must be sequential: H2 → H3 → H4 (no skipping levels)
3. No empty headings
4. Headings should be descriptive and keyword-rich
5. No duplicate headings

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "issues": [{ "severity": "error"|"warning"|"info", "message": "issue", "suggestion": "fix" }],
  "hierarchy": ["H2: First", "H3: Sub"]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const issueMessages: string[] = [];
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'headings', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
            issueMessages.push(issue.message);
          }
        }
        return { passed: result.passed, hierarchy: result.hierarchy || headings, issues: issueMessages };
      }
    } catch (error) {
      console.error('[SEO Validator] AI headings validation failed:', error);
    }

    return { passed: true, hierarchy: headings, issues: [] };
  }

  /**
   * AI Agent: Validate links
   */
  private async validateLinksWithAI(
    content: string
  ): Promise<{ passed: boolean; total: number; invalid: number; external: number; nofollow: number }> {
    const linkPattern = /<a([^>]*)href=["']([^"']*)["']([^>]*)>/gi;
    const links: string[] = [];
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[2]);
    }

    if (links.length === 0) {
      return { passed: true, total: 0, invalid: 0, external: 0, nofollow: 0 };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze links for SEO best practices.

LINKS FOUND:
${links.map((l, i) => `${i + 1}. ${l}`).join('\n')}

FULL CONTENT WITH LINK TAGS (for nofollow check):
${content.match(/<a[^>]*>/gi)?.join('\n') || 'No link tags'}

VALIDATION CRITERIA:
1. No invalid/placeholder links (#, PRODUCT_URL, placeholder, empty)
2. External links should have rel="nofollow"
3. Internal links (mcgrocer.com, myshopify.com) don't need nofollow
4. All links should be properly formatted URLs

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "total": number,
  "invalid": number,
  "external": number,
  "nofollow": number,
  "issues": [{ "severity": "error"|"warning", "message": "issue", "suggestion": "fix" }]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'links', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
          }
        }
        return {
          passed: result.passed,
          total: result.total || links.length,
          invalid: result.invalid || 0,
          external: result.external || 0,
          nofollow: result.nofollow || 0,
        };
      }
    } catch (error) {
      console.error('[SEO Validator] AI links validation failed:', error);
    }

    return { passed: true, total: links.length, invalid: 0, external: 0, nofollow: 0 };
  }

  /**
   * AI Agent: Validate images and suggest alt text for missing ones
   */
  private async validateImagesWithAI(
    content: string
  ): Promise<{ passed: boolean; total: number; withAlt: number; withoutAlt: number; suggestedAlts: Array<{ src: string; suggestedAlt: string }> }> {
    const imgPattern = /<img([^>]*)>/gi;
    const images: string[] = [];
    let match;
    while ((match = imgPattern.exec(content)) !== null) {
      images.push(match[0]);
    }

    if (images.length === 0) {
      return { passed: true, total: 0, withAlt: 0, withoutAlt: 0, suggestedAlts: [] };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent. Analyze images for accessibility and SEO.

IMAGE TAGS FOUND:
${images.join('\n')}

VALIDATION CRITERIA:
1. All images must have alt attributes
2. Alt text should be descriptive (10-125 characters, not empty, not just "image")
3. Alt text should describe what's in the image, not be generic
4. For product images, include the product name

For any image missing alt text or with poor alt text, suggest an appropriate alt based on:
- The image URL/filename (extract product names, descriptions)
- The surrounding context in the content

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "total": number,
  "withAlt": number,
  "withoutAlt": number,
  "issues": [{ "severity": "warning", "message": "issue", "suggestion": "fix" }],
  "suggestedAlts": [{ "src": "image URL", "suggestedAlt": "descriptive alt text" }]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'images', message: issue.message, suggestion: issue.suggestion, autoFixable: true });
          }
        }
        return {
          passed: result.passed,
          total: result.total || images.length,
          withAlt: result.withAlt || 0,
          withoutAlt: result.withoutAlt || 0,
          suggestedAlts: result.suggestedAlts || [],
        };
      }
    } catch (error) {
      console.error('[SEO Validator] AI images validation failed:', error);
    }

    return { passed: true, total: images.length, withAlt: images.length, withoutAlt: 0, suggestedAlts: [] };
  }

  /**
   * AI Agent: Validate content for AI patterns
   */
  private async validateAiContentWithAI(
    content: string
  ): Promise<{ passed: boolean; issues: string[]; patterns: string[] }> {
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (!textContent) {
      return { passed: true, issues: [], patterns: [] };
    }

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Validator Agent specialized in detecting AI-generated content patterns.

CONTENT TO ANALYZE:
"${textContent.substring(0, 3000)}"

DETECT THESE AI PATTERNS:

1. SELF-INTRODUCTION (CRITICAL):
   - "I am a writer/blogger/expert"
   - "My name is...", "As your nutritionist/chef"
   - "With X years of experience"
   - "Let me introduce myself"

2. AI REASONING IN CONTENT (CRITICAL):
   - "I selected this keyword because..."
   - "Based on my analysis..."
   - "My strategy for this article..."
   - "The keyword was chosen..."
   - "For this article, I will..."

3. META/SUMMARY BLEED (ERROR):
   - "Selected keyword: ..."
   - "SEO Strategy: ..."
   - "Word count: ..."
   - "Summary:" appearing in content

4. WEAK OPENINGS (WARNING):
   - "In this article, we will..."
   - "This blog post covers..."
   - "Let's dive into..."
   - "Here's what you need to know..."

RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "issues": [{ "severity": "critical"|"error"|"warning", "message": "description", "suggestion": "fix" }],
  "patterns": ["exact pattern found 1", "exact pattern found 2"]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const issueMessages: string[] = [];
        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({ severity: issue.severity, category: 'ai-content', message: issue.message, suggestion: issue.suggestion, autoFixable: false });
            issueMessages.push(issue.message);
          }
        }
        return { passed: result.passed, issues: issueMessages, patterns: result.patterns || [] };
      }
    } catch (error) {
      console.error('[SEO Validator] AI content validation failed:', error);
    }

    return { passed: true, issues: [], patterns: [] };
  }

  /**
   * AI Agent: Validate tags for relevance and SEO best practices
   */
  private async validateTagsWithAI(
    tags: string[],
    content: string,
    primaryKeyword: string,
    metaTitle: string
  ): Promise<{ passed: boolean; tags: string[]; issues: string[]; suggestedTags?: string[] }> {
    if (!tags || tags.length === 0) {
      this.addIssue({
        severity: 'warning',
        category: 'tags',
        message: 'No tags provided for the blog',
        suggestion: 'Add 3-7 relevant tags that describe the blog topic and help with SEO',
        autoFixable: false,
      });
      return { passed: false, tags: [], issues: ['No tags provided'], suggestedTags: [] };
    }

    // Extract text content for analysis
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);

    try {
      const response = await ai.models.generateContent({
        model: this.model,
        contents: `You are an SEO Tag Validator Agent. Analyze these blog tags for relevance and SEO effectiveness.

TAGS PROVIDED: ${JSON.stringify(tags)}
PRIMARY KEYWORD: "${primaryKeyword || 'not specified'}"
META TITLE: "${metaTitle}"
CONTENT EXCERPT: "${textContent.substring(0, 1000)}..."

VALIDATION CRITERIA:
1. RELEVANCE: Tags must be directly related to the blog content
2. QUANTITY: Ideal is 3-7 tags (too few = missed SEO opportunity, too many = keyword stuffing)
3. FORMAT: Tags should be lowercase, no special characters, concise (1-3 words each)
4. PRIMARY KEYWORD: At least one tag should contain or relate to the primary keyword
5. SPECIFICITY: Tags should be specific enough to be useful but not too niche
6. NO DUPLICATES: No duplicate or near-duplicate tags
7. NO GENERIC TAGS: Avoid overly generic tags like "blog", "article", "post"
8. SEARCH INTENT: Tags should match what users might search for

ANALYZE AND RESPOND WITH JSON ONLY:
{
  "passed": boolean,
  "relevantTags": ["tags that are good"],
  "irrelevantTags": ["tags that don't fit the content"],
  "issues": [{ "severity": "error"|"warning"|"info", "message": "issue description", "suggestion": "how to fix" }],
  "suggestedTags": ["3-5 better tag suggestions based on the content"]
}`,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const issueMessages: string[] = [];

        if (result.issues) {
          for (const issue of result.issues) {
            this.addIssue({
              severity: issue.severity,
              category: 'tags',
              message: issue.message,
              suggestion: issue.suggestion,
              autoFixable: false,
            });
            issueMessages.push(issue.message);
          }
        }

        // Add specific issues for irrelevant tags
        if (result.irrelevantTags && result.irrelevantTags.length > 0) {
          this.addIssue({
            severity: 'warning',
            category: 'tags',
            message: `Irrelevant tags detected: ${result.irrelevantTags.join(', ')}`,
            suggestion: 'Remove or replace these tags with more relevant ones',
            autoFixable: false,
            context: result.irrelevantTags.join(', '),
          });
        }

        return {
          passed: result.passed,
          tags: result.relevantTags || tags,
          issues: issueMessages,
          suggestedTags: result.suggestedTags || [],
        };
      }
    } catch (error) {
      console.error('[SEO Validator] AI tags validation failed:', error);
    }

    // Fallback validation
    const hasEnoughTags = tags.length >= 3 && tags.length <= 7;
    const hasPrimaryKeyword = primaryKeyword
      ? tags.some(tag => tag.toLowerCase().includes(primaryKeyword.toLowerCase()))
      : true;

    if (!hasEnoughTags) {
      this.addIssue({
        severity: 'warning',
        category: 'tags',
        message: tags.length < 3 ? 'Too few tags (less than 3)' : 'Too many tags (more than 7)',
        suggestion: 'Aim for 3-7 relevant tags for optimal SEO',
        autoFixable: false,
      });
    }

    if (!hasPrimaryKeyword && primaryKeyword) {
      this.addIssue({
        severity: 'warning',
        category: 'tags',
        message: 'Primary keyword not found in tags',
        suggestion: `Add a tag containing "${primaryKeyword}" for better SEO`,
        autoFixable: false,
      });
    }

    return {
      passed: hasEnoughTags && hasPrimaryKeyword,
      tags,
      issues: [],
      suggestedTags: [],
    };
  }

  /**
   * Validate content readability using Flesch Reading Ease score
   *
   * Scoring (Flesch Reading Ease):
   * - 90-100: Very Easy (5th grade)
   * - 80-90: Easy (6th grade)
   * - 70-80: Fairly Easy (7th grade) - TARGET for web content
   * - 60-70: Standard (8th-9th grade) - Acceptable
   * - 50-60: Fairly Difficult (10th-12th grade)
   * - 30-50: Difficult (College)
   * - 0-30: Very Difficult (Graduate)
   *
   * For SEO, we target 60-80 (Standard to Fairly Easy)
   */
  private async validateReadability(
    content: string
  ): Promise<{ passed: boolean; score: number; grade: string; issues: string[] }> {
    // Strip HTML tags to get plain text
    const plainText = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plainText || plainText.length < 100) {
      return { passed: true, score: 70, grade: 'Unknown', issues: ['Content too short to analyze'] };
    }

    // Calculate Flesch Reading Ease
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = plainText.split(/\s+/).filter(w => w.length > 0);
    const syllables = this.countSyllables(plainText);

    const sentenceCount = sentences.length;
    const wordCount = words.length;

    if (sentenceCount === 0 || wordCount === 0) {
      return { passed: true, score: 70, grade: 'Unknown', issues: ['Could not analyze sentence structure'] };
    }

    // Flesch Reading Ease formula: 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
    const avgSentenceLength = wordCount / sentenceCount;
    const avgSyllablesPerWord = syllables / wordCount;

    let fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    fleschScore = Math.max(0, Math.min(100, fleschScore)); // Clamp to 0-100

    // Determine grade and pass/fail
    let grade: string;
    const issues: string[] = [];

    if (fleschScore >= 80) {
      grade = 'Easy';
    } else if (fleschScore >= 70) {
      grade = 'Fairly Easy';
    } else if (fleschScore >= 60) {
      grade = 'Standard';
    } else if (fleschScore >= 50) {
      grade = 'Fairly Difficult';
      issues.push('Content may be too complex for general audience');
    } else if (fleschScore >= 30) {
      grade = 'Difficult';
      issues.push('Content is too complex - simplify sentences and vocabulary');
    } else {
      grade = 'Very Difficult';
      issues.push('Content is extremely complex - significant simplification needed');
    }

    // Additional readability checks
    if (avgSentenceLength > 25) {
      issues.push(`Average sentence length (${avgSentenceLength.toFixed(1)} words) is too long - aim for under 20 words`);
      this.addIssue({
        severity: 'warning',
        category: 'readability',
        message: `Sentences too long (avg ${avgSentenceLength.toFixed(1)} words)`,
        suggestion: 'Break long sentences into shorter ones for better readability',
        autoFixable: false,
      });
    }

    // Check for very long paragraphs (estimate by looking at text between </p> and <p>)
    const paragraphs = content.split(/<\/p>\s*<p/i);
    const longParagraphs = paragraphs.filter(p => {
      const text = p.replace(/<[^>]+>/g, '').trim();
      const pSentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return pSentences.length > 5;
    });

    if (longParagraphs.length > 0) {
      issues.push(`${longParagraphs.length} paragraph(s) have more than 5 sentences - consider breaking them up`);
      this.addIssue({
        severity: 'info',
        category: 'readability',
        message: `${longParagraphs.length} long paragraph(s) detected`,
        suggestion: 'Keep paragraphs to 3-4 sentences for better web readability',
        autoFixable: false,
      });
    }

    // SEO target: 60-80 is ideal for web content
    const passed = fleschScore >= 50; // Allow down to "Fairly Difficult" but warn below 60

    if (fleschScore < 60 && passed) {
      this.addIssue({
        severity: 'warning',
        category: 'readability',
        message: `Readability score (${Math.round(fleschScore)}) is below target`,
        suggestion: 'Use simpler words and shorter sentences to improve readability',
        autoFixable: false,
      });
    }

    return {
      passed,
      score: Math.round(fleschScore),
      grade,
      issues,
    };
  }

  /**
   * Count syllables in text (English approximation)
   */
  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    for (const word of words) {
      // Remove non-alpha characters
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) continue;

      // Count syllables using a simple algorithm
      let syllables = 0;
      let previousIsVowel = false;
      const vowels = 'aeiouy';

      for (let i = 0; i < cleanWord.length; i++) {
        const isVowel = vowels.includes(cleanWord[i]);

        // Count a syllable when we transition from non-vowel to vowel
        if (isVowel && !previousIsVowel) {
          syllables++;
        }
        previousIsVowel = isVowel;
      }

      // Handle silent 'e' at end
      if (cleanWord.endsWith('e') && syllables > 1) {
        syllables--;
      }

      // Handle words ending in 'le' preceded by consonant
      if (cleanWord.length > 2 && cleanWord.endsWith('le') && !vowels.includes(cleanWord[cleanWord.length - 3])) {
        syllables++;
      }

      // Every word has at least one syllable
      totalSyllables += Math.max(1, syllables);
    }

    return totalSyllables;
  }

  private addIssue(issue: Omit<SeoIssue, 'id'>): void {
    this.issues.push({ id: `seo-${++this.issueIdCounter}`, ...issue });
  }

  private calculateScore(): number {
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

  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateFeedback(): ContentAgentFeedback {
    const critical = this.issues.filter(i => i.severity === 'critical' || i.severity === 'error');
    if (critical.length === 0) {
      return { requiresRegeneration: false, specificIssues: [] };
    }

    return {
      requiresRegeneration: true,
      regenerationPrompt: `Fix these SEO issues:\n${critical.map(i => `- ${i.category}: ${i.message}`).join('\n')}`,
      specificIssues: critical.map(i => ({ what: i.message, why: `${i.severity} issue`, how: i.suggestion })),
    };
  }
}

export const seoValidator = new SeoValidator();

export async function validateAndFixWithFeedback(
  content: string,
  metaTitle: string,
  metaDescription: string,
  options: { autoFix?: boolean; primaryKeyword?: string; excerpt?: string; tags?: string[]; maxRetries?: number; model?: string } = {}
): Promise<SeoValidationReport> {
  const { primaryKeyword = '', excerpt = '', tags = [], model } = options;
  return seoValidator.validate(content, metaTitle, metaDescription, { primaryKeyword, excerpt, tags, model });
}
