/**
 * Shopping Assistant Add-to-Cart Automation System Types
 */

// ==========================================
// Vendor Types
// ==========================================

export type Vendor = {
  id: string;
  name: string;
  domain: string;
  is_prioritized: boolean;
  requires_captcha: boolean;
  can_automate: boolean;
  login_url: string | null;
  cart_url: string | null;
  selectors: VendorSelectors | null;
  rate_limit_daily: number;
  created_at: string;
}

export type VendorSelectors = {
  email_input?: string;
  password_input?: string;
  login_button?: string;
  add_to_cart?: string;
  cart_confirmation?: string;
  blocked_indicator?: string;
}

export type VendorWithStats = Vendor & {
  account_count: number;
  healthy_accounts: number;
  blocked_accounts: number;
}

// ==========================================
// Vendor Account Types
// ==========================================

export type VendorAccount = {
  id: string;
  vendor_id: string;
  email: string;
  password: string;
  is_blocked: boolean;
  blocked_at: string | null;
  last_used_at: string | null;
  session_data: Record<string, any> | null;
  daily_items_added: number;
  total_items_added: number;
  created_at: string;
}

export type VendorAccountWithVendor = VendorAccount & {
  vendor_name: string;
  vendor_domain: string;
}

export type CreateVendorAccountInput = {
  vendor_id: string;
  email: string;
  password: string;
}

export type UpdateVendorAccountInput = {
  email?: string;
  password?: string;
  is_blocked?: boolean;
}

// ==========================================
// Cart Queue Types
// ==========================================

export type CartQueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'manual_required';

export type CartQueue = {
  id: string;
  user_id: string;
  vendor_id: string;
  product_url: string;
  product_name: string | null;
  product_data: Record<string, any> | null;
  status: CartQueueStatus;
  assigned_account_id: string | null;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type CartQueueWithDetails = CartQueue & {
  vendor_name: string;
  vendor_domain: string;
  account_email: string | null;
}

export type CreateCartQueueInput = {
  user_id: string;
  vendor_id: string;
  product_url: string;
  product_name?: string;
  product_data?: Record<string, any>;
}

export type CartQueueStats = {
  pending: number;
  processing: number;
  completed_today: number;
  failed_today: number;
  manual_required: number;
  average_completion_time_seconds: number;
}

// ==========================================
// User Cart Items Types
// ==========================================

export type UserCartItem = {
  id: string;
  user_id: string;
  vendor_account_id: string;
  product_url: string;
  product_name: string | null;
  quantity: number;
  added_at: string;
}

export type UserCartItemWithDetails = UserCartItem & {
  vendor_name: string;
  vendor_domain: string;
  account_email: string;
}

// ==========================================
// Account Migration Types
// ==========================================

export type AccountMigration = {
  id: string;
  old_account_id: string;
  new_account_id: string;
  migrated_items: MigratedItem[];
  migrated_at: string;
}

export type MigratedItem = {
  product_url: string;
  product_name: string | null;
  quantity: number;
}

export type CreateMigrationInput = {
  old_account_id: string;
  new_account_id: string;
}

// ==========================================
// API Response Types
// ==========================================

export type AddToCartResponse = {
  success: boolean;
  queue_id: string;
  status: CartQueueStatus;
  message: string;
  estimated_completion?: string;
}

export type TestAccountResponse = {
  success: boolean;
  message: string;
  session_valid: boolean;
}

export type MigrateAccountResponse = {
  success: boolean;
  migrated_items: number;
  migration_id: string;
}

// ==========================================
// Service Response Wrapper
// ==========================================

export type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
  success: boolean;
}

// ==========================================
// Filter and Pagination Types
// ==========================================

export type CartQueueFilters = {
  status?: CartQueueStatus;
  vendor_id?: string;
  date_from?: string;
  date_to?: string;
}

export type VendorAccountFilters = {
  vendor_id?: string;
  is_blocked?: boolean;
}

export type PaginationParams = {
  page?: number;
  limit?: number;
  offset?: number;
}

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}
