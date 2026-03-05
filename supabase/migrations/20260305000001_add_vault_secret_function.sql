-- Create a database function to retrieve secrets from vault
-- This is called by the get-api-key edge function using service role

CREATE OR REPLACE FUNCTION get_vault_secret(secret_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name;

  RETURN secret_value;
END;
$$;

-- Revoke direct access from public/anon - only service role can call this
REVOKE EXECUTE ON FUNCTION get_vault_secret(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_vault_secret(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION get_vault_secret(TEXT) FROM authenticated;

-- To store the Gemini API key in vault, run:
-- SELECT vault.create_secret('YOUR_GEMINI_API_KEY_HERE', 'gemini_api_key');
