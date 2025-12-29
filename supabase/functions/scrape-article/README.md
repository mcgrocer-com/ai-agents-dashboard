# Scrape Article

## Overview
Article scraping using Browserbase cloud browsers. This function is a placeholder implementation that returns a 501 Not Implemented status, as Deno Deploy cannot run Chrome locally. The function demonstrates the required integration pattern for Browserbase and suggests using a Railway backend as a free alternative.

## Endpoint
- **URL**: `/scrape-article`
- **Method**: `POST`
- **Authentication**: None

## Request

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "url": "https://example.com/article"
}
```

#### Field Descriptions
- `url` (required): URL of the article to scrape

## Response

### Current Response (501 Not Implemented)
```json
{
  "success": false,
  "error": "Browserbase integration not yet implemented",
  "note": "See STAGEHAND-BROWSER-LIMITATION.md for Railway backend approach (free alternative)",
  "cost": "$20/month for Browserbase"
}
```

### Error Responses

#### 400 Bad Request - Missing URL
```json
{
  "error": "URL is required"
}
```

#### 500 Internal Server Error - Missing Credentials
```json
{
  "error": "Browserbase credentials required",
  "note": "Deno Deploy cannot run Chrome locally. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID."
}
```

#### 500 Internal Server Error
```json
{
  "error": "error message"
}
```

## Environment Variables
- `BROWSERBASE_API_KEY` (required): Browserbase API key for authentication
- `BROWSERBASE_PROJECT_ID` (required): Browserbase project ID
- `GEMINI_API_KEY` (optional): Gemini API key (referenced but not yet used)

## Browserbase Integration Pattern

### API Endpoint
```
https://www.browserbase.com/v1/sessions
```

### Request Example
```javascript
POST https://www.browserbase.com/v1/sessions
Headers:
  X-BB-API-Key: {BROWSERBASE_API_KEY}
  Content-Type: application/json
Body:
{
  "projectId": "{BROWSERBASE_PROJECT_ID}",
  "browserSettings": {
    "context": {
      "id": "scraping-context"
    }
  }
}
```

### Response Example
```json
{
  "id": "session-id",
  "projectId": "project-id",
  "status": "running",
  "url": "wss://connect.browserbase.com/...",
  ...
}
```

## Current Implementation Status

### What's Implemented
- Basic request validation (URL required)
- Environment variable checks for Browserbase credentials
- CORS support for cross-origin requests
- Browserbase session creation request structure
- Error handling for missing credentials

### What's NOT Implemented
- Actual browser automation using Browserbase session
- Article content extraction
- HTML/text parsing
- Stagehand SDK integration
- Gemini API integration for content processing
- Success response format

## Technical Limitation

### Why Browserbase is Required
Deno Deploy cannot run Chrome/Chromium locally because:
1. Deno Deploy is a serverless platform with limited runtime
2. Chrome requires native binaries and system dependencies
3. No file system access for Chrome installation
4. Limited memory and process management

### Browserbase Solution
Browserbase provides cloud-hosted Chrome browsers accessible via API:
- Remote browser sessions via WebSocket
- Persistent contexts for session management
- Headless and headed modes
- Built-in anti-detection features

### Alternative: Railway Backend
As noted in the response, the recommended free alternative is:
- Deploy a Node.js backend on Railway
- Use Puppeteer or Playwright locally
- Expose REST API for article scraping
- Call from Supabase Edge Function via HTTP

See `STAGEHAND-BROWSER-LIMITATION.md` for detailed instructions.

## CORS Support
Allows cross-origin requests from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

Note: CORS headers are imported from `../_shared/cors.ts` which does not exist in the current codebase. The function may fail with import error.

## Example Usage

### cURL Request
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scrape-article \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

### Response
```json
{
  "success": false,
  "error": "Browserbase integration not yet implemented",
  "note": "See STAGEHAND-BROWSER-LIMITATION.md for Railway backend approach (free alternative)",
  "cost": "$20/month for Browserbase"
}
```

## Future Implementation Plan

### With Browserbase ($20/month)
1. Create Browserbase session using provided code
2. Connect to browser via WebSocket URL
3. Navigate to article URL
4. Extract article content using selectors
5. Clean and parse HTML/text
6. Return structured data

### With Railway (Free)
1. Deploy Node.js backend on Railway
2. Install Puppeteer/Playwright
3. Create scraping endpoint
4. Call Railway endpoint from this function
5. Return scraped data

## Expected Response Format (Future)
```json
{
  "success": true,
  "url": "https://example.com/article",
  "title": "Article Title",
  "content": "Article content...",
  "author": "Author Name",
  "publishedDate": "2025-01-15",
  "images": ["https://example.com/image1.jpg"],
  "metadata": {
    "wordCount": 1234,
    "readingTime": "5 min"
  }
}
```

## Cost Considerations

### Browserbase Pricing
- **Free Tier**: Limited sessions per month
- **Paid Tier**: $20/month for increased usage
- **Enterprise**: Custom pricing

### Railway Pricing (Free Alternative)
- **Free Tier**: $5 credit per month
- **Hobby**: $5/month for more resources
- No usage limits on free tier (within resource constraints)

## Notes
- This function is currently a placeholder/stub
- Returns 501 Not Implemented for all valid requests
- Requires significant development to implement full scraping functionality
- Import from `../_shared/cors.ts` will fail if file doesn't exist
- Browserbase credentials are checked but not actively used
- Consider Railway backend approach for cost-effective solution
- Session ID from Browserbase response is not yet utilized
- No timeout handling for long-running scraping operations
