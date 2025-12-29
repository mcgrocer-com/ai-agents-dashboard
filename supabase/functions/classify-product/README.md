# Classify Product

Stateless API for classifying UK medicines and healthcare products using Google Gemini AI. This function determines whether products should be rejected based on UK medicine regulations (POM, P, GSL classifications) and content policy compliance.

## Endpoint

`POST /functions/v1/classify-product`

## Authentication

Requires Supabase service role key authentication via environment variables. Also requires a valid Google Gemini API key.

## Request Body

```json
{
  "products": [
    {
      "productId": "string",
      "title": "string",
      "description": "string (optional)"
    }
  ]
}
```

- `products`: Array of product objects to classify (required)
  - `productId`: Unique identifier for the product (required)
  - `title`: Product name/title (required)
  - `description`: Product description (optional)

**Batch Processing:**
- Processes products in batches of 3 to avoid rate limits
- 500ms delay between batches
- Maximum products per request: No hard limit, but recommended to keep under 100 for performance

## Response

### Success (200)

```json
{
  "success": true,
  "results": [
    {
      "productId": "abc123",
      "rejected": false,
      "reason": "Product classified as GSL (General Sales List) - allowed"
    },
    {
      "productId": "xyz789",
      "rejected": true,
      "reason": "Product contains prescription-only medicine (POM) - not allowed"
    }
  ]
}
```

### Partial Success with Errors (200)

```json
{
  "success": true,
  "results": [
    {
      "productId": "abc123",
      "rejected": false,
      "reason": "Product approved"
    },
    {
      "productId": "error456",
      "rejected": false,
      "reason": "",
      "error": {
        "message": "API quota exceeded. Please try again later.",
        "retryable": true
      }
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Invalid request body
```json
{
  "success": false,
  "error": "Invalid request: provide products array"
}
```

**405 Method Not Allowed** - Non-POST request
```json
{
  "success": false,
  "error": "Method not allowed"
}
```

**500 Internal Server Error** - Missing API key
```json
{
  "success": false,
  "error": "GEMINI_API_KEY not configured"
}
```

**503 Service Unavailable** - All classifications failed due to rate limiting
```json
{
  "success": false,
  "error": "All classifications failed with retryable errors. Please try again later.",
  "error_type": "quota_exceeded",
  "results": [...]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for bypassing RLS |
| GEMINI_API_KEY | Yes | Google Gemini API key for AI classification |

## Classification Logic

### UK Medicine Classifications
- **POM (Prescription Only Medicine)**: Rejected - requires prescription
- **P (Pharmacy Medicine)**: Rejected - requires pharmacist supervision
- **GSL (General Sales List)**: Approved - can be sold freely

### Model Fallback Strategy
Uses multiple Gemini models with automatic fallback:
1. Attempt 1: Primary model (gemini-1.5-flash)
2. Attempt 2: Secondary model (gemini-1.5-pro)
3. Attempt 3: Tertiary model (gemini-2.0-flash-exp)
4. Attempt 4: Final fallback model

### Retry Logic
- **Exponential backoff**: 1s, 2s, 4s delays with random jitter
- **Model rotation**: Different model for each retry attempt
- **Retryable errors**: Rate limits, quota exceeded, transient failures
- **Non-retryable errors**: Invalid API key, malformed requests

## Examples

### cURL - Single Product

```bash
curl -X POST https://your-project.supabase.co/functions/v1/classify-product \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "productId": "abc123",
        "title": "Paracetamol 500mg Tablets",
        "description": "Pain relief tablets for headaches and fever"
      }
    ]
  }'
```

### cURL - Batch Classification

```bash
curl -X POST https://your-project.supabase.co/functions/v1/classify-product \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "productId": "prod1",
        "title": "Paracetamol 500mg",
        "description": "Pain relief"
      },
      {
        "productId": "prod2",
        "title": "Ibuprofen 200mg",
        "description": "Anti-inflammatory"
      },
      {
        "productId": "prod3",
        "title": "Vitamin D3 Supplements"
      }
    ]
  }'
```

### JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('classify-product', {
  body: {
    products: [
      {
        productId: 'abc123',
        title: 'Paracetamol 500mg Tablets',
        description: 'Pain relief tablets'
      }
    ]
  }
});

if (error) {
  console.error('Classification failed:', error);
} else {
  const results = data.results;
  const accepted = results.filter(r => !r.rejected && !r.error).length;
  const rejected = results.filter(r => r.rejected).length;
  const errored = results.filter(r => r.error).length;

  console.log(`Accepted: ${accepted}, Rejected: ${rejected}, Errors: ${errored}`);

  // Handle individual results
  results.forEach(result => {
    if (result.error) {
      console.warn(`Product ${result.productId} failed:`, result.error.message);
    } else if (result.rejected) {
      console.log(`Product ${result.productId} rejected:`, result.reason);
    } else {
      console.log(`Product ${result.productId} approved:`, result.reason);
    }
  });
}
```

### Python with Retry Logic

```python
import requests
import time

def classify_products_with_retry(products, max_retries=3):
    url = 'https://your-project.supabase.co/functions/v1/classify-product'
    headers = {
        'Authorization': 'Bearer YOUR_ANON_KEY',
        'Content-Type': 'application/json'
    }

    for attempt in range(max_retries):
        response = requests.post(url, headers=headers, json={'products': products})
        data = response.json()

        if response.status_code == 503:
            # Rate limited, retry with backoff
            wait_time = 2 ** attempt
            print(f"Rate limited, waiting {wait_time}s before retry...")
            time.sleep(wait_time)
            continue

        return data

    raise Exception("Max retries exceeded")

# Usage
products = [
    {
        'productId': 'abc123',
        'title': 'Paracetamol 500mg',
        'description': 'Pain relief'
    }
]

result = classify_products_with_retry(products)
print(result)
```

## Related Functions

- **add-product-copyright** - Adds products to copyright queue (separate workflow)
- **remove-product-from-copyright** - Removes products from copyright queue

## Workflow Integration

This function is typically used in the product validation workflow:
1. User scrapes or imports products
2. Products are sent to this function for classification
3. Rejected products are filtered out or flagged
4. Approved products continue to next processing stage
5. Products with errors can be retried later

## Performance Considerations

- **Batch size**: 3 products processed concurrently per batch
- **Batch delay**: 500ms between batches
- **Rate limiting**: Automatic retry with exponential backoff
- **Model rotation**: Uses different models to distribute load
- **Timeout**: Individual classification may take 5-10 seconds
- **Total time**: ~(products / 3) * 0.5s + processing time

## Cost Optimization

- Uses Gemini Flash models primarily for cost efficiency
- Falls back to Pro models only when needed
- Batch processing reduces API call overhead
- Failed classifications return error without marking as rejected (preserves retry ability)

## Error Handling Best Practices

1. **Check for 503 status**: Implement retry logic for rate limiting
2. **Handle partial failures**: Some products may succeed while others fail
3. **Preserve retry capability**: Products with errors are not marked as rejected
4. **Log error types**: Distinguish between retryable and non-retryable errors
5. **Implement backoff**: Use exponential backoff for retries
