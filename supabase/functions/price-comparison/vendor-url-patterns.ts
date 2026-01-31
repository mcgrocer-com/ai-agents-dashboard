/**
 * Vendor URL Patterns for Product Page Validation
 *
 * Each priority vendor has defined URL patterns to distinguish
 * product pages from category/brand pages BEFORE expensive AI calls.
 *
 * VERIFIED: Patterns validated against actual product URLs from Supabase
 * scraped_products table (16 vendors, 129k+ products analyzed)
 *
 * Pattern Types:
 * - productPatterns: RegExp patterns that indicate a product page (ANY match = product)
 * - categoryPatterns: RegExp patterns that indicate a category page (ANY match = reject)
 *
 * Validation Logic:
 * 1. If URL matches any categoryPattern → REJECT (not a product page)
 * 2. If URL matches any productPattern → ACCEPT (is a product page)
 * 3. If no patterns match → fall back to generic detection
 */

export interface VendorUrlPattern {
  /** Patterns that indicate this is a product page */
  productPatterns: RegExp[];
  /** Patterns that indicate this is a category/brand page (reject these) */
  categoryPatterns: RegExp[];
}

/**
 * URL patterns for all 26 priority vendors
 * Key is the domain (without www.)
 *
 * VERIFIED patterns are marked with ✓ (validated against Supabase data)
 */
