-- Add Oxylabs Proxy tool to agent_tools table
-- This is a residential proxy for UK IP access in price comparison scraping

INSERT INTO agent_tools (
  key_type,
  key_name,
  status,
  message,
  api_provider
)
VALUES (
  'oxylabs-proxy',
  'Oxylabs Proxy',
  'down',
  'Waiting for first health check',
  'Oxylabs'
)
ON CONFLICT (key_type) DO NOTHING;
