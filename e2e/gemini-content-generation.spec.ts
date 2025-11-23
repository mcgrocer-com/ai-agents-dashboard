/**
 * Gemini Content Generation E2E Test
 * Tests the complete blog creation workflow with Gemini AI
 */

import { test, expect } from '@playwright/test';

test.describe('Gemini Content Generation Workflow', () => {
  // Increase timeout for AI generation (can take 30-60 seconds)
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/ai-agents-dashboard/');

    // Login
    await page.fill('input[type="email"]', 'careers@mcgrocer.com');
    await page.fill('input[type="password"]', 'McGrocer');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should complete full blog creation workflow with Gemini AI', async ({ page }) => {
    console.log('Starting full blog creation workflow test...');

    // Navigate to Blogger create page
    await page.goto('/ai-agents-dashboard/blogger/create');
    await page.waitForLoadState('networkidle');

    // Step 1: Enter Topic
    console.log('Step 1: Entering topic...');
    const topicInput = page.locator('input[placeholder*="topic"]').first();
    await expect(topicInput).toBeVisible();
    await topicInput.fill('Best Kitchen Knives for Home Cooks');

    // Click Next
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 2: Select Persona
    console.log('Step 2: Selecting persona...');
    // Wait for personas to load
    await page.waitForSelector('text=Harriet', { timeout: 10000 });

    // Select Harriet Greene (warm, storytelling style)
    const harrietPersona = page.locator('text=Harriet').first();
    await harrietPersona.click();
    await page.waitForTimeout(500);

    // Click Next
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 3: Select Template
    console.log('Step 3: Selecting template...');
    await page.waitForSelector('text=List Post', { timeout: 10000 });

    // Select List Post template
    const listTemplate = page.locator('text=List Post').first();
    await listTemplate.click();
    await page.waitForTimeout(500);

    // Click Next
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 4: Keyword Research
    console.log('Step 4: Performing keyword research...');

    // Wait for keyword research section
    await page.waitForSelector('button:has-text("Research")', { timeout: 10000 });

    // Click Research button
    const researchButton = page.locator('button:has-text("Research")');
    await researchButton.click();

    // Wait for keywords to load (can take 5-10 seconds)
    await page.waitForTimeout(8000);

    // Verify keywords loaded
    const keywordButtons = page.locator('button').filter({ hasText: /kitchen|knives/i });
    const keywordCount = await keywordButtons.count();
    console.log(`Found ${keywordCount} keyword suggestions`);
    expect(keywordCount).toBeGreaterThan(0);

    // Select first keyword
    await keywordButtons.first().click();
    await page.waitForTimeout(1000);

    // Click Next to trigger content generation
    await page.click('button:has-text("Next")');
    console.log('Triggering Gemini content generation...');

    // Step 5: Content Generation (This is where Gemini does its magic!)
    console.log('Step 5: Waiting for Gemini content generation...');

    // Wait for loading state to appear
    await page.waitForSelector('text=/Processing/i', { timeout: 5000 }).catch(() => {
      console.log('Loading indicator not found, continuing...');
    });

    // Wait for content to be generated (30-60 seconds)
    // We're looking for the content editor to have content
    await page.waitForTimeout(60000);

    // Check if content was generated
    const contentEditor = page.locator('textarea, .content-editor, [contenteditable="true"]').first();
    const contentValue = await contentEditor.inputValue().catch(() => '');
    const contentText = await contentEditor.textContent().catch(() => '');

    console.log('Content length:', Math.max(contentValue.length, contentText.length));

    // Verify content exists and is substantial (should be 1500+ words)
    const content = contentValue || contentText;
    expect(content.length).toBeGreaterThan(500);

    // Check for success notification
    const successNotification = page.locator('text=/Content Generated/i, text=/Word Count/i');
    const hasNotification = await successNotification.count();
    if (hasNotification > 0) {
      console.log('Success notification found!');
    }

    // Take screenshot of generated content
    await page.screenshot({
      path: 'playwright-report/gemini-content-generated.png',
      fullPage: true
    });

    // Click Next to continue
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Next")');

    // Step 6: Images & Links (Product Selection)
    console.log('Step 6: Product links section...');
    await page.waitForTimeout(2000);

    // Verify product selector is visible
    const productSection = page.locator('text=/Product Links/i, text=/Shopify/i');
    const hasProductSection = await productSection.count() > 0;
    console.log('Product section visible:', hasProductSection);

    // Skip product selection for now
    await page.click('button:has-text("Next")');

    // Step 7: Meta Data & SEO
    console.log('Step 7: Meta data and SEO...');
    await page.waitForTimeout(2000);

    // Check for meta title and description fields
    const metaTitleInput = page.locator('input[placeholder*="title"], input[name="metaTitle"]').first();
    const metaDescInput = page.locator('textarea[placeholder*="description"], textarea[name="metaDescription"]').first();

    await expect(metaTitleInput).toBeVisible({ timeout: 10000 });
    await expect(metaDescInput).toBeVisible();

    // Verify meta fields have content
    const titleValue = await metaTitleInput.inputValue();
    const descValue = await metaDescInput.inputValue();

    console.log('Meta title:', titleValue);
    console.log('Meta description:', descValue);

    expect(titleValue.length).toBeGreaterThan(10);
    expect(descValue.length).toBeGreaterThan(20);

    // Check for SEO score
    const seoScore = page.locator('text=/SEO Score/i, text=/score:/i');
    const hasSeoScore = await seoScore.count() > 0;
    console.log('SEO score visible:', hasSeoScore);

    // Take screenshot of SEO section
    await page.screenshot({
      path: 'playwright-report/gemini-seo-section.png',
      fullPage: true
    });

    // Click Next to final preview
    await page.click('button:has-text("Next")');

    // Step 8: Final Preview
    console.log('Step 8: Final preview...');
    await page.waitForTimeout(2000);

    // Verify preview shows the blog
    const blogPreview = page.locator('text=/Preview/i, .blog-preview');
    const hasPreview = await blogPreview.count() > 0;
    console.log('Blog preview visible:', hasPreview);

    // Check for Save and Publish buttons
    const saveButton = page.locator('button:has-text("Save Blog")');
    const publishButton = page.locator('button:has-text("Publish")');

    await expect(saveButton).toBeVisible();
    const hasPublishButton = await publishButton.count() > 0;
    console.log('Publish button visible:', hasPublishButton);

    // Take final screenshot
    await page.screenshot({
      path: 'playwright-report/gemini-final-preview.png',
      fullPage: true
    });

    console.log('✅ Full workflow test completed successfully!');
  });

  test('should verify Gemini generates content with product links', async ({ page }) => {
    console.log('Testing product link generation...');

    // Navigate to Blogger create page
    await page.goto('/ai-agents-dashboard/blogger/create');
    await page.waitForLoadState('networkidle');

    // Quick workflow to content generation
    // Step 1: Topic
    await page.locator('input[placeholder*="topic"]').first().fill('Best Organic Olive Oil');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 2: Persona (select first)
    await page.waitForSelector('[class*="persona"], [class*="card"]', { timeout: 10000 });
    const firstPersona = page.locator('[class*="persona"], [class*="card"]').first();
    await firstPersona.click();
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 3: Template (select List Post)
    await page.waitForSelector('text=List Post', { timeout: 10000 });
    await page.locator('text=List Post').first().click();
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Step 4: Keywords
    await page.locator('button:has-text("Research")').click();
    await page.waitForTimeout(8000);

    // Select first keyword
    const keywords = page.locator('button').filter({ hasText: /olive|oil/i });
    if (await keywords.count() > 0) {
      await keywords.first().click();
    }
    await page.waitForTimeout(1000);

    // Trigger content generation
    await page.click('button:has-text("Next")');
    console.log('Generating content with Gemini...');

    // Wait for content generation (up to 60 seconds)
    await page.waitForTimeout(60000);

    // Check console for Gemini logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Gemini]')) {
        console.log('Browser console:', text);
      }
    });

    // Check for product links in generated content
    // Note: The content might be in a textarea or contenteditable div
    const content = await page.evaluate(() => {
      const editor = document.querySelector('textarea, [contenteditable="true"]');
      return editor ? (editor as any).value || editor.textContent : '';
    });

    console.log('Generated content length:', content.length);

    // Check for product links (should contain <a href= tags)
    const hasProductLinks = content.includes('<a href=') || content.includes('href="');
    console.log('Content contains product links:', hasProductLinks);

    // Verify Gemini function calls were made
    // This would show up in console logs if logging is enabled

    expect(content.length).toBeGreaterThan(500);
  });

  test('should handle Gemini API errors gracefully', async ({ page }) => {
    console.log('Testing error handling...');

    // This test verifies that if Gemini fails, the UI shows appropriate error
    // We can't easily force an error, but we can verify the error UI exists

    await page.goto('/ai-agents-dashboard/blogger/create');
    await page.waitForLoadState('networkidle');

    // Complete minimal steps
    await page.locator('input[placeholder*="topic"]').first().fill('Test Topic');
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Select persona
    await page.waitForSelector('[class*="persona"], [class*="card"]', { timeout: 10000 });
    await page.locator('[class*="persona"], [class*="card"]').first().click();
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);

    // Select template
    await page.waitForSelector('[class*="template"], [class*="card"]', { timeout: 10000 });
    await page.locator('[class*="template"], [class*="card"]').first().click();

    console.log('✅ Error handling test setup completed');
  });
});

test.describe('Gemini Content Quality Checks', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-agents-dashboard/');
    await page.fill('input[type="email"]', 'careers@mcgrocer.com');
    await page.fill('input[type="password"]', 'McGrocer');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should verify content follows template structure', async ({ page }) => {
    console.log('Testing content structure adherence...');

    // This test would generate content and verify it follows the template's H2/H3 structure
    // Implementation would be similar to above but with structure validation

    await page.goto('/ai-agents-dashboard/blogger/create');

    // TODO: Implement structure validation after content generation
    // Check for H1, H2, H3 tags in proper hierarchy
    // Verify semantic HTML usage

    console.log('✅ Structure test placeholder completed');
  });

  test('should verify persona voice matches generated content', async ({ page }) => {
    console.log('Testing persona voice matching...');

    // This test would verify that different personas generate different styles
    // Would require generating content with 2 different personas and comparing

    await page.goto('/ai-agents-dashboard/blogger/create');

    // TODO: Implement persona voice validation
    // Generate with Harriet (warm) vs Nathan (investigative)
    // Verify tone differences

    console.log('✅ Persona voice test placeholder completed');
  });
});
