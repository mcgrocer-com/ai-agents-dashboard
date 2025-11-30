/**
 * ClassificationItem Component
 * Clickable list item displaying basic product info with classification
 * Opens dialog to change classification when clicked
 */

import { Package, ExternalLink } from 'lucide-react';
import ClassificationBadge from './ClassificationBadge';
import type { ClassifiedProduct } from '@/types/classification';

interface ClassificationItemProps {
  product: ClassifiedProduct;
  onClick: (product: ClassifiedProduct) => void;
}

export function ClassificationItem({ product, onClick }: ClassificationItemProps) {
  const handleClick = () => {
    onClick(product);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg
        hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group"
    >
      {/* Product Image */}
      <div className="flex-shrink-0">
        {product.main_image ? (
          <img
            src={product.main_image}
            alt={product.name || 'Product'}
            className="w-16 h-16 object-cover rounded-md border border-gray-100"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {product.name || 'Unknown Product'}
            </h3>
            {product.vendor && (
              <p className="text-xs text-gray-500 mt-0.5">{product.vendor}</p>
            )}
          </div>
          <ClassificationBadge
            classification={product.classification}
            rejected={product.rejected}
          />
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          {product.price !== null && (
            <span className="font-medium text-gray-700">
              £{product.price.toFixed(2)}
            </span>
          )}
          {product.classification_confidence !== null && (
            <span>
              Confidence: {Math.round(product.classification_confidence * 100)}%
            </span>
          )}
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </a>
          )}
        </div>
      </div>

      {/* Click indicator */}
      <div className="flex-shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

export default ClassificationItem;
