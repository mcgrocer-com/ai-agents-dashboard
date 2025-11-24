-- RLS policies for blog-images storage bucket
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fxkjblrlogjumybceozk/sql

-- Enable RLS (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to blog images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update blog images" ON storage.objects;

-- Policy 1: Allow authenticated users to INSERT (upload) images to blog-images bucket
CREATE POLICY "Allow authenticated users to upload blog images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-images');

-- Policy 2: Allow public SELECT (read) access to blog-images bucket
CREATE POLICY "Allow public read access to blog images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'blog-images');

-- Policy 3: Allow authenticated users to DELETE their uploads from blog-images bucket
CREATE POLICY "Allow authenticated users to delete blog images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'blog-images');

-- Policy 4: Allow authenticated users to UPDATE their uploads in blog-images bucket
CREATE POLICY "Allow authenticated users to update blog images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-images');
