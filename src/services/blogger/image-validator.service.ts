/**
 * Image Validator Service
 *
 * Validates image URLs in blog content and removes broken images.
 * The content generation agent is responsible for selecting valid images.
 */

export interface ImageValidationResult {
  url: string;
  isValid: boolean;
  status?: number;
  error?: string;
}

export interface ImageValidationReport {
  totalImages: number;
  validImages: number;
  brokenImages: number;
  removedImages: number;
  results: ImageValidationResult[];
  fixedContent: string;
}

/**
 * Extract all image URLs from HTML content
 */
function extractImageUrls(content: string): { url: string; fullTag: string; alt: string }[] {
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: { url: string; fullTag: string; alt: string }[] = [];
  let match;

  while ((match = imgPattern.exec(content)) !== null) {
    const fullTag = match[0];
    const url = match[1];
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    images.push({ url, fullTag, alt });
  }

  return images;
}

/**
 * Check if an image URL is valid/accessible
 * Uses multiple strategies to handle CORS restrictions
 */
async function validateImageUrl(url: string): Promise<ImageValidationResult> {
  try {
    // Skip data URLs - they're always valid
    if (url.startsWith('data:')) {
      return { url, isValid: true, status: 200 };
    }

    // Validate all URLs including CDN domains
    // Strategy 1: Try fetch with no-cors mode (can't read response but checks basic reachability)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { url, isValid: true, status: response.status };
      }

      // Non-OK response means image is broken
      return {
        url,
        isValid: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    } catch (fetchError) {
      // CORS error or network error - try Image element as fallback
      return await validateWithImageElement(url);
    }
  } catch (error) {
    return {
      url,
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Validate image URL using Image element (works around some CORS issues)
 */
function validateWithImageElement(url: string): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = setTimeout(() => {
      img.src = ''; // Cancel loading
      resolve({
        url,
        isValid: false,
        error: 'Timeout loading image',
      });
    }, 8000); // 8s timeout for image loading

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve({
        url,
        isValid: true,
        status: 200,
      });
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve({
        url,
        isValid: false,
        error: 'Image failed to load',
      });
    };

    // Trigger load
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

// Note: Image replacement is disabled - broken images are simply removed.
// The content generation agent should select valid images during generation.
// Automatic replacement was causing incorrect product images to be shown.

/**
 * Validate all images in content and remove broken ones
 * Note: Replacement is disabled - the content agent should select valid images during generation
 */
export async function validateAndFixImages(
  content: string,
  _topic: string,
  options: {
    removeOnFailure?: boolean; // Remove broken images (default: true)
  } = {}
): Promise<ImageValidationReport> {
  const { removeOnFailure = true } = options;

  const images = extractImageUrls(content);
  const results: ImageValidationResult[] = [];
  let fixedContent = content;
  let removedCount = 0;

  // Validate all images in parallel
  const validationPromises = images.map(img => validateImageUrl(img.url));
  const validations = await Promise.all(validationPromises);

  // Process broken images
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const validation = validations[i];

    if (validation.isValid) {
      results.push(validation);
      continue;
    }

    // Image is broken - remove it (no automatic replacement to avoid wrong images)
    console.log(`[ImageValidator] Broken image will be removed: ${img.url}`);

    if (removeOnFailure) {
      // Remove the broken image and its caption
      // Pattern to match image + optional caption paragraph
      const imgWithCaptionPattern = new RegExp(
        escapeRegExp(img.fullTag) +
        '\\s*(?:<p[^>]*style="[^"]*text-align:\\s*center[^"]*"[^>]*>.*?</p>)?',
        'gi'
      );

      fixedContent = fixedContent.replace(imgWithCaptionPattern, '');
      removedCount++;
    }

    results.push(validation);
  }

  // Clean up any double line breaks left by removed images
  fixedContent = fixedContent.replace(/\n{3,}/g, '\n\n').trim();

  return {
    totalImages: images.length,
    validImages: validations.filter(v => v.isValid).length,
    brokenImages: validations.filter(v => !v.isValid).length,
    removedImages: removedCount,
    results,
    fixedContent,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick check for broken images (returns count only)
 */
export async function countBrokenImages(content: string): Promise<number> {
  const images = extractImageUrls(content);
  const validations = await Promise.all(images.map(img => validateImageUrl(img.url)));
  return validations.filter(v => !v.isValid).length;
}
