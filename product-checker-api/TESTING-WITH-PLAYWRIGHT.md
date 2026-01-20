# Testing Product Checker API with Playwright MCP

This document describes the testing and verification strategy for the Product Checker API using the Playwright MCP (Model Context Protocol) tool.

## Overview

The Product Checker API extracts product information (name, price, availability) from UK retailer websites using CSS-based extraction with AI fallback. To ensure accuracy, we verify API results against actual website content using Playwright.

## Testing Workflow

### 1. Start the API Server

```bash
cd product-checker-api
npm start
```

The server runs on port 3001 by default.

### 2. Test API Endpoints

**Single Product Check:**
```bash
curl -s -X POST http://localhost:3001/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.sainsburys.co.uk/shop/gb/groceries/product/details/best-of-british-/sainsburys-british-red-potatoes-2kg"}'
```

**Batch Check:**
```bash
curl -s -X POST http://localhost:3001/check-batch \
  -H "Content-Type: application/json" \
  -d '{"items": [{"url": "URL1"}, {"url": "URL2"}], "concurrency": 3}'
```

### 3. Verify with Playwright MCP

After getting API results, verify them against actual website content:

#### Navigate to Product Page
```
mcp__playwright__browser_navigate(url: "product-url")
```

#### Wait for Page Load
```
mcp__playwright__browser_wait_for(time: 5)
```

#### Take Accessibility Snapshot
```
mcp__playwright__browser_snapshot()
```

The snapshot provides a structured view of the page including:
- Product name (usually in `heading [level=1]`)
- Price (look for elements containing `£X.XX`)
- Availability (look for "Add to basket/trolley" buttons)

## Verification Checklist

For each product, verify:

| Field | API Response | Website Content | Match |
|-------|-------------|-----------------|-------|
| Product Name | Check `product` field | Look for `heading [level=1]` | Should match or be similar |
| Price | Check `price` field | Look for elements with `£X.XX` | Should match exactly |
| Availability | Check `availability` field | Look for Add button or "Out of Stock" text | Should match |

## Vendor-Specific Extraction Details

### Sainsbury's (2024+ Layout)

Sainsbury's uses a complex nested structure for product pages. The extractor uses multiple fallback methods:

#### Page Structure (verified via Playwright snapshot)
```yaml
main:
  - heading [level=1]: "Product Name"
  - generic:
    - generic: "£3.30"       # Nectar price
    - generic: "with Nectar"
  - generic:
    - generic: "£4.95"       # Regular price
    - generic: "£2.48 / 100ml"  # Unit price
  - button: "Add [product name] to trolley"
```

#### Extraction Methods (in priority order)

| Method | Description | When Used |
|--------|-------------|-----------|
| Method 1 | Scoped leaf node scan within main product area | Primary method - finds container with H1 + Add button |
| Method 2 | Find Add button, extract price from parent container | When Method 1 returns no prices |
| Method 3 | Look for "with Nectar" pattern sibling structure | Fallback for Nectar-priced products |
| Method 4 | data-testid selector (older layout) | Legacy pages with `[data-testid="pd-retail-price"]` |
| Method 5 | Full page leaf node scan | Last resort - may include similar products prices |

#### Price Extraction Rules
- Uses regex `/^£\d+\.\d{2}$/` to match ONLY exact price format
- Rejects concatenated prices like "£4.95£2.48 / 100ml"
- Sorts prices descending, takes highest as regular price
- Supports pence format (e.g., "15p" → "£0.15")

#### Availability Detection
- Primary: Look for main Add button containing "to trolley" + product name
- Secondary: Any button with text "add", "to trolley", "to basket"
- Out of Stock: Disabled button with "out of stock" or main content text
- Excludes "Similar Products" section from out of stock text search

#### Known Issues
- "Similar Products" section has concatenated prices (e.g., "£3.50£23.33 / ltr")
- Nectar prices shown alongside regular prices - we extract the higher (regular) price
- Some products may show "Nectar Price" badge without regular price displayed
- **Sainsbury's detects headless browsers** - requires `HEADLESS=false` with Xvfb virtual display

#### Test URL
```
https://www.sainsburys.co.uk/gol-ui/product/dove-advanced-care-original-anti-perspirant-deodorant-spray-200ml
```

Expected extraction:
- Product: "Dove Women Original 72h Advanced Care Antiperspirant Deodorant 200ml"
- Price: "£4.95" (regular) or "£3.30" (Nectar)
- Availability: "In Stock"

