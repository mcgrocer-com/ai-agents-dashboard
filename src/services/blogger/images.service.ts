/**
 * Blogger Images Service
 * Handles image upload to Supabase Storage and AI image generation
 */

import { supabase } from '@/lib/supabase/client';
import { GoogleGenAI } from '@google/genai';
import type { ServiceResponse } from '@/types/blogger';
import { callDecodoProxy } from './ai.service';

// Initialize Google GenAI for image generation
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

const BUCKET_NAME = 'blog-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// Domains that are already hosted on our infrastructure (no need to re-host)
const HOSTED_DOMAINS = [
  'supabase.co',           // Already on Supabase
  'cdn.shopify.com',       // Shopify CDN (product images)
  'mcgrocer.com',          // Our own domain
];

/**
 * Check if URL is already hosted on our infrastructure
 */
function isHostedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return HOSTED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

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

/**
 * Generate a featured image using Gemini 2.5 Flash Image (Nano Banana)
 * @param topic - Blog topic to generate image for
 * @param metaTitle - Meta title for context
 * @param blogId - Blog ID for saving
 */
export async function generateFeaturedImage(
  topic: string,
  metaTitle: string,
  blogId: string
): Promise<ServiceResponse<{ url: string; path: string }>> {
  try {
    // Get current user for storage path
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

    // Create a detailed prompt for blog featured image
    const imagePrompt = `Create a professional, high-quality featured image for a blog article.

Topic: ${topic}
Title: ${metaTitle}

Requirements:
- Clean, modern design suitable for a blog header
- No text or words in the image
- Professional and visually appealing
- Bright, engaging colors
- 16:9 aspect ratio composition
- High quality, photorealistic or professional illustration style
- Suitable for grocery, food, or e-commerce context if relevant to the topic`;

    console.log('[Image Generation] Generating image for:', topic);

    // Use Gemini 2.5 Flash Image model (Nano Banana)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: imagePrompt,
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    // Extract image from response
    let imageData: string | null = null;
    let mimeType = 'image/png';

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageData = part.inlineData.data || null;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
    }

    if (!imageData) {
      return {
        data: null,
        error: new Error('No image generated from AI model'),
        success: false,
      };
    }

    // Convert base64 to blob
    const byteCharacters = atob(imageData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const fileExt = extMap[mimeType] || 'png';
    const fileName = `${user.id}/${blogId}.${fileExt}`;

    console.log('[Image Generation] Uploading to storage:', fileName);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error('Error uploading generated image:', uploadError);
      return {
        data: null,
        error: uploadError,
        success: false,
      };
    }

    // Get public URL with cache-busting parameter
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);

    // Add timestamp to bust browser cache
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

    console.log('[Image Generation] Success:', cacheBustedUrl);

    return {
      data: {
        url: cacheBustedUrl,
        path: uploadData.path,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Error generating featured image:', error);
    return {
      data: null,
      error: error as Error,
      success: false,
    };
  }
}

/**
 * Download an external image via proxy and upload to Supabase storage
 * Uses Decodo proxy to bypass CORS restrictions
 * Returns the new Supabase URL or original URL if download fails
 */