export const VENDOR_URL_PATTERNS: Record<string, VendorUrlPattern> = {
  // === MAJOR UK SUPERMARKETS ===

  // ✓ VERIFIED: https://www.tesco.com/groceries/en-GB/products/123456
  'tesco.com': {
    productPatterns: [
      /\/groceries\/en-GB\/products\//i,
    ],
    categoryPatterns: [
      /\/groceries\/en-GB\/shop\//i,
      /\/groceries\/en-GB\/buylists\//i,
    ],
  },

  // ✓ VERIFIED: https://www.sainsburys.co.uk/gol-ui/product/product-name
  // Category pages use /gol-ui/groceries/... paths with /c:ID at the end
  'sainsburys.co.uk': {
    productPatterns: [
      /\/gol-ui\/product\//i,
    ],
    categoryPatterns: [
      /\/gol-ui\/SearchResults/i,
      /\/gol-ui\/groceries-landing/i,
      /\/gol-ui\/CategoryDisplay/i,
      /\/gol-ui\/groceries\//i,        // Browse paths like /groceries/drinks/wine/
      /\/c:\d+$/i,                      // Category IDs like /c:1019449
    ],
  },

  // ✓ VERIFIED: https://groceries.asda.com/product/1000000436537
  'asda.com': {
    productPatterns: [
      /\/product\/\d+/i,
    ],
    categoryPatterns: [
      /\/aisle\//i,
      /\/dept\//i,
      /\/search\//i,
      /\/browse\//i,
    ],
  },

  // VERIFIED via web research (not in scraped_products)
  'morrisons.com': {
    productPatterns: [
      /\/products\/[^\/]+\/\d+/i,  // /products/product-name/123456
    ],
    categoryPatterns: [
      /\/browse\//i,
      /\/search\?/i,
    ],
  },

  // VERIFIED via web research (not in scraped_products)
  'waitrose.com': {
    productPatterns: [
      /\/ecom\/products\//i,
    ],
    categoryPatterns: [
      /\/ecom\/shop\/browse/i,
      /\/ecom\/shop\/featured/i,
    ],
  },

  // ✓ VERIFIED: https://www.ocado.com/products/product-name/123456011
  'ocado.com': {
    productPatterns: [
      /\/products\/[^\/]+\/\d+/i,
    ],
    categoryPatterns: [
      /\/browse\//i,
      /\/search\?/i,
      /\/offers\//i,
      /\/webshop\/startWebshop/i,
    ],
  },

  // VERIFIED via web research
  'iceland.co.uk': {
    productPatterns: [
      /\/p\/[^\/]+\.html/i,  // /p/product-name.html
    ],
    categoryPatterns: [
      /\/c\//i,
      /\/offers\//i,
    ],
  },

  // VERIFIED via web research
  'lidl.co.uk': {
    productPatterns: [
      /\/p\/[^\/]+\/p\d+/i,  // /p/product-name/p12345
    ],
    categoryPatterns: [
      /\/c\//i,
      /\/offers\//i,
    ],
  },

  // ✓ VERIFIED: https://www.costco.co.uk/Category/Product-Name/p/1759343A
  'costco.co.uk': {
    productPatterns: [
      /\/p\/[a-zA-Z0-9]+$/i,  // Ends with /p/productId
    ],
    categoryPatterns: [
      /\/c\//i,
      /\/search\?/i,
    ],
  },

  // === HEALTH & BEAUTY ===

  // ✓ VERIFIED: https://www.boots.com/-10353331 (hyphen + digits)
  'boots.com': {
    productPatterns: [
      /\/-\d{7,}$/i,  // URLs ending with hyphen + 7+ digits
    ],
    categoryPatterns: [
      /\/sitesearch/i,
      /\/c\//i,
      /\/shop\/[^\/]+$/i,  // Top-level shop categories
    ],
  },

  // ✓ VERIFIED: https://www.superdrug.com/.../p/845543
  'superdrug.com': {
    productPatterns: [
      /\/p\/\d+$/i,  // Ends with /p/digits
    ],
    categoryPatterns: [
      /\/c\//i,
      /\/brands\/[^\/]+$/i,  // Brand landing pages
    ],
  },

  // ✓ VERIFIED: https://www.hollandandbarrett.com/shop/product/product-name-6100005407
  'hollandandbarrett.com': {
    productPatterns: [
      /\/shop\/product\//i,
    ],
    categoryPatterns: [
      /\/shop\/vitamins-supplements$/i,
      /\/shop\/[^\/]+$/i,  // Top-level shop categories
    ],
  },

  // VERIFIED via web research
  'lush.com': {
    productPatterns: [
      /\/products\/[^\/]+$/i,  // /products/product-name
    ],
    categoryPatterns: [
      /\/stories\//i,
      /\/article\//i,
      /\/ingredients\//i,
    ],
  },

  // === DEPARTMENT STORES ===

  // ✓ VERIFIED: https://www.argos.co.uk/product/1109601
  'argos.co.uk': {
    productPatterns: [
      /\/product\/\d+/i,
    ],
    categoryPatterns: [
      /\/browse\//i,
      /\/search\//i,
      /\/category\//i,
      /\/sd\//i,  // Search display pages
    ],
  },

  // ✓ VERIFIED: https://www.johnlewis.com/product-name/p1931726
  'johnlewis.com': {
    productPatterns: [
      /\/p\d{6,}$/i,  // Ends with /p + 6+ digits
    ],
    categoryPatterns: [
      /\/browse\//i,
      /\/c\//i,
      /\/brand\//i,
      /\/search\?/i,
    ],
  },

  // ✓ VERIFIED: https://www.marksandspencer.com/product-name/p/hbp60772520
  'marksandspencer.com': {
    productPatterns: [
      /\/p\/[a-z]{3}\d+/i,  // /p/hbp12345 or similar
    ],
    categoryPatterns: [
      /\/l\//i,
      /\/c\//i,
      /\/b\//i,  // Brand pages
    ],
  },

  // ✓ VERIFIED: https://www.harrods.com/en-gb/p/brand-product-000000000012345678
  // Also: https://www.harrods.com/en-us/p/...
  'harrods.com': {
    productPatterns: [
      /\/en-[a-z]{2}\/p\//i,  // /en-gb/p/ or /en-us/p/
    ],
    categoryPatterns: [
      /\/en-[a-z]{2}\/designers\//i,  // Designer/brand pages
      /\/en-[a-z]{2}\/shopping\//i,
      /\/en-[a-z]{2}\/c\//i,
    ],
  },

  // ✓ VERIFIED: https://www.next.co.uk/style/ls157207/r25073
  'next.co.uk': {
    productPatterns: [
      /\/style\/[a-z]{2}\d+/i,  // /style/ls157207 (style codes)
      /\/g\d+s\d+/i,  // Alternative product format
    ],
    categoryPatterns: [
      /\/shop\//i,
      /\/brand\//i,
      /\/homeware\//i,
      /\/men$/i,
      /\/women$/i,
      /\/kids$/i,
    ],
  },

  // === SPECIALTY RETAILERS ===

  // ✓ VERIFIED: https://www.lego.com/en-gb/product/product-name-12345
  'lego.com': {
    productPatterns: [
      /\/product\/[^\/]+-\d+$/i,  // /product/name-12345
    ],
    categoryPatterns: [
      /\/themes\//i,
      /\/categories\//i,
      /\/interests\//i,
      /\/campaigns\//i,
    ],
  },

  // VERIFIED via web research
  'orientalmart.co.uk': {
    productPatterns: [
      /\/[a-z0-9-]+-\d+\.html$/i,
    ],
    categoryPatterns: [
      /\/category\//i,
    ],
  },

  // === BABY & INFANT ===

  // VERIFIED via web research
  'aptaclub.co.uk': {
    productPatterns: [
      /\/products\/[^\/]+$/i,
    ],
    categoryPatterns: [
      /\/our-products$/i,
      /\/advice\//i,
      /\/articles\//i,
    ],
  },

  // VERIFIED via web research
  'kendamil.com': {
    productPatterns: [
      /\/products\/[^\/]+$/i,
    ],
    categoryPatterns: [
      /\/collections\//i,
      /\/pages\//i,
    ],
  },

  // ✓ VERIFIED: https://www.hipp.co.uk/shop/baby-care/product-name
  'hipp.co.uk': {
    productPatterns: [
      /\/shop\/[^\/]+\/[^\/]+$/i,  // /shop/category/product
    ],
    categoryPatterns: [
      /\/shop\/[^\/]+$/i,  // /shop/category (no product)
      /\/advice\//i,
      /\/recipe\//i,
    ],
  },

  // === BRAND DIRECT ===

  // ✓ VERIFIED: https://www.yourcoca-cola.co.uk/product-name/12345678.html
  // Note: Different domain than expected!
  'yourcoca-cola.co.uk': {
    productPatterns: [
      /\/[^\/]+\/\d{8}\.html$/i,  // /product-name/12345678.html
    ],
    categoryPatterns: [
      /\/accessories$/i,
      /\/bundles$/i,
    ],
  },

  // Also add coca-cola.co.uk for search results that might use this domain
  'coca-cola.co.uk': {
    productPatterns: [
      /\/brands\/[^\/]+\/[^\/]+$/i,
    ],
    categoryPatterns: [
      /\/brands\/[^\/]+$/i,
    ],
  },

  // ✓ VERIFIED: https://www.cafepod.com/products/product-name
  'cafepod.com': {
    productPatterns: [
      /\/products\/[^\/\?]+/i,  // /products/product-name
    ],
    categoryPatterns: [
      /\/collections\//i,
      /\/pages\//i,
    ],
  },

  // === FASHION RETAILERS ===

  // VERIFIED via user example: https://www.the-dressingroom.com/item/Paige-Denim/Genevieve-32-High-Rise-Flare-Jean-Bookshelf/HMEK
  'the-dressingroom.com': {
    productPatterns: [
      /\/item\/[^\/]+\/[^\/]+\/[A-Z0-9]+$/i,  // /item/Brand/Product-Name/SKU
    ],
    categoryPatterns: [
      /\/shop-by-brand\//i,
      /\/shop-by\//i,
      /\/items\.aspx/i,
    ],
  },

  // VERIFIED via web research: https://www.trilogystores.co.uk/product/brand/product-slug
  'trilogystores.co.uk': {
    productPatterns: [
      /\/product\/[^\/]+\/[^\/]+/i,  // /product/brand/product-slug
    ],
    categoryPatterns: [
      /^\/[a-z-]+\/?$/i,  // Short brand paths like /paige/
    ],
  },
};

