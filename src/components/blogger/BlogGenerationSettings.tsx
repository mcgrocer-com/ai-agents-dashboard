/**
 * BlogGenerationSettings Dialog
 * Configure AI model, image inclusion, and articles research count
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Sparkles } from 'lucide-react';

// LocalStorage key for caching model preference
const MODEL_STORAGE_KEY = 'blogger_selected_model';

interface BlogGenerationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: BlogGenerationSettings) => void;
  initialSettings: BlogGenerationSettings;
  isLoading?: boolean;
}

export interface BlogGenerationSettings {
  model: 'gemini-3-pro-preview' | 'gemini-3-flash-preview' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash' | 'gemini-2.0-flash-exp' | 'gemini-flash-latest';
  includeImages: boolean;
  articlesResearchCount: number;
  seoIterationCount: number; // SEO fix iterations (5-10)
}

// Helper to get cached model from localStorage
export function getCachedModel(): BlogGenerationSettings['model'] | null {
  try {
    const cached = localStorage.getItem(MODEL_STORAGE_KEY);
    if (cached) {
      return cached as BlogGenerationSettings['model'];
    }
  } catch (e) {
    console.warn('Failed to read cached model:', e);
  }
  return null;
}

// Helper to save model to localStorage
function cacheModel(model: BlogGenerationSettings['model']) {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch (e) {
    console.warn('Failed to cache model:', e);
  }
}

export function BlogGenerationSettingsDialog({
  isOpen,
  onClose,
  onConfirm,
  initialSettings,
  isLoading = false,
}: BlogGenerationSettingsProps) {
  const [settings, setSettings] = useState<BlogGenerationSettings>(initialSettings);

  // Load cached model on mount
  useEffect(() => {
    const cachedModel = getCachedModel();
    if (cachedModel) {
      setSettings(prev => ({ ...prev, model: cachedModel }));
    }
  }, []);

  // Sync settings when initialSettings changes (but preserve cached model)
  useEffect(() => {
    const cachedModel = getCachedModel();
    setSettings({
      ...initialSettings,
      model: cachedModel || initialSettings.model,
    });
  }, [initialSettings]);

  if (!isOpen) return null;

  const modelOptions = [
    {
      value: 'gemini-3-pro-preview',
      label: 'Gemini 3 Pro Preview (Recommended)',
      description: 'Most powerful, 1M token context, highest quality output'
    },
    {
      value: 'gemini-3-flash-preview',
      label: 'Gemini 3 Flash Preview',
      description: 'Fast Gemini 3 model with high quality output'
    },
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Fast, stable, best balance of speed and quality'
    },
    {
      value: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Powerful with slower but higher quality output'
    },
    {
      value: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      description: 'Alternative stable version'
    },
    {
      value: 'gemini-flash-latest',
      label: 'Gemini Flash Latest',
      description: 'Latest stable version with newest features'
    },
    {
      value: 'gemini-2.0-flash-exp',
      label: 'Gemini 2.0 Flash Experimental',
      description: 'Experimental (may have quota limits)'
    },
  ];

  const handleConfirm = () => {
    // Cache the selected model for future sessions
    cacheModel(settings.model);
    onConfirm(settings);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Generation Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* AI Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <div className="space-y-2">
              {modelOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                    settings.model === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={option.value}
                    checked={settings.model === option.value}
                    onChange={(e) => setSettings({ ...settings, model: e.target.value as any })}
                    disabled={isLoading}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Include Images Toggle */}
          <div>
            <label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  Include Product Images
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Add product images to the generated content
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.includeImages}
                onChange={(e) => setSettings({ ...settings, includeImages: e.target.checked })}
                disabled={isLoading}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </label>
          </div>

          {/* Articles Research Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Articles to Research
            </label>
            <input
              type="number"
              min={3}
              max={10}
              value={settings.articlesResearchCount}
              onChange={(e) => {
                const value = Math.max(3, Math.min(10, parseInt(e.target.value) || 3));
                setSettings({ ...settings, articlesResearchCount: value });
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-2">
              Number of top-ranking articles to analyze (3-10). Higher values provide more insights but take longer.
            </p>
          </div>

          {/* SEO Iteration Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SEO Fix Iterations
            </label>
            <input
              type="number"
              min={5}
              max={10}
              value={settings.seoIterationCount}
              onChange={(e) => {
                const value = Math.max(5, Math.min(10, parseInt(e.target.value) || 5));
                setSettings({ ...settings, seoIterationCount: value });
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-2">
              Maximum SEO fix attempts (5-10). Higher values allow more refinement to achieve target SEO score.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Generate Content
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
