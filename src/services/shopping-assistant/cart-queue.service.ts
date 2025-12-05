/**
 * Shopping Assistant Cart Queue Service
 * Handles cart queue operations and status tracking
 */

import { supabase } from '@/lib/supabase/client';
import type {
  CartQueue,
  CartQueueWithDetails,
  CreateCartQueueInput,
  CartQueueStats,
  ServiceResponse,
  CartQueueFilters,
  PaginatedResponse,
  PaginationParams,
} from '@/types/shopping-assistant';

/**
 * Add item to cart queue
 */
export async function addToCart(
  input: CreateCartQueueInput
): Promise<ServiceResponse<CartQueue>> {
  try {
    const { data, error } = await supabase
      .from('cart_queue')
      .insert([
        {
          user_id: input.user_id,
          vendor_id: input.vendor_id,
          product_url: input.product_url,
          product_name: input.product_name || null,
          product_data: input.product_data || null,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding to cart queue:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error adding to cart:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get queue item by ID
 */
export async function getQueueItemById(
  id: string
): Promise<ServiceResponse<CartQueueWithDetails>> {
  try {
    const { data, error } = await supabase
      .from('cart_queue')
      .select(
        `
        *,
        vendors!inner(name, domain),
        vendor_accounts(email)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching queue item:', error);
      return { data: null, error: error.message, success: false };
    }

    const item: CartQueueWithDetails = {
      ...data,
      vendor_name: data.vendors.name,
      vendor_domain: data.vendors.domain,
      account_email: data.vendor_accounts?.email || null,
    };

    return { data: item, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error fetching queue item:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get all queue items for a user
 */
export async function getUserCartQueue(
  userId: string,
  filters?: CartQueueFilters,
  pagination?: PaginationParams
): Promise<ServiceResponse<PaginatedResponse<CartQueueWithDetails>>> {
  try {
    let query = supabase
      .from('cart_queue')
      .select(
        `
        *,
        vendors!inner(name, domain),
        vendor_accounts(email)
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vendor_id) {
      query = query.eq('vendor_id', filters.vendor_id);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Apply pagination
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching user cart queue:', error);
      return { data: null, error: error.message, success: false };
    }

    const items: CartQueueWithDetails[] = (data || []).map((item) => ({
      ...item,
      vendor_name: item.vendors.name,
      vendor_domain: item.vendors.domain,
      account_email: item.vendor_accounts?.email || null,
    }));

    return {
      data: {
        items,
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching user cart queue:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get all queue items (admin view - no user filter)
 */
export async function getAllCartQueue(
  filters?: CartQueueFilters,
  pagination?: PaginationParams
): Promise<ServiceResponse<PaginatedResponse<CartQueueWithDetails>>> {
  try {
    let query = supabase
      .from('cart_queue')
      .select(
        `
        *,
        vendors!inner(name, domain),
        vendor_accounts(email)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vendor_id) {
      query = query.eq('vendor_id', filters.vendor_id);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Apply pagination
    const limit = pagination?.limit || 50;
    const offset = pagination?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching all cart queue:', error);
      return { data: null, error: error.message, success: false };
    }

    const items: CartQueueWithDetails[] = (data || []).map((item) => ({
      ...item,
      vendor_name: item.vendors.name,
      vendor_domain: item.vendors.domain,
      account_email: item.vendor_accounts?.email || null,
    }));

    return {
      data: {
        items,
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit,
        offset,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching all cart queue:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<
  ServiceResponse<CartQueueStats>
> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get counts
    const [pending, processing, completedToday, failedToday, manualRequired] =
      await Promise.all([
        supabase
          .from('cart_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('cart_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'processing'),
        supabase
          .from('cart_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('completed_at', today.toISOString()),
        supabase
          .from('cart_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('updated_at', today.toISOString()),
        supabase
          .from('cart_queue')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'manual_required'),
      ]);

    // Calculate average completion time
    const { data: completedItems } = await supabase
      .from('cart_queue')
      .select('created_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString())
      .not('completed_at', 'is', null);

    let avgCompletionTime = 0;
    if (completedItems && completedItems.length > 0) {
      const totalSeconds = completedItems.reduce((sum, item) => {
        const created = new Date(item.created_at).getTime();
        const completed = new Date(item.completed_at!).getTime();
        return sum + (completed - created) / 1000;
      }, 0);
      avgCompletionTime = Math.round(totalSeconds / completedItems.length);
    }

    return {
      data: {
        pending: pending.count || 0,
        processing: processing.count || 0,
        completed_today: completedToday.count || 0,
        failed_today: failedToday.count || 0,
        manual_required: manualRequired.count || 0,
        average_completion_time_seconds: avgCompletionTime,
      },
      error: null,
      success: true,
    };
  } catch (error) {
    console.error('Unexpected error fetching queue stats:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Retry a failed queue item
 */
export async function retryQueueItem(
  id: string
): Promise<ServiceResponse<CartQueue>> {
  try {
    const { data, error } = await supabase
      .from('cart_queue')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error retrying queue item:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error retrying queue item:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Cancel a pending queue item
 */
export async function cancelQueueItem(
  id: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase.from('cart_queue').delete().eq('id', id);

    if (error) {
      console.error('Error canceling queue item:', error);
      return { data: null, error: error.message, success: false };
    }

    return { data: null, error: null, success: true };
  } catch (error) {
    console.error('Unexpected error canceling queue item:', error);
    return {
      data: null,
      error: (error as Error).message,
      success: false,
    };
  }
}

/**
 * Subscribe to queue item status changes
 */
export function subscribeToQueueItem(
  id: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`queue-item-${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'cart_queue',
        filter: `id=eq.${id}`,
      },
      callback
    )
    .subscribe();
}
