/**
 * Shopping Assistant Accounts Service
 * Handles vendor account management and selection
 */

import { supabase } from '@/lib/supabase/client';
import type {
  VendorAccount,
  VendorAccountWithVendor,
  CreateVendorAccountInput,
  UpdateVendorAccountInput,
  ServiceResponse,
  VendorAccountFilters,
  PaginatedResponse,
  PaginationParams,
} from '@/types/shopping-assistant';

/**
 * Get all accounts with optional filters
 */
export async function getAllAccounts(
  filters?: VendorAccountFilters,
  pagination?: PaginationParams
): Promise<ServiceResponse<PaginatedResponse<VendorAccountWithVendor>>> {
  try {
    let query = supabase
      .from('vendor_accounts')
      .select(
        `
        *,
        vendors!inner(name, domain)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.vendor_id) {
      query = query.eq('vendor_id', filters.vendor_id);
    }
    if (filters?.is_blocked !== undefined) {
      query = query.eq('is_blocked', filters.is_blocked);
    }

    // Apply pagination
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching accounts:', error);
      return { data: null, error: error.message, success: false };
    }

    const accounts: VendorAccountWithVendor[] = (data || []).map((item) => ({
      ...item,
      vendor_name: item.vendors.name,
      vendor_domain: item.vendors.domain,
    }));

    return {
      data: {
        items: accounts,
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching accounts:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get account by ID
 */
export async function getAccountById(
  id: string
): Promise<ServiceResponse<VendorAccountWithVendor>> {
  try {
    const { data, error } = await supabase
      .from('vendor_accounts')
      .select(
        `
        *,
        vendors!inner(name, domain)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching account:', error);
      return { data: null, error: error.message, success: false };
    }

    const account: VendorAccountWithVendor = {
      ...data,
      vendor_name: data.vendors.name,
      vendor_domain: data.vendors.domain,
    };

    return { data: account, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching account:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Create a new vendor account
 */
export async function createAccount(
  input: CreateVendorAccountInput
): Promise<ServiceResponse<VendorAccount>> {
  try {
    const { data, error } = await supabase
      .from('vendor_accounts')
      .insert([
        {
          vendor_id: input.vendor_id,
          email: input.email,
          password: input.password,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating account:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error creating account:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Update an existing account
 */
export async function updateAccount(
  id: string,
  updates: UpdateVendorAccountInput
): Promise<ServiceResponse<VendorAccount>> {
  try {
    const { data, error } = await supabase
      .from('vendor_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating account:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error updating account:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Delete an account
 */
export async function deleteAccount(
  id: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('vendor_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting account:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error deleting account:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get available accounts for a vendor (not blocked, under rate limit)
 */
export async function getAvailableAccounts(
  vendorId: string
): Promise<ServiceResponse<VendorAccount[]>> {
  try {
    // Get vendor rate limit
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('rate_limit_daily')
      .eq('id', vendorId)
      .single();

    if (vendorError) {
      return { data: null, error: vendorError.message, success: false };
    }

    const { data, error } = await supabase
      .from('vendor_accounts')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_blocked', false)
      .lt('daily_items_added', vendor.rate_limit_daily)
      .order('last_used_at', { ascending: true, nullsFirst: true });

    if (error) {
      console.error('Error fetching available accounts:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data: data || [], error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching available accounts:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}
