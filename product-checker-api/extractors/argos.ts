/**
 * Argos-specific extractor
 * Product Name: h1 heading or [data-test="product-title"]
 * Price: [data-test="product-price-primary"] or [itemprop="price"]
 * Availability: "Add to trolley" button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractArgos(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name - try multiple selectors in order of reliability
    let productName = "Unknown";

    // Try data-test first (most reliable)
    const dataTestTitle = document.querySelector('[data-test="product-title"]');
    if (dataTestTitle?.textContent?.trim()) {
      productName = dataTestTitle.textContent.trim();
    } else {
      // Fallback to h1
      const h1 = document.querySelector("h1");
      if (h1?.textContent?.trim()) {
        productName = h1.textContent.trim();
      }
    }

    // Price - use schema.org itemprop or data-test attribute
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Try itemprop="price" first (most accurate)
    const priceElement = document.querySelector('[itemprop="price"]');
    if (priceElement) {
      const priceContent = priceElement.getAttribute('content');
      if (priceContent) {
        price = `£${priceContent}`;
      } else {
        // Fallback to text content
        const priceText = priceElement.textContent?.trim();
        if (priceText) {
          const match = priceText.match(/£[\d,.]+/);
          if (match) price = match[0];
        }
      }
    }

    // If still not found, try data-test selector
    if (price === "Unknown") {
      const dataTestPrice = document.querySelector('[data-test="product-price-primary"]');
      if (dataTestPrice?.textContent) {
        const match = dataTestPrice.textContent.match(/£[\d,.]+/);
        if (match) price = match[0];
      }
    }

    // Check for "was" price (original price before discount)
    const wasPriceElement = document.querySelector('[data-test="price-was"]');
    if (wasPriceElement?.textContent) {
      const match = wasPriceElement.textContent.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
    }

    // Availability: Check for Add to Trolley button
    const hasAddToTrolley = !!(
      document.querySelector('[data-test="add-to-trolley-button-button"]') ||
      document.querySelector('[data-test="add-to-trolley-button"]') ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = (btn.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        return text.includes("add to trolley") || text.includes("add to basket");
      })
    );

    // Check for out of stock indicators
    const pageText = document.body.textContent?.toLowerCase() || "";
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable") ||
      pageText.includes("not available");

    let availability: string;
    if (hasOutOfStock) {
      availability = "Out of Stock";
    } else if (hasAddToTrolley) {
      availability = "In Stock";
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
