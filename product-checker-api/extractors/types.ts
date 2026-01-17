/**
 * Shared types for vendor extractors
 */

export type AvailabilityStatus = "In Stock" | "Out of Stock" | "Limited Stock" | "Pre-order" | "Unknown";

export interface SiteExtractionResult {
  productName: string;
  price: string | null;  // null when price cannot be extracted (e.g., out of stock products)
  availability: AvailabilityStatus;
  originalPrice?: string;
  currency?: string;
}

export type PageWithEvaluate = {
  evaluate: <T>(fn: () => T) => Promise<T>;
  waitForSelector?: (selector: string, options?: { timeout?: number; timeoutMs?: number }) => Promise<unknown>;
  waitForLoadState?: (state: string, options?: { timeout?: number; timeoutMs?: number }) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow additional properties from Stagehand Page
};

/**
 * Wait for page content to be ready before extraction
 * Returns true if content is found, false if timeout
 * Waits for both H1 and price-related content to ensure page is fully loaded
 */
export async function waitForContent(page: PageWithEvaluate, timeout = 15000): Promise<boolean> {
  const startTime = Date.now();

  // Poll for h1 element to appear first
  while (Date.now() - startTime < timeout) {
    try {
      const hasContent = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        return h1 && h1.textContent && h1.textContent.trim().length > 0;
      });
      if (hasContent) break;
    } catch {
      // Page might not be ready, continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // After H1 is found, wait a bit more for dynamic content (prices often load async)
  // and also check for price-related elements
  const priceWaitStart = Date.now();
  const priceWaitTimeout = Math.min(5000, timeout - (Date.now() - startTime));

  while (Date.now() - priceWaitStart < priceWaitTimeout) {
    try {
      const hasPriceContent = await page.evaluate(() => {
        // Check for common price indicators
        const priceSelectors = [
          '[class*="price"]',
          '[data-testid*="price"]',
          '[itemprop="price"]',
          '.pd__cost',
          '[class*="cost"]'
        ];

        for (const selector of priceSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && /£\d/.test(el.textContent)) {
            return true;
          }
        }

        // Also check for £ symbol in page text near H1
        const h1 = document.querySelector("h1");
        if (h1 && h1.parentElement?.parentElement) {
          const nearbyText = h1.parentElement.parentElement.textContent || "";
          if (/£\d+\.\d{2}/.test(nearbyText)) {
            return true;
          }
        }

        return false;
      });
      if (hasPriceContent) return true;
    } catch {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Return true if H1 was found (even if no price yet - extractor will handle it)
  return Date.now() - startTime < timeout;
}

export function validateAvailability(value: unknown): AvailabilityStatus {
  const validValues: AvailabilityStatus[] = ["In Stock", "Out of Stock", "Limited Stock", "Pre-order", "Unknown"];
  if (typeof value === "string" && validValues.includes(value as AvailabilityStatus)) {
    return value as AvailabilityStatus;
  }
  return "Unknown";
}

export function extractCurrency(price: string): string {
  if (price.startsWith("£")) return "GBP";
  if (price.startsWith("€")) return "EUR";
  if (price.startsWith("$")) return "USD";
  return "GBP";
}
