-- Migration: Add Auto-Create Trigger for Public Users
-- Created: 2025-11-20
-- Description: Automatically creates a record in public.users when a user signs up via auth.users
--              Also backfills existing auth.users that don't have public.users records

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, preferences, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'reviewer', -- Default role
    true,
    '{}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if record already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Create public.users records for existing auth.users
-- Only insert users where both ID and email don't exist in public.users
INSERT INTO public.users (id, email, full_name, role, is_active, preferences, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'reviewer', -- Default role
  true,
  '{}'::jsonb,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu
  WHERE pu.id = au.id OR pu.email = au.email
);

-- Add comment
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a record in public.users when a user signs up via auth.users. Triggered after INSERT on auth.users.';
