-- Migration: Add classification agent guidelines support
-- Purpose: Enable custom guidelines that are appended to base classification system prompt
-- Date: 2025-11-26
-- Note: Guidelines are APPENDED to the base system prompt, not replacing it

-- Insert example guideline for classification agent (optional - can be customized via UI)
INSERT INTO agent_resource (agent_type, resource_type, title, content, is_active, version)
VALUES (
  'classification',
  'guideline',
  'Classification Agent Guidelines',
  'Additional guidelines for product classification:

- Prioritize accuracy over speed
- When in doubt, always classify as REJECTED (unclear)
- Consider product packaging and dosage information carefully
- Be extra cautious with herbal and supplement products

These guidelines supplement the base classification rules.',
  true,
  1
)
ON CONFLICT (agent_type, resource_type) WHERE is_active = true
DO UPDATE SET
  content = EXCLUDED.content,
  updated_at = NOW();

-- Add comment
COMMENT ON TABLE agent_resource IS 'Stores agent guidelines, system prompts, and other resources used by AI agents';
