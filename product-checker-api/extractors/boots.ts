/**
 * Boots-specific extractor
 * Product Name: h1 heading
 * Price: Element with class containing "price" (estore_product_price_widget)
 * Availability: Check for out of stock/sold out text
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractBoots(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name from H1 - normalize whitespace (remove tabs/newlines)
    const h1 = document.querySelector("h1");
    const productName = h1?.textContent?.replace(/\s+/g, " ").trim() || "Unknown";

    // Price from price widget class
    let price: string | null = "Unknown";
    let originalPrice: string | undefined;

    // Try specific Boots price selectors (multiple approaches)
    const priceSelectors = [
      '.pd-price',
      '.pd-price__price',
      '.price',
      '[class*="estore_product_price"]',
      '[class*="price-reDesign"]',
      '[data-test="product-price"]',
      '[class*="productPrice"]',
      '[class*="product-price"]',
      '[itemprop="price"]',
    ];

    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = (el instanceof HTMLElement ? el.innerText : el.textContent) || "";
        // Match £X.XX or £X
        const match = text.match(/£(\d+(?:\.\d{2})?)/);
        if (match) {
          const value = match[1];
          price = value.includes('.') ? `£${value}` : `£${value}.00`;
          break;
        }
        // Match pence format like 15p
        const penceMatch = text.match(/^(\d+)p$/i);
        if (penceMatch) {
          price = `£${(parseInt(penceMatch[1], 10) / 100).toFixed(2)}`;
          break;
        }
      }
    }

    if (price === "Unknown") {
      const allDivs = Array.from(document.querySelectorAll('div'));
      for (const div of allDivs) {
        const text = div.innerText?.trim() || "";
        if (/^£\d+(\.\d{2})?$/.test(text)) {
          const match = text.match(/£(\d+(?:\.\d{2})?)/);
          if (match) {
            const value = match[1];
            price = value.includes('.') ? `£${value}` : `£${value}.00`;
            break;
          }
        }
        if (/^\d+p$/i.test(text)) {
          const penceMatch = text.match(/^(\d+)p$/i);
          if (penceMatch) {
            price = `£${(parseInt(penceMatch[1], 10) / 100).toFixed(2)}`;
            break;
          }
        }
      }
    }

    if (price === "Unknown") {
      const productArea = document.querySelector('[class*="product-detail"], [class*="pdp-"], main, article') || document.body;
      const allText = (productArea instanceof HTMLElement ? productArea.innerText : productArea.textContent) || "";
      const priceMatches = allText.match(/£\d+\.\d{2}/g);
      if (priceMatches && priceMatches.length > 0) {
        price = priceMatches[0];
      }
    }

    const wasEl = document.querySelector('[class*="was-price"], [class*="original-price"], .pd-price__was-price');
    if (wasEl) {
      const match = wasEl.textContent?.match(/£(\d+(?:\.\d{2})?)/);
      if (match) {
        const value = match[1];
        originalPrice = value.includes('.') ? `£${value}` : `£${value}.00`;
      }
    }

    const hasAddToBasket = !!(
      document.querySelector('[data-test="add-to-basket"]') ||
      document.querySelector('button[class*="add-to-basket"]') ||
      document.querySelector('[class*="add-to-basket"]') ||
      document.querySelector('[class*="AddToBasket"]') ||
      document.querySelector('[class*="addToBasket"]') ||
      Array.from(document.querySelectorAll("button, a, [role='button'], [class*='btn'], [class*='button']")).some((el) => {
        const text = el.textContent?.toLowerCase().trim() || "";
        return text === "add to basket" || text === "add to bag" || text.includes("add to basket");
      })
    );

    const productAreaForStock = document.querySelector('[class*="product-detail"], [class*="pdp-"], main, article') || document.body;
    const productText = productAreaForStock.textContent?.toLowerCase() || "";
    const outOfStockIndicator = document.querySelector('[class*="out-of-stock"], [class*="sold-out"], [class*="unavailable"]');

    const hasOutOfStockText =
      productText.includes("out of stock") ||
      productText.includes("sold out") ||
      productText.includes("currently unavailable") ||
      productText.includes("stock coming soon") ||
      productText.includes("temporarily unavailable");

    let availability: string;
    if (hasAddToBasket) {
      availability = "In Stock";
    } else if (outOfStockIndicator || hasOutOfStockText) {
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
