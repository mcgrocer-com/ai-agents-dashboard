/**
 * Shopping Assistant Navigation
 * Sub-navigation for switching between Queue Monitor and Credentials
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutList, Key, Search } from 'lucide-react';

export const ShoppingAssistantNav: React.FC = () => {
  const location = useLocation();

  const tabs = [
    {
      name: 'Queue Monitor',
      path: '/shopping-assistant',
      icon: LayoutList,
    },
    {
      name: 'Price Comparison',
      path: '/shopping-assistant/prices',
      icon: Search,
    },
    {
      name: 'Credentials',
      path: '/shopping-assistant/credentials',
      icon: Key,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/shopping-assistant') {
      return location.pathname === '/shopping-assistant' ||
             location.pathname === '/shopping-assistant/queue';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={18} />
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
