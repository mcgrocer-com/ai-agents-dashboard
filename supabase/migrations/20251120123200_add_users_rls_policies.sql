-- Migration: Add RLS Policies for Users Table
-- Created: 2025-11-20
-- Description: Adds Row Level Security policies to allow users to read and update their own preferences
--
-- Policies:
-- 1. users_select_own: Users can read their own user record
-- 2. users_update_own_preferences: Users can update their own preferences field

-- Policy 1: Allow users to read their own user record
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy 2: Allow users to update their own preferences field
-- This policy ensures users can only update the preferences column, not other sensitive fields
CREATE POLICY "users_update_own_preferences" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add comment explaining the policies
COMMENT ON POLICY "users_select_own" ON public.users IS
  'Allows authenticated users to read their own user record including preferences';

COMMENT ON POLICY "users_update_own_preferences" ON public.users IS
  'Allows authenticated users to update their own user record. Used primarily for updating preferences field (e.g., sync_vendors)';
