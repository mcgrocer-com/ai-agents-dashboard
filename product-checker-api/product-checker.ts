/**
 * Product Checker Service
 * Uses Stagehand with Gemini AI for product extraction from UK retailer sites
 * Supports proxy via pure Playwright when USE_PROXY=true, with direct fallback
 * Uses playwright-extra with stealth plugin to bypass anti-bot detection
 */
import { Stagehand } from "@browserbasehq/stagehand";
import { chromium } from "playwright-extra";
import type { Browser, BrowserContext, Page } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { z } from "zod";
import { needsSiteSpecificExtraction, extractWithSiteSpecific } from "./site-extractors";

// Apply stealth plugin to bypass anti-bot detection (Imperva, Cloudflare, etc.)
chromium.use(StealthPlugin());

export interface ProductCheckResult {
  url: string;
  product: string;
  price: string;
  availability: "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";
  originalPrice?: string;
  currency?: string;
  extractionMethod: "css" | "ai";
  checkedAt: string;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 15000,
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

/**
 * Check product details from a given URL with automatic retry logic
 */
export async function checkProduct(url: string, expectedProductName?: string): Promise<ProductCheckResult> {
  let lastError: Error | null = null;
  let lastResult: ProductCheckResult | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = getRetryDelay(attempt - 1);
      console.log(`[ProductChecker] Retry ${attempt}/${RETRY_CONFIG.maxRetries} after ${Math.round(delayMs)}ms delay...`);
      await sleep(delayMs);
    }

