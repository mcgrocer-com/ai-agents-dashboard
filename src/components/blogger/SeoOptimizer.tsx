/**
 * SeoOptimizer Component
 * SEO meta fields with character counts, validation, and individual SEO scores
 */

import { CheckCircle, AlertCircle, Upload, X, RefreshCw, Sparkles, Eye } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { uploadBlogImage, generateFeaturedImage } from '@/services/blogger/images.service';
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
  topic?: string;
  primaryKeyword?: string;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onPrimaryKeywordChange?: (value: string) => void;
  onFeaturedImageChange?: (url: string, alt: string) => void;
  onImageRemove?: () => void;
  onRegenerateMetaTitle?: () => Promise<void>;
  onRegenerateMetaDescription?: () => Promise<void>;
  isLoading?: boolean;
}

export function SeoOptimizer({
  metaTitle,
  metaDescription,
  featuredImage,
  featuredImageAlt,
  blogId,
  topic = '',
  primaryKeyword = '',
  onMetaTitleChange,
  onMetaDescriptionChange,
  onPrimaryKeywordChange,
  onFeaturedImageChange,
  onImageRemove,
  onRegenerateMetaTitle,
  onRegenerateMetaDescription,
  isLoading = false,
}: SeoOptimizerProps) {
  const [imageAlt, setImageAlt] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingDescription, setIsRegeneratingDescription] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);

  const handleRegenerateTitle = async () => {
    if (!onRegenerateMetaTitle || isRegeneratingTitle) return;
    setIsRegeneratingTitle(true);
    try {
      await onRegenerateMetaTitle();
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateDescription = async () => {
    if (!onRegenerateMetaDescription || isRegeneratingDescription) return;
    setIsRegeneratingDescription(true);
    try {
      await onRegenerateMetaDescription();
    } finally {
      setIsRegeneratingDescription(false);
    }
  };

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

  const handleGenerateImage = async () => {
    if (!onFeaturedImageChange || isGenerating) return;

    setIsGenerating(true);
    setUploadError(null);

    try {
      const result = await generateFeaturedImage(topic || metaTitle, metaTitle, blogId);

      if (result.success && result.data) {
        onFeaturedImageChange(result.data.url, metaTitle);
        // Auto-show preview dialog when image generation completes
        setIsPreviewLoading(true);
        setShowPreview(true);
      } else {
        setUploadError(result.error?.message || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

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
        {/* Primary Keyword Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Keyword
          </label>
          <input
            type="text"
            value={primaryKeyword}
            onChange={(e) => onPrimaryKeywordChange?.(e.target.value)}
            disabled={isLoading || !onPrimaryKeywordChange}
            placeholder="Enter primary keyword for SEO scoring..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            This keyword is used to score your meta title and description. It's auto-selected during content generation.
          </p>
        </div>

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
            {onRegenerateMetaTitle && (
              <button
                type="button"
                onClick={handleRegenerateTitle}
                disabled={isLoading || isRegeneratingTitle}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800
                  hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Regenerate meta title"
              >
                <RefreshCw className={`w-3 h-3 ${isRegeneratingTitle ? 'animate-spin' : ''}`} />
                <span>{isRegeneratingTitle ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            )}
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
            {onRegenerateMetaDescription && (
              <button
                type="button"
                onClick={handleRegenerateDescription}
                disabled={isLoading || isRegeneratingDescription}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800
                  hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Regenerate meta description"
              >
                <RefreshCw className={`w-3 h-3 ${isRegeneratingDescription ? 'animate-spin' : ''}`} />
                <span>{isRegeneratingDescription ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            )}
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
                <button
                  onClick={() => {
                    setIsPreviewLoading(true);
                    setShowPreview(true);
                  }}
                  className="p-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 shadow-lg"
                  title="Preview full image"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={handleGenerateImage}
                  disabled={isLoading || isGenerating || !onFeaturedImageChange}
                  className="p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate with AI"
                >
                  {isGenerating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
                {onImageRemove && (
                  <button
                    onClick={onImageRemove}
                    className="p-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-lg"
                    disabled={isLoading || isGenerating}
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
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowImageInput(true)}
                disabled={isLoading || isGenerating}
                className="px-4 py-6 border-2 border-dashed border-gray-300 rounded-md
                  hover:border-blue-500 hover:bg-blue-50 transition-colors
                  flex flex-col items-center gap-2 text-gray-600 hover:text-blue-600
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Upload Image</span>
                <span className="text-xs text-gray-500">Select from device</span>
              </button>
              <button
                onClick={handleGenerateImage}
                disabled={isLoading || isGenerating || !onFeaturedImageChange}
                className="px-4 py-6 border-2 border-dashed border-purple-300 rounded-md
                  hover:border-purple-500 hover:bg-purple-50 transition-colors
                  flex flex-col items-center gap-2 text-purple-600 hover:text-purple-700
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-600 border-t-transparent" />
                    <span className="text-sm font-medium">Generating...</span>
                    <span className="text-xs text-purple-500">Please wait</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    <span className="text-sm font-medium">Generate with AI</span>
                    <span className="text-xs text-purple-500">Gemini Nano Banana</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error message for generation (shown when no upload input visible) */}
          {uploadError && !showImageInput && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{uploadError}</p>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            Featured images appear on Shopify when the article is published.
          </p>
        </div>
      </div>

      {/* Image Preview Modal - Portal to body for proper fixed positioning */}
      {showPreview && featuredImage && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative min-w-[320px] min-h-[320px] max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-900 shadow-lg"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Loading spinner */}
            {isPreviewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-600 border-t-transparent" />
                  <span className="text-sm text-gray-600 font-medium">Loading image...</span>
                </div>
              </div>
            )}
            <img
              src={featuredImage}
              alt={featuredImageAlt || 'Featured image preview'}
              className={`max-w-full max-h-[85vh] object-contain ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setIsPreviewLoading(false)}
            />
            {featuredImageAlt && !isPreviewLoading && (
              <div className="w-full p-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm text-gray-700 text-center">
                  <strong>Alt text:</strong> {featuredImageAlt}
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
