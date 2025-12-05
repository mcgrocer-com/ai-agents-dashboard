/**
 * Credentials Dashboard Page
 * Admin interface for managing vendors and accounts
 */

import React, { useState, useEffect } from 'react';
import { VendorCard } from '@/components/shopping-assistant/VendorCard';
import { ShoppingAssistantNav } from '@/components/shopping-assistant/ShoppingAssistantNav';
import { AddVendorModal } from '@/components/shopping-assistant/AddVendorModal';
import { getAllVendors } from '@/services/shopping-assistant';
import type { VendorWithStats } from '@/types/shopping-assistant';
import { Loader2, Plus, Search } from 'lucide-react';

export const CredentialsDashboardPage: React.FC = () => {
  const [vendors, setVendors] = useState<VendorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    setError(null);

    const result = await getAllVendors();

    if (result.success && result.data) {
      setVendors(result.data);
    } else {
      setError(result.error || 'Failed to load vendors');
    }

    setLoading(false);
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation */}
      <ShoppingAssistantNav />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Credentials Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Manage vendor accounts and automation settings
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={20} />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search vendors by name or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Vendors Grid */}
      {!loading && filteredVendors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredVendors.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {searchQuery ? 'No vendors found' : 'No vendors configured yet'}
          </p>
          {!searchQuery && (
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => setShowAddModal(true)}
            >
              Add Your First Vendor
            </button>
          )}
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddModal && (
        <AddVendorModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadVendors();
          }}
        />
      )}
    </div>
  );
};
