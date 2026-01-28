/**
 * Site-specific extractor router
 * Routes URLs to the appropriate vendor-specific CSS selector extractors
 * Falls back to AI extraction for unknown vendors
 */

import {
  extractArgos,
  extractAsda,
  extractBoots,
  extractCafepod,
  extractCocaCola,
  extractCostco,
  extractHarrods,
  extractJohnLewis,
  extractLego,
  extractMarksAndSpencer,
  extractNext,
  extractOcado,
  extractSainsburys,
  extractSuperdrug,
  extractTesco,
  extractWaitrose,
  SiteExtractionResult,
  PageWithEvaluate,
  waitForContent,
} from "./extractors";

export type { SiteExtractionResult };
export type { PageWithEvaluate };

// Map of domain patterns to extractors
const VENDOR_EXTRACTORS: Record<string, (page: PageWithEvaluate) => Promise<SiteExtractionResult>> = {
  "argos.co.uk": extractArgos,
  "asda.com": extractAsda,
  "boots.com": extractBoots,
  "cafepod.com": extractCafepod,
  "costco.co.uk": extractCostco,
  "harrods.com": extractHarrods,
  "johnlewis.com": extractJohnLewis,
  "lego.com": extractLego,
  "marksandspencer.com": extractMarksAndSpencer,
  "next.co.uk": extractNext,
  "ocado.com": extractOcado,
  "sainsburys.co.uk": extractSainsburys,
  "superdrug.com": extractSuperdrug,
  "tesco.com": extractTesco,
  "waitrose.com": extractWaitrose,
  "yourcoca-cola.co.uk": extractCocaCola,
};

/**
 * Get the list of supported vendors for site-specific extraction
 */
export function getSupportedVendors(): string[] {
  return Object.keys(VENDOR_EXTRACTORS);
}

/**
 * Check if a URL requires site-specific extraction
 * Returns true for all known vendors
 */
export function needsSiteSpecificExtraction(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return Object.keys(VENDOR_EXTRACTORS).some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Get the vendor name from a URL
 */
export function getVendorFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const domain of Object.keys(VENDOR_EXTRACTORS)) {
      if (hostname.includes(domain)) {
        return domain;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Handle Costco's postcode requirement
 * Sets a UK postcode to enable full product availability and add-to-cart functionality
 */
async function handleCostcoPostcode(page: PageWithEvaluate): Promise<void> {
  try {
    // Check if postcode dialog or "Set Postcode" button exists
    const needsPostcode = await page.evaluate(() => {
      const setPostcodeBtn = document.querySelector('button[class*="Set Postcode"], [class*="postcode"]');
      const postcodeText = document.body.textContent?.toLowerCase() || "";
      return (
        postcodeText.includes("set postcode") ||
        postcodeText.includes("enter your delivery postcode") ||
        postcodeText.includes("set delivery postcode") ||
        !!setPostcodeBtn
      );
    });

    if (!needsPostcode) {
      console.log("[SiteExtractors] Costco: Postcode already set or not required");
      return;
    }

    console.log("[SiteExtractors] Costco: Setting delivery postcode...");

    // Try to find and click the "Set Postcode" button to open dialog
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const setPostcodeBtn = buttons.find(
        (btn) =>
          btn.textContent?.toLowerCase().includes("set postcode") ||
          btn.textContent?.toLowerCase().includes("set delivery")
      );
      if (setPostcodeBtn) {
        (setPostcodeBtn as HTMLButtonElement).click();
      }
    });

    // Wait for dialog to appear
    await new Promise((r) => setTimeout(r, 1000));

    // Find the postcode input field and enter the postcode
    const inputFilled = await page.evaluate(() => {
      const postcode = "SW1A 1AA"; // Westminster, London

      // Look for postcode input in dialog - try multiple selectors
      // Costco uses a textbox with role="textbox" or aria-label="Postcode"
      const selectors = [
        'input[aria-label*="ostcode" i]',
        'input[placeholder*="ostcode" i]',
        'input[name*="ostcode" i]',
        '[role="textbox"]',
        'input[type="text"]',
        'input:not([type])',
      ];

      let postcodeInput: HTMLInputElement | null = null;

      // Try each selector
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const input = el as HTMLInputElement;
          // Check if this input is likely the postcode field
          const isInDialog = input.closest('dialog, [role="dialog"], [class*="modal"], [class*="dialog"]');
          const labelText = input.getAttribute("aria-label")?.toLowerCase() || "";
          const placeholder = input.placeholder?.toLowerCase() || "";
          const nearbyText = input.parentElement?.textContent?.toLowerCase() || "";

          if (
            isInDialog &&
            (labelText.includes("postcode") ||
              placeholder.includes("postcode") ||
              nearbyText.includes("postcode"))
          ) {
            postcodeInput = input;
            break;
          }
        }
        if (postcodeInput) break;
      }

      // Fallback: just find any visible input in a dialog
      if (!postcodeInput) {
        const dialogInputs = document.querySelectorAll(
          'dialog input, [role="dialog"] input, [class*="modal"] input'
        );
        if (dialogInputs.length > 0) {
          postcodeInput = dialogInputs[0] as HTMLInputElement;
        }
      }

      if (postcodeInput) {
        postcodeInput.focus();
        postcodeInput.value = postcode;
        postcodeInput.dispatchEvent(new Event("input", { bubbles: true }));
        postcodeInput.dispatchEvent(new Event("change", { bubbles: true }));
        postcodeInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        return true;
      }
      return false;
    });

    if (!inputFilled) {
      console.log("[SiteExtractors] Costco: Could not find postcode input field");
      return;
    }

    // Wait a moment for validation
    await new Promise((r) => setTimeout(r, 500));

    // Click the confirm/submit button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const confirmBtn = buttons.find(
        (btn) =>
          btn.textContent?.toLowerCase().includes("set delivery postcode") ||
          btn.textContent?.toLowerCase().includes("continue") ||
          btn.textContent?.toLowerCase().includes("confirm") ||
          btn.textContent?.toLowerCase().includes("submit")
      );
      if (confirmBtn) {
        (confirmBtn as HTMLButtonElement).click();
      }
    });

    // Wait for page to update with new availability info
    await new Promise((r) => setTimeout(r, 2000));
    console.log("[SiteExtractors] Costco: Postcode set successfully");
  } catch (error) {
    console.log("[SiteExtractors] Costco: Error setting postcode:", error);
    // Continue with extraction even if postcode setting fails
  }
}