export async function rehostExternalImage(
  imageUrl: string,
  blogId: string,
  imageIndex: number
): Promise<{ success: boolean; url: string; error?: string }> {
  const logPrefix = `[Image Rehost ${imageIndex}]`;

  try {
    // Parse URL for logging
    let hostname = 'unknown';
    try {
      hostname = new URL(imageUrl).hostname;
    } catch {
      // Invalid URL
    }

    console.log(`${logPrefix} Processing: ${hostname} - ${imageUrl.substring(0, 100)}...`);

    // Skip if already hosted on our infrastructure
    if (isHostedUrl(imageUrl)) {
      console.log(`${logPrefix} SKIP: Already hosted on ${hostname}`);
      return { success: true, url: imageUrl };
    }

    // Skip data URLs
    if (imageUrl.startsWith('data:')) {
      console.log(`${logPrefix} SKIP: Data URL`);
      return { success: true, url: imageUrl };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error(`${logPrefix} FAIL: User not authenticated`);
      return { success: false, url: imageUrl, error: 'User not authenticated' };
    }

    console.log(`${logPrefix} DOWNLOAD: Fetching via proxy from ${hostname}...`);

    // Download the image via Decodo proxy (bypasses CORS)
    const proxyResponse = await callDecodoProxy({ url: imageUrl, proxy_image: true });

    if (!proxyResponse.ok) {
      console.error(`${logPrefix} DOWNLOAD FAIL: Proxy returned ${proxyResponse.status}`);
      return { success: false, url: imageUrl, error: `Proxy error: ${proxyResponse.status}` };
    }

    const result = await proxyResponse.json();

    if (!result.success || !result.data) {
      console.error(`${logPrefix} DOWNLOAD FAIL: ${result.error || 'No image data returned'}`);
      return { success: false, url: imageUrl, error: result.error || 'No image data' };
    }

    const sizeKB = Math.round(result.size / 1024);
    const mimeType = result.mimeType || 'image/jpeg';

    console.log(`${logPrefix} DOWNLOAD OK: ${sizeKB}KB, type: ${mimeType}`);

    // Validate size
    if (result.size > MAX_FILE_SIZE) {
      console.error(`${logPrefix} FAIL: Image too large (${sizeKB}KB > 5MB)`);
      return { success: false, url: imageUrl, error: 'Image too large (>5MB)' };
    }

    // Convert base64 to blob
    const byteCharacters = atob(result.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Determine file extension
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const fileExt = extMap[mimeType] || 'jpg';
    const fileName = `${user.id}/${blogId}-img${imageIndex}.${fileExt}`;

    console.log(`${logPrefix} UPLOAD: Starting upload to Supabase: ${fileName}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, {
        cacheControl: '31536000', // 1 year cache
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error(`${logPrefix} UPLOAD FAIL:`, uploadError.message);
      return { success: false, url: imageUrl, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    console.log(`${logPrefix} SUCCESS: ${hostname} → ${publicUrl}`);
    return { success: true, url: publicUrl };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} ERROR:`, errorMsg);
    return {
      success: false,
      url: imageUrl,
      error: errorMsg,
    };
  }
}

/**
 * Process all images in HTML content - rehost external images to Supabase
 * @param content - HTML content with image tags
 * @param blogId - Blog ID for naming
 * @returns Updated content with Supabase URLs
 */
export async function rehostAllImages(
  content: string,
  blogId: string
): Promise<{ content: string; rehostedCount: number; failedCount: number }> {
  console.log(`\n========== IMAGE REHOST START ==========`);
  console.log(`Blog ID: ${blogId}`);
  console.log(`Content length: ${content.length} chars`);

  // Extract all image URLs
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: { fullTag: string; url: string }[] = [];
  let match;

  while ((match = imgPattern.exec(content)) !== null) {
    images.push({ fullTag: match[0], url: match[1] });
  }

  console.log(`Found ${images.length} images in content`);

  if (images.length === 0) {
    console.log(`========== IMAGE REHOST END (no images) ==========\n`);
    return { content, rehostedCount: 0, failedCount: 0 };
  }

  // Log all image URLs found
  images.forEach((img, i) => {
    try {
      const hostname = new URL(img.url).hostname;
      const isHosted = isHostedUrl(img.url);
      console.log(`  [${i}] ${hostname} ${isHosted ? '(HOSTED - will skip)' : '(EXTERNAL - will rehost)'}`);
    } catch {
      console.log(`  [${i}] Invalid URL: ${img.url.substring(0, 50)}...`);
    }
  });

  let updatedContent = content;
  let rehostedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Process images sequentially to avoid rate limits
  for (let i = 0; i < images.length; i++) {
    const { fullTag, url } = images[i];

    // Skip if already hosted (check again for clarity in logs)
    if (isHostedUrl(url)) {
      skippedCount++;
      continue;
    }

    const result = await rehostExternalImage(url, blogId, i);

    if (result.success && result.url !== url) {
      // Replace URL in the tag
      const newTag = fullTag.replace(url, result.url);
      updatedContent = updatedContent.replace(fullTag, newTag);
      rehostedCount++;
    } else if (!result.success) {
      failedCount++;
    }
  }

  console.log(`\n========== IMAGE REHOST SUMMARY ==========`);
  console.log(`  Total images: ${images.length}`);
  console.log(`  Skipped (already hosted): ${skippedCount}`);
  console.log(`  Rehosted successfully: ${rehostedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`========== IMAGE REHOST END ==========\n`);

  return { content: updatedContent, rehostedCount, failedCount };
}
