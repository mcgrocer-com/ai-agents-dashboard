# _shared

Shared utilities used across multiple Edge Functions.

## Files

### gemini-classification.ts

UK medicine classification service using Google Gemini AI.

**Purpose**: Determines if products can be legally sold on McGrocer (non-pharmacy website) based on UK medicine regulations.

**Exports**:
- `classifyProduct(name, description, apiKey, supabase)` - Main classification function
- `ClassificationResult` - Result interface
- `RetryableError` - Error class for retryable failures
- `QuotaExceededError` - Error class for rate limit errors

**Classifications**:
| Classification | Description | Accepted |
|----------------|-------------|----------|
| `not_medicine` | Food, drinks, cosmetics, household items | Yes |
| `gsl` | General Sales List - OTC medicines | Yes |
| `pharmacy` | Requires pharmacist supervision | No |
| `pom` | Prescription Only Medicine | No |
| `unclear` | Cannot determine classification | No |

**Used by**:
- [push-to-pending](../push-to-pending/README.md)
- [retry-failed-classifications](../retry-failed-classifications/README.md)
- [classify-product](../classify-product/README.md)

---

### erpnext-utils.ts

ERPNext API integration utilities.

**Purpose**: Common functions for pushing product data to ERPNext and handling the dual-write pattern (production + staging).

**Exports**:
- `PendingProduct` - Product interface with all agent data
- `pushToERPNext(products, authToken, baseUrl)` - Push products to ERPNext
- `verifyERPNextItems(itemCodes, authToken, baseUrl)` - Verify items exist
- `buildERPNextPayload(product)` - Build API payload from product data

**Used by**:
- [sync-completed-products-to-erpnext](../sync-completed-products-to-erpnext/README.md)
- [push-products-to-erpnext](../push-products-to-erpnext/README.md)
- [resync-product-to-erpnext](../resync-product-to-erpnext/README.md)
- [resync-vendor-to-erpnext](../resync-vendor-to-erpnext/README.md)

## Usage

Import shared utilities in your edge function:

```typescript
import { classifyProduct, ClassificationResult } from '../_shared/gemini-classification.ts';
import { pushToERPNext, PendingProduct } from '../_shared/erpnext-utils.ts';
```

## Notes

- Shared code is not deployed as a separate function
- Changes to shared code require redeploying dependent functions
- Use `npx supabase functions deploy` to deploy all functions with shared code
