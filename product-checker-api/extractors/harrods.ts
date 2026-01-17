/**
 * Harrods-specific extractor
 * Moved from site-extractors.ts - handles promotional overlays
 * Product Name: h1 heading or JSON-LD
 * Price: JSON-LD structured data or specific price elements
 * Availability: Add to Bag button or Quantity selector
 *
 * FIX: Returns null for price when out of stock and no price found
 *      Previously returned fallback £100 which was incorrect
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractHarrods(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  const data = await page.evaluate(() => {
    let productName = "Unknown";
    let price: string | null = null;
    let originalPrice: string | undefined;
    let jsonLdAvailability: string | null = null;

    // Method 1 (BEST): Try JSON-LD structured data first
    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of jsonLdScripts) {
      try {
        const jsonData = JSON.parse(script.textContent || "");

        // Handle direct Product type
        if (jsonData["@type"] === "Product") {
          if (jsonData.name) {
            productName = jsonData.name;
          }
          if (jsonData.offers) {
            const offers = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
            if (offers.price) {
              const currency = offers.priceCurrency === "USD" ? "$" : "£";
              price = `${currency}${offers.price}`;
            } else if (offers.priceSpecification?.price) {
              price = `£${offers.priceSpecification.price}`;
            }
            // Get availability from JSON-LD
            if (offers.availability) {
              jsonLdAvailability = offers.availability;
            }
          }
          break;
        }

        // Handle ProductGroup type (Harrods uses this with variants)
        if (jsonData["@type"] === "ProductGroup") {
          if (jsonData.name) {
            productName = jsonData.name;
          }
          // Get price from first variant
          if (jsonData.hasVariant && jsonData.hasVariant.length > 0) {
            const variant = jsonData.hasVariant[0];
            if (variant.offers) {
              const offers = Array.isArray(variant.offers) ? variant.offers[0] : variant.offers;
              if (offers.price) {
                const currency = offers.priceCurrency === "USD" ? "$" : "£";
                price = `${currency}${offers.price}`;
              }
              // Get availability from JSON-LD
              if (offers.availability) {
                jsonLdAvailability = offers.availability;
              }
            }
          }
          break;
        }
      } catch {
        // Continue if parsing fails
      }
    }

    // Fallback: Product name from H1 heading
    if (productName === "Unknown") {
      const h1 = document.querySelector("h1");
      productName = h1?.textContent?.trim() || "Unknown";
    }

    // Method 2: Look for specific price elements (not broad text search)
    if (!price) {
      // Look for price in data attributes or specific price classes
      const priceSelectors = [
        '[data-test="product-price"]',
        '[data-test="price"]',
        '[class*="ProductPrice"]',
        '[class*="product-price"]',
        '[class*="selling-price"]',
        '[itemprop="price"]',
      ];

      for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const match = el.textContent?.match(/£[\d,.]+/);
          if (match) {
            price = match[0];
            break;
          }
        }
      }
    }

    // Method 3: Look for price elements near the H1 (more targeted than before)
    if (!price) {
      const h1 = document.querySelector("h1");
      if (h1) {
        // Only look at siblings and immediate parent content, not entire section
        const parent = h1.parentElement;
        if (parent) {
          // Get direct children only, not all descendants
          const siblings = Array.from(parent.children);
          for (const sibling of siblings) {
            if (sibling !== h1) {
              const text = sibling.textContent || "";
              // Only match standalone price (not mixed with lots of other text)
              if (text.length < 50) {
                const match = text.match(/£[\d,.]+/);
                if (match) {
                  price = match[0];
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Check for Add to Bag button FIRST (stronger signal than text)
    const hasAddToBag = !!(
      document.querySelector('[data-test="add-to-bag"]') ||
      document.querySelector(
        'button[class*="add-to-bag"], button[class*="add-to-cart"], button[class*="add-to-basket"]'
      ) ||
      document.querySelector(
        'button[class*="addToBag"], button[class*="addToCart"], button[class*="addToBasket"]'
      ) ||
      document.querySelector(
        'button[aria-label*="Add to Bag"], button[aria-label*="Add to Cart"], button[aria-label*="Add to Basket"]'
      ) ||
      Array.from(document.querySelectorAll("button")).some((btn) => {
        const text = btn.textContent?.toLowerCase() || "";
        return text.includes("add to bag") || text.includes("add to basket") || text.includes("add to cart");
      })
    );

    // Check for Quantity selector
    const hasQuantity = !!(
      document.querySelector('select[aria-label*="uantity"]') ||
      document.querySelector('select[id*="quantity"]') ||
      document.querySelector('label[for*="quantity"]')
    );

    // Check for out of stock ONLY in product section
    let hasOutOfStock = false;
    const h1 = document.querySelector("h1");
    if (h1) {
      const productSection =
        h1.closest("section, article, main") || h1.parentElement?.parentElement?.parentElement;
      if (productSection) {
        const sectionText = productSection.textContent?.toLowerCase() || "";
        hasOutOfStock =
          sectionText.includes("out of stock") ||
          sectionText.includes("sold out") ||
          sectionText.includes("currently unavailable") ||
          (sectionText.includes("notify me") && !hasAddToBag);
      }
    }

    let availability: string;
    if (hasAddToBag || hasQuantity) {
      availability = "In Stock";
    } else if (hasOutOfStock) {
      availability = "Out of Stock";
    } else if (jsonLdAvailability) {
      // Use JSON-LD availability as fallback
      if (jsonLdAvailability.includes("InStock") || jsonLdAvailability.includes("LimitedAvailability")) {
        availability = "In Stock";
      } else if (jsonLdAvailability.includes("OutOfStock") || jsonLdAvailability.includes("SoldOut")) {
        availability = "Out of Stock";
      } else if (jsonLdAvailability.includes("PreOrder")) {
        availability = "Pre-order";
      } else {
        availability = "Unknown";
      }
    } else {
      availability = "Unknown";
    }

    // Return price as "Unknown" if null (will be handled by caller)
    return {
      productName,
      price: price || "Unknown",
      availability,
      originalPrice
    };
  });

  // If price is "Unknown", return null instead of a fake value
  const finalPrice = data.price === "Unknown" ? null : data.price;

  return {
    productName: data.productName,
    price: finalPrice,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: finalPrice ? extractCurrency(finalPrice) : "GBP",
  };
}
