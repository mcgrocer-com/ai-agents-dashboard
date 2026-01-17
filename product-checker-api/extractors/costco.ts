/**
 * Costco-specific extractor
 * Product Name: h1 heading
 * Price: Generic div with £X.XX near product info
 * Availability: "Add to cart" button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractCostco(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price - Costco displays price in a generic div
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for price near product info area
    const productArea = document.querySelector('[class*="product-detail"], [class*="pdp-"], main') || document.body;

    // Look for elements that contain ONLY a price (£XXX.XX format)
    const allElements = Array.from(productArea.querySelectorAll("*"));
    for (const el of allElements) {
      const text = el.textContent?.trim() || "";
      // Match elements with price pattern (£X.XX or £XXX.XX)
      if (/^£\d{1,3}(?:,\d{3})*\.\d{2}$/.test(text)) {
        price = text;
        break;
      }
    }

    // Method 2: Search for price pattern in text content
    if (price === "Unknown") {
      const priceMatches = productArea.textContent?.match(/£\d{1,3}(?:,\d{3})*\.\d{2}/g);
      if (priceMatches && priceMatches.length > 0) {
        price = priceMatches[0];
      }
    }

    // Check for unit price separately (per kg, per item, etc.)
    const unitPriceEl = document.querySelector('[class*="unit-price"], [class*="per-unit"]');
    if (unitPriceEl) {
      // Unit price is separate, not the main price
    }

    // Availability: Check for Add to cart button with multiple selector patterns
    const hasAddButton = !!(
      document.querySelector('button[class*="add-to-cart"]') ||
      document.querySelector('button[class*="AddToCart"]') ||
      document.querySelector('[class*="add-to-cart"]') ||
      document.querySelector('[class*="addToCart"]') ||
      document.querySelector('[id*="add-to-cart"]') ||
      document.querySelector('[id*="addToCart"]') ||
      document.querySelector('input[type="submit"][value*="Add"]') ||
      Array.from(document.querySelectorAll("button, input[type='submit'], a[role='button']")).some((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        const value = (btn as HTMLInputElement).value?.toLowerCase() || "";
        return (
          text.includes("add to cart") ||
          text.includes("add to basket") ||
          text.includes("add to trolley") ||
          value.includes("add to cart")
        );
      })
    );

    // Check product area for availability text (reuse productArea from above)
    const productText = productArea.textContent?.toLowerCase() || "";

    // Check for in-stock indicators
    const hasInStockText =
      productText.includes("in stock") ||
      productText.includes("available") ||
      productText.includes("ready to ship");

    const hasOutOfStock =
      productText.includes("out of stock") ||
      productText.includes("sold out") ||
      productText.includes("currently unavailable") ||
      productText.includes("not available");

    // Priority: Add button or explicit "In stock" text > Out of Stock text > Unknown
    let availability: string;
    if (hasAddButton || hasInStockText) {
      availability = "In Stock";
    } else if (hasOutOfStock) {
      availability = "Out of Stock";
    } else {
      // Default to In Stock if we found price and product name (likely purchasable)
      availability = price !== "Unknown" && productName !== "Unknown" ? "In Stock" : "Unknown";
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
