/**
 * Cafepod-specific extractor (Shopify site)
 * Product Name: h1 heading
 * Price: Generic div with £X.XX
 * Availability: "Add to cart" button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractCafepod(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price - Cafepod is a Shopify site
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for Shopify price in main product area (not "You may also like" section)
    // Scope to product section to avoid prices from recommendation carousels
    const productSection = h1?.closest("section, [class*='product-info'], main") || document.body;

    // First try simple .price selector near the H1 - most reliable
    const priceNearH1 = productSection.querySelector(".price");
    if (priceNearH1) {
      const match = priceNearH1.textContent?.match(/£\d+(?:\.\d{2})?/);
      if (match) price = match[0];
    }

    // Fallback to other Shopify selectors if .price not found
    if (price === "Unknown") {
      const priceSelectors = [
        '[class*="price--sale"]',
        '[class*="price__sale"]',
        '[data-product-price]',
      ];

      for (const selector of priceSelectors) {
        const el = productSection.querySelector(selector);
        if (el) {
          const match = el.textContent?.match(/£\d+(?:\.\d{2})?/);
          if (match) {
            price = match[0];
            break;
          }
        }
      }
    }

    // Method 2: Find elements containing ONLY a price near H1
    if (price === "Unknown" && h1) {
      const productArea = h1.closest("section, article, main, [class*='product']") || document.body;
      const allElements = Array.from(productArea.querySelectorAll("*"));

      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        if (/^£\d+(?:\.\d{2})?$/.test(text)) {
          price = text;
          break;
        }
      }
    }

    // Method 3: Fallback price search
    if (price === "Unknown") {
      const mainContent = document.querySelector("main") || document.body;
      const priceMatches = mainContent.textContent?.match(/£\d+\.\d{2}/g);
      if (priceMatches && priceMatches.length > 0) {
        price = priceMatches[0];
      }
    }

    // Check for original/compare price
    const comparePrice = document.querySelector('[class*="compare-price"], [class*="was-price"]');
    if (comparePrice) {
      const match = comparePrice.textContent?.match(/£\d+(?:\.\d{2})?/);
      if (match) originalPrice = match[0];
    }

    // Availability: Check for Add to cart button (Shopify standard)
    const hasAddButton = !!(
      document.querySelector('[name="add"]') ||
      document.querySelector('button[type="submit"][class*="add"]') ||
      document.querySelector('[class*="add-to-cart"]') ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        return text.includes("add to cart") || text.includes("add to basket") || text.includes("add to bag");
      })
    );

    const pageText = document.body.textContent?.toLowerCase() || "";
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable");

    // Priority: Add button > Out of Stock text
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
