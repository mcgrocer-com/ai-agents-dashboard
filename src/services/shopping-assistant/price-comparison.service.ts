/**
 * Price Comparison Service
 * Calls the price-comparison edge function to find UK product prices
 */

import { supabase } from '@/lib/supabase/client';
import type { ServiceResponse } from '@/types/shopping-assistant';

/**
 * Product result from price comparison
 */
export interface PriceComparisonProduct {
  product_name: string;
  price: number;
  currency: string;
  source_url: string;
  vendor: string;
  confidence: number;
}

/**
 * Metadata from price comparison response
 */
export interface PriceComparisonMetadata {
  query: string;
  limit: number;
  results_count: number;
  execution_time: number;
  model: string;
  iterations: number;
  timestamp: string;
}

/**
 * Full response from price comparison
 */
export interface PriceComparisonResponse {
  products: PriceComparisonProduct[];
  metadata: PriceComparisonMetadata;
}

/**
 * Search for product prices across UK retailers
 * @param query - Product search query
 * @param limit - Maximum results to return (default: 5)
 */
export async function searchPrices(
  query: string,
  limit: number = 5
): Promise<ServiceResponse<PriceComparisonResponse>> {
  try {
    const { data, error } = await supabase.functions.invoke('price-comparison', {
      body: { query, limit },
    });

    if (error) {
      console.error('Price comparison error:', error);
      return { data: null, error: error.message, success: false };
    }

    if (!data.success) {
      return { data: null, error: data.error || 'Search failed', success: false };
    }

    return {
      data: {
        products: data.products || [],
        metadata: data.metadata,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error in price comparison:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}
