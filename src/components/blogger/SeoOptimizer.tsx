/**
 * SeoOptimizer Component
 * SEO meta fields with character counts and score display
 */

import { TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface SeoOptimizerProps {
  metaTitle: string;
  metaDescription: string;
  seoScore: number | null;
  readabilityScore: number | null;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  isLoading?: boolean;
}

export function SeoOptimizer({
  metaTitle,
  metaDescription,
  seoScore,
  readabilityScore,
  onMetaTitleChange,
  onMetaDescriptionChange,
  isLoading = false,
}: SeoOptimizerProps) {
  const titleLength = metaTitle.length;
  const descLength = metaDescription.length;
  const idealTitleRange = titleLength >= 50 && titleLength <= 60;
  const idealDescRange = descLength >= 140 && descLength <= 160;

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          SEO Optimization
        </h3>
        <p className="text-sm text-gray-600">
          Optimize your meta tags for search engines and track your SEO score.
        </p>
      </div>

      {(seoScore !== null || readabilityScore !== null) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">SEO Score</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(seoScore)}`}>
              {seoScore ?? '—'}/100
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Readability</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(readabilityScore)}`}>
              {readabilityScore ?? '—'}/100
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta Title
          </label>
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
            <div className="flex items-center gap-2">
              {idealTitleRange ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              )}
              <span
                className={`text-xs ${
                  idealTitleRange ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {idealTitleRange ? 'Optimal length' : 'Aim for 50-60 characters'}
              </span>
            </div>
            <span className="text-xs text-gray-500">{titleLength}/60</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meta Description
          </label>
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
            <div className="flex items-center gap-2">
              {idealDescRange ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-600" />
              )}
              <span
                className={`text-xs ${
                  idealDescRange ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {idealDescRange ? 'Optimal length' : 'Aim for 140-160 characters'}
              </span>
            </div>
            <span className="text-xs text-gray-500">{descLength}/160</span>
          </div>
        </div>
      </div>
    </div>
  );
}
