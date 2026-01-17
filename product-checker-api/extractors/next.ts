/**
 * Next-specific extractor
 * Updated: 2026-01-09
 *
 * Current selectors (verified working):
 * - Product Name: h1.MuiTypography-h1
 * - Price: [data-testid="product-now-price"]
 * - Original Price: [data-testid="product-was-price"]
 * - Availability: [data-testid="item-form-addToBag-button"]
 *
 * URL Format: https://www.next.co.uk/style/[style_code]/[color_code]#[color_code]
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractNext(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.trim() || "Unknown";

    // Price using data-testid attribute
    const priceEl = document.querySelector('[data-testid="product-now-price"]');
    let price = "Unknown";
    if (priceEl) {
      const priceText = priceEl.textContent?.trim();
      const match = priceText?.match(/£[\d,.]+/);
      if (match) price = match[0];
    }

    // Original/Was Price
    let originalPrice: string | undefined;
    const wasPriceEl = document.querySelector('[data-testid="product-was-price"]');
    if (wasPriceEl) {
      const wasPriceText = wasPriceEl.textContent?.trim();
      const match = wasPriceText?.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
    }

    // Availability - check for Add to Bag button
    const addButton = document.querySelector('[data-testid="item-form-addToBag-button"]');
    const hasAddButton = !!addButton && !(addButton as HTMLButtonElement).disabled;

    // Check for out of stock text as fallback
    const pageText = document.body.textContent?.toLowerCase() || "";
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable") ||
      pageText.includes("not available online");

    // Determine availability
    // Priority: Add to Bag button presence > Out of Stock text
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