/**
 * Extract product data using site-specific CSS selectors
 * Returns null if no site-specific extractor is available
 */
export async function extractWithSiteSpecific(
  url: string,
  page: PageWithEvaluate
): Promise<SiteExtractionResult | null> {
  const vendor = getVendorFromUrl(url);

  if (!vendor) {
    console.log("[SiteExtractors] No site-specific extractor for URL:", url);
    return null;
  }

  const extractor = VENDOR_EXTRACTORS[vendor];
  if (!extractor) {
    console.log("[SiteExtractors] Extractor not found for vendor:", vendor);
    return null;
  }

  console.log(`[SiteExtractors] Using ${vendor} extractor`);

  try {
    // Wait for page content to load before running CSS extraction
    // Increased timeout to 60s to allow proxy connections and slow sites like Boots more time to load
    const contentReady = await waitForContent(page, 60000);
    if (!contentReady) {
      console.log(`[SiteExtractors] Page content not ready after 60s, skipping CSS extraction`);
      return null;
    }
    console.log(`[SiteExtractors] Page content ready, running ${vendor} extractor`);

    // Handle Costco's postcode requirement before extraction
    if (vendor === "costco.co.uk") {
      await handleCostcoPostcode(page);
    }

    const result = await extractor(page);

    // Validate result - if we got Unknown for ALL fields including availability, return null
    // But if we have valid availability, return the result even with partial data
    if (result.productName === "Unknown" && result.price === "Unknown" && result.availability === "Unknown") {
      console.log(`[SiteExtractors] ${vendor} extractor returned all Unknown values, falling back to AI`);
      return null;
    }

    // Log what we got
    console.log(`[SiteExtractors] ${vendor} extractor result: name=${result.productName}, price=${result.price}, availability=${result.availability}`);
    return result;
  } catch (error) {
    console.error(`[SiteExtractors] Error in ${vendor} extractor:`, error);
    return null;
  }
}
