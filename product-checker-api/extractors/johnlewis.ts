/**
 * John Lewis-specific extractor
 * Updated 2026-01-10: Uses description list (dl/dt/dd) structure for price
 * Product Name: h1 heading (brand link + product text)
 * Price: Definition element (dd) following term "Price" or paragraph with £ symbol
 * Availability: "In stock" text or Add to Basket button
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency, waitForContent } from "./types";

export async function extractJohnLewis(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  // Wait for page content to load - John Lewis has loading states
  await waitForContent(page, 10000);

  const data = await page.evaluate(() => {
    // Product name from H1 - John Lewis has brand in link + product text
    const h1 = document.querySelector("h1");
    let productName = "Unknown";

    if (h1) {
      // Extract brand from link and product text separately to ensure proper spacing
      const brandLink = h1.querySelector("a");
      const brandName = brandLink?.textContent?.trim() || "";

      // Get full H1 text and normalize
      const fullText = h1.textContent?.trim().replace(/\s+/g, " ") || "";

      // If we have a brand link, ensure space after brand name
      if (brandName && fullText.startsWith(brandName)) {
        const productPart = fullText.slice(brandName.length).trim();
        productName = productPart ? `${brandName} ${productPart}` : brandName;
      } else {
        productName = fullText;
      }
    }

    // Skip if product name looks like a loading state
    if (productName.toLowerCase().includes("hang on") || productName.toLowerCase().includes("loading")) {
      productName = "Unknown";
    }

    // Price - John Lewis uses description list structure with dt/dd
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for description list with "Price" term
    const priceTerms = Array.from(document.querySelectorAll("dt"));
    for (const dt of priceTerms) {
      if (dt.textContent?.trim().toLowerCase() === "price") {
        // Get the next sibling (dd element with price)
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === "DD") {
          const match = dd.textContent?.match(/£[\d,.]+/);
          if (match) {
            price = match[0];
            break;
          }
        }
      }
    }

    // Method 2: Look for paragraph with price pattern near H1
    if (price === "Unknown" && h1) {
      const productSection = h1.closest("main") || h1.parentElement?.parentElement?.parentElement;
      if (productSection) {
        const paragraphs = Array.from(productSection.querySelectorAll("p"));
        for (const p of paragraphs) {
          const text = p.textContent?.trim() || "";
          // Match price like "£50.00" at start of paragraph
          if (text.match(/^£[\d,.]+$/) && text.length < 15) {
            price = text;
            break;
          }
        }
      }
    }

    // Method 3: Look for any price element with data-test or class
    if (price === "Unknown") {
      const priceElement = document.querySelector(
        '[data-test="price"], [data-test="product-price"], [itemprop="price"]'
      );
      if (priceElement) {
        const match = priceElement.textContent?.match(/£[\d,.]+/);
        if (match) price = match[0];
      }
    }

    // Check for was/original price
    const wasEl = document.querySelector('[data-test="was-price"], [class*="was-price"]');
    if (wasEl) {
      const match = wasEl.textContent?.match(/£[\d,.]+/);
      if (match) originalPrice = match[0];
    }

    // Availability: Look for explicit stock status or Add to Basket button
    let availability: string = "Unknown";

    // Method 1: Check for explicit unavailability messages in main section
    const mainSection = document.querySelector("main");
    if (mainSection) {
      const sectionText = mainSection.textContent?.toLowerCase() || "";

      // Check for out of stock / unavailable messages first (more specific)
      if (
        sectionText.includes("no longer available") ||
        sectionText.includes("out of stock") ||
        sectionText.includes("sold out") ||
        sectionText.includes("currently unavailable") ||
        sectionText.includes("unlikely to receive more stock")
      ) {
        availability = "Out of Stock";
      } else if (
        sectionText.includes("in stock online") ||
        (sectionText.includes("only") && sectionText.includes("in stock")) ||
        sectionText.includes("currently in stock")
      ) {
        availability = "In Stock";
      }
    }

    // Method 2: Check for Add to Basket button (only if not already determined)
    if (availability === "Unknown") {
      const hasAddButton = !!(
        document.querySelector('button[class*="add-to-basket"]') ||
        Array.from(document.querySelectorAll("button")).some((btn) => {
          const text = btn.textContent?.trim().toLowerCase() || "";
          return text === "add to basket" || text === "add to bag";
        })
      );
      if (hasAddButton) availability = "In Stock";
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
