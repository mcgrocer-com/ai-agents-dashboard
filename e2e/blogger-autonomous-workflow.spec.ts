import { test, expect } from '@playwright/test';

test.describe('Blogger Autonomous Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3007/ai-agents-dashboard/login');
    await page.fill('input[type="email"]', 'careers@mcgrocer.com');
    await page.fill('input[type="password"]', 'McGrocer');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard');

    // Navigate to blogger create
    await page.goto('http://localhost:3007/ai-agents-dashboard/blogger/create');
    await page.waitForLoadState('networkidle');
  });

  test('should show 7 steps in wizard header (not 8)', async ({ page }) => {
    // Check that Keyword Research step is removed from wizard header
    const stepTitles = await page.locator('.text-xs.text-center').allTextContents();

    expect(stepTitles).toContain('Topic Input');
    expect(stepTitles).toContain('Choose Persona');
    expect(stepTitles).toContain('Select Template');
    expect(stepTitles).toContain('Content Preview');
    expect(stepTitles).toContain('Images & Links');
    expect(stepTitles).toContain('Meta Data');
    expect(stepTitles).toContain('Final Preview');

    // Should NOT contain Keyword Research
    expect(stepTitles).not.toContain('Keyword Research');

    // Should have exactly 7 steps
    expect(stepTitles.filter(Boolean).length).toBe(7);
  });

  test('should generate content without keyword research step', async ({ page }) => {
    // Step 1: Enter topic
    await page.fill('input[placeholder*="topic"]', 'baby oil');
    await page.click('button:has-text("Next")');

    // Step 2: Select persona
    await page.click('text=Dr. Sarah Mitchell');
    await page.click('button:has-text("Next")');

    // Step 3: Select template
    await page.click('text=How-to Guide');
    await page.click('button:has-text("Next")');

    // Step 4: Should be Content Preview (not keyword research)
    await expect(page.locator('h3:has-text("Content Preview")')).toBeVisible();

    // Click generate content button
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for processing logs to appear
    await expect(page.locator('text=Agent Processing Log')).toBeVisible({ timeout: 5000 });

    // Wait for content generation to complete (timeout 120 seconds for AI)
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Check that content is displayed (not blank screen)
    const contentEditor = page.locator('textarea[placeholder*="HTML content"]');
    await expect(contentEditor).toBeVisible();

    const content = await contentEditor.inputValue();
    console.log('Generated content length:', content.length);

    // Content should not be empty
    expect(content.length).toBeGreaterThan(500);

    // Content should contain HTML tags
    expect(content).toContain('<h1>');
    expect(content).toContain('<p>');

    // Content should contain product images
    expect(content).toContain('<img');
    expect(content).toMatch(/src=["'][^"']+["']/);
    console.log('Content includes product images');

    // Take screenshot of content editor
    await page.screenshot({ path: 'e2e-screenshots/blogger-content-generated.png', fullPage: true });
  });

  test('should track AI agent function calls in processing logs', async ({ page }) => {
    // Step 1-3: Quick setup
    await page.fill('input[placeholder*="topic"]', 'kitchen knives');
    await page.click('button:has-text("Next")');
    await page.click('text=Marcus Thompson');
    await page.click('button:has-text("Next")');
    await page.click('text=Product Review');
    await page.click('button:has-text("Next")');

    // Generate content
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for agent processing log panel
    await expect(page.locator('text=Agent Processing Log')).toBeVisible({ timeout: 5000 });

    // Check for keyword research function call
    await expect(page.locator('text=Calling researchKeywords')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Found').first()).toBeVisible({ timeout: 10000 });

    // Check for top-ranking articles function call
    await expect(page.locator('text=Calling getTopRankingArticles')).toBeVisible({ timeout: 30000 });

    // Check for product search function calls (should be multiple)
    const productSearchLogs = await page.locator('text=Calling searchProducts').count();
    expect(productSearchLogs).toBeGreaterThanOrEqual(3); // Should call searchProducts 3-5 times

    // Wait for completion
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Take screenshot of processing logs
    await page.screenshot({ path: 'e2e-screenshots/blogger-processing-logs.png', fullPage: true });
  });

  test('should NOT show blank screen after content generation', async ({ page }) => {
    // Quick setup
    await page.fill('input[placeholder*="topic"]', 'gluten free diet');
    await page.click('button:has-text("Next")');
    await page.click('text=Emma Roberts');
    await page.click('button:has-text("Next")');
    await page.click('text=Listicle');
    await page.click('button:has-text("Next")');

    // Generate
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for completion
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Verify content editor is visible (not blank)
    await expect(page.locator('h3:has-text("Content Editor")')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="HTML content"]')).toBeVisible();

    // Verify regenerate button is visible
    await expect(page.locator('button:has-text("Regenerate")' )).toBeVisible();

    // Verify preview button is visible
    await expect(page.locator('button:has-text("Preview")')).toBeVisible();

    // Click preview to check HTML renders
    await page.click('button:has-text("Preview")');
    await page.waitForTimeout(1000);

    // Verify preview is not blank
    const previewContent = page.locator('.prose');
    await expect(previewContent).toBeVisible();

    const previewText = await previewContent.textContent();
    expect(previewText?.length || 0).toBeGreaterThan(100);

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/blogger-preview-not-blank.png', fullPage: true });
  });

  test('should capture and display AI-selected keyword in console logs', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    // Quick setup
    await page.fill('input[placeholder*="topic"]', 'baby formula');
    await page.click('button:has-text("Next")');
    await page.click('text=Dr. Sarah Mitchell');
    await page.click('button:has-text("Next")');
    await page.click('text=Buying Guide');
    await page.click('button:has-text("Next")');

    // Generate
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for completion
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Check console logs for selected keyword
    const selectedKeywordLog = consoleLogs.find(log => log.includes('Selected keyword:'));
    expect(selectedKeywordLog).toBeTruthy();
    console.log('Found selected keyword log:', selectedKeywordLog);

    // Verify keyword was actually selected (not empty)
    expect(selectedKeywordLog).not.toContain('Selected keyword: ""');
    expect(selectedKeywordLog).not.toContain('Selected keyword: undefined');
  });

  test('should embed product images in generated content', async ({ page }) => {
    // Capture console logs for image count
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    // Quick setup
    await page.fill('input[placeholder*="topic"]', 'organic honey');
    await page.click('button:has-text("Next")');
    await page.click('text=Emma Roberts');
    await page.click('button:has-text("Next")');
    await page.click('text=Product Review');
    await page.click('button:has-text("Next")');

    // Generate
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for completion
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Get generated content
    const contentEditor = page.locator('textarea[placeholder*="HTML content"]');
    const content = await contentEditor.inputValue();

    // Verify images are embedded
    const imageMatches = content.match(/<img[^>]+>/g);
    expect(imageMatches).toBeTruthy();
    expect(imageMatches!.length).toBeGreaterThanOrEqual(3); // Should have at least 3 product images

    // Verify images have proper attributes
    expect(content).toContain('src=');
    expect(content).toContain('alt=');

    // Check console logs for image count
    const imageCountLog = consoleLogs.find(log => log.includes('Product images embedded:'));
    expect(imageCountLog).toBeTruthy();
    console.log('Found image count log:', imageCountLog);

    // Take screenshot
    await page.screenshot({ path: 'e2e-screenshots/blogger-product-images.png', fullPage: true });
  });

  test('should generate content with proper HTML formatting', async ({ page }) => {
    // Quick setup
    await page.fill('input[placeholder*="topic"]', 'skincare routine');
    await page.click('button:has-text("Next")');
    await page.click('text=Dr. Sarah Mitchell');
    await page.click('button:has-text("Next")');
    await page.click('text=How-to Guide');
    await page.click('button:has-text("Next")');

    // Generate
    await page.click('button:has-text("Generate Content with AI")');

    // Wait for completion
    await expect(page.locator('text=Blog content generated successfully')).toBeVisible({ timeout: 120000 });

    // Get generated content
    const contentEditor = page.locator('textarea[placeholder*="HTML content"]');
    const content = await contentEditor.inputValue();

    // Verify HTML structure tags
    expect(content).toMatch(/<h1[^>]*>.*<\/h1>/); // Has H1 heading
    expect(content).toMatch(/<h2[^>]*>.*<\/h2>/); // Has H2 headings
    expect(content).toMatch(/<p[^>]*>.*<\/p>/); // Has paragraphs

    // Verify formatting tags
    expect(content).toContain('<strong>'); // Has bold text
    expect(content).toContain('<em>'); // Has italic text

    // Verify lists (should have at least one type)
    const hasLists = content.includes('<ul>') || content.includes('<ol>');
    expect(hasLists).toBeTruthy();

    console.log('Content has proper HTML structure with h1, h2, p, strong, em, and lists');

    // Click preview to verify HTML renders correctly
    await page.click('button:has-text("Preview")');
    await page.waitForTimeout(1000);

    // Verify preview renders headings
    const previewH1 = page.locator('.prose h1');
    await expect(previewH1).toBeVisible();

    const previewH2 = page.locator('.prose h2').first();
    await expect(previewH2).toBeVisible();

    // Take screenshot of preview
    await page.screenshot({ path: 'e2e-screenshots/blogger-html-formatting.png', fullPage: true });
  });
});
