/**
 * Coca-Cola (Your Coca-Cola) specific extractor
 * Product Name: h1 heading
 * Price: "Current price" text element
 * Availability: "Add to basket" button + "In stock" text
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractCocaCola(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    // Product name - try specific product title selectors first, then H1
    let productName = "Unknown";

    // Method 1: Look for product title in specific areas
    const titleSelectors = [
      '[class*="product-title"]',
      '[class*="productTitle"]',
      '[class*="product-name"]',
      '[class*="productName"]',
      '[data-test*="product-title"]',
      '[itemprop="name"]',
      '.pdp-title',
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.replace(/\s+/g, " ").trim();
        if (text && text.length > 3) {
          productName = text;
          break;
        }
      }
    }

    // Method 2: Look for H1 within main product section (not header)
    if (productName === "Unknown") {
      const productSection = document.querySelector('[class*="product-detail"], [class*="pdp-"], main, article');
      if (productSection) {
        const h1 = productSection.querySelector("h1");
        if (h1) {
          productName = h1.textContent?.replace(/\s+/g, " ").trim() || "Unknown";
        }
      }
    }

    // Method 3: Check page title (often contains specific product name)
    if (productName === "Unknown" || productName.toLowerCase().includes("cans & bottles")) {
      const pageTitle = document.title;
      // Page title often follows pattern: "Product Name | Brand | Site"
      const titleParts = pageTitle.split("|").map((p) => p.trim());
      if (titleParts.length > 0 && titleParts[0].length > 5) {
        // Remove "Buy" prefix if present
        const cleanTitle = titleParts[0].replace(/^buy\s+/i, "").trim();
        if (cleanTitle.length > 5) {
          productName = cleanTitle;
        }
      }
    }

    // Method 4: Extract from URL path (e.g., /fanta-pear-24-x-330ml/...)
    if (productName === "Unknown" || productName.toLowerCase().includes("cans & bottles")) {
      const urlPath = window.location.pathname;
      const pathMatch = urlPath.match(/\/([a-z0-9-]+)\//i);
      if (pathMatch && pathMatch[1]) {
        // Convert slug to title case: "fanta-pear-24-x-330ml" -> "Fanta Pear 24 X 330ml"
        const slug = pathMatch[1];
        const titleFromSlug = slug
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        if (titleFromSlug.length > 5) {
          productName = titleFromSlug;
        }
      }
    }

    // Method 5: Fallback to any H1
    if (productName === "Unknown") {
      const h1 = document.querySelector("h1");
      productName = h1?.textContent?.replace(/\s+/g, " ").trim() || "Unknown";
    }

    // Price - Your Coca-Cola shows "Current price: £X.XX"
    let price = "Unknown";
    let originalPrice: string | undefined;

    // Method 1: Look for current price indicator
    const currentPriceEl = document.querySelector('[class*="current-price"], [class*="CurrentPrice"]');
    if (currentPriceEl) {
      const match = currentPriceEl.textContent?.match(/£\d+(?:\.\d{2})?/);
      if (match) price = match[0];
    }

    // Method 2: Look for text starting with "Current price:"
    if (price === "Unknown") {
      const allElements = Array.from(document.querySelectorAll("*"));
      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        // Match elements that START with "Current price:" to avoid picking up nav/banner text
        if (text.toLowerCase().startsWith("current price")) {
          const match = text.match(/£\d+(?:\.\d{2})?/);
          if (match) {
            price = match[0];
            break;
          }
        }
      }
    }

    // Method 2b: Look for sibling element after "Current price:" label
    if (price === "Unknown") {
      const allElements = Array.from(document.querySelectorAll("*"));
      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        // Find short price-only elements near product info
        if (/^£\d+\.\d{2}$/.test(text) && el.parentElement) {
          // Check if parent/sibling mentions "current price"
          const parentText = el.parentElement.textContent?.toLowerCase() || "";
          if (parentText.includes("current price") || parentText.includes("per can")) {
            price = text;
            break;
          }
        }
      }
    }

    // Method 3: Find elements containing ONLY a price
    if (price === "Unknown") {
      const productArea = document.querySelector("main, [class*='product']") || document.body;
      const allElements = Array.from(productArea.querySelectorAll("*"));

      for (const el of allElements) {
        const text = el.textContent?.trim() || "";
        if (/^£\d+(?:\.\d{2})?$/.test(text)) {
          price = text;
          break;
        }
      }
    }

    // Method 4: Fallback price pattern search
    if (price === "Unknown") {
      const mainContent = document.querySelector("main") || document.body;
      const priceMatches = mainContent.textContent?.match(/£\d+\.\d{2}/g);
      if (priceMatches && priceMatches.length > 0) {
        price = priceMatches[0];
      }
    }

    // Check for was/original price
    const wasPriceEl = document.querySelector('[class*="was-price"], [class*="original-price"]');
    if (wasPriceEl) {
      const match = wasPriceEl.textContent?.match(/£\d+(?:\.\d{2})?/);
      if (match) originalPrice = match[0];
    }

    // Availability: Check for Add to basket button
    const hasAddButton = !!(
      document.querySelector('button[class*="add-to-basket"]') ||
      document.querySelector('[class*="add-to-basket"]') ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        return text.includes("add to basket") || text.includes("add to cart");
      })
    );

    // Also check for explicit "In stock" text
    const pageText = document.body.textContent?.toLowerCase() || "";
    const hasInStockText = pageText.includes("in stock");
    const hasOutOfStock =
      pageText.includes("out of stock") ||
      pageText.includes("sold out") ||
      pageText.includes("currently unavailable");

    // Priority: Add button or explicit "In stock" text > Out of Stock text
    let availability: string;
    if (hasAddButton || hasInStockText) {
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
