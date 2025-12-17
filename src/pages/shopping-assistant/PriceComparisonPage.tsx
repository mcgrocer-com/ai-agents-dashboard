/**
 * Price Comparison Page
 * Search for product prices across UK retailers
 */

import React, { useState } from 'react';
import { ShoppingAssistantNav } from '@/components/shopping-assistant/ShoppingAssistantNav';
import {
  searchPrices,
  type PriceComparisonProduct,
  type PriceComparisonMetadata,
} from '@/services/shopping-assistant';
import { Search, Loader2, ExternalLink, Clock, Tag, Copy, Check } from 'lucide-react';

export const PriceComparisonPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [products, setProducts] = useState<PriceComparisonProduct[]>([]);
  const [metadata, setMetadata] = useState<PriceComparisonMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  const convertToSerperFormat = () => {
    if (!metadata || products.length === 0) return null;

    return {
      searchParameters: {
        q: metadata.query,
        gl: 'gb',
      },
      organic: products.map((product, index) => ({
        title: product.product_name,
        link: product.source_url,
        snippet: `${product.vendor} - ${product.product_name}`,
        currency: product.currency,
        price: product.price,
        position: index + 1,
        ...(product.confidence >= 0.9 && { rating: 4.5 }),
      }))
    };
  };

  const handleCopyJson = async () => {
    const serperData = convertToSerperFormat();
    if (!serperData) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(serperData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    const result = await searchPrices(query.trim(), limit);

    if (result.success && result.data) {
      setProducts(result.data.products);
      setMetadata(result.data.metadata);
    } else {
      setError(result.error || 'Search failed');
      setProducts([]);
      setMetadata(null);
    }

    setLoading(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <ShoppingAssistantNav />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Price Comparison</h1>
        <p className="text-gray-600 mt-2">
          Search for product prices across UK retailers
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter product name (e.g., Kendamil Stage 1 900g)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={3}>3 results</option>
            <option value={5}>5 results</option>
            <option value={10}>10 results</option>
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Search size={20} />
            )}
            Search
          </button>
        </div>
      </form>

      {/* Metadata */}
      {metadata && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {metadata.execution_time.toFixed(1)}s
            </span>
            <span className="flex items-center gap-1">
              <Tag size={16} />
              {metadata.results_count} results
            </span>
          </div>
          <button
            onClick={handleCopyJson}
            disabled={products.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                Copy JSON
              </>
            )}
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="text-gray-500">Searching UK retailers...</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && products.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <div
              key={`${product.source_url}-${index}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">
                  {product.vendor}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(
                    product.confidence
                  )}`}
                >
                  {Math.round(product.confidence * 100)}% match
                </span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                {product.product_name}
              </h3>
              <p className="text-2xl font-bold text-blue-600 mb-4">
                £{product.price.toFixed(2)}
              </p>
              <a
                href={product.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                View Product <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && hasSearched && products.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found</p>
          <p className="text-gray-400 text-sm mt-2">
            Try a different search term or increase the result limit
          </p>
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Search className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 text-lg">Enter a product to search</p>
          <p className="text-gray-400 text-sm mt-2">
            We'll find prices from 17+ UK retailers
          </p>
        </div>
      )}
    </div>
  );
};
