/**
 * Status Badge Component
 * Displays colored status indicators for various states
 */

import React from 'react';
import type { CartQueueStatus } from '@/types/shopping-assistant';

interface StatusBadgeProps {
  status: CartQueueStatus | 'active' | 'blocked';
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
    icon: '⏳',
  },
  processing: {
    label: 'Processing',
    className: 'bg-blue-100 text-blue-800',
    icon: '🔄',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800',
    icon: '✅',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
    icon: '❌',
  },
  manual_required: {
    label: 'Manual Required',
    className: 'bg-purple-100 text-purple-800',
    icon: '👋',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800',
    icon: '🟢',
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-100 text-red-800',
    icon: '🔴',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};
