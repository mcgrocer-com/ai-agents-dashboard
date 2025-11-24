-- Add Decodo API to agent_tools table
INSERT INTO agent_tools (key_type, key_name, status, message, api_provider) VALUES
  ('decodo-key', 'Decodo API', 'checking', 'Waiting for first health check', 'Decodo')
ON CONFLICT (key_type) DO NOTHING;
