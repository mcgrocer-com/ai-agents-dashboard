# Playwright MCP Verification Guide

This guide explains how to verify Product Checker API results using Playwright MCP tools.

---

## Overview

The verification process compares API extraction results against actual website content to ensure accuracy. This is done using Playwright's browser automation to:

1. Navigate to the product page
2. Extract visible content (name, price, stock)
3. Compare with API results
4. Generate pass/fail verdict

---

## Playwright MCP Commands

### Available Commands

| Command | Purpose | Parameters |
|---------|---------|------------|
| `mcp__playwright__browser_navigate` | Navigate to URL | `url: string` |
| `mcp__playwright__browser_wait_for` | Wait for time or text | `time: number` or `text: string` |
| `mcp__playwright__browser_snapshot` | Get accessibility tree | none |
| `mcp__playwright__browser_take_screenshot` | Capture screenshot | `path: string` |
| `mcp__playwright__browser_click` | Click element | `selector: string` |
| `mcp__playwright__browser_evaluate` | Run JavaScript | `script: string` |

---

## Verification Workflow

### Step 1: Get API Result

First, call the API to get extraction results:

```bash
curl -s -X POST http://localhost:3001/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.argos.co.uk/product/2158675"}'
```

**Expected Response:**
```json
{
  "url": "https://www.argos.co.uk/product/2158675",
  "product": "Slumberdown Wonderful Wool Medium Weight Duvet - Superking",
  "price": "£102.00",
  "availability": "In Stock",
  "currency": "GBP",
  "checkedAt": "2026-01-09T13:23:31.476Z"
}
```

### Step 2: Navigate with Playwright

```javascript
mcp__playwright__browser_navigate({
  url: "https://www.argos.co.uk/product/2158675"
})
```

### Step 3: Wait for Page Load

```javascript
mcp__playwright__browser_wait_for({
  time: 5
})
```

This waits 5 seconds for the page to fully load and render.

### Step 4: Take Snapshot

```javascript
mcp__playwright__browser_snapshot()
```

This returns an accessibility tree of the page structure.

**Example Output:**
```
heading [level=1] "Slumberdown Wonderful Wool Medium Weight Duvet - Superking"
text "£102.00"
button "Add to trolley"
```

### Step 5: Verify Content

Compare the snapshot content with API results:

| Field | API Result | Snapshot Content | Match? |
|-------|-----------|------------------|--------|
| Product Name | "Slumberdown Wonderful Wool..." | heading [level=1] "Slumberdown..." | ✅ |
| Price | "£102.00" | text "£102.00" | ✅ |
| Stock | "In Stock" | button "Add to trolley" present | ✅ |

---

## Verification Examples

### Example 1: Argos Product

**API Call:**
```bash
curl -s -X POST http://localhost:3001/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.argos.co.uk/product/2154387"}'
```

**API Response:**
```json
{
  "product": "AEG HKB75820NB Electric Gas Hob - Black",
  "price": "£580.00",
  "availability": "In Stock"
}
```

**Playwright Verification:**
```javascript
// Navigate
mcp__playwright__browser_navigate({
  url: "https://www.argos.co.uk/product/2154387"
})

// Wait
mcp__playwright__browser_wait_for({ time: 5 })

// Snapshot
const snapshot = mcp__playwright__browser_snapshot()

// Look for in snapshot:
// - heading [level=1] containing "AEG HKB75820NB" ✅
// - text "£580.00" ✅
// - button "Add to trolley" ✅
```

**Verdict:** ✅ PASS - All fields match

### Example 2: ASDA Product

**API Call:**
```bash
curl -s -X POST http://localhost:3001/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://groceries.asda.com/product/1000383180349"}'
```

**API Response:**
```json
{
  "product": "George Home Pink Brushed Cotton Plain Fitted Sheet -Single",
  "price": "£7.50",
  "availability": "In Stock"
}
```

