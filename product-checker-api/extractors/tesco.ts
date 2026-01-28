/**
 * Tesco-specific extractor
 * Product Name: h1 heading
 * Price: Price element with structured classes
 * Availability: Add button presence and out of stock indicators
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractTesco(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    try {
      // Product name from H1
      const h1 = document.querySelector("h1");
      const productName = h1?.textContent?.trim() || "Unknown";

      // Price extraction - Tesco uses various price structures
      let price = "Unknown";
      let originalPrice: string | undefined;

      // Method 1: Look for Tesco-specific price selectors
      const priceEl = document.querySelector(
        '[data-auto-id="price"], [class*="price-per-sellable-unit"], [class*="price-control-wrapper"], [class*="product-price"]'
      );
      if (priceEl) {
        const match = priceEl.textContent?.match(/£[\d,.]+/);
        if (match) price = match[0];
      }

      // Method 2: Look for price near add button
      if (price === "Unknown") {
        const addButton = document.querySelector('button[data-auto-id="product-add-button"], button[class*="add-button"]');
        if (addButton) {
          const parent = addButton.closest('[class*="product-details"], [class*="product-info"], section, article') || addButton.parentElement?.parentElement;
          if (parent) {
            const priceElements = Array.from(parent.querySelectorAll("span, p, div")).filter(el => {
              const text = el.textContent?.trim() || "";
              return /^£[\d,.]+$/.test(text) && el.children.length === 0;
            });
            if (priceElements.length > 0) {
              const priceText = priceElements[0].textContent?.trim();
              const match = priceText?.match(/£[\d,.]+/);
              if (match) price = match[0];
            }
          }
        }
      }

      // Method 3: Look for structured price container near H1
      if (price === "Unknown" && h1) {
        const parent = h1.closest("section, article, main") || h1.parentElement?.parentElement;
        if (parent) {
          const priceElements = Array.from(parent.querySelectorAll("span, p, div"));
          for (const el of priceElements) {
            if (el.children.length === 0) {
              const text = el.textContent?.trim() || "";
              if (/^£[\d,.]+$/.test(text)) {
                price = text;
                break;
              }
            }
          }
        }
      }

      // Method 4: Check for sale/promotional pricing (was/now structure)
      const allText = Array.from(document.querySelectorAll("span, p, div")).map(el => ({
        text: el.textContent?.trim() || "",
        element: el
      }));

      for (const item of allText) {
        if (item.text.toLowerCase().includes("was") && /£[\d,.]+/.test(item.text)) {
          const match = item.text.match(/£[\d,.]+/);
          if (match) {
            originalPrice = match[0];
          }
        }
      }

      // Availability detection
      const hasAddButton = !!(
        document.querySelector('button[data-auto-id="product-add-button"]') ||
        document.querySelector('button[class*="add-button"]:not([disabled])') ||
        document.querySelector('button[class*="add-to-trolley"]:not([disabled])') ||
        Array.from(document.querySelectorAll("button:not([disabled])")).some((el) => {
          const text = el.textContent?.toLowerCase().trim() || "";
          return text === "add" || text.includes("add to basket") || text.includes("add to trolley");
        })
      );

      // Check for out of stock indicators
      const productArea = document.querySelector('[class*="product"], main, article') || document.body;
      const productText = productArea.textContent?.toLowerCase() || "";
      const outOfStockIndicator = document.querySelector('[class*="out-of-stock"], [class*="unavailable"], button[disabled]');
      const disabledButtonText = outOfStockIndicator?.textContent?.toLowerCase() || "";

      const hasOutOfStock =
        !!outOfStockIndicator ||
        productText.includes("out of stock") ||
        productText.includes("currently unavailable") ||
        productText.includes("temporarily unavailable") ||
        disabledButtonText.includes("out of stock");

      let availability: string;
      if (hasAddButton) {
        availability = "In Stock";
      } else if (hasOutOfStock) {
        availability = "Out of Stock";
      } else {
        availability = "Unknown";
      }

      return {
        productName,
        price,
        availability,
        originalPrice,
        _debug: {
          hasH1: !!h1,
          h1Text: h1?.textContent?.trim().substring(0, 50),
          hasAddButton,
          hasOutOfStock,
          buttonCount: document.querySelectorAll("button").length,
        }
      };
    } catch (e) {
      return {
        productName: "Unknown",
        price: "Unknown",
        availability: "Unknown",
        originalPrice: undefined,
        _debug: { error: String(e) }
      };
    }
  });

  // Log debug info server-side
  if (data._debug) {
    console.log("[Tesco Extractor] Debug:", JSON.stringify(data._debug));
  }

  return {
    productName: data.productName,
    price: data.price,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: extractCurrency(data.price),
  };
}
