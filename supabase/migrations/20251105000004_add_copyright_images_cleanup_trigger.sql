-- Create function to delete copyright images from storage when status is reset
-- Cleans up orphaned images from the copyright-images bucket

CREATE OR REPLACE FUNCTION cleanup_copyright_images()
RETURNS TRIGGER AS $$
DECLARE
  image_url TEXT;
  image_path TEXT;
BEGIN
  -- Handle UPDATE: Clean up when copyright_status changes to pending or NULL
  IF TG_OP = 'UPDATE' THEN
    -- Only proceed if copyright_status changed to pending or NULL
    IF (NEW.copyright_status = 'pending' OR NEW.copyright_status IS NULL)
       AND (OLD.copyright_status IS DISTINCT FROM NEW.copyright_status) THEN

      -- Delete images if they exist in OLD record
      IF OLD.non_copyright_images IS NOT NULL AND array_length(OLD.non_copyright_images, 1) > 0 THEN
        FOREACH image_url IN ARRAY OLD.non_copyright_images LOOP
          -- Extract the path from the full URL and remove query string
          -- URL format: https://{project}.supabase.co/storage/v1/object/public/copyright-images/{path}?
          image_path := regexp_replace(image_url, '^.*/copyright-images/', '');
          image_path := regexp_replace(image_path, '\?.*$', '');

          -- Delete from storage bucket
          DELETE FROM storage.objects
          WHERE bucket_id = 'copyright-images'
          AND name = image_path;
        END LOOP;
      END IF;

      -- Clear the non_copyright_images and non_copyright_desc fields
      NEW.non_copyright_images := NULL;
      NEW.non_copyright_desc := NULL;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle DELETE: Clean up images when product is deleted
  IF TG_OP = 'DELETE' THEN
    IF OLD.non_copyright_images IS NOT NULL AND array_length(OLD.non_copyright_images, 1) > 0 THEN
      FOREACH image_url IN ARRAY OLD.non_copyright_images LOOP
        -- Extract the path from the full URL and remove query string
        image_path := regexp_replace(image_url, '^.*/copyright-images/', '');
        image_path := regexp_replace(image_path, '\?.*$', '');

        -- Delete from storage bucket
        DELETE FROM storage.objects
        WHERE bucket_id = 'copyright-images'
        AND name = image_path;
      END LOOP;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for UPDATE operations
CREATE TRIGGER trigger_cleanup_copyright_images_on_update
BEFORE UPDATE ON pending_products
FOR EACH ROW
WHEN (
  (NEW.copyright_status = 'pending' OR NEW.copyright_status IS NULL)
  AND (OLD.copyright_status IS DISTINCT FROM NEW.copyright_status)
)
EXECUTE FUNCTION cleanup_copyright_images();

-- Create trigger for DELETE operations
CREATE TRIGGER trigger_cleanup_copyright_images_on_delete
BEFORE DELETE ON pending_products
FOR EACH ROW
WHEN (OLD.non_copyright_images IS NOT NULL)
EXECUTE FUNCTION cleanup_copyright_images();

-- Add comment
COMMENT ON FUNCTION cleanup_copyright_images IS
  'Automatically deletes images from copyright-images storage bucket when:
  1. copyright_status is changed to pending or NULL (UPDATE)
  2. Product row is deleted (DELETE)
  Also clears non_copyright_images and non_copyright_desc fields on status reset.';
