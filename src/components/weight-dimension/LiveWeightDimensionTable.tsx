'use client';

import { useRealtime } from '@/hooks/useRealtime';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import WeightDimensionTable from './WeightDimensionTable';
import { useState, useEffect } from 'react';

interface LiveWeightDimensionTableProps {
  initialProducts: any[];
}

/**
 * Live Weight & Dimension Table
 *
 * Wraps WeightDimensionTable with real-time subscription.
 * Updates automatically when weight and dimension estimation results change.
 */
export function LiveWeightDimensionTable({ initialProducts }: LiveWeightDimensionTableProps) {
  const [products, setProducts] = useState(initialProducts);
  const [connected, setConnected] = useState(false);

  useRealtime<any>({
    tableName: 'weight_dimension_agent_products',
    onInsert: (newProduct) => {
      setProducts((prevProducts) => [newProduct, ...prevProducts]);
    },
    onUpdate: (updatedProduct) => {
      setProducts((prevProducts) =>
        prevProducts.map((p) =>
          p.id === updatedProduct.id ? updatedProduct : p
        )
      );
    },
  });

  useEffect(() => {
    // This is a mock connection status
    setConnected(true);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <LiveIndicator connected={connected} />
          <span className="text-sm text-gray-600">
            {products.length} products
            {connected && ' (live updates)'}
          </span>
        </div>
      </div>
      <WeightDimensionTable products={products} />
    </div>
  );
}
