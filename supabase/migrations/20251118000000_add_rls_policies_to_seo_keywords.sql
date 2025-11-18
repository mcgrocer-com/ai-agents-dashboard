-- Add RLS policies for seo_keywords table
-- This allows authenticated users to perform all operations on the table

-- Enable RLS on seo_keywords table (if not already enabled)
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to SELECT
CREATE POLICY "Allow authenticated users to select seo_keywords"
ON seo_keywords
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow all authenticated users to INSERT
CREATE POLICY "Allow authenticated users to insert seo_keywords"
ON seo_keywords
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow all authenticated users to UPDATE
CREATE POLICY "Allow authenticated users to update seo_keywords"
ON seo_keywords
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow all authenticated users to DELETE
CREATE POLICY "Allow authenticated users to delete seo_keywords"
ON seo_keywords
FOR DELETE
TO authenticated
USING (true);

-- Also allow anon access for now (you can remove this if you only want authenticated access)
CREATE POLICY "Allow anon users to select seo_keywords"
ON seo_keywords
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow anon users to insert seo_keywords"
ON seo_keywords
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon users to update seo_keywords"
ON seo_keywords
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon users to delete seo_keywords"
ON seo_keywords
FOR DELETE
TO anon
USING (true);
