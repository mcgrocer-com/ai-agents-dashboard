/**
 * Waitrose-specific extractor
 * Product Name: h1 heading
 * Price: Price element with structured classes
 * Availability: Add button presence and stock indicators
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractWaitrose(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    try {
      // Product name from H1
      const h1 = document.querySelector("h1");
      const productName = h1?.textContent?.trim() || "Unknown";

      // Price extraction - Waitrose uses structured price components
      let price = "Unknown";
      let originalPrice: string | undefined;

      // Method 1: Look for Waitrose-specific price selectors
      const priceEl = document.querySelector(
        '[data-testid="product-price"], [class*="productPrice"], [class*="product-price"], [class*="price__value"]'
      );
      if (priceEl) {
        const match = priceEl.textContent?.match(/£[\d,.]+/);
        if (match) price = match[0];
      }

      // Method 2: Look for price in structured product details section
      if (price === "Unknown") {
        const productDetails = document.querySelector('[class*="productDetails"], [class*="product-details"], [data-testid*="product"]');
        if (productDetails) {
          const priceElements = Array.from(productDetails.querySelectorAll("span, p, div")).filter(el => {
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

      // Method 3: Look for price near add to trolley button
      if (price === "Unknown") {
        const addButton = document.querySelector('button[data-testid*="add"], button[class*="add-to-trolley"], button[class*="addToTrolley"]');
        if (addButton) {
          const parent = addButton.closest('[class*="product"], section, article') || addButton.parentElement?.parentElement;
          if (parent) {
            const priceElements = Array.from(parent.querySelectorAll("span, p, div")).filter(el => {
              const text = el.textContent?.trim() || "";
              return /^£[\d,.]+$/.test(text) && el.children.length === 0;
            });

            // Sort to get highest price (current price) and second highest (original price if on sale)
            const prices = priceElements
              .map(el => ({
                text: el.textContent?.trim() || "",
                value: parseFloat((el.textContent?.match(/£([\d,.]+)/) || [])[1]?.replace(",", "") || "0")
              }))
              .filter(p => !isNaN(p.value) && p.value > 0)
              .sort((a, b) => b.value - a.value);

            if (prices.length > 0) {
              price = prices[0].text;
              if (prices.length > 1 && prices[1].value < prices[0].value) {
                originalPrice = prices[0].text;
              }
            }
          }
        }
      }

      // Method 4: Scan product area near H1
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

      // Check for promotional/sale pricing
      const promoText = Array.from(document.querySelectorAll("span, p, div")).map(el => el.textContent?.trim() || "");
      for (const text of promoText) {
        if ((text.toLowerCase().includes("was") || text.toLowerCase().includes("rrp")) && /£[\d,.]+/.test(text)) {
          const match = text.match(/£[\d,.]+/);
          if (match && !originalPrice) {
            originalPrice = match[0];
          }
        }
      }

      // Availability detection
      const hasAddButton = !!(
        document.querySelector('button[data-testid*="add"]:not([disabled])') ||
        document.querySelector('button[class*="add-to-trolley"]:not([disabled])') ||
        document.querySelector('button[class*="addToTrolley"]:not([disabled])') ||
        Array.from(document.querySelectorAll("button:not([disabled])")).some((el) => {
          const text = el.textContent?.toLowerCase().trim() || "";
          return text === "add" ||
                 text.includes("add to trolley") ||
                 text.includes("add to basket") ||
                 text.includes("add to order");
        })
      );

      // Check for out of stock indicators
      const productArea = document.querySelector('[class*="product"], main, article') || document.body;
      const productText = productArea.textContent?.toLowerCase() || "";
      const outOfStockButton = document.querySelector('button[disabled]');
      const outOfStockButtonText = outOfStockButton?.textContent?.toLowerCase() || "";

      const hasOutOfStock =
        productText.includes("out of stock") ||
        productText.includes("currently unavailable") ||
        productText.includes("temporarily out of stock") ||
        outOfStockButtonText.includes("out of stock") ||
        outOfStockButtonText.includes("unavailable") ||
        !!document.querySelector('[class*="out-of-stock"], [data-testid*="out-of-stock"]');

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
    console.log("[Waitrose Extractor] Debug:", JSON.stringify(data._debug));
  }

  return {
    productName: data.productName,
    price: data.price,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: extractCurrency(data.price),
  };
}
