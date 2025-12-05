/**
 * Accounts Table Component
 * Displays and manages vendor accounts
 */

import React, { useState, useEffect } from 'react';
import {
  getAllAccounts,
  updateAccount,
  deleteAccount,
} from '@/services/shopping-assistant';
import type { VendorAccountWithVendor } from '@/types/shopping-assistant';
import { Loader2, Trash2, Ban, CheckCircle } from 'lucide-react';

interface AccountsTableProps {
  vendorId: string;
  refreshKey?: number;
}

export const AccountsTable: React.FC<AccountsTableProps> = ({
  vendorId,
  refreshKey = 0,
}) => {
  const [accounts, setAccounts] = useState<VendorAccountWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, [vendorId, refreshKey]);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);

    const result = await getAllAccounts({ vendor_id: vendorId });

    if (result.success && result.data) {
      setAccounts(result.data.items);
    } else {
      setError(result.error || 'Failed to load accounts');
    }

    setLoading(false);
  };

  const handleToggleBlock = async (account: VendorAccountWithVendor) => {
    setActionLoading(account.id);

    const result = await updateAccount(account.id, {
      is_blocked: !account.is_blocked,
    });

    if (result.success) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === account.id ? { ...a, is_blocked: !a.is_blocked } : a
        )
      );
    } else {
      setError(result.error || 'Failed to update account');
    }

    setActionLoading(null);
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    setActionLoading(accountId);

    const result = await deleteAccount(accountId);

    if (result.success) {
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } else {
      setError(result.error || 'Failed to delete account');
    }

    setActionLoading(null);
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-blue-600" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No accounts configured yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Add an account to start automating
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Today
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Last Used
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {account.email}
                </p>
                <p className="text-xs text-gray-500">
                  Added {formatRelativeTime(account.created_at)}
                </p>
              </td>
              <td className="px-4 py-3">
                {account.is_blocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <Ban size={12} />
                    Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle size={12} />
                    Active
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {account.daily_items_added}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {account.total_items_added}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {formatRelativeTime(account.last_used_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleToggleBlock(account)}
                    disabled={actionLoading === account.id}
                    className={`p-1.5 rounded ${
                      account.is_blocked
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-orange-600 hover:bg-orange-50'
                    }`}
                    title={account.is_blocked ? 'Unblock' : 'Block'}
                  >
                    {actionLoading === account.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : account.is_blocked ? (
                      <CheckCircle size={16} />
                    ) : (
                      <Ban size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    disabled={actionLoading === account.id}
                    className="p-1.5 rounded text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    {actionLoading === account.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
