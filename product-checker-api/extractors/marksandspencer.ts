/**
 * Marks & Spencer-specific extractor
 * Product Name: h1 heading or JSON-LD
 * Price: JSON-LD structured data (most reliable) or specific price elements
 * Availability: JSON-LD or Add to Bag button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractMarksAndSpencer(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    let productName = "Unknown";
    let price = "Unknown";
    let originalPrice: string | undefined;
    let availability = "Unknown";

    // Method 1 (BEST): Extract from JSON-LD structured data
    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of jsonLdScripts) {
      try {
        const jsonData = JSON.parse(script.textContent || "");
        if (jsonData["@type"] === "Product") {
          // Get product name
          if (jsonData.name) {
            productName = jsonData.name;
          }
          // Get price from offers
          if (jsonData.offers) {
            const offers = jsonData.offers;
            if (offers.priceSpecification?.price) {
              price = `£${offers.priceSpecification.price}`;
            } else if (offers.price) {
              price = `£${offers.price}`;
            }
            // Get availability
            if (offers.availability) {
              if (offers.availability.includes("InStock")) {
                availability = "In Stock";
              } else if (offers.availability.includes("OutOfStock")) {
                availability = "Out of Stock";
              }
            }
          }
          break;
        }
      } catch {
        // Continue to next script if parsing fails
      }
    }

    // Fallback: Get product name from H1 if not found in JSON-LD
    if (productName === "Unknown") {
      const h1 = document.querySelector("h1");
      productName = h1?.textContent?.trim() || "Unknown";
    }

    // Fallback: Look for specific M&S price elements if JSON-LD didn't have price
    if (price === "Unknown") {
      // Try specific price selectors
      const priceEl = document.querySelector(
        '[data-test-id="price"], [class*="price-current"], [class*="product-price"], [class*="selling-price"]'
      );
      if (priceEl) {
        const match = priceEl.textContent?.match(/£[\d,.]+/);
        if (match) price = match[0];
      }
    }

    // Fallback: Check availability from page if not from JSON-LD
    if (availability === "Unknown") {
      const hasAddButton = !!(
        document.querySelector('[data-test-id="add-to-bag"]') ||
        document.querySelector('button[class*="add-to-bag"]') ||
        Array.from(document.querySelectorAll("button")).some((btn) => {
          const text = btn.textContent?.toLowerCase() || "";
          return text.includes("add to bag") || text.includes("add to basket");
        })
      );

      // Only check for out of stock in the main product area, not entire page
      const mainContent = document.querySelector("main, article, [role='main']");
      const productText = mainContent?.textContent?.toLowerCase() || "";
      const hasOutOfStock =
        productText.includes("out of stock") ||
        productText.includes("sold out") ||
        productText.includes("currently unavailable");

      if (hasAddButton) {
        availability = "In Stock";
      } else if (hasOutOfStock) {
        availability = "Out of Stock";
      }
    }

    // Check for was/original price
    const wasEl = document.querySelector('[class*="was-price"], [class*="price-was"]');
    if (wasEl) {
      const match = wasEl.textContent?.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
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
