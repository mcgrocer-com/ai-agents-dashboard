/**
 * Blogger Images Service
 * Handles image upload to Supabase Storage
 */

import { supabase } from '@/lib/supabase/client';
import type { ServiceResponse } from '@/types/blogger';

const BUCKET_NAME = 'blog-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Upload image to Supabase Storage
 * @param file - The image file to upload
 * @param blogId - Blog ID to use as filename
 */
export async function uploadBlogImage(
  file: File,
  blogId: string
): Promise<ServiceResponse<{ url: string; path: string }>> {
  try {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        data: null,
        error: new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'),
        success: false,
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        data: null,
        error: new Error('File size exceeds 5MB limit.'),
        success: false,
      };
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        data: null,
        error: new Error('User not authenticated'),
        success: false,
      };
    }

    // Generate file name using blog ID
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${blogId}.${fileExt}`;

    // Upload to Supabase Storage (upsert=true to replace existing image with same blog ID)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true, // Allow replacing existing image
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return {
        data: null,
        error: uploadError,
        success: false,
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);

    return {
      data: {
        url: publicUrl,
        path: uploadData.path,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error uploading image:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteBlogImage(path: string): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

    if (error) {
      console.error('Error deleting image:', error);
      return {
        data: null,
        error,
        success: false,
      };
    }

    return {
      data: null,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error deleting image:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}
