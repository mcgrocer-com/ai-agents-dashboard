-- Create agent_tools table to store API key health check results
CREATE TABLE IF NOT EXISTS agent_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type TEXT NOT NULL UNIQUE,
  key_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down', 'checking')),
  message TEXT,
  response_time INTEGER, -- in milliseconds
  last_checked TIMESTAMPTZ,
  error_message TEXT,
  api_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on key_type for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_tools_key_type ON agent_tools(key_type);

-- Create index on last_checked for sorting
CREATE INDEX IF NOT EXISTS idx_agent_tools_last_checked ON agent_tools(last_checked DESC);

-- Insert initial rows for each tool
INSERT INTO agent_tools (key_type, key_name, status, message, api_provider) VALUES
  ('serper-key', 'Serper API', 'checking', 'Waiting for first health check', 'Serper'),
  ('openai-vision', 'OpenAI Vision API', 'checking', 'Waiting for first health check', 'OpenAI'),
  ('category-key', 'Category Agent', 'checking', 'Waiting for first health check', 'Google Gemini'),
  ('weight-and-dimension-key', 'Weight & Dimension Agent', 'checking', 'Waiting for first health check', 'Google Gemini'),
  ('seo-agent-key', 'SEO Agent', 'checking', 'Waiting for first health check', 'Google Gemini'),
  ('supabase-key', 'Supabase', 'checking', 'Waiting for first health check', 'Supabase')
ON CONFLICT (key_type) DO NOTHING;

-- Grant permissions
GRANT SELECT ON agent_tools TO authenticated;
GRANT SELECT ON agent_tools TO anon;

-- Add comment
COMMENT ON TABLE agent_tools IS 'Stores health check results for external API tools used by AI agents';