**Playwright Verification:**
```javascript
// Navigate
mcp__playwright__browser_navigate({
  url: "https://groceries.asda.com/product/1000383180349"
})

// Wait
mcp__playwright__browser_wait_for({ time: 5 })

// Snapshot
const snapshot = mcp__playwright__browser_snapshot()

// Look for in snapshot:
// - heading containing "George Home Pink Brushed Cotton" ✅
// - text "£7.50" ✅
// - button "Add to trolley" ✅
```

**Verdict:** ✅ PASS - All fields match

---

## Verification Checklist

For each product verification:

- [ ] Navigate to product URL successfully
- [ ] Page loads without errors (no 404, 500, etc.)
- [ ] Product name visible in heading
- [ ] Product name matches API result (exact or similar)
- [ ] Price visible on page
- [ ] Price matches API result (exact)
- [ ] Stock button present ("Add to trolley/basket")
- [ ] Stock status matches API result
- [ ] Take screenshot for reference
- [ ] Record verdict (PASS/FAIL/PARTIAL)

---

## Verification Criteria

### Product Name Matching

**Exact Match:**
- API: "Slumberdown Wonderful Wool Duvet"
- Page: "Slumberdown Wonderful Wool Duvet"
- Result: ✅ PASS

**Similar Match (acceptable):**
- API: "AEG Built In Single Electric Oven"
- Page: "AEG BEX335011M Built In Single Electric Oven - Stainless Steel"
- Result: ✅ PASS (API name is substring)

**Different (fail):**
- API: "Samsung TV"
- Page: "LG Television"
- Result: ❌ FAIL

### Price Matching

**Exact Match:**
- API: "£102.00"
- Page: "£102.00"
- Result: ✅ PASS

**Within Tolerance (acceptable):**
- API: "£102.00"
- Page: "£101.99" or "£102.50"
- Result: ✅ PASS (±1% allowed for rounding)

**Outside Tolerance (fail):**
- API: "£102.00"
- Page: "£150.00"
- Result: ❌ FAIL

### Stock Status Matching

**In Stock - Correct:**
- API: "In Stock"
- Page: Button "Add to trolley" present
- Result: ✅ PASS

**Out of Stock - Correct:**
- API: "Out of Stock"
- Page: Text "Currently unavailable" present
- Result: ✅ PASS

**Mismatch (fail):**
- API: "In Stock"
- Page: Text "Currently unavailable"
- Result: ❌ FAIL

---

## Sample Verification Script

### Manual Verification Process

```javascript
// 1. Define test product
const testProduct = {
  url: "https://www.argos.co.uk/product/2158675",
  apiResult: {
    product: "Slumberdown Wonderful Wool Medium Weight Duvet - Superking",
    price: "£102.00",
    availability: "In Stock"
  }
};

// 2. Navigate to page
await mcp__playwright__browser_navigate({ url: testProduct.url });

// 3. Wait for load
await mcp__playwright__browser_wait_for({ time: 5 });

// 4. Take snapshot
const snapshot = await mcp__playwright__browser_snapshot();

// 5. Parse snapshot for verification
const productNameInSnapshot = snapshot.includes("Slumberdown Wonderful Wool");
const priceInSnapshot = snapshot.includes("£102.00");
const stockButtonInSnapshot = snapshot.includes("Add to trolley");

// 6. Verify results
const verification = {
  productName: productNameInSnapshot ? "✅ PASS" : "❌ FAIL",
  price: priceInSnapshot ? "✅ PASS" : "❌ FAIL",
  stock: stockButtonInSnapshot ? "✅ PASS" : "❌ FAIL"
};

// 7. Overall verdict
const allPass = productNameInSnapshot && priceInSnapshot && stockButtonInSnapshot;
const verdict = allPass ? "✅ ALL CHECKS PASSED" : "❌ VERIFICATION FAILED";

console.log(verification);
console.log(verdict);
```

---

## Automated Verification Script

A Node.js script is provided: `verify-products.js`

**Usage:**
```bash
node verify-products.js
```

This script:
1. Reads predefined test products
2. Navigates to each URL with Playwright
3. Extracts content from live page
4. Compares with API results
5. Generates pass/fail report
6. Saves screenshots to `.playwright-mcp/`

