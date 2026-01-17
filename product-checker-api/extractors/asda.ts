/**
 * ASDA-specific extractor
 * Product Name: h1 heading
 * Price: Price element with class or data attribute
 * Availability: Add button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractAsda(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price - ASDA uses structured paragraphs with "was" and "actual price" labels
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for paragraphs with price structure (handles sale prices correctly)
    // ASDA has: paragraph with "was" £X.XX, and paragraph with "actual price" £Y.YY
    const allParagraphs = Array.from(document.querySelectorAll("p"));
    for (const p of allParagraphs) {
      const text = p.textContent || "";
      // Look for "actual price" paragraph (current selling price)
      if (text.toLowerCase().includes("actual price")) {
        const match = text.match(/£[\d,.]+/);
        if (match) {
          price = match[0];
        }
      }
      // Look for "was" paragraph (original price before sale)
      if (text.toLowerCase().includes("was") && !text.toLowerCase().includes("actual")) {
        const match = text.match(/£[\d,.]+/);
        if (match) {
          originalPrice = match[0];
        }
      }
    }

    // Method 2: Look for ASDA price selectors (non-sale items)
    if (price === "Unknown") {
      const priceEl = document.querySelector(
        '[data-auto-id="price"], [class*="co-product__price"]'
      );
      if (priceEl) {
        const match = priceEl.textContent?.match(/£[\d,.]+/);
        if (match) price = match[0];
      }
    }

    // Method 3: Look in product details section near H1 (fallback)
    if (price === "Unknown" && h1) {
      const parent = h1.closest("section, article, main") || h1.parentElement?.parentElement;
      if (parent) {
        // Find price paragraphs that don't contain "was"
        const paragraphs = Array.from(parent.querySelectorAll("p"));
        for (const p of paragraphs) {
          const text = p.textContent || "";
          if (text.match(/^£[\d,.]+$/) || (text.match(/£[\d,.]+/) && !text.toLowerCase().includes("was"))) {
            const match = text.match(/£[\d,.]+/);
            if (match) {
              price = match[0];
              break;
            }
          }
        }
      }
    }

    // Availability: Check for Add button first (most reliable indicator)
    // ASDA uses various button types and text variations
    const hasAddButton = !!(
      document.querySelector('[data-auto-id="add-to-trolley"]') ||
      document.querySelector('[data-auto-id="add"]') ||
      document.querySelector('button[class*="add-to-trolley"]') ||
      document.querySelector('[class*="add-button"]') ||
      // Check all clickable elements for "add" text
      Array.from(document.querySelectorAll("button, a, [role='button'], [class*='btn'], [class*='button']")).some((el) => {
        const text = el.textContent?.toLowerCase().trim() || "";
        // Match "add", "add to trolley", "add to basket" but NOT "add to favourites"
        return (
          text === "add" ||
          text.includes("add to trolley") ||
          text.includes("add to basket")
        );
      })
    );
    // Check for out of stock indicators in product area only (not entire page)
    const productArea = document.querySelector('[class*="product"], main, article') || document.body;
    const productText = productArea.textContent?.toLowerCase() || "";
    const outOfStockIndicator = document.querySelector('[class*="out-of-stock"], [class*="sold-out"], [class*="unavailable"]');
    const hasOutOfStock =
      !!outOfStockIndicator ||
      productText.includes("out of stock") ||
      productText.includes("sold out") ||
      productText.includes("currently unavailable");

    let availability: string;
    // Add button is the most reliable indicator - if present, it's in stock
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
