/**
 * ProductSelector Component
 * Search and select Shopify products to link in blog
 */

import { useState } from 'react';
import { Search, Plus, X, ExternalLink } from 'lucide-react';
import type { ShopifyProduct } from '@/types/blogger';

interface ProductSelectorProps {
  selectedProducts: ShopifyProduct[];
  onSearch: (query: string) => Promise<ShopifyProduct[]>;
  onAddProduct: (product: ShopifyProduct) => void;
  onRemoveProduct: (productId: string) => void;
  isLoading?: boolean;
}

export function ProductSelector({
  selectedProducts,
  onSearch,
  onAddProduct,
  onRemoveProduct,
  isLoading = false,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ShopifyProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await onSearch(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const isProductSelected = (productId: string) => {
    return selectedProducts.some((p) => p.id === productId);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products..."
          disabled={searching || isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={searching || isLoading || !searchQuery.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Search Results:</p>
          <div className="grid gap-2 max-h-60 overflow-y-auto">
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border border-gray-200
                  rounded-md bg-white hover:border-blue-300"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{product.title}</p>
                  <p className="text-xs text-gray-600">${product.price}</p>
                </div>
                <button
                  onClick={() => onAddProduct(product)}
                  disabled={isProductSelected(product.id)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {isProductSelected(product.id) ? 'Added' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Selected Products ({selectedProducts.length}):
          </p>
          <div className="grid gap-2">
            {selectedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border border-blue-200
                  rounded-md bg-blue-50"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{product.title}</p>
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View product <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <button
                  onClick={() => onRemoveProduct(product.id)}
                  className="p-1 text-red-600 hover:bg-red-100 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