**Expected Output:**
```
╔═══════════════════════════════════════════════════╗
║   Product Checker API - Playwright Verification   ║
╚═══════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verifying: ARGOS
URL: https://www.argos.co.uk/product/2158675
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 COMPARISON RESULTS:
─────────────────────────────────────────

🏷️  PRODUCT NAME:
   API:     Slumberdown Wonderful Wool Medium Weight Duvet - Superking
   Website: Slumberdown Wonderful Wool Medium Weight Duvet - Superking
   Status:  ✅ MATCH

💰 PRICE:
   API:     £102.00
   Website: £102.00
   Status:  ✅ MATCH

📦 STOCK STATUS:
   API:     In Stock
   Website: In Stock
   Status:  ✅ MATCH

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT: ✅ ALL CHECKS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Recommended Test Products

Based on API test results, verify these products:

### Argos (High Priority - 3 products)
1. **Product #1:** Duvet - £102.00
   - URL: https://www.argos.co.uk/product/2158675
   - Reason: First product, establishes baseline

2. **Product #6:** AEG Hob - £580.00
   - URL: https://www.argos.co.uk/product/2154387
   - Reason: High-value item, mid-range product

3. **Product #10:** Built In Oven - £370.00
   - URL: https://www.argos.co.uk/product/2154002
   - Reason: Last product, ensures consistency

### ASDA (High Priority - 2 products)
1. **Product #11:** Pink Fitted Sheet - £7.50
   - URL: https://groceries.asda.com/product/1000383180349
   - Reason: Only fully successful extraction

2. **Product #13:** Sonic Skateboard - £20.00
   - URL: https://groceries.asda.com/product/1000383180809
   - Reason: Partial success, verify stock detection

### ASDA (Investigation - 1 product)
3. **Product #12:** White TENCEL Sheet - ERROR
   - URL: https://groceries.asda.com/product/1000383180534
   - Reason: Returned 404, verify if product exists

---

## Common Issues During Verification

### Issue 1: Page Not Loading
**Symptom:** Browser hangs or timeout
**Cause:** Network issues, bot detection, slow page
**Solution:** Increase wait time, check URL validity

### Issue 2: Elements Not Found
**Symptom:** Snapshot missing expected elements
**Cause:** Page structure different, slow JavaScript
**Solution:** Wait longer, use alternative selectors

### Issue 3: Price Format Differences
**Symptom:** "£102.00" vs "£102"
**Cause:** Different formatting on page
**Solution:** Normalize both values before comparison

### Issue 4: Stock Button Text Varies
**Symptom:** "Add to trolley" vs "Add to basket"
**Cause:** Vendor-specific terminology
**Solution:** Check for either variant

---

## Verification Report Template

After running verifications, document results:

```markdown
## Verification Results

**Date:** [Date]
**Products Verified:** [Number]
**Method:** Playwright MCP

| Product | URL | Name Match | Price Match | Stock Match | Verdict |
|---------|-----|------------|-------------|-------------|---------|
| Argos #1 | ...2158675 | ✅ | ✅ | ✅ | ✅ PASS |
| Argos #6 | ...2154387 | ✅ | ✅ | ✅ | ✅ PASS |
| ASDA #11 | ...80349 | ✅ | ✅ | ✅ | ✅ PASS |

**Summary:**
- Verified: X products
- Passed: X/X (100%)
- Failed: 0/X (0%)

**Conclusion:** API extraction is accurate and reliable.
```

---

## Next Steps

1. ✅ Run API tests (completed)
2. ⏳ Run Playwright verification script
3. ⏳ Document verification results
4. ⏳ Identify any discrepancies
5. ⏳ Update extractors if issues found
6. ✅ Generate final report

**To run verification:**
```bash
# Install dependencies
npm install playwright

# Install browsers
npx playwright install chromium

# Run verification
node verify-products.js
```

---

**Guide Version:** 1.0
**Last Updated:** 2026-01-09
**Reference:** ARGOS-ASDA-TEST-RESULTS.md
