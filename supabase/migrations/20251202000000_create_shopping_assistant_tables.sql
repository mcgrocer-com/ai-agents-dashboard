-- Shopping Assistant Add-to-Cart Automation System
-- Migration: Create vendors, vendor_accounts, cart_queue, user_cart_items, and account_migrations tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Vendors Table
-- ==========================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  is_prioritized BOOLEAN DEFAULT false,
  requires_captcha BOOLEAN DEFAULT false,
  can_automate BOOLEAN DEFAULT true,
  login_url VARCHAR(500),
  cart_url VARCHAR(500),
  selectors JSONB,
  rate_limit_daily INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- Vendor Accounts Table
-- ==========================================
CREATE TABLE vendor_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  is_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  session_data JSONB,
  daily_items_added INTEGER DEFAULT 0,
  total_items_added INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(vendor_id, email)
);

-- ==========================================
-- Cart Queue Table
-- ==========================================
CREATE TABLE cart_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  product_url VARCHAR(1000) NOT NULL,
  product_name VARCHAR(500),
  product_data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_account_id UUID REFERENCES vendor_accounts(id),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ==========================================
-- User Cart Items Table
-- ==========================================
CREATE TABLE user_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  vendor_account_id UUID REFERENCES vendor_accounts(id),
  product_url VARCHAR(1000) NOT NULL,
  product_name VARCHAR(500),
  quantity INTEGER DEFAULT 1,
  added_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- Account Migrations Table
-- ==========================================
CREATE TABLE account_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_account_id UUID REFERENCES vendor_accounts(id),
  new_account_id UUID REFERENCES vendor_accounts(id),
  migrated_items JSONB NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- Indexes for Performance
-- ==========================================
CREATE INDEX idx_cart_queue_status ON cart_queue(status);
CREATE INDEX idx_cart_queue_user ON cart_queue(user_id);
CREATE INDEX idx_cart_queue_vendor ON cart_queue(vendor_id);
CREATE INDEX idx_vendor_accounts_vendor ON vendor_accounts(vendor_id);
CREATE INDEX idx_vendor_accounts_blocked ON vendor_accounts(is_blocked);
CREATE INDEX idx_user_cart_items_user ON user_cart_items(user_id);

-- ==========================================
-- Helper Functions
-- ==========================================

-- Function to increment account usage
CREATE OR REPLACE FUNCTION increment_account_usage(account_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE vendor_accounts
  SET
    daily_items_added = daily_items_added + 1,
    total_items_added = total_items_added + 1,
    last_used_at = NOW()
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily limits (run via cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS void AS $$
BEGIN
  UPDATE vendor_accounts SET daily_items_added = 0;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- RLS Policies
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_migrations ENABLE ROW LEVEL SECURITY;

-- Vendors: Public read, admin write
CREATE POLICY "Vendors are viewable by all users"
  ON vendors FOR SELECT
  USING (true);

CREATE POLICY "Vendors are manageable by admins only"
  ON vendors FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Vendor Accounts: Admin only
CREATE POLICY "Vendor accounts are viewable by admins only"
  ON vendor_accounts FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Vendor accounts are manageable by admins only"
  ON vendor_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Cart Queue: Users can see their own items
CREATE POLICY "Users can view their own cart queue items"
  ON cart_queue FOR SELECT
  USING (user_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can insert their own cart queue items"
  ON cart_queue FOR INSERT
  WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can manage all cart queue items"
  ON cart_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- User Cart Items: Users can see their own items
CREATE POLICY "Users can view their own cart items"
  ON user_cart_items FOR SELECT
  USING (user_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage all user cart items"
  ON user_cart_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- Account Migrations: Admin only
CREATE POLICY "Account migrations are viewable by admins only"
  ON account_migrations FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Account migrations are manageable by admins only"
  ON account_migrations FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- Comments for Documentation
-- ==========================================
COMMENT ON TABLE vendors IS 'Registry of supported vendor websites for cart automation';
COMMENT ON TABLE vendor_accounts IS 'Vendor account credentials with encryption and usage tracking';
COMMENT ON TABLE cart_queue IS 'Queue of pending add-to-cart operations with retry logic';
COMMENT ON TABLE user_cart_items IS 'Successfully added cart items for tracking';
COMMENT ON TABLE account_migrations IS 'Historical data for account migrations when accounts are blocked';
