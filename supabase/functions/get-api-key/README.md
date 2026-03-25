# get-api-key

## Overview
Retrieves whitelisted API keys stored in Supabase Vault. Only returns keys from a predefined allowlist to prevent unauthorized access to secrets.

## Endpoint
- **URL**: `/get-api-key`
- **Method**: POST
- **Authentication**: Supabase Auth (anon key or service role)

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Body
```json
{
  "keyName": "gemini_api_key"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| keyName | string | Yes | Name of the secret to retrieve |

### Supported Key Names
| Key Name | Description |
|----------|-------------|
| `gemini_api_key` | Google Gemini API key (used by blogger tool) |

## Response

### Success (200)
```json
{
  "key": "AIza..."
}
```

### Error - Invalid Key Name (400)
```json
{
  "error": "Invalid key name. Allowed: gemini_api_key"
}
```

### Error - Not Found (404)
```json
{
  "error": "Secret not found in vault"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Service role key for vault access |

## Implementation Notes
- Uses Supabase Vault via the `get_vault_secret` RPC function
- Allowlist pattern ensures only specific secrets can be retrieved
- Service role key required to access vault (bypasses RLS)

## Related Functions
- **check-api-key-health** — Tests health of API keys