    try {
      const result = await attemptProductCheck(url, expectedProductName, attempt);

      if (result.price !== "Unknown" && result.price !== "Price not found") {
        console.log(`[ProductChecker] Success on attempt ${attempt + 1}`);
        return result;
      }

      lastResult = result;
      console.log(`[ProductChecker] Attempt ${attempt + 1} returned incomplete data (price: ${result.price})`);

      if (attempt >= RETRY_CONFIG.maxRetries) {
        console.log(`[ProductChecker] Max retries reached, returning best result`);
        return result;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[ProductChecker] Attempt ${attempt + 1} failed: ${lastError.message}`);

      if (attempt >= RETRY_CONFIG.maxRetries) {
        throw lastError;
      }
    }
  }

  if (lastResult) {
    return lastResult;
  }
  throw lastError || new Error("Product check failed after retries");
}

/**
 * Shared browser arguments
 */
const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/**
 * AI extraction schema
 */
const AI_EXTRACTION_SCHEMA = z.object({
  productName: z.string().describe("The main product name/title displayed on the page"),
  price: z.string().describe("The current selling price with currency symbol (e.g., £109, $99.99, €50)"),
  availability: z
    .enum(["In Stock", "Out of Stock", "Limited Stock", "Pre-order", "Unknown"])
    .describe(
      "In Stock = has Add to Cart/Bag/Basket/Trolley button or standalone 'Add' button; " +
      "Out of Stock = Sold Out or Unavailable; " +
      "Limited Stock = Low stock warning; " +
      "Pre-order = available for pre-order; " +
      "Unknown = cannot determine"
    ),
  originalPrice: z.string().nullish().describe("Original/RRP price if product is on sale (e.g., Was £150)"),
  currency: z.string().nullish().describe("Currency code: GBP, USD, EUR"),
});

/**
 * Build AI extraction prompt
 */
function buildExtractionPrompt(expectedProductName?: string): string {
  const productHint = expectedProductName
    ? `CRITICAL: The product you MUST find is "${expectedProductName}". ONLY extract information for this specific product. If you see promotional banners, sale announcements, or other products, IGNORE them completely. The product name should closely match "${expectedProductName}". `
    : "";

  return productHint +
    "Extract product information from this e-commerce PRODUCT PAGE. " +
    "IGNORE COMPLETELY: Sale banners, promotional headers (like 'UP TO X% OFF'), navigation menus, footer links, " +
    "'You may also like' sections, 'Customers who viewed this' sections, 'Sponsored products' sections, " +
    "'Related products' sections, and any promotional overlays or recommendation carousels. " +
    "FOCUS ONLY ON: The MAIN product detail section at the TOP of the page. This section contains: " +
    "- The main product H1 heading (the largest title for THIS product) " +
    "- The main product price displayed DIRECTLY below or beside the H1 title " +
    "- The main 'Add to Basket/Cart/Bag' button for THIS product " +
    "1) PRODUCT NAME: Find the H1 heading - the main product title at the top of the page. " +
    "2) PRICE: Find the price displayed IMMEDIATELY next to or below the H1 product title. " +
    "   DO NOT use prices from 'Sponsored products', 'Related items', or recommendation sections. " +
    "   The main product price is typically displayed prominently near the H1 title, not in carousels. " +
    "3) AVAILABILITY: Check the main 'Add to Basket' button near the product title. " +
    "- IN STOCK: Main 'Add to Bag/Cart/Basket/Trolley/Buy Now' button or standalone 'Add' button is clickable/enabled. " +
    "- OUT OF STOCK: 'Sold Out', 'Out of Stock', 'Unavailable', or main add button is disabled. " +
    "- LIMITED STOCK: 'Low Stock', 'Only X left', 'Limited Availability', 'Hurry'. " +
    "- PRE-ORDER: 'Pre-order', 'Coming Soon'. " +
    "Default to 'In Stock' if main add-to-cart button exists without out-of-stock indicators.";
}

/**
 * Perform AI extraction using an existing Stagehand instance
 */
async function performAIExtraction(
  stagehand: Stagehand,
  expectedProductName: string | undefined
): Promise<{
  productName: string;
  price: string;
  availability: "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";
  originalPrice?: string;
  currency?: string;
}> {
  // Try to dismiss cookie banners
  try {
    await stagehand.act(
      "Click 'Accept All', 'Accept Cookies', 'Accept', 'OK', 'Got it', or any button to dismiss cookie banner if visible"
    );
  } catch {
    // No banner or already dismissed
  }

  console.log(`[ProductChecker] Extracting product data with AI...`);
  const extractResult = await stagehand.extract(
    buildExtractionPrompt(expectedProductName),
    AI_EXTRACTION_SCHEMA
  );

  const productData = parseExtractResult(extractResult);
  console.log(`[ProductChecker] AI extraction result:`, productData);

  return productData;
}

/**
 * Proxy configuration interface
 */
interface ProxyConfig {
  server: string;
  username: string;
  password: string;
}

/**
 * Product check using pure Playwright with proxy support
 * Falls back to direct access if proxy is blocked
 */
async function attemptProductCheckWithProxy(
  url: string,
  expectedProductName: string | undefined,
  attempt: number,
  proxy: ProxyConfig
): Promise<ProductCheckResult> {
  console.log(`[ProductChecker] Using proxy: ${proxy.server}`);

  const hasDisplay = !!process.env.DISPLAY;
  let browser: Browser | null = null;

  try {
    // Pass proxy at browser launch level (like sainsbury.py does)
    browser = await chromium.launch({
      headless: !hasDisplay,
      args: BROWSER_ARGS,
      proxy: {
        server: proxy.server,  // No http:// prefix, just host:port
        username: proxy.username,
        password: proxy.password,
      },
    });

    // Create context with realistic browser fingerprint to bypass Imperva
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-GB",
      timezoneId: "Europe/London",
      permissions: ["geolocation"],
      geolocation: { latitude: 51.5074, longitude: -0.1278 }, // London
      colorScheme: "light",
    });

    const page: Page = await context.newPage();

    // Log messages from the browser console to help debug extractors
    page.on("console", (msg) => {
      const text = msg.text();
      // Skip noise but keep our extractor logs
      if (text.includes("[BootsExtractor]") || text.includes("[SiteExtractor]")) {
        console.log(`[Browser] ${text}`);
      }
    });

    // Add random delay to appear more human-like
    await page.waitForTimeout(1000 + Math.random() * 2000);

    // Simulate mouse movement before navigation (helps bypass behavioral detection)
    await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);

    console.log(`[ProductChecker] Navigating to ${url} via proxy`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      console.log(`[ProductChecker] Navigation succeeded`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.log(`[ProductChecker] Navigation error:`, errorMsg);

      // If proxy tunnel fails completely, fall back to direct access
      if (errorMsg.includes("ERR_TUNNEL_CONNECTION_FAILED") || errorMsg.includes("ERR_PROXY")) {
        console.log(`[ProductChecker] Proxy tunnel blocked, falling back to direct access...`);
        await browser.close();
        browser = null;
        return await attemptProductCheckDirect(url, expectedProductName, attempt);
      }

      // Otherwise retry with networkidle
      await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    }

    // Simulate human behavior: random wait, mouse movements, and scroll
    await page.waitForTimeout(1500 + Math.random() * 1500);
    await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 300);
    await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 200));
    await page.waitForTimeout(500 + Math.random() * 1000);

    const currentUrl = page.url();
    console.log(`[ProductChecker] Page URL: ${currentUrl}`);

    if (currentUrl.includes("chrome-error://") || currentUrl === "about:blank") {
      throw new Error(`Navigation failed - page shows ${currentUrl}`);
    }

    // Try CSS extraction
    if (needsSiteSpecificExtraction(url)) {
      console.log(`[ProductChecker] Attempting CSS extraction via proxy...`);
      const siteData = await extractWithSiteSpecific(
        url,
        page as unknown as Parameters<typeof extractWithSiteSpecific>[1]
      );
      if (siteData && siteData.productName !== "Unknown" && siteData.price !== "Unknown") {
        console.log(`[ProductChecker] CSS extraction successful:`, siteData);
        return {
          url,
          product: siteData.productName.replace(/\s+/g, " ").trim(),
          price: siteData.price || "Unknown",
          availability: siteData.availability,
          originalPrice: siteData.originalPrice,
          currency: siteData.currency,
          extractionMethod: "css",
          checkedAt: new Date().toISOString(),
        };
      }
      console.log(`[ProductChecker] CSS extraction incomplete, falling back to direct + AI`);
    }

    // Close proxy browser and fall back to direct Stagehand for AI extraction
    await browser.close();
    browser = null;
    return await attemptProductCheckDirect(url, expectedProductName, attempt);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Single attempt to check product using Stagehand with CSS extraction + AI fallback (direct, no proxy)
 */
async function attemptProductCheckDirect(
  url: string,
  expectedProductName: string | undefined,
  attempt: number
): Promise<ProductCheckResult> {
  const hasDisplay = !!process.env.DISPLAY;
  console.log(`[ProductChecker] Direct access attempt: DISPLAY=${process.env.DISPLAY}, using headless=${!hasDisplay}`);

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "gemini-2.0-flash",
    localBrowserLaunchOptions: {
      headless: !hasDisplay,
      viewport: { width: 1280, height: 720 },
      connectTimeoutMs: 60000,
      args: BROWSER_ARGS,
    },
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Log messages from the browser console to help debug extractors
    page.on("console", (msg) => {
      const text = msg.text();
      // Skip noise but keep our extractor logs
      if (text.includes("[BootsExtractor]") || text.includes("[SiteExtractor]")) {
        console.log(`[Browser] ${text}`);
      }
    });

    console.log(`[ProductChecker] Navigating to ${url} (direct)`);
    let navigationSucceeded = false;

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeoutMs: 60000 });
      if (response) {
        const finished = await response.finished();
        const status = response.status();
        if (finished instanceof Error) {
          console.log(`[ProductChecker] Navigation failed:`, finished.message);
        } else if (status >= 200 && status < 400) {
          navigationSucceeded = true;
          console.log(`[ProductChecker] Navigation succeeded, status: ${status}`);
        } else {
          console.log(`[ProductChecker] Navigation returned error status: ${status}`);
        }
      }
    } catch (e) {
      console.log(`[ProductChecker] Navigation error:`, e instanceof Error ? e.message : e);
    }

    let currentUrl = page.url();
    console.log(`[ProductChecker] Page URL after goto: ${currentUrl}`);

    if (!navigationSucceeded || currentUrl.includes("chrome-error://") || currentUrl === "about:blank") {
      console.log(`[ProductChecker] Initial navigation failed, retrying with networkidle...`);
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const response = await page.goto(url, { waitUntil: "networkidle", timeoutMs: 90000 });
        if (response) {
          const finished = await response.finished();
          if (!(finished instanceof Error)) {
            navigationSucceeded = true;
            console.log(`[ProductChecker] Retry navigation succeeded`);
          }
        }
      } catch (e) {
        console.log(`[ProductChecker] Retry navigation error:`, e instanceof Error ? e.message : e);
      }
      currentUrl = page.url();
      console.log(`[ProductChecker] Page URL after retry: ${currentUrl}`);
    }

    console.log(`[ProductChecker] Waiting for product content to load...`);
    try {
      await stagehand.act("wait for the product details and price to be visible on the page");
    } catch {
      console.log(`[ProductChecker] Content wait completed or timed out`);
    }

    currentUrl = page.url();
    console.log(`[ProductChecker] Final page URL: ${currentUrl}`);

    if (currentUrl.includes("chrome-error://") || currentUrl === "about:blank") {
      throw new Error(`Navigation failed - page shows ${currentUrl}`);
    }

    // Try CSS extraction first
    if (needsSiteSpecificExtraction(url)) {
      console.log(`[ProductChecker] Attempting CSS extraction...`);
      const siteData = await extractWithSiteSpecific(url, page as unknown as Parameters<typeof extractWithSiteSpecific>[1]);

      // Accept CSS extraction if we have good data (both name and price)
      // OR if we have valid availability (not Unknown) - availability is critical for price comparison
      const hasGoodData = siteData && siteData.productName !== "Unknown" && siteData.price !== "Unknown";
      const hasValidAvailability = siteData && siteData.availability !== "Unknown";

      if (hasGoodData) {
        console.log(`[ProductChecker] CSS extraction successful:`, siteData);
        return {
          url,
          product: siteData.productName.replace(/\s+/g, " ").trim(),
          price: siteData.price || "Unknown",
          availability: siteData.availability,
          originalPrice: siteData.originalPrice,
          currency: siteData.currency,
          extractionMethod: "css",
          checkedAt: new Date().toISOString(),
        };
      }

      // If we have valid availability but incomplete data, return it anyway
      // This is better than waiting for AI fallback to fail
      if (hasValidAvailability) {
        console.log(`[ProductChecker] CSS extraction partial (availability=${siteData.availability}):`, siteData);
        return {
          url,
          product: siteData.productName !== "Unknown" ? siteData.productName.replace(/\s+/g, " ").trim() : "Unknown",
          price: siteData.price || "Unknown",
          availability: siteData.availability,
          originalPrice: siteData.originalPrice,
          currency: siteData.currency,
          extractionMethod: "css",
          checkedAt: new Date().toISOString(),
        };
      }

      console.log(`[ProductChecker] CSS extraction incomplete, falling back to AI`);
    }

    // Fall back to AI extraction
    const productData = await performAIExtraction(stagehand, expectedProductName);

    return {
      url,
      product: productData.productName,
      price: productData.price,
      availability: productData.availability,
      originalPrice: productData.originalPrice,
      currency: productData.currency,
      extractionMethod: "ai",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await stagehand.close();
  }
}

/**
 * Single attempt to check product - uses proxy if configured, with direct fallback
 */
async function attemptProductCheck(
  url: string,
  expectedProductName: string | undefined,
  attempt: number
): Promise<ProductCheckResult> {
  const hasDisplay = !!process.env.DISPLAY;
  console.log(`[ProductChecker] Attempt ${attempt + 1}: DISPLAY=${process.env.DISPLAY}, using headless=${!hasDisplay}`);

  // Check if proxy is configured
  const useProxy = process.env.USE_PROXY === "true";
  const proxyServer = process.env.PROXY_SERVER;
  const proxyUsername = process.env.PROXY_USERNAME;
  const proxyPassword = process.env.PROXY_PASSWORD;

  // Use proxy if configured
  if (useProxy && proxyServer && proxyUsername && proxyPassword) {
    return attemptProductCheckWithProxy(url, expectedProductName, attempt, {
      server: proxyServer,
      username: proxyUsername,
      password: proxyPassword,
    });
  }

  // Direct access (no proxy)
  return attemptProductCheckDirect(url, expectedProductName, attempt);
}

/**
 * Parse extraction result from Stagehand AI
 */
function parseExtractResult(extractResult: unknown): {
  productName: string;
  price: string;
  availability: "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";
  originalPrice?: string;
  currency?: string;
} {
  const result = extractResult as Record<string, unknown>;

  if (result.productName && typeof result.productName === "string") {
    return {
      productName: result.productName.replace(/\s+/g, " ").trim(),
      price: String(result.price || "Unknown"),
      availability: validateAvailability(result.availability),
      originalPrice: result.originalPrice ? String(result.originalPrice) : undefined,
      currency: result.currency ? String(result.currency) : undefined,
    };
  }

  // Fallback: parse from raw pageText
  if (result.pageText && typeof result.pageText === "string") {
    const pageText = result.pageText;

    const nameMatch = pageText.match(/heading: ([^\n]+)/i);
    const productName = nameMatch ? nameMatch[1].replace(/\s+/g, " ").trim() : "Unknown Product";

    const priceMatch = pageText.match(/StaticText: ([£€$][\d,.]+)/);
    const price = priceMatch ? priceMatch[1] : "Price not found";

    const pageTextLower = pageText.toLowerCase();
    const hasAddToCart =
      pageTextLower.includes("add to bag") ||
      pageTextLower.includes("add to cart") ||
      pageTextLower.includes("add to basket") ||
      pageTextLower.includes("add to trolley") ||
      pageTextLower.includes("buy now") ||
      pageTextLower.includes("purchase") ||
      pageText.includes("button: Add") ||
      /button[:\s]*add(?!\s+to\s+(?:wishlist|favourites|favorite|list))/i.test(pageText);
    const isSoldOut =
      pageTextLower.includes("sold out") ||
      pageTextLower.includes("out of stock") ||
      pageTextLower.includes("currently unavailable") ||
      pageTextLower.includes("not available") ||
      pageTextLower.includes("unavailable");
    const isLimitedStock =
      pageTextLower.includes("low stock") ||
      (pageTextLower.includes("only") && pageTextLower.includes("left")) ||
      pageTextLower.includes("limited availability") ||
      pageTextLower.includes("hurry");
    const isPreOrder =
      pageTextLower.includes("pre-order") ||
      pageTextLower.includes("preorder") ||
      pageTextLower.includes("coming soon");

    let availability: "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";
    if (isSoldOut) {
      availability = "Out of Stock";
    } else if (isPreOrder) {
      availability = "Pre-order";
    } else if (isLimitedStock) {
      availability = "Limited Stock";
    } else if (hasAddToCart) {
      availability = "In Stock";
    } else {
      availability = "Unknown";
    }

    return { productName, price, availability };
  }

  return { productName: "Unknown", price: "Unknown", availability: "Unknown" };
}

/**
 * Validate availability value
 */
function validateAvailability(
  value: unknown
): "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown" {
  const validValues = ["In Stock", "Out of Stock", "Limited Stock", "Pre-order", "Unknown"];
  if (typeof value === "string" && validValues.includes(value)) {
    return value as "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";
  }
  return "Unknown";
}

/**
 * Check product using a provided page from the browser pool
 * This is more efficient as it doesn't need to launch a new browser
 */
export async function checkProductWithPage(
  page: Page,
  url: string,
  expectedProductName?: string
): Promise<ProductCheckResult> {
  console.log(`[ProductChecker] Navigating to ${url} with pooled browser`);

  // Add random delay to appear more human-like
  await page.waitForTimeout(500 + Math.random() * 1000);

  // Simulate mouse movement before navigation
  await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`[ProductChecker] Navigation succeeded`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log(`[ProductChecker] Navigation error:`, errorMsg);

    // Retry with networkidle
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  }

  // Simulate human behavior
  await page.waitForTimeout(1000 + Math.random() * 1000);
  await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 300);
  await page.evaluate(() => window.scrollBy(0, 100 + Math.random() * 200));
  await page.waitForTimeout(300 + Math.random() * 500);

  const currentUrl = page.url();
  console.log(`[ProductChecker] Page URL: ${currentUrl}`);

  if (currentUrl.includes("chrome-error://") || currentUrl === "about:blank") {
    throw new Error(`Navigation failed - page shows ${currentUrl}`);
  }

  // Try CSS extraction first
  if (needsSiteSpecificExtraction(url)) {
    console.log(`[ProductChecker] Attempting CSS extraction...`);
    const siteData = await extractWithSiteSpecific(
      url,
      page as unknown as Parameters<typeof extractWithSiteSpecific>[1]
    );

    if (siteData && siteData.productName !== "Unknown" && siteData.price !== "Unknown") {
      console.log(`[ProductChecker] CSS extraction successful:`, siteData);
      return {
        url,
        product: siteData.productName.replace(/\s+/g, " ").trim(),
        price: siteData.price || "Unknown",
        availability: siteData.availability,
        originalPrice: siteData.originalPrice,
        currency: siteData.currency,
        extractionMethod: "css",
        checkedAt: new Date().toISOString(),
      };
    }

    // Accept partial data if we have valid availability
    if (siteData && siteData.availability !== "Unknown") {
      console.log(`[ProductChecker] CSS extraction partial:`, siteData);
      return {
        url,
        product: siteData.productName !== "Unknown" ? siteData.productName.replace(/\s+/g, " ").trim() : "Unknown",
        price: siteData.price || "Unknown",
        availability: siteData.availability,
        originalPrice: siteData.originalPrice,
        currency: siteData.currency,
        extractionMethod: "css",
        checkedAt: new Date().toISOString(),
      };
    }

    console.log(`[ProductChecker] CSS extraction incomplete, falling back to AI`);
  }

  // Fall back to AI extraction using Stagehand
  // Note: This creates a new Stagehand instance since it needs its own browser context
  console.log(`[ProductChecker] Using AI extraction fallback...`);
  const hasDisplay = !!process.env.DISPLAY;

  // Get proxy configuration for Stagehand fallback
  const useProxy = process.env.USE_PROXY === "true";
  const proxyServer = process.env.PROXY_SERVER;
  const proxyUsername = process.env.PROXY_USERNAME;
  const proxyPassword = process.env.PROXY_PASSWORD;

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "gemini-2.0-flash",
    localBrowserLaunchOptions: {
      headless: !hasDisplay,
      viewport: { width: 1280, height: 720 },
      connectTimeoutMs: 60000,
      args: BROWSER_ARGS,
      // Add proxy configuration if available
      ...(useProxy && proxyServer && proxyUsername && proxyPassword
        ? {
            proxy: {
              server: proxyServer,
              username: proxyUsername,
              password: proxyPassword,
            },
          }
        : {}),
    },
  });

  try {
    await stagehand.init();
    const stagehandPage = stagehand.context.pages()[0];

    await stagehandPage.goto(url, { waitUntil: "domcontentloaded", timeoutMs: 60000 });

    try {
      await stagehand.act("wait for the product details and price to be visible on the page");
    } catch {
      // Content wait completed or timed out
    }

    const productData = await performAIExtraction(stagehand, expectedProductName);

    return {
      url,
      product: productData.productName,
      price: productData.price,
      availability: productData.availability,
      originalPrice: productData.originalPrice,
      currency: productData.currency,
      extractionMethod: "ai",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await stagehand.close();
  }
}
