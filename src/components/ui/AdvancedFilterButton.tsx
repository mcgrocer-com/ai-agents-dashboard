'use client';

import { Filter } from 'lucide-react';

interface AdvancedFilterButtonProps {
  hasAdvancedFilters: boolean;
}

export function AdvancedFilterButton({ hasAdvancedFilters }: AdvancedFilterButtonProps) {
  return (
    <button
      className={`px-3 py-2 border rounded-lg flex items-center gap-2 text-sm ${
        hasAdvancedFilters
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Filter className="h-4 w-4" />
      <span>Filters</span>
    </button>
  );
}
