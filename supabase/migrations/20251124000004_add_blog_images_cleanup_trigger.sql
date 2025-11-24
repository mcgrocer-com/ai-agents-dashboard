-- Create function to delete blog images from storage when blog is deleted
-- Cleans up orphaned images from the blog-images bucket

CREATE OR REPLACE FUNCTION cleanup_blog_images()
RETURNS TRIGGER AS $$
DECLARE
  image_path TEXT;
BEGIN
  -- Handle DELETE: Clean up featured image when blog is deleted
  IF TG_OP = 'DELETE' THEN
    IF OLD.featured_image_url IS NOT NULL THEN
      -- Extract the path from the full URL and remove query string
      -- URL format: https://{project}.supabase.co/storage/v1/object/public/blog-images/{user_id}/{blog_id}.{ext}
      image_path := regexp_replace(OLD.featured_image_url, '^.*/blog-images/', '');
      image_path := regexp_replace(image_path, '\?.*$', '');

      -- Delete from storage bucket
      DELETE FROM storage.objects
      WHERE bucket_id = 'blog-images'
      AND name = image_path;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for DELETE operations
CREATE TRIGGER trigger_cleanup_blog_images_on_delete
BEFORE DELETE ON blogger_blogs
FOR EACH ROW
WHEN (OLD.featured_image_url IS NOT NULL)
EXECUTE FUNCTION cleanup_blog_images();

-- Add comment
COMMENT ON FUNCTION cleanup_blog_images IS
  'Automatically deletes featured image from blog-images storage bucket when blog row is deleted.';
