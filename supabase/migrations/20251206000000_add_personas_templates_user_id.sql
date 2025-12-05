-- ============================================================================
-- Migration: Add user_id column to blogger_personas and blogger_templates
-- Description: Enables user-created personas and templates while protecting
--              system (seeded) items from modification
-- Date: 2025-12-06
-- ============================================================================

-- Add user_id column to personas (nullable - null means system persona)
ALTER TABLE blogger_personas
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to templates (nullable - null means system template)
ALTER TABLE blogger_templates
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- blogger_personas CRUD policies
-- ============================================================================

-- RLS: Users can only INSERT their own personas (with their user_id)
CREATE POLICY "Users can create their own personas"
    ON blogger_personas FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- RLS: Users can only UPDATE user-created personas (not system ones)
CREATE POLICY "Users can update user-created personas"
    ON blogger_personas FOR UPDATE TO authenticated
    USING (user_id IS NOT NULL);

-- RLS: Users can only DELETE user-created personas (not system ones)
CREATE POLICY "Users can delete user-created personas"
    ON blogger_personas FOR DELETE TO authenticated
    USING (user_id IS NOT NULL);

-- ============================================================================
-- blogger_templates CRUD policies
-- ============================================================================

-- RLS: Users can only INSERT their own templates (with their user_id)
CREATE POLICY "Users can create their own templates"
    ON blogger_templates FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- RLS: Users can only UPDATE user-created templates (not system ones)
CREATE POLICY "Users can update user-created templates"
    ON blogger_templates FOR UPDATE TO authenticated
    USING (user_id IS NOT NULL);

-- RLS: Users can only DELETE user-created templates (not system ones)
CREATE POLICY "Users can delete user-created templates"
    ON blogger_templates FOR DELETE TO authenticated
    USING (user_id IS NOT NULL);

-- ============================================================================
-- Indexes for user_id columns
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_blogger_personas_user_id ON blogger_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_blogger_templates_user_id ON blogger_templates(user_id);
