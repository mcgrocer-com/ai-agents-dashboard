/**
 * Queue Monitor Page
 * Real-time monitoring of cart queue operations
 */

import React, { useState, useEffect } from 'react';
import { StatusBadge } from '@/components/shopping-assistant/StatusBadge';
import { ShoppingAssistantNav } from '@/components/shopping-assistant/ShoppingAssistantNav';
import {
  getQueueStats,
  getAllCartQueue,
} from '@/services/shopping-assistant';
import type {
  CartQueueStats,
  CartQueueWithDetails,
  CartQueueStatus,
} from '@/types/shopping-assistant';
import { Loader2, RefreshCw } from 'lucide-react';

export const QueueMonitorPage: React.FC = () => {
  const [stats, setStats] = useState<CartQueueStats | null>(null);
  const [queueItems, setQueueItems] = useState<CartQueueWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] =
    useState<CartQueueStatus | 'all'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, selectedStatus]);

  const loadData = async () => {
    setError(null);

    // Load stats
    const statsResult = await getQueueStats();
    if (statsResult.success && statsResult.data) {
      setStats(statsResult.data);
    }

    // Load all queue items (admin view - no user filter)
    const filters = selectedStatus !== 'all' ? { status: selectedStatus } : {};
    const queueResult = await getAllCartQueue(filters, { limit: 50 });

    if (queueResult.success && queueResult.data) {
      setQueueItems(queueResult.data.items);
    } else {
      setError(queueResult.error || 'Failed to load queue items');
    }

    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation */}
      <ShoppingAssistantNav />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Queue Monitor</h1>
            <p className="text-gray-600 mt-2">
              Real-time cart queue processing status
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium">Processing</p>
            <p className="text-2xl font-bold text-blue-900">
              {stats.processing}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-800 font-medium">Completed</p>
            <p className="text-2xl font-bold text-green-900">
              {stats.completed_today}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">Failed</p>
            <p className="text-2xl font-bold text-red-900">
              {stats.failed_today}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-800 font-medium">Manual</p>
            <p className="text-2xl font-bold text-purple-900">
              {stats.manual_required}
            </p>
            <p className="text-xs text-purple-700 mt-1">
              Avg: {formatTime(stats.average_completion_time_seconds)}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'processing', label: 'Processing' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'manual_required', label: 'Manual' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value as CartQueueStatus | 'all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedStatus === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
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

      {/* Queue Items Table */}
      {!loading && queueItems.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {queueItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {item.product_name || 'Unknown Product'}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">
                      {item.product_url}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.vendor_name}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && queueItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No queue items found</p>
        </div>
      )}
    </div>
  );
};
