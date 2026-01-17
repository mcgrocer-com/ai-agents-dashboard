/**
 * LEGO-specific extractor
 * Product Name: h1 heading
 * Price: Separate divs for original and sale prices
 * Availability: "Add to Bag" button (can be disabled for retired products)
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractLego(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price - LEGO shows both original and sale prices
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for Sale Price div
    const salePriceEl = document.querySelector('[class*="sale-price"], [aria-label*="Sale"], [class*="SalePrice"]');
    if (salePriceEl) {
      const match = salePriceEl.textContent?.match(/£\d+(?:\.\d{2})?/);
      if (match) price = match[0];
    }

    // Method 2: Look for regular price if no sale price
    if (price === "Unknown") {
      const productArea = document.querySelector('main, [class*="product"]') || document.body;
      const allElements = Array.from(productArea.querySelectorAll("*"));

      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        // Match elements with price pattern £X.XX or £XXX.XX
        if (/^£\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(text)) {
          // Check if this is a sale price element
          const isSalePrice = el.getAttribute("aria-label")?.toLowerCase().includes("sale") ||
                             el.className?.toLowerCase().includes("sale");

          if (isSalePrice && price === "Unknown") {
            price = text;
          } else if (!isSalePrice && !originalPrice) {
            // First non-sale price is likely original
            if (price === "Unknown") {
              price = text;
            } else {
              originalPrice = text;
            }
          }
        }
      }
    }

    // Method 3: Fallback - find any price pattern
    if (price === "Unknown") {
      const productArea = document.querySelector('main') || document.body;
      const priceMatches = productArea.textContent?.match(/£\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
      if (priceMatches && priceMatches.length > 0) {
        // If multiple prices, last one is often the sale price
        price = priceMatches[priceMatches.length - 1];
        if (priceMatches.length > 1) {
          originalPrice = priceMatches[0];
        }
      }
    }

    // Availability: Check for Add to Bag button
    const addButton = document.querySelector('button[class*="add-to-bag"], button[class*="AddToBag"]') ||
                      Array.from(document.querySelectorAll("button")).find((btn) => {
                        const text = btn.textContent?.toLowerCase() || "";
                        return text.includes("add to bag") || text.includes("add to basket");
                      });

    const hasAddButton = !!addButton;
    const isButtonDisabled = addButton?.hasAttribute("disabled") || false;

    // Check for retired/out of stock indicators
    const pageText = document.body.textContent?.toLowerCase() || "";
    const isRetired = pageText.includes("retired") || pageText.includes("retiring");
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable");

    // Priority: Non-disabled Add button > Retired > Out of Stock
    let availability: string;
    if (hasAddButton && !isButtonDisabled) {
      availability = "In Stock";
    } else if (isRetired || isButtonDisabled) {
      availability = "Out of Stock";
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
