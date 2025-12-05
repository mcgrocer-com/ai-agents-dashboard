/**
 * Vendor Card Component
 * Displays vendor summary with account health indicators
 */

import React from 'react';
import type { VendorWithStats } from '@/types/shopping-assistant';
import { Link } from 'react-router-dom';

interface VendorCardProps {
  vendor: VendorWithStats;
}

export const VendorCard: React.FC<VendorCardProps> = ({ vendor }) => {
  const getHealthStatus = () => {
    if (vendor.blocked_accounts === vendor.account_count) {
      return { color: 'red', icon: '🔴', label: 'All Blocked' };
    }
    if (vendor.blocked_accounts > 0) {
      return { color: 'yellow', icon: '🟡', label: 'Partially Blocked' };
    }
    if (vendor.healthy_accounts === 0) {
      return { color: 'gray', icon: '⚪', label: 'No Accounts' };
    }
    return { color: 'green', icon: '🟢', label: 'Healthy' };
  };

  const healthStatus = getHealthStatus();

  return (
    <Link
      to={`/shopping-assistant/vendors/${vendor.id}`}
      className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{healthStatus.icon}</span>
            <h3 className="text-lg font-semibold text-gray-900">
              {vendor.name}
            </h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">{vendor.domain}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Accounts</p>
          <p className="font-semibold text-gray-900">
            {vendor.account_count} total
          </p>
        </div>
        <div>
          <p className="text-gray-500">Status</p>
          <p className="font-semibold text-gray-900">{healthStatus.label}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span className={vendor.can_automate ? 'text-green-600' : 'text-red-600'}>
          {vendor.can_automate ? '✓ Auto' : '✗ Manual'}
        </span>
        <span className={vendor.requires_captcha ? 'text-orange-600' : ''}>
          {vendor.requires_captcha ? '⚠ Captcha' : ''}
        </span>
        <span className={vendor.is_prioritized ? 'text-blue-600' : ''}>
          {vendor.is_prioritized ? '⭐ Priority' : ''}
        </span>
      </div>
    </Link>
  );
};
