/**
 * Sainsbury's-specific extractor
 * Product Name: h1 heading
 * Price: Element near heading with £ symbol or pence format
 * Availability: "Add" button presence
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

/**
 * Helper to parse price text and return normalized £X.XX format
 * Handles: £1.50, £0.15, 15p, 50p, etc.
 */
function parsePriceText(text: string): string | null {
  if (!text) return null;

  // Match £X.XX format
  const poundMatch = text.match(/£(\d+(?:\.\d{2})?)/);
  if (poundMatch) {
    const value = poundMatch[1];
    // Ensure two decimal places
    return value.includes('.') ? `£${value}` : `£${value}.00`;
  }

  // Match pence-only format: 15p, 50p, etc.
  const penceMatch = text.match(/^(\d+)p$/i);
  if (penceMatch) {
    const pence = parseInt(penceMatch[1], 10);
    const pounds = (pence / 100).toFixed(2);
    return `£${pounds}`;
  }

  return null;
}

export async function extractSainsburys(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    try {
      // Product name from H1 with class pd__header
      const h1 = document.querySelector("h1.pd__header, h1");
      const productName = h1?.textContent?.trim() || "Unknown";

      // Price - Sainsbury's uses specific price classes
      let price = "Unknown";
      let originalPrice: string | undefined;

      // Helper to convert pence to pounds
      const penceToPounds = (pence: number): string => {
        return "£" + (pence / 100).toFixed(2);
      };

      // Method 1: Look for the price elements in the product detail section
      // Sainsbury's new layout shows price like "15p" in a div
      const allDivs = Array.from(document.querySelectorAll('div'));
      for (const div of allDivs) {
        const text = div.textContent?.trim() || "";
        // Match exact pence format like "15p"
        if (/^\d{1,3}p$/.test(text)) {
          const penceValue = parseInt(text.replace('p', ''), 10);
          if (!isNaN(penceValue) && penceValue > 0 && penceValue < 1000) {
            price = penceToPounds(penceValue);
            break;
          }
        }
        // Match exact pound format like "£1.50"
        if (/^£\d+\.\d{2}$/.test(text)) {
          price = text;
          break;
        }
      }

      // Method 2: Look for retail price with data-testid (most reliable for older layout)
      if (price === "Unknown") {
        const retailPriceEl = document.querySelector('[data-testid="pd-retail-price"]');
        if (retailPriceEl) {
          const text = retailPriceEl.textContent?.trim() || "";
          const match = text.match(/£(\d+\.\d{2})/);
          if (match) price = match[0];
        }
      }

      // Method 3: Look for pd__cost__retail-price class
      if (price === "Unknown") {
        const retailPriceClass = document.querySelector('.pd__cost__retail-price');
        if (retailPriceClass) {
          const text = retailPriceClass.textContent?.trim() || "";
          const match = text.match(/£(\d+\.\d{2})/);
          if (match) price = match[0];
        }
      }

      // Method 4: Fallback to pd__cost parent element
      if (price === "Unknown") {
        const costEl = document.querySelector('.pd__cost');
        if (costEl) {
          const text = costEl.textContent || "";
          // Try pound format first
          const poundMatch = text.match(/£(\d+\.\d{2})/);
          if (poundMatch) {
            price = poundMatch[0];
          } else {
            // Try pence format
            const penceMatch = text.match(/(\d{1,3})p/);
            if (penceMatch) {
              const penceValue = parseInt(penceMatch[1], 10);
              if (!isNaN(penceValue) && penceValue > 0) {
                price = penceToPounds(penceValue);
              }
            }
          }
        }
      }

      // Check for original/was price
      const wasElements = document.querySelectorAll('[class*="was"], img[alt*="was"]');
      for (const el of wasElements) {
        const text = el.getAttribute('alt') || el.textContent || "";
        const match = text.match(/£(\d+\.\d{2})/);
        if (match) {
          originalPrice = match[0];
          break;
        }
      }

      // Availability: Check for Add button or Out of Stock
      const outOfStockButton = document.querySelector('button[disabled]');
      const outOfStockText = outOfStockButton?.textContent?.toLowerCase() || "";
      const hasOutOfStockButton = outOfStockText.includes('out of stock');

      const hasAddButton = !!(
        document.querySelector('button.ln-c-button--filled[type="button"]:not([disabled])') ||
        document.querySelector('[data-test-id="add-button"]:not([disabled])') ||
        document.querySelector('button[class*="add-button"]:not([disabled])') ||
        Array.from(document.querySelectorAll("button:not([disabled])")).some((btn) => {
          const text = btn.textContent?.toLowerCase() || "";
          return (
            text === "add" ||
            text.includes("add to trolley") ||
            text.includes("add to basket")
          );
        })
      );

      const pageText = document.body.textContent?.toLowerCase() || "";
      const hasOutOfStockText =
        pageText.includes("out of stock") ||
        pageText.includes("sold out") ||
        pageText.includes("currently unavailable");

      // Priority: Add button > Out of Stock button > Out of Stock text
      let availability: string;
      if (hasAddButton) {
        availability = "In Stock";
      } else if (hasOutOfStockButton || hasOutOfStockText) {
        availability = "Out of Stock";
      } else {
        availability = "Unknown";
      }

      return { productName, price, availability, originalPrice };
    } catch (e) {
      // Return defaults if anything fails
      return { productName: "Unknown", price: "Unknown", availability: "Unknown", originalPrice: undefined };
    }
  });

  return {
    productName: data.productName,
    price: data.price,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: extractCurrency(data.price),
  };
}