---

## Common Issues and Fixes

### 1. Price Concatenation Issue (Sainsbury's)

**Problem:** Sainsbury's concatenates price and unit price (e.g., "£1.5578p / kg" instead of "£1.55" and "78p / kg").

**Solution:** Use element-level extraction with strict regex `/^£\d+\.\d{2}$/` to match elements containing ONLY a price. The extractor now scopes the search to the main product area to avoid similar products.

### 2. Stock Detection False Positives

**Problem:** Page contains "out of stock" text in unrelated sections (footer, similar products).

**Solution:** Prioritize the presence of "Add to Basket/Bag" button over page-wide text search:
```typescript
if (hasAddButton) {
  availability = "In Stock";
} else if (hasOutOfStock) {
  availability = "Out of Stock";
}
```

The extractor also explicitly excludes text containing "similar products" from out-of-stock detection.

### 3. Intermittent Website Errors

**Problem:** Some retailers (e.g., Sainsbury's) show intermittent "Something went wrong" errors.

**Solution:** The API has retry logic. If verification fails, try navigating to the page again with Playwright.

### 4. Proxy Connection Issues

**Problem:** Some sites (e.g., Argos) fail with ERR_TUNNEL_CONNECTION_FAILED through proxy.

**Solution:** Configure proxy bypass for affected domains in `product-checker.ts`:
```typescript
const proxyBypassDomains = ["www.argos.co.uk", "argos.co.uk"];
```

### 5. Multiple Prices on Page (Sainsbury's, Tesco)

**Problem:** Pages show multiple prices (regular, Nectar/Clubcard, unit price) and "Similar Products" section has additional prices.

**Solution:**
- Scope extraction to main product container (area with H1 + Add button)
- Use leaf node detection to avoid concatenated prices
- Sort prices descending and take highest as regular retail price

## Test Products File

Reference products for testing are maintained in `test-products.json`:

```json
{
  "vendor": "sainsbury",
  "url": "https://www.sainsburys.co.uk/...",
  "name": "Product Name",
  "expectedPrice": "1.55",
  "expectedStock": "in stock",
  "extraction": "css"
}
```

## Playwright MCP Commands Reference

| Command | Purpose |
|---------|---------|
| `browser_navigate` | Navigate to URL |
| `browser_wait_for` | Wait for time or text |
| `browser_snapshot` | Get accessibility tree |
| `browser_take_screenshot` | Capture visual screenshot |
| `browser_click` | Click an element |
| `browser_evaluate` | Run JavaScript |

## Example Verification Session

1. **Test API:**
   ```bash
   curl -s -X POST http://localhost:3001/check \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.marksandspencer.com/pure-cotton-rubus-bedding-set/p/hbp22606237"}'
   ```

   Response:
   ```json
   {"product": "Pure Cotton Rubus Bedding Set", "price": "£59.50", "availability": "In Stock"}
   ```

2. **Navigate with Playwright:**
   ```
   browser_navigate(url: "https://www.marksandspencer.com/pure-cotton-rubus-bedding-set/p/hbp22606237")
   ```

3. **Wait and Snapshot:**
   ```
   browser_wait_for(time: 5)
   browser_snapshot()
   ```

4. **Verify in Snapshot:**
   - Find `heading [level=1]`: "Pure Cotton Rubus Bedding Set"
   - Find price element: "£59.50"
   - Find button: "Add to bag"

5. **Confirm Match:** All fields match API response.

## Supported Vendors

| Vendor | CSS Extraction | Notes |
|--------|---------------|-------|
| Argos | Yes | Bypasses proxy |
| Boots | Yes | |
| John Lewis | Yes | |
| Sainsbury's | Yes | Fixed price concatenation |
| Ocado | Yes | May require login for some products |
| M&S | Yes | |
| Next | Yes | |
| Superdrug | Yes | |
| Harrods | Yes | Check URL validity |
| ASDA | Yes | Bot detection issues |

## Troubleshooting

1. **Server won't start:** Check if port 3001 is in use: `npx kill-port 3001`
2. **Browser not found:** Run `mcp__playwright__browser_install()`
3. **Page not loading:** Check proxy settings or try bypassing proxy
4. **Wrong price extracted:** Add debug logging and check extractor selectors


// https://britishshop.pl/en_GB/p/Marks-Spencer-Brown-Sauce-475g/7771