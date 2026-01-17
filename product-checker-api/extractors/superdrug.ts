/**
 * Superdrug-specific extractor
 * Product Name: h1 heading
 * Price: Price container with class
 * Availability: Add to Basket button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractSuperdrug(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for Superdrug price selectors
    const priceEl = document.querySelector(
      '[data-test="product-price"], [class*="product-price"], [class*="Price"]'
    );
    if (priceEl) {
      const match = priceEl.textContent?.match(/£[\d,.]+/);
      if (match) price = match[0];
    }

    // Method 2: Look in product info section
    if (price === "Unknown" && h1) {
      const parent = h1.closest("section, article, main") || h1.parentElement?.parentElement;
      if (parent) {
        const priceMatches = parent.textContent?.match(/£[\d,.]+/g);
        if (priceMatches && priceMatches.length > 0) {
          price = priceMatches[0];
        }
      }
    }

    // Check for was/RRP price
    const wasEl = document.querySelector('[class*="was-price"], [class*="rrp"]');
    if (wasEl) {
      const match = wasEl.textContent?.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
    }

    // Availability
    const hasAddButton = !!(
      document.querySelector('[data-test="add-to-basket"]') ||
      document.querySelector('button[class*="add-to-basket"]') ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        return text.includes("add to basket") || text.includes("add to bag");
      })
    );

    const pageText = document.body.textContent?.toLowerCase() || "";
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable");

    // Priority: Add to Basket button > Out of Stock text
    // If Add to Basket exists, product is in stock regardless of "out of stock" text elsewhere on page
    let availability: string;
    if (hasAddButton) {
      availability = "In Stock";
    } else if (hasOutOfStock) {
      availability = "Out of Stock";
    } else {
      availability = "Unknown";
    }

    return { productName, price, availability, originalPrice };
  });

  return {
    productName: data.productName,
    price: data.price,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: extractCurrency(data.price),
  };
}
