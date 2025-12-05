/**
 * SeoOptimizer Component
 * SEO meta fields with character counts, validation, and individual SEO scores
 */

import { CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { uploadBlogImage } from '@/services/blogger/images.service';
import {
  calculateMetaTitleScore,
  calculateMetaDescriptionScore,
} from '@/services/blogger/ai.service';

interface SeoOptimizerProps {
  metaTitle: string;
  metaDescription: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  blogId: string;
  primaryKeyword?: string;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onFeaturedImageChange?: (url: string, alt: string) => void;
  onImageRemove?: () => void;
  isLoading?: boolean;
}

export function SeoOptimizer({
  metaTitle,
  metaDescription,
  featuredImage,
  featuredImageAlt,
  blogId,
  primaryKeyword = '',
  onMetaTitleChange,
  onMetaDescriptionChange,
  onFeaturedImageChange,
  onImageRemove,
  isLoading = false,
}: SeoOptimizerProps) {
  const [imageAlt, setImageAlt] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const titleLength = metaTitle.length;
  const descLength = metaDescription.length;

  // Calculate individual SEO scores with criteria breakdown
  const titleScore = useMemo(
    () => calculateMetaTitleScore(metaTitle, primaryKeyword),
    [metaTitle, primaryKeyword]
  );
  const descScore = useMemo(
    () => calculateMetaDescriptionScore(metaDescription, primaryKeyword),
    [metaDescription, primaryKeyword]
  );

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onFeaturedImageChange) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadBlogImage(file, blogId);

      if (result.success && result.data) {
        onFeaturedImageChange(result.data.url, imageAlt || metaTitle);
        setImageAlt('');
        setShowImageInput(false);
      } else {
        setUploadError(result.error?.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          SEO Optimization
        </h3>
        <p className="text-sm text-gray-600">
          Optimize your meta tags for search engines.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Meta Title
            </label>
            <span
              className={`text-sm font-semibold ${
                titleScore.score === titleScore.maxScore
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`}
            >
              Score: {titleScore.score}/{titleScore.maxScore}
            </span>
          </div>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => onMetaTitleChange(e.target.value)}
            disabled={isLoading}
            placeholder="Enter SEO-optimized title..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{titleLength}/60 characters</span>
          </div>
          {/* Criteria breakdown */}
          <div className="mt-2 space-y-1">
            {titleScore.criteria.map((criterion) => (
              <div key={criterion.name} className="flex items-center gap-2">
                {criterion.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    criterion.passed ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {criterion.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Meta Description
            </label>
            <span
              className={`text-sm font-semibold ${
                descScore.score === descScore.maxScore
                  ? 'text-green-600'
                  : 'text-yellow-600'
              }`}
            >
              Score: {descScore.score}/{descScore.maxScore}
            </span>
          </div>
          <textarea
            value={metaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            disabled={isLoading}
            placeholder="Enter SEO-optimized description..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">{descLength}/160 characters</span>
          </div>
          {/* Criteria breakdown */}
          <div className="mt-2 space-y-1">
            {descScore.criteria.map((criterion) => (
              <div key={criterion.name} className="flex items-center gap-2">
                {criterion.passed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    criterion.passed ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {criterion.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Image Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Featured Image
          </label>

          {featuredImage ? (
            <div className="relative border border-gray-300 rounded-md overflow-hidden">
              <img
                src={featuredImage}
                alt={featuredImageAlt || 'Featured image'}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                {onImageRemove && (
                  <button
                    onClick={onImageRemove}
                    className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-lg"
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {featuredImageAlt && (
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    <strong>Alt text:</strong> {featuredImageAlt}
                  </p>
                </div>
              )}
            </div>
          ) : showImageInput ? (
            <div className="space-y-3 p-4 border border-gray-300 rounded-md bg-gray-50">
              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image File
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileSelect}
                  disabled={isLoading || isUploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                    file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: JPEG, PNG, WebP, GIF (Max 5MB)
                </p>
              </div>

              {/* Alt text input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alt Text (Optional)
                </label>
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Defaults to blog title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading || isUploading}
                />
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm font-medium">Uploading image...</span>
                </div>
              )}

              {/* Error message */}
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{uploadError}</p>
                </div>
              )}

              {/* Cancel button */}
              <div>
                <button
                  onClick={() => {
                    setShowImageInput(false);
                    setImageAlt('');
                    setUploadError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={isLoading || isUploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowImageInput(true)}
              disabled={isLoading}
              className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-md
                hover:border-blue-500 hover:bg-blue-50 transition-colors
                flex flex-col items-center gap-2 text-gray-600 hover:text-blue-600
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">Upload Featured Image</span>
              <span className="text-xs text-gray-500">Click to select an image file</span>
            </button>
          )}

          <p className="text-xs text-gray-500 mt-2">
            Featured images appear on Shopify when the article is published.
          </p>
        </div>
      </div>
    </div>
  );
}
