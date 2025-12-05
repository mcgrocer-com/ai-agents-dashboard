/**
 * Shopping Assistant Vendors Service
 * Handles CRUD operations for vendor management
 */

import { supabase } from '@/lib/supabase/client';
import type {
  Vendor,
  VendorWithStats,
  ServiceResponse,
} from '@/types/shopping-assistant';

/**
 * Get all vendors with account statistics
 */
export async function getAllVendors(): Promise<
  ServiceResponse<VendorWithStats[]>
> {
  try {
    // Get vendors
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('*')
      .order('name');

    if (vendorsError) {
      console.error('Error fetching vendors:', vendorsError);
      return { data: null, error: vendorsError.message, success: false };
    }

    // Get account stats for each vendor
    const vendorsWithStats = await Promise.all(
      (vendors || []).map(async (vendor) => {
        const { data: accounts } = await supabase
          .from('vendor_accounts')
          .select('id, is_blocked')
          .eq('vendor_id', vendor.id);

        const account_count = accounts?.length || 0;
        const blocked_accounts =
          accounts?.filter((a) => a.is_blocked).length || 0;
        const healthy_accounts = account_count - blocked_accounts;

        return {
          ...vendor,
          account_count,
          healthy_accounts,
          blocked_accounts,
        };
      })
    );

    return {
      data: vendorsWithStats,
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching vendors:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get a single vendor by ID
 */
export async function getVendorById(
  id: string
): Promise<ServiceResponse<Vendor>> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching vendor:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching vendor:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Create a new vendor
 */
export async function createVendor(
  vendor: Omit<Vendor, 'id' | 'created_at'>
): Promise<ServiceResponse<Vendor>> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .insert([vendor])
      .select()
      .single();

    if (error) {
      console.error('Error creating vendor:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error creating vendor:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Update an existing vendor
 */
export async function updateVendor(
  id: string,
  updates: Partial<Omit<Vendor, 'id' | 'created_at'>>
): Promise<ServiceResponse<Vendor>> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating vendor:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error updating vendor:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Delete a vendor (cascades to accounts)
 */
export async function deleteVendor(
  id: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.from('vendors').delete().eq('id', id);

    if (error) {
      console.error('Error deleting vendor:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting vendor:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

export interface ScrapedVendorOption {
  name: string;
  product_count: number;
  already_added: boolean;
}

/**
 * Get available vendors from scraped_products with product counts
 * Uses RPC function for efficient server-side aggregation
 */
export async function getScrapedVendors(): Promise<
  ServiceResponse<ScrapedVendorOption[]>
> {
  try {
    // Use RPC for efficient server-side counting (same as ScraperAgentPage)
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_distinct_vendors'
    );

    if (rpcError) {
      console.error('Error fetching vendors via RPC:', rpcError);
      return { data: null, error: rpcError.message, success: false };
    }

    // Get existing shopping assistant vendors
    const { data: existingVendors } = await supabase
      .from('vendors')
      .select('name');

    const existingNames = new Set(
      (existingVendors || []).map((v) => v.name.toLowerCase())
    );

    // Transform RPC result: {vendor: string, product_count: number}[]
    const vendors: ScrapedVendorOption[] = (rpcData || [])
      .filter((item: { vendor: string }) => item.vendor)
      .map((item: { vendor: string; product_count: number }) => ({
        name: item.vendor,
        product_count: item.product_count || 0,
        already_added: existingNames.has(item.vendor.toLowerCase()),
      }))
      .sort(
        (a: ScrapedVendorOption, b: ScrapedVendorOption) =>
          b.product_count - a.product_count
      );

    return { data: vendors, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching scraped vendors:', error);
    return { data: null, error: (error as Error).message, success: false };
  }
}
