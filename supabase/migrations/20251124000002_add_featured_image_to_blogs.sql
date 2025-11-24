-- Add featured image columns to blogger_blogs table
ALTER TABLE blogger_blogs
ADD COLUMN featured_image_url TEXT,
ADD COLUMN featured_image_alt TEXT;

-- Add comment for documentation
COMMENT ON COLUMN blogger_blogs.featured_image_url IS 'URL of the featured image for the blog article';
COMMENT ON COLUMN blogger_blogs.featured_image_alt IS 'Alt text for the featured image (SEO and accessibility)';