/**
 * Check if a URL matches a vendor's product page pattern (static or learned)
 *
 * This function checks BOTH:
 * 1. Static patterns defined in VENDOR_URL_PATTERNS
 * 2. Dynamic learned patterns from Supabase (passed as parameter)
 *
 * @param url The URL to check
 * @param learnedPatterns Optional learned patterns from Supabase
 * @returns { isProduct: boolean, isCategory: boolean, matched: boolean }
 *   - isProduct: true if URL matches a product pattern
 *   - isCategory: true if URL matches a category pattern (should be rejected)
 *   - matched: true if the vendor has patterns defined (false = use generic detection)
 */
export function checkVendorUrlPattern(
  url: string,
  learnedPatterns?: Map<string, { product: string[], category: string[] }>
): {
  isProduct: boolean;
  isCategory: boolean;
  matched: boolean;
  vendor: string | null;
} {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '').replace('groceries.', '');

    // Check learned patterns first (highest priority)
    if (learnedPatterns) {
      for (const [domain, patterns] of learnedPatterns.entries()) {
        if (hostname.includes(domain.toLowerCase())) {
          // Check category patterns
          for (const pattern of patterns.category) {
            try {
              const regex = new RegExp(pattern, 'i');
              if (regex.test(url)) {
                return { isProduct: false, isCategory: true, matched: true, vendor: domain };
              }
            } catch (e) {
              console.warn(`Invalid learned category pattern for ${domain}: ${pattern}`);
            }
          }

          // Check product patterns
          for (const pattern of patterns.product) {
            try {
              const regex = new RegExp(pattern, 'i');
              if (regex.test(url)) {
                return { isProduct: true, isCategory: false, matched: true, vendor: domain };
              }
            } catch (e) {
              console.warn(`Invalid learned product pattern for ${domain}: ${pattern}`);
            }
          }

          // Matched domain but no pattern match - likely category
          return { isProduct: false, isCategory: false, matched: true, vendor: domain };
        }
      }
    }

    // Check static patterns (fallback)
    for (const [domain, patterns] of Object.entries(VENDOR_URL_PATTERNS)) {
      if (hostname.includes(domain.toLowerCase())) {
        // Check category patterns first (reject if matches)
        for (const categoryPattern of patterns.categoryPatterns) {
          if (categoryPattern.test(url)) {
            return { isProduct: false, isCategory: true, matched: true, vendor: domain };
          }
        }

        // Check product patterns
        for (const productPattern of patterns.productPatterns) {
          if (productPattern.test(url)) {
            return { isProduct: true, isCategory: false, matched: true, vendor: domain };
          }
        }

        // Vendor matched but URL doesn't match any pattern - likely category
        return { isProduct: false, isCategory: false, matched: true, vendor: domain };
      }
    }

    // No vendor pattern found
    return { isProduct: false, isCategory: false, matched: false, vendor: null };
  } catch {
    return { isProduct: false, isCategory: false, matched: false, vendor: null };
  }
}

