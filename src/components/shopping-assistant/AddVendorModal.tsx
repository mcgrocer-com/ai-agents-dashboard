/**
 * Add Vendor Modal
 * Modal for selecting and adding a vendor from scraped products
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  getScrapedVendors,
  createVendor,
  type ScrapedVendorOption,
} from '@/services/shopping-assistant';
import { X, Loader2, Search, Check, AlertCircle } from 'lucide-react';

interface AddVendorModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [vendors, setVendors] = useState<ScrapedVendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    const result = await getScrapedVendors();
    if (result.success && result.data) {
      setVendors(result.data);
    } else {
      setError(result.error || 'Failed to load vendors');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!selectedVendor) return;

    setSaving(true);
    setError(null);

    // Create vendor with default settings
    const result = await createVendor({
      name: selectedVendor,
      domain: `${selectedVendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.uk`,
      login_url: null,
      cart_url: null,
      selectors: null,
      is_prioritized: false,
      can_automate: true,
      requires_captcha: false,
      rate_limit_daily: 50,
    });

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Failed to add vendor');
    }

    setSaving(false);
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !v.already_added
  );

  const alreadyAddedCount = vendors.filter((v) => v.already_added).length;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Vendor</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {alreadyAddedCount} vendors already added
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Vendor List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          )}

          {!loading && filteredVendors.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery
                  ? 'No matching vendors found'
                  : 'All vendors have been added'}
              </p>
            </div>
          )}

          {!loading && filteredVendors.length > 0 && (
            <div className="space-y-2">
              {filteredVendors.map((vendor) => (
                <button
                  key={vendor.name}
                  onClick={() => setSelectedVendor(vendor.name)}
                  className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-colors ${
                    selectedVendor === vendor.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900">{vendor.name}</p>
                    <p className="text-sm text-gray-500">
                      {vendor.product_count.toLocaleString()} products
                    </p>
                  </div>
                  {selectedVendor === vendor.name && (
                    <Check size={20} className="text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedVendor || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="animate-spin" size={16} />}
            Add Vendor
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
