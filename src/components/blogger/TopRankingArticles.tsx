/**
 * TopRankingArticles Component
 * Displays top-ranking articles for competitive intelligence
 */

import { ExternalLink, TrendingUp } from 'lucide-react';

interface Article {
  position: number;
  title: string;
  url: string;
  description: string;
}

interface TopRankingArticlesProps {
  articles: Article[];
  isLoading?: boolean;
  showEmptyState?: boolean;
}

export function TopRankingArticles({ articles, isLoading = false, showEmptyState = false }: TopRankingArticlesProps) {
  if (showEmptyState) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Top-Ranking Articles
        </p>
        <div className="p-12 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-1">Select a keyword to view top-ranking articles</p>
          <p className="text-sm text-gray-500">
            See what's currently ranking for your target keyword
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Loading top-ranking articles...
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Top-Ranking Articles ({articles.length} results):
      </p>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {articles.map((article) => {
          const domain = new URL(article.url).hostname.replace('www.', '');

          return (
            <div
              key={article.position}
              className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all bg-white"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-sm font-bold text-blue-600 flex-shrink-0">
                  #{article.position}
                </span>
                <div className="flex-1 min-w-0">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors flex items-start gap-1.5 group"
                  >
                    <span className="truncate">{article.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-0.5" />
                  </a>
                  <p className="text-xs text-gray-500 mt-0.5 mb-1">{domain}</p>
                  {article.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{article.description}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
