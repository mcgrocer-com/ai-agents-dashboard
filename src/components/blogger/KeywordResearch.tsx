/**
 * KeywordResearch Component
 * Keyword research interface with AI-powered suggestions
 */

import { useState } from 'react';
import { Search, TrendingUp, Check } from 'lucide-react';
import type { Keyword } from '@/types/blogger';

interface KeywordResearchProps {
  topic: string;
  keywords: Keyword[];
  selectedKeyword: Keyword | null;
  onResearch: (topic: string) => Promise<void>;
  onSelectKeyword: (keyword: Keyword) => void;
  isLoading?: boolean;
}

export function KeywordResearch({
  topic,
  keywords,
  selectedKeyword,
  onResearch,
  onSelectKeyword,
  isLoading = false,
}: KeywordResearchProps) {
  const [searchTopic, setSearchTopic] = useState(topic);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTopic.trim()) {
      onResearch(searchTopic.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Keyword Research
        </h3>
        <p className="text-sm text-gray-600">
          Research keywords for your topic to optimize SEO performance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={searchTopic}
          onChange={(e) => setSearchTopic(e.target.value)}
          placeholder="Enter topic to research keywords..."
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2
            focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !searchTopic.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          {isLoading ? 'Researching...' : 'Research'}
        </button>
        <button
          type="button"
          onClick={() => {
            // Use topic as primary keyword (fallback when API is unavailable)
            onSelectKeyword({
              keyword: searchTopic,
              search_volume: 0,
              competition: 'medium' as const,
              intent: 'informational' as const,
              topic: searchTopic
            });
          }}
          disabled={!searchTopic.trim()}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700
            disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Skip research and use topic as primary keyword"
        >
          Skip Research
        </button>
      </form>

      {keywords.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Select a primary keyword:
          </p>
          <div className="grid gap-2">
            {keywords.map((keyword, idx) => {
              const isSelected = selectedKeyword?.keyword === keyword.keyword;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectKeyword(keyword)}
                  className={`
                    p-3 text-left rounded-lg border transition-all
                    ${isSelected
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{keyword.keyword}</span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-600">
                          Volume: {keyword.search_volume.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-600">
                          Difficulty: {keyword.competition}
                        </span>
                        <span className="text-xs text-gray-600 capitalize">
                          Intent: {keyword.intent}
                        </span>
                      </div>
                    </div>
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