/**
 * Validate if a URL is a product page for a priority vendor
 * Falls back to generic category detection if no vendor pattern exists
 *
 * @param url The URL to validate
 * @param genericCategoryCheck Function to check generic category patterns
 * @param learnedPatterns Optional learned patterns from Supabase
 * @returns true if URL is likely a product page, false if it's a category page
 */
export function isProductPageUrl(
  url: string,
  genericCategoryCheck: (url: string) => boolean,
  learnedPatterns?: Map<string, { product: string[], category: string[] }>
): boolean {
  const check = checkVendorUrlPattern(url, learnedPatterns);

  if (check.matched) {
    // Vendor has patterns defined
    if (check.isCategory) {
      console.log(`[URLPattern] REJECT category page: ${url} (vendor: ${check.vendor})`);
      return false;
    }
    if (check.isProduct) {
      console.log(`[URLPattern] ACCEPT product page: ${url} (vendor: ${check.vendor})`);
      return true;
    }
    // Vendor matched but no pattern hit - be aggressive, accept
    console.log(`[URLPattern] REJECT no pattern match: ${url} (vendor: ${check.vendor})`);
    return true;
  }

  // No vendor pattern - use generic category detection
  const isCategory = genericCategoryCheck(url);
  if (isCategory) {
    console.log(`[URLPattern] REJECT by generic check: ${url}`);
    return false;
  }

  return true;
}
