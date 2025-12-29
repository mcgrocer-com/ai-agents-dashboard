# Check API Key Health

Health check endpoint that validates and tests the operational status of various API keys used by AI agents in the system. This function performs actual API calls to verify that keys are valid and the services are responsive.

## Endpoint

`POST /functions/v1/check-api-key-health`

## Authentication

No authentication required for the function itself, but it requires environment variables to be configured in Supabase Edge Functions.

## Request Body

```json
{
  "keyType": "string"
}
```

### Supported Key Types

- `serper-key`: Serper API for web search functionality
- `openai-vision`: OpenAI Vision API for image analysis
- `category-key`: Gemini API for category classification agent
- `weight-and-dimension-key`: Gemini API for weight and dimension extraction agent
- `seo-agent-key`: Gemini API for SEO optimization agent
- `supabase-key`: Supabase database connection validation
- `decodo-key`: Decodo API for Google Suggest keyword research

## Response

### Success (200)

```json
{
  "success": true,
  "keyType": "serper-key",
  "status": "healthy",
  "message": "Serper API key is valid and operational",
  "responseTime": 245,
  "details": {
    "apiProvider": "Serper",
    "tested": true
  }
}
```

### Error Response (200 with success: false)

```json
{
  "success": false,
  "keyType": "serper-key",
  "status": "down",
  "message": "Serper API returned error: 401",
  "responseTime": 123,
  "details": {
    "apiProvider": "Serper",
    "tested": true,
    "error": "Invalid API key"
  }
}
```

### Status Values

- `healthy`: API key is valid and service is operational
- `degraded`: API key may be valid but service is experiencing issues
- `down`: API key is invalid or service is unavailable

### Error Responses

- **400**: Bad Request - Invalid key type provided
- **405**: Method Not Allowed - Only POST requests accepted
- **500**: Internal Server Error - Unexpected error during health check

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SERPER_API_KEY | Conditional | Required for testing `serper-key` |
| OPENAI_API_KEY | Conditional | Required for testing `openai-vision` |
| GEMINI_API_KEY | Conditional | Required for testing `category-key`, `weight-and-dimension-key`, `seo-agent-key` |
| AI_MODEL_CATEGORY_AGENT | No | Gemini model for category agent (default: `gemini-flash-lite-latest`) |
| AI_MODEL_WEIGHT_AGENT | No | Gemini model for weight agent (default: `gemini-flash-lite-latest`) |
| AI_MODEL_SEO_AGENT | No | Gemini model for SEO agent (default: `gemini-flash-lite-latest`) |
| SUPABASE_URL | Yes | Required for testing `supabase-key` |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Required for testing `supabase-key` |
| DECODO_USERNAME | Conditional | Required for testing `decodo-key` |
| DECODO_PASSWORD | Conditional | Required for testing `decodo-key` |

## Examples

### cURL - Test Serper API Key

```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-api-key-health \
  -H "Content-Type: application/json" \
  -d '{"keyType": "serper-key"}'
```

### cURL - Test Gemini API Key (Category Agent)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-api-key-health \
  -H "Content-Type: application/json" \
  -d '{"keyType": "category-key"}'
```

### cURL - Test Supabase Connection

```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-api-key-health \
  -H "Content-Type: application/json" \
  -d '{"keyType": "supabase-key"}'
```

### JavaScript/TypeScript Example

```typescript
async function checkApiHealth(keyType: string) {
  const response = await fetch(
    'https://your-project.supabase.co/functions/v1/check-api-key-health',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyType }),
    }
  );

  const result = await response.json();

  console.log(`${keyType}: ${result.status}`);
  console.log(`Response time: ${result.responseTime}ms`);
  console.log(`Message: ${result.message}`);

  return result;
}

// Check all API keys
const keys = [
  'serper-key',
  'openai-vision',
  'category-key',
  'weight-and-dimension-key',
  'seo-agent-key',
  'supabase-key',
  'decodo-key',
];

for (const key of keys) {
  await checkApiHealth(key);
}
```

## Behavior

1. **Validates Key Type**: Ensures the requested key type is supported
2. **Performs Live Test**: Makes actual API calls to test key validity
3. **Measures Response Time**: Tracks how long each API call takes
4. **Updates Database**: Automatically saves health check results to `agent_tools` table with:
   - Status (healthy/degraded/down)
   - Response time in milliseconds
   - Last checked timestamp
   - Error message (if applicable)
   - API provider name

## Health Check Tests Performed

### Serper API
- **Endpoint**: `https://google.serper.dev/search`
- **Test**: Simple search query with `q: "health check test"` and `num: 1`
- **Method**: POST with `X-API-KEY` header

### OpenAI Vision API
- **Endpoint**: `https://api.openai.com/v1/models`
- **Test**: List available models
- **Method**: GET with `Authorization: Bearer` header

### Google Gemini API (category, weight-and-dimension, seo-agent)
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Test**: Simple text generation with prompt "Hello"
- **Method**: POST with API key in URL parameter

### Supabase Connection
- **Test**: Query `scraped_products` table for a single record
- **Method**: Internal Supabase client query

### Decodo API
- **Endpoint**: `https://scraper-api.decodo.com/v2/scrape`
- **Test**: Google Suggest scrape with query "health check test"
- **Method**: POST with Basic Authentication

## Database Integration

Results are automatically stored in the `agent_tools` table with the following updates:

- `status`: Current health status
- `message`: Human-readable status message
- `response_time`: API response time in milliseconds
- `last_checked`: ISO timestamp of check
- `error_message`: Error details if check failed
- `api_provider`: Name of the API provider
- `updated_at`: ISO timestamp of update

## Related Functions

- **fetch-vendor-products**: Uses custom API keys for authentication
- **decodo-proxy**: Uses Decodo credentials for web scraping
- **price-comparison**: Uses Serper and Gemini API keys for product search and AI verification

## Notes

- This endpoint is public and does NOT require authentication
- Health checks perform actual API calls, which may consume API quotas
- Failed health checks do not return 5xx errors; check the `success` field in the response
- Database update failures do not fail the health check response
- CORS is enabled for all origins (`Access-Control-Allow-Origin: *`)
- Response times are measured in milliseconds
- Each test makes a minimal API call to avoid consuming quotas
