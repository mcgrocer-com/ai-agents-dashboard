/**
 * ChangeClassificationDialog Component
 * Dialog for viewing product details and changing classification
 */

import { useState, useEffect } from 'react';
import { X, Package, ExternalLink, AlertTriangle } from 'lucide-react';
import ClassificationBadge from './ClassificationBadge';
import type { ClassifiedProduct, ClassificationType } from '@/types/classification';

interface ChangeClassificationDialogProps {
  isOpen: boolean;
  product: ClassifiedProduct | null;
  onClose: () => void;
  onSave: (productId: string, classification: ClassificationType, reason: string) => void;
  isLoading?: boolean;
}

const CLASSIFICATION_OPTIONS: { value: ClassificationType; label: string; description: string }[] = [
  { value: 'not_medicine', label: 'Not Medicine', description: 'Food, household, or non-medicinal product' },
  { value: 'gsl', label: 'GSL - Allowed', description: 'General Sales List medicine' },
  { value: 'pharmacy', label: 'Pharmacy Only', description: 'Requires pharmacy supervision' },
  { value: 'pom', label: 'Prescription Only', description: 'Prescription Only Medicine (POM)' },
  { value: 'unclear', label: 'Unclear', description: 'Borderline or uncertain classification' },
];

export function ChangeClassificationDialog({
  isOpen,
  product,
  onClose,
  onSave,
  isLoading = false,
}: ChangeClassificationDialogProps) {
  const [classification, setClassification] = useState<ClassificationType>('unclear');
  const [reason, setReason] = useState('');

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setClassification(product.classification || 'unclear');
      setReason(product.classification_reason || '');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const handleSave = () => {
    onSave(product.id, classification, reason.trim() || `Changed to ${classification}`);
  };

  const hasChanged = classification !== product.classification;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Change Classification</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Product Info Card */}
            <div className="flex gap-4 p-4 bg-gray-50 rounded-lg mb-6">
              {product.main_image ? (
                <img
                  src={product.main_image}
                  alt={product.name || 'Product'}
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 line-clamp-2">{product.name}</h3>
                {product.vendor && (
                  <p className="text-sm text-gray-500 mt-1">{product.vendor}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {product.price !== null && (
                    <span className="text-sm font-medium text-gray-700">
                      £{product.price.toFixed(2)}
                    </span>
                  )}
                  {product.url && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Product
                    </a>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500 mr-2">Current:</span>
                  <ClassificationBadge
                    classification={product.classification}
                    rejected={product.rejected}
                  />
                </div>
              </div>
            </div>

            {/* Classification Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                New Classification
              </label>
              <div className="space-y-2">
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      classification === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="classification"
                      value={option.value}
                      checked={classification === option.value}
                      onChange={(e) => setClassification(e.target.value as ClassificationType)}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{option.label}</span>
                        {(option.value === 'pharmacy' || option.value === 'pom' || option.value === 'unclear') && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                            Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Classification <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Optional: Explain why this classification is appropriate..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  resize-none"
              />
            </div>

            {/* Warning for rejection */}
            {(classification === 'pharmacy' || classification === 'pom' || classification === 'unclear') && (
              <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  This classification will mark the product as <strong>rejected</strong> and prevent it from being listed.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !hasChanged}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Classification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChangeClassificationDialog;
