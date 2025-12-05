/**
 * Vendor Detail Page
 * View and manage vendor settings and accounts
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getVendorById, updateVendor } from '@/services/shopping-assistant';
import { AccountsTable } from '@/components/shopping-assistant/AccountsTable';
import { AddAccountModal } from '@/components/shopping-assistant/AddAccountModal';
import type { Vendor } from '@/types/shopping-assistant';
import { ArrowLeft, Loader2, Plus, Save, ExternalLink } from 'lucide-react';

export const VendorDetailPage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<Vendor>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (vendorId) {
      loadVendor();
    }
  }, [vendorId]);

  const loadVendor = async () => {
    if (!vendorId) return;
    setLoading(true);
    setError(null);

    const result = await getVendorById(vendorId);

    if (result.success && result.data) {
      setVendor(result.data);
      setFormData(result.data);
    } else {
      setError(result.error || 'Failed to load vendor');
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);

    const result = await updateVendor(vendorId, {
      name: formData.name,
      domain: formData.domain,
      login_url: formData.login_url,
      cart_url: formData.cart_url,
      is_prioritized: formData.is_prioritized,
      can_automate: formData.can_automate,
      requires_captcha: formData.requires_captcha,
      rate_limit_daily: formData.rate_limit_daily,
    });

    if (result.success && result.data) {
      setVendor(result.data);
      setEditMode(false);
    } else {
      setError(result.error || 'Failed to save vendor');
    }

    setSaving(false);
  };

  const handleAccountAdded = () => {
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Vendor not found'}</p>
        <Link to="/shopping-assistant/credentials" className="text-blue-600 mt-4 inline-block">
          Back to Credentials
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/shopping-assistant/credentials"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Credentials
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
            <a
              href={`https://${vendor.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 mt-1"
            >
              {vendor.domain}
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <button
                  onClick={() => {
                    setFormData(vendor);
                    setEditMode(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Edit Vendor
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Vendor Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vendor Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            {editMode ? (
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{vendor.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            {editMode ? (
              <input
                type="text"
                value={formData.domain || ''}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{vendor.domain}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login URL</label>
            {editMode ? (
              <input
                type="text"
                value={formData.login_url || ''}
                onChange={(e) => setFormData({ ...formData, login_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{vendor.login_url || '-'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cart URL</label>
            {editMode ? (
              <input
                type="text"
                value={formData.cart_url || ''}
                onChange={(e) => setFormData({ ...formData, cart_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{vendor.cart_url || '-'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Rate Limit</label>
            {editMode ? (
              <input
                type="number"
                value={formData.rate_limit_daily || 50}
                onChange={(e) => setFormData({ ...formData, rate_limit_daily: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{vendor.rate_limit_daily} items/account/day</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editMode ? formData.can_automate : vendor.can_automate}
                onChange={(e) => editMode && setFormData({ ...formData, can_automate: e.target.checked })}
                disabled={!editMode}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can Automate</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editMode ? formData.requires_captcha : vendor.requires_captcha}
                onChange={(e) => editMode && setFormData({ ...formData, requires_captcha: e.target.checked })}
                disabled={!editMode}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Requires Captcha</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editMode ? formData.is_prioritized : vendor.is_prioritized}
                onChange={(e) => editMode && setFormData({ ...formData, is_prioritized: e.target.checked })}
                disabled={!editMode}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Prioritized</span>
            </label>
          </div>
        </div>
      </div>

      {/* Accounts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Add Account
          </button>
        </div>

        <AccountsTable vendorId={vendorId!} refreshKey={refreshKey} />
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          vendorId={vendorId!}
          vendorName={vendor.name}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAccountAdded}
        />
      )}
    </div>
  );
};
