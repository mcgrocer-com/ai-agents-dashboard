/**
 * Test script for Gemini content generation
 * Tests the new AI service with function calling
 */

import { generateBlogWithGemini } from './src/services/blogger/gemini-content.service';

// Mock persona (simplified for testing)
const mockPersona = {
  id: 'test-persona-1',
  name: 'Test Writer',
  role: 'Food & Lifestyle Blogger',
  bio: 'Experienced food writer',
  expertise: 'Food, cooking, kitchen equipment',
  context_data: {
    years_experience: 10,
    location: 'London, UK',
    writing_style: 'Warm, conversational, practical',
    methodology: 'Hands-on testing and research',
    purpose: 'Help readers make informed kitchen purchases',
    career_milestone: 'Published cookbook author',
    best_templates: ['How-to Post', 'Review Post', 'List Post'],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock template
const mockTemplate = {
  id: 'test-template-1',
  name: 'List Post',
  description: 'Numbered list format (e.g., "Top 10 Ways...")',
  content_structure: `
H1: [Number] [Adjective] Ways to [Action] [Topic]
Introduction: Hook + Preview of list
H2: 1. [First Item]
  - Explanation
  - Benefits
  - Example or tip
H2: 2. [Second Item]
  - Explanation
  - Benefits
  - Example or tip
[Continue for remaining items]
Conclusion: Summary + CTA
`,
  seo_rules: 'Include primary keyword in H1, H2s, and naturally in content. Add internal product links. Use semantic HTML.',
  prompt_template: 'Write in a friendly, helpful tone. Provide actionable advice. Include specific examples.',
  notes: 'Keep items concise but informative. Use numbered lists for clarity.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock keyword
const mockKeyword = {
  id: 'test-keyword-1',
  keyword: 'best kitchen knives',
  topic: 'kitchen knives',
  search_volume: 5400,
  cpc: 1.25,
  competition: 'medium',
  intent: 'informational',
  user_id: null,
  created_at: new Date().toISOString(),
};

// Test request
const testRequest = {
  topic: 'Best Kitchen Knives for Home Cooks',
  persona: mockPersona,
  template: mockTemplate,
  primaryKeyword: mockKeyword,
  keywords: [
    'best kitchen knives',
    'chef knife recommendations',
    'kitchen knife sets',
    'professional kitchen knives',
    'knife buying guide',
  ],
};

async function runTest() {
  console.log('='.repeat(60));
  console.log('Testing Gemini Content Generation');
  console.log('='.repeat(60));
  console.log('');
  console.log('Topic:', testRequest.topic);
  console.log('Persona:', testRequest.persona.name);
  console.log('Template:', testRequest.template.name);
  console.log('Keyword:', testRequest.primaryKeyword.keyword);
  console.log('');
  console.log('Starting generation...');
  console.log('');

  const startTime = Date.now();

  try {
    const result = await generateBlogWithGemini(testRequest);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result.success && result.data) {
      console.log('✅ SUCCESS!');
      console.log('');
      console.log('Generation Stats:');
      console.log('- Duration:', duration, 'seconds');
      console.log('- Word Count:', result.data.wordCount);
      console.log('- Product Links:', result.data.productLinks.length);
      console.log('- Articles Analyzed:', result.data.articlesAnalyzed);
      console.log('');
      console.log('Content Preview (first 500 characters):');
      console.log('-'.repeat(60));
      console.log(result.data.content.substring(0, 500) + '...');
      console.log('-'.repeat(60));
      console.log('');
      console.log('Product Handles Used:');
      result.data.productLinks.forEach((handle, i) => {
        console.log(`  ${i + 1}. ${handle}`);
      });
    } else {
      console.log('❌ FAILED');
      console.log('Error:', result.error?.message || 'Unknown error');
    }
  } catch (error) {
    console.log('❌ EXCEPTION');
    console.error(error);
  }
}

runTest();
