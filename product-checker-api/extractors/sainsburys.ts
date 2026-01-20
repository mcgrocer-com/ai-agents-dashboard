/**
 * Sainsbury's-specific extractor
 * Multiple extraction methods for different page layouts (2024+ and legacy)
 *
 * Extraction Methods:
 * - Method 1: Scoped leaf node scan within main product area
 * - Method 2: Find Add button and extract price from nearby container
 * - Method 3: Look for "with Nectar" pattern sibling structure
 * - Method 4: data-testid fallback (older layout)
 * - Method 5: Full page leaf node scan (last resort)
 */

import { SiteExtractionResult, PageWithEvaluate, validateAvailability, extractCurrency } from "./types";

export async function extractSainsburys(page: PageWithEvaluate): Promise<SiteExtractionResult> {
  // All extraction logic is inlined to avoid TypeScript __name helper issues in browser context
  const data = await page.evaluate(() => {
    try {
      // Product name from H1 (Sainsbury's 2024+ layout)
      const h1 = document.querySelector("h1");
      const productName = h1 ? (h1.textContent || "").trim() : "Unknown";
      if (productName === "") return { productName: "Unknown", price: "Unknown", availability: "Unknown", originalPrice: undefined, _debug: { error: "No H1 found" } };

      let price = "Unknown";
      let originalPrice: string | undefined;
      let methodUsed = "";

      // ========== METHOD 1: Scoped search near H1 heading ==========
      // Find the main product section (excludes Similar Products, Frequently Bought Together)
      let mainProductArea: Element | null = null;
      if (h1) {
        let container: Element | null = h1.parentElement;
        for (let i = 0; i < 10 && container; i++) {
          const addBtn = container.querySelector("button");
          if (addBtn && (addBtn.textContent || "").toLowerCase().includes("trolley")) {
            mainProductArea = container;
            break;
          }
          container = container.parentElement;
        }
        if (!mainProductArea) {
          mainProductArea = document.querySelector("main") || h1.parentElement;
        }
      }

      // Extract prices from main product area
      if (mainProductArea && price === "Unknown") {
        const pricesFound: string[] = [];
        const allElements = mainProductArea.querySelectorAll("*");

        for (let idx = 0; idx < allElements.length; idx++) {
          const el = allElements[idx];
          if (el.children.length === 0) {
            const text = (el.textContent || "").trim();
            // Match exact pound format like "£4.95"
            if (/^£\d+\.\d{2}$/.test(text)) {
              pricesFound.push(text);
            }
            // Match exact pence format like "15p"
            if (/^\d{1,3}p$/.test(text)) {
              const penceValue = parseInt(text.replace("p", ""), 10);
              if (!isNaN(penceValue) && penceValue > 0 && penceValue < 1000) {
                pricesFound.push("£" + (penceValue / 100).toFixed(2));
              }
            }
          }
        }

        if (pricesFound.length > 0) {
          const sortedPrices = pricesFound
            .map(function(p) { return { text: p, value: parseFloat(p.replace("£", "")) }; })
            .filter(function(p) { return !isNaN(p.value); })
            .sort(function(a, b) { return b.value - a.value; });

          if (sortedPrices.length > 0) {
            price = sortedPrices[0].text;
            methodUsed = "method1-scoped";
            if (sortedPrices.length > 1 && sortedPrices[1].value < sortedPrices[0].value) {
              originalPrice = sortedPrices[0].text;
            }
          }
        }
      }

      // ========== METHOD 2: Find Add button and extract price from parent container ==========
      if (price === "Unknown") {
        const allButtons = document.querySelectorAll("button");
        const addButtons: Element[] = [];
        for (let i = 0; i < allButtons.length; i++) {
          const btn = allButtons[i];
          const text = (btn.textContent || "").toLowerCase();
          if (text.includes("to trolley") || (text === "add" && btn.closest("main"))) {
            addButtons.push(btn);
          }
        }

        for (let bi = 0; bi < addButtons.length && price === "Unknown"; bi++) {
          const addBtn = addButtons[bi];
          let priceContainer: Element | null = addBtn.parentElement;
          for (let i = 0; i < 5 && priceContainer && price === "Unknown"; i++) {
            const containerPrices: string[] = [];
            const containerElements = priceContainer.querySelectorAll("*");
            for (let j = 0; j < containerElements.length; j++) {
              const el = containerElements[j];
              if (el.children.length === 0) {
                const text = (el.textContent || "").trim();
                if (/^£\d+\.\d{2}$/.test(text)) {
                  containerPrices.push(text);
                }
              }
            }
            if (containerPrices.length > 0 && containerPrices.length <= 4) {
              const sortedPrices = containerPrices
                .map(function(p) { return { text: p, value: parseFloat(p.replace("£", "")) }; })
                .filter(function(p) { return !isNaN(p.value); })
                .sort(function(a, b) { return b.value - a.value; });

              if (sortedPrices.length > 0) {
                price = sortedPrices[0].text;
                methodUsed = "method2-addbutton";
                if (sortedPrices.length > 1) {
                  originalPrice = sortedPrices[0].text;
                }
              }
            }
            priceContainer = priceContainer.parentElement;
          }
        }
      }

      // ========== METHOD 3: Look for "with Nectar" pattern ==========
      if (price === "Unknown") {
        const allElements = document.querySelectorAll("*");
        for (let i = 0; i < allElements.length && price === "Unknown"; i++) {
          const el = allElements[i];
          if (el.children.length === 0 && (el.textContent || "").toLowerCase().includes("with nectar")) {
            let container: Element | null = el.parentElement;
            for (let j = 0; j < 5 && container && price === "Unknown"; j++) {
              const prices: string[] = [];
              const containerElements = container.querySelectorAll("*");
              for (let k = 0; k < containerElements.length; k++) {
                const ce = containerElements[k];
                if (ce.children.length === 0) {
                  const text = (ce.textContent || "").trim();
                  if (/^£\d+\.\d{2}$/.test(text)) {
                    prices.push(text);
                  }
                }
              }
              if (prices.length >= 1 && prices.length <= 4) {
                const sortedPrices = prices
                  .map(function(p) { return { text: p, value: parseFloat(p.replace("£", "")) }; })
                  .filter(function(p) { return !isNaN(p.value); })
                  .sort(function(a, b) { return b.value - a.value; });

                if (sortedPrices.length > 0) {
                  price = sortedPrices[0].text;
                  methodUsed = "method3-nectar";
                  if (sortedPrices.length > 1) {
                    originalPrice = sortedPrices[0].text;
                  }
                }
              }
              container = container.parentElement;
            }
          }
        }
      }

      // ========== METHOD 4: data-testid fallback (older layout) ==========
      if (price === "Unknown") {
        const retailPriceEl = document.querySelector('[data-testid="pd-retail-price"]');
        if (retailPriceEl) {
          const text = (retailPriceEl.textContent || "").trim();
          const match = text.match(/£(\d+\.\d{2})/);
          if (match) {
            price = match[0];
            methodUsed = "method4-testid";
          }
        }
      }

      // ========== METHOD 5: Full page leaf node scan (last resort) ==========
      if (price === "Unknown") {
        const allElements = document.querySelectorAll("*");
        const pricesFound: string[] = [];

        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i];
          if (el.children.length === 0) {
            const text = (el.textContent || "").trim();
            if (/^£\d+\.\d{2}$/.test(text)) {
              pricesFound.push(text);
            }
            if (/^\d{1,3}p$/.test(text)) {
              const penceValue = parseInt(text.replace("p", ""), 10);
              if (!isNaN(penceValue) && penceValue > 0 && penceValue < 1000) {
                pricesFound.push("£" + (penceValue / 100).toFixed(2));
              }
            }
          }
        }

        if (pricesFound.length > 0) {
          const sortedPrices = pricesFound
            .map(function(p) { return { text: p, value: parseFloat(p.replace("£", "")) }; })
            .filter(function(p) { return !isNaN(p.value); })
            .sort(function(a, b) { return b.value - a.value; });

          if (sortedPrices.length > 0) {
            price = sortedPrices[0].text;
            methodUsed = "method5-fullpage";
            if (sortedPrices.length > 1) {
              originalPrice = sortedPrices[0].text;
            }
          }
        }
      }

      // ========== AVAILABILITY DETECTION ==========
      let hasAnyAddButton = false;
      const buttons = document.querySelectorAll("button:not([disabled])");
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = (btn.textContent || "").toLowerCase();
        if (text === "add" || text.includes("to trolley") || text.includes("to basket")) {
          hasAnyAddButton = true;
          break;
        }
      }

      // Check for out of stock indicators
      const outOfStockButton = document.querySelector("button[disabled]");
      const outOfStockButtonText = outOfStockButton ? (outOfStockButton.textContent || "").toLowerCase() : "";
      const hasOutOfStockButton = outOfStockButtonText.includes("out of stock") ||
                                   outOfStockButtonText.includes("unavailable");

      const mainContent = document.querySelector("main") || document.body;
      const mainText = (mainContent.textContent || "").toLowerCase();
      const hasOutOfStockText =
        (mainText.includes("out of stock") ||
        mainText.includes("sold out") ||
        mainText.includes("currently unavailable")) &&
        !mainText.includes("similar products");

      let availability: string;
      if (hasAnyAddButton) {
        availability = "In Stock";
      } else if (hasOutOfStockButton || hasOutOfStockText) {
        availability = "Out of Stock";
      } else {
        availability = "Unknown";
      }

      return {
        productName: productName || "Unknown",
        price: price,
        availability: availability,
        originalPrice: originalPrice,
        _debug: {
          methodUsed: methodUsed,
          hasH1: !!h1,
          h1Text: h1 ? (h1.textContent || "").trim().substring(0, 50) : "none",
          hasMain: !!document.querySelector("main"),
          pageTitle: document.title,
          bodyPreview: (document.body.textContent || "").trim().substring(0, 200),
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
    console.log("[Sainsburys Extractor] Debug:", JSON.stringify(data._debug));
  }

  return {
    productName: data.productName,
    price: data.price,
    availability: validateAvailability(data.availability),
    originalPrice: data.originalPrice,
    currency: extractCurrency(data.price),
  };
}
