# Product Checker API

AI-powered product data extraction from e-commerce websites using Stagehand and Gemini AI.

## Features

- **Universal Product Extraction**: Works with any e-commerce product page
- **AI-Powered**: Uses Gemini 2.0 Flash for intelligent data extraction
- **Residential Proxy**: Proxying.io residential proxy for reliable access
- **Parallel Processing**: Batch endpoint supports concurrent requests
- **Site-Specific Extractors**: Optimized extractors for complex sites (Harrods)

## Supported Vendors

| Vendor | Status | Notes |
|--------|--------|-------|
| Argos | ✅ | Full support |
| ASDA | ✅ | Full support |
| Boots | ✅ | Full support |
| Harrods | ✅ | Site-specific extractor |
| John Lewis | ✅ | Full support |
| M&S | ✅ | Full support |
| Next | ✅ | Full support |
| Ocado | ✅ | Full support |
| Sainsbury | ✅ | Full support |
| Superdrug | ✅ | Full support |

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browser
npm run install-browser
```

## Configuration

Create a `.env` file:

```env
# Server port (default: 3001)
PORT=3003

# Proxying.io credentials (optional - has defaults)
PROXYING_USER=mcgrocer1
PROXYING_PASS=wNeIluDyGU

# Max concurrent requests for batch (default: 3)
MAX_CONCURRENT=3

# Display for headed mode (set by xvfb on server)
DISPLAY=:99
```

## Usage

### Start Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start

# With xvfb (headed mode on server)
DISPLAY=:99 npm start
```

### API Endpoints

#### Health Check
```bash
GET /health
```
Response:
```json
{"status": "ok", "timestamp": "2026-01-06T11:00:00.000Z"}
```

#### Single Product Check
```bash
POST /check
Content-Type: application/json

{
  "url": "https://www.boots.com/product-name-12345",
  "productName": "Optional product name hint"
}
```
Response:
```json
{
  "url": "https://www.boots.com/product-name-12345",
  "product": "Product Name",
  "price": "£29.99",
  "availability": "In Stock",
  "originalPrice": "£39.99",
  "currency": "GBP",
  "checkedAt": "2026-01-06T11:00:00.000Z"
}
```

#### Batch Product Check (Parallel)
```bash
POST /check-batch
Content-Type: application/json

{
  "items": [
    {"url": "https://www.boots.com/product-1", "productName": "Product 1"},
    {"url": "https://www.argos.co.uk/product-2", "productName": "Product 2"},
    {"url": "https://www.johnlewis.com/product-3", "productName": "Product 3"}
  ],
  "concurrency": 3
}
```
Response:
```json
{
  "results": [
    {"url": "...", "product": "...", "price": "...", "availability": "...", "success": true},
    {"url": "...", "product": "...", "price": "...", "availability": "...", "success": true},
    {"url": "...", "product": "...", "price": "...", "availability": "...", "success": true}
  ],
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "duration": "45.2s",
    "concurrency": 3
  }
}
```

## Availability Values

| Value | Description |
|-------|-------------|
| `In Stock` | Product available, Add to Cart button present |
| `Out of Stock` | Sold out, unavailable |
| `Limited Stock` | Low stock warning |
| `Pre-order` | Available for pre-order |
| `Unknown` | Cannot determine availability |

## Architecture

```
product-checker-api/
├── index.ts              # Express server with endpoints
├── product-checker.ts    # Main extraction logic with Stagehand
├── site-extractors.ts    # Site-specific CSS extractors
├── package.json          # Dependencies
└── .env                  # Configuration
```

### How It Works

1. **Request received** with product URL
2. **Browser launched** via Playwright with residential proxy
3. **Page loaded** and cookie banners dismissed
4. **Site-specific check**: If Harrods, use CSS selectors
5. **AI extraction**: Stagehand + Gemini extracts product data
6. **Response returned** with product name, price, availability

## Deployment (RunPod)

The API runs on a RunPod GPU server with xvfb for headed browser mode.

```bash
# SSH to server
ssh root@69.30.85.32 -p 22176

# Start with xvfb
cd /runpod-volume/product-checker-api
DISPLAY=:99 nohup npx tsx index.ts > server.log 2>&1 &

# Check logs
tail -f server.log
```

## Performance

- **Single request**: ~30-45 seconds
- **Batch (3 concurrent)**: ~15 seconds per product
- **10 products**: ~46 seconds total

## Dependencies

- **@browserbasehq/stagehand**: AI-powered browser automation
- **playwright**: Browser automation
- **express**: HTTP server
- **zod**: Schema validation
- **dotenv**: Environment configuration

## Proxy

Uses **Proxying.io** residential proxy for all requests:
- Endpoint: `proxy.proxying.io:8080`
- Protocol: HTTP
- Type: Rotating residential IPs
- Coverage: Global with UK priority
