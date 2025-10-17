-- Create admin user: careers@mcgrocer.com
-- This migration creates both the auth.users and ensures public.users records are in sync

-- Note: This migration uses extensions.create_user() which may not be available
-- If it fails, you'll need to use the Supabase Dashboard or Admin API instead

-- First, ensure the public.users record exists (it should already exist from previous setup)
INSERT INTO public.users (id, email, full_name, role, is_active, preferences, created_at, updated_at)
VALUES (
  'e5bd3fe5-dc1c-4c08-9c3c-ac4123b945b2'::uuid,
  'careers@mcgrocer.com',
  'MCGrocer Admin',
  'admin',
  true,
  '{}'::jsonb,
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = now();

-- Log the user record
DO $$
BEGIN
  RAISE NOTICE 'Public user record created/updated for careers@mcgrocer.com';
  RAISE NOTICE 'User ID: e5bd3fe5-dc1c-4c08-9c3c-ac4123b945b2';
  RAISE NOTICE '';
  RAISE NOTICE 'To complete the setup, create the auth.users record using:';
  RAISE NOTICE '1. Supabase Dashboard > Authentication > Add User';
  RAISE NOTICE '   OR';
  RAISE NOTICE '2. Use the Admin API with the service role key';
  RAISE NOTICE '   OR';
  RAISE NOTICE '3. Run: node scripts/complete_admin_setup.js <SERVICE_ROLE_KEY>';
  RAISE NOTICE '';
  RAISE NOTICE 'Credentials:';
  RAISE NOTICE '  Email: careers@mcgrocer.com';
  RAISE NOTICE '  Password: McGrocer';
  RAISE NOTICE '  Role: admin';
END $$;
