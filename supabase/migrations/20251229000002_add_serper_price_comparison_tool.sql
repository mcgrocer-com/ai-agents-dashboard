-- Add Serper Price Comparison tool to agent_tools table
-- This is a dedicated Serper API key for the price comparison edge function

INSERT INTO agent_tools (
  key_type,
  key_name,
  status,
  message,
  api_provider
)
VALUES (
  'serper-key-price-comparison',
  'Serper API (Price Comparison)',
  'down',
  'Waiting for first health check',
  'Serper'
)
ON CONFLICT (key_type) DO NOTHING;
