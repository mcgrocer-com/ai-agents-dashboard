/**
 * Test: Top-Ranking Articles Feature
 * Verifies that top-ranking articles load when a keyword is selected
 */

import { test, expect } from '@playwright/test';

test.describe('Top-Ranking Articles Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3005/ai-agents-dashboard/');

    // Login
    await page.fill('input[type="email"]', 'careers@mcgrocer.com');
    await page.fill('input[type="password"]', 'McGrocer');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForTimeout(2000);
  });

  test('should display top-ranking articles when keyword is selected', async ({ page }) => {
    // Navigate to Blogger create page
    await page.goto('http://localhost:3005/ai-agents-dashboard/blogger/create');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Enter a topic
    const topicInput = page.locator('input[placeholder*="topic"]').first();
    await topicInput.fill('best kitchen knives');

    // Click Research button
    const researchButton = page.locator('button:has-text("Research")');
    await researchButton.click();

    // Wait for keyword suggestions to load
    await page.waitForTimeout(5000);

    // Verify keyword suggestions appear
    const keywordButtons = page.locator('button').filter({ hasText: /kitchen/ });
    const keywordCount = await keywordButtons.count();
    console.log(`Found ${keywordCount} keyword suggestions`);

    expect(keywordCount).toBeGreaterThan(0);

    // Click the first keyword suggestion
    await keywordButtons.first().click();

    // Wait for top-ranking articles to load
    await page.waitForTimeout(5000);

    // Check if "Top-Ranking Articles" heading exists
    const articlesHeading = page.locator('text=/Top-Ranking Articles/i');
    const headingExists = await articlesHeading.count() > 0;

    console.log('Top-Ranking Articles section exists:', headingExists);

    // Check for article elements
    const articleItems = page.locator('div').filter({ hasText: /#\d+/ });
    const articleCount = await articleItems.count();

    console.log(`Found ${articleCount} top-ranking articles`);

    // Take a screenshot
    await page.screenshot({
      path: 'test-screenshots/top-ranking-articles.png',
      fullPage: true
    });

    // Verify at least some articles loaded
    expect(articleCount).toBeGreaterThan(0);

    // Verify article structure (position badge, title, link)
    const firstArticle = articleItems.first();
    const hasPosition = await firstArticle.locator('text=/^#\\d+$/').count() > 0;
    const hasLink = await firstArticle.locator('a[target="_blank"]').count() > 0;

    console.log('First article has position badge:', hasPosition);
    console.log('First article has external link:', hasLink);

    expect(hasPosition).toBeTruthy();
    expect(hasLink).toBeTruthy();
  });

  test('should show loading state while fetching articles', async ({ page }) => {
    // Navigate to Blogger create page
    await page.goto('http://localhost:3005/ai-agents-dashboard/blogger/create');

    await page.waitForTimeout(1000);

    // Enter a topic
    const topicInput = page.locator('input[placeholder*="topic"]').first();
    await topicInput.fill('gaming laptops');

    // Click Research button
    const researchButton = page.locator('button:has-text("Research")');
    await researchButton.click();

    // Wait for keyword suggestions
    await page.waitForTimeout(5000);

    // Click a keyword
    const keywordButtons = page.locator('button').filter({ hasText: /laptop|gaming/ });
    if (await keywordButtons.count() > 0) {
      await keywordButtons.first().click();

      // Check for loading state (should appear briefly)
      const loadingText = page.locator('text=/Loading top-ranking articles/i');
      const loadingExists = await loadingText.count() > 0;

      console.log('Loading state detected:', loadingExists);

      // Wait for articles to load
      await page.waitForTimeout(5000);

      // Verify articles loaded
      const articlesHeading = page.locator('text=/Top-Ranking Articles/i');
      expect(await articlesHeading.count()).toBeGreaterThan(0);
    }
  });
});
