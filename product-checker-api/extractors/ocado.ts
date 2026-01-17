/**
 * Ocado-specific extractor
 * Product Name: h1 heading
 * Price: Multiple price elements (current price and original/was price)
 * Availability: data-test="counter-button" or aria-label containing "Add...trolley"
 * Note: Prioritizes Add button presence over text search to avoid false negatives
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractOcado(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price - Ocado often shows sale price and original price
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for specific price classes
    const currentPriceEl = document.querySelector(
      '[class*="offer-price"], [class*="current-price"], [data-test="product-price"]'
    );
    if (currentPriceEl) {
      const match = currentPriceEl.textContent?.match(/£[\d,.]+/);
      if (match) price = match[0];
    }

    // Method 2: Look in product info section
    if (price === "Unknown" && h1) {
      const parent = h1.closest("section, article, main") || h1.parentElement?.parentElement;
      if (parent) {
        // Get all prices in order
        const priceMatches = parent.textContent?.match(/£[\d,.]+/g);
        if (priceMatches && priceMatches.length > 0) {
          // First price is usually current/sale price
          price = priceMatches[0];
          // Second price is often original/was price
          if (priceMatches.length > 1) {
            const firstNum = parseFloat(priceMatches[0].replace("£", "").replace(",", ""));
            const secondNum = parseFloat(priceMatches[1].replace("£", "").replace(",", ""));
            // Original price is typically higher
            if (secondNum > firstNum) {
              originalPrice = priceMatches[1];
            }
          }
        }
      }
    }

    // Look for was/original price explicitly
    const wasPriceEl = document.querySelector('[class*="was-price"], [class*="original-price"]');
    if (wasPriceEl && !originalPrice) {
      const match = wasPriceEl.textContent?.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
    }

    // Availability: Check for Add button - this is the PRIMARY indicator
    // Ocado uses data-test="counter-button" for the Add to trolley button
    const hasAddButton = !!(
      document.querySelector('[data-test="counter-button"]') ||
      document.querySelector('[aria-label*="Add"][aria-label*="trolley"]') ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = btn.textContent?.trim().toLowerCase() || "";
        const ariaLabel = btn.getAttribute("aria-label")?.toLowerCase() || "";
        // Check for exact "add" text (not "added" or other variations)
        return (
          text === "add" ||
          (ariaLabel.includes("add") && ariaLabel.includes("trolley"))
        );
      })
    );

    // Check for specific out-of-stock indicators near the product
    // Only check in the main product area, not the entire page
    const productSection = document.querySelector("main, article, [data-test*='product']") || document.body;
    const productText = productSection.textContent?.toLowerCase() || "";

    // Look for explicit out of stock messages (more specific patterns)
    const hasOutOfStockMessage =
      productText.includes("currently unavailable") ||
      productText.includes("temporarily out of stock") ||
      productText.includes("not available for delivery");

    let availability: string;
    // IMPORTANT: Prioritize button presence over text search
    // If there's an Add button, the product is in stock
    if (hasAddButton) {
      availability = "In Stock";
    } else if (hasOutOfStockMessage) {
      availability = "Out of Stock";
    } else {
      // If no Add button and no clear out of stock message, mark as unknown
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
