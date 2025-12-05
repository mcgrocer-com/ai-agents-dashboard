# Product Requirements Document

## Shopping Assistant - Add to Cart Automation System

**Version 1.0**

December 2025

| Field | Value |
|-------|-------|
| **Document Owner** | [Your Name / Team] |
| **Status** | Draft |
| **Last Updated** | December 2, 2025 |
| **Stakeholders** | Engineering, Product, Operations |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Goals & Objectives](#3-goals--objectives)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [Database Schema](#7-database-schema)
8. [API Specifications](#8-api-specifications)
9. [UI/UX Requirements (Credentials Dashboard)](#9-uiux-requirements-credentials-dashboard)
10. [Security Considerations](#10-security-considerations)
11. [Success Metrics](#11-success-metrics)
12. [Implementation Timeline](#12-implementation-timeline)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

The Shopping Assistant Add-to-Cart Automation System is a comprehensive solution designed to automate the process of adding products to shopping carts across multiple UK vendor websites. Building upon the existing product discovery functionality, this system introduces automated cart management with intelligent account rotation, captcha handling, and resilient retry mechanisms.

The system leverages Stagehand running on Runpod infrastructure for browser automation, Supabase for data persistence and real-time updates, and integrates with the existing React frontend. Key differentiators include intelligent handling of blocked accounts, automatic migration of cart items between accounts, and a hybrid approach supporting both automated and manual processing workflows.

### 1.1 Key Capabilities

- Automated login and add-to-cart operations for supported vendors
- Intelligent account selection and rotation to avoid rate limits
- Automatic detection of blocked accounts with seamless migration
- Queue-based processing with retry logic and failure handling
- Manual fallback workflow for vendors with captcha or complex authentication
- Real-time status updates and comprehensive tracking dashboard

---

## 2. Product Overview

### 2.1 Problem Statement

ERPNext needs to automate adding discovered products from multiple UK vendors to shopping carts as part of the procurement workflow. Currently, this process requires manual intervention where staff must visit each vendor website, log in, and add items to carts. This is time-consuming, error-prone, and creates bottlenecks in the procurement pipeline.

### 2.2 Proposed Solution

An automated add-to-cart system that manages a shared pool of vendor accounts for internal ERPNext use. The system handles authentication, programmatically adds products to carts, and intelligently rotates through available accounts to avoid rate limits and blocks. This is an **internal automation tool** - not a multi-tenant SaaS - designed specifically for ERPNext integration.

### 2.3 System Components

| Component | Description |
|-----------|-------------|
| **React Admin Dashboard** | Admin-only UI for managing vendor accounts and monitoring queue (no end-user interface) |
| **Supabase Backend** | Database for vendors, accounts, queue, and cart tracking with real-time subscriptions |
| **Queue Processor** | Worker service that processes cart queue items and dispatches to automation |
| **Stagehand on Runpod** | Browser automation infrastructure for executing login and add-to-cart actions |
| **API Layer** | RESTful endpoints for ERPNext integration, admin account management, and status queries |

---

## 3. Goals & Objectives

### 3.1 Primary Goals

1. Automate the add-to-cart process for 80% of prioritized UK vendors within 6 months
2. Reduce average time-to-cart from 5+ minutes (manual) to under 30 seconds (automated)
3. Achieve 95% success rate for automated cart additions on supported vendors
4. Provide seamless fallback to manual processing for unsupported scenarios

### 3.2 Secondary Objectives

1. Build a scalable account management system supporting 100+ vendor accounts
2. Implement intelligent rate limiting to minimize account blocks
3. Create comprehensive audit trails for compliance and debugging
4. Enable real-time visibility into cart operation status for end users

### 3.3 Out of Scope (v1.0)

- Automated checkout and payment processing
- Price comparison and optimization features
- Automated captcha solving (vendors with captcha will use manual workflow)
- Mobile app native implementation
- Multi-region support (UK vendors only in v1.0)

---

## 4. User Stories

### 4.1 ERPNext Integration Stories

**US-001: ERPNext Add to Cart**

> As ERPNext, I want to call an API endpoint to add a product to a vendor cart so that the procurement workflow is automated without manual intervention.

**Acceptance Criteria:**
- API returns immediate acknowledgment with queue ID
- System processes request within 60 seconds
- Failed items are flagged with clear error messages for retry

**US-002: Monitor Queue Status**

> As an operations admin, I want to view the status of all pending cart additions across all vendors so that I can monitor automation health and intervene when needed.

### 4.2 Admin/Operations Stories

**US-004: Manage Vendor Accounts**

> As an administrator, I want to add, edit, and manage vendor account credentials so that the system has valid accounts for automation.

**US-005: Monitor Account Health**

> As an administrator, I want to view account status including block state, usage metrics, and last activity so that I can proactively manage account health.

**US-006: Configure Vendor Settings**

> As an administrator, I want to configure vendor-specific settings like selectors, rate limits, and automation capability flags so that the system handles each vendor appropriately.

**US-007: Handle Blocked Accounts**

> As an administrator, I want to be alerted when accounts are blocked and have tools to migrate cart data to new accounts so that users are not impacted.

---

## 5. Functional Requirements

### 5.1 Vendor Management

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-V01 | Vendor Registry | System shall maintain a registry of supported vendors with metadata including name, domain, login URL, and automation capability flags |
| FR-V02 | Vendor Selectors | System shall store CSS/XPath selectors for each vendor to locate login fields, cart buttons, and confirmation elements |
| FR-V03 | Captcha Flag | System shall flag vendors that require captcha, automatically routing to manual workflow |
| FR-V04 | Priority Ranking | System shall support vendor prioritization to prefer certain vendors in product search results |

### 5.2 Account Management

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-A01 | Account Storage | System shall store vendor account credentials in shared pool for rotation |
| FR-A02 | Account Selection | System shall select available accounts based on usage limits, block status, and last activity time |
| FR-A03 | Usage Tracking | System shall track daily and total item counts per account to enforce rate limits |
| FR-A04 | Block Detection | System shall automatically detect and flag blocked accounts based on page content analysis |
| FR-A05 | Session Persistence | System shall store and reuse session cookies to minimize login frequency |
| FR-A06 | Account Migration | System shall migrate cart tracking data from blocked accounts to replacement accounts |

### 5.3 Queue Processing

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-Q01 | Queue Management | System shall maintain a queue of pending cart operations with status tracking |
| FR-Q02 | Retry Logic | System shall retry failed operations up to 3 times with exponential backoff |
| FR-Q03 | Status Updates | System shall provide real-time status updates via Supabase subscriptions |
| FR-Q04 | Manual Routing | System shall automatically route items to manual queue when automation is not possible |
| FR-Q05 | Priority Processing | System shall process queue items in FIFO order with optional priority override |

### 5.4 Automation Engine

| ID | Requirement | Description |
|----|-------------|-------------|
| FR-E01 | Login Automation | System shall automate vendor login using stored credentials and Stagehand |
| FR-E02 | Add to Cart | System shall navigate to product pages and execute add-to-cart actions |
| FR-E03 | Captcha Detection | System shall detect captcha presence and abort automation, flagging for manual handling |
| FR-E04 | Block Detection | System shall detect account blocks based on page content patterns |
| FR-E05 | Cart Verification | System shall verify successful cart addition before marking operation complete |

---

## 6. Technical Architecture

### 6.1 System Architecture Overview

The system follows a queue-based architecture with clear separation between the API layer, queue processor, and automation engine. This design enables horizontal scaling, fault tolerance, and clear audit trails.

#### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   React Frontend (Existing)                     │
│  - Product Discovery (Implemented)                              │
│  - Add to Cart UI (New)                                         │
│  - Credentials Dashboard (New)                                  │
│  - Cart Status Tracking (New)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js/Express)                  │
│  POST /api/cart/add          - Queue item for cart addition     │
│  GET  /api/cart/status/:id   - Get queue item status            │
│  GET  /api/cart/user/:userId - Get all user cart items          │
│  POST /api/vendors           - Manage vendors (Admin)           │
│  POST /api/accounts          - Manage accounts (Admin)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                      │
│  - vendors, vendor_accounts, cart_queue                         │
│  - user_cart_items, account_migrations                          │
│  - Real-time subscriptions for status updates                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Queue Processor (Worker)                     │
│  - Polls cart_queue every 30 seconds                            │
│  - Assigns accounts, dispatches to Stagehand                    │
│  - Handles responses, updates status                            │
│  - Triggers account migration on blocks                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Stagehand on Runpod                          │
│  - Serverless browser automation                                │
│  - Executes login + add-to-cart flows                           │
│  - Returns success/failure/blocked status                       │
│  - Session cookie management                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | React (Existing) | Existing admin dashboard codebase, team familiarity |
| Database | Supabase (PostgreSQL) | Existing setup, real-time subscriptions, RLS |
| API | Next.js API Routes / Express | TypeScript support, serverless compatible |
| Queue | Supabase + Cron Worker | Simplicity, no additional infrastructure |
| Automation | Stagehand on Runpod | AI-powered actions, cost-effective GPU infra |

### 6.3 Add to Cart Flow Sequence

The following sequence describes the complete flow from ERPNext request to cart confirmation:

1. ERPNext calls POST /api/cart/add with product details and constant user_id='system'
2. API checks vendor automation capability and creates queue entry
3. API returns queue ID to ERPNext immediately
4. Queue processor picks up pending item on next poll cycle
5. Processor selects available account from shared pool based on usage/block status
6. Processor dispatches automation task to Stagehand on Runpod
7. Stagehand executes login (if needed) and add-to-cart
8. Stagehand returns result with success/failure/blocked status
9. Processor updates queue status in Supabase
10. Admin dashboard receives real-time update via Supabase subscription
11. ERPNext can query queue status or receive webhook notification

---

## 7. Database Schema

### 7.1 Entity Relationship Diagram

```
┌─────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│    vendors      │      │   vendor_accounts   │      │   cart_queue     │
├─────────────────┤      ├─────────────────────┤      ├──────────────────┤
│ id (PK)         │──┐   │ id (PK)             │   ┌──│ id (PK)          │
│ name            │  │   │ vendor_id (FK)      │───┘  │ user_id          │
│ domain          │  └──>│ email               │      │ vendor_id (FK)   │
│ is_prioritized  │      │ password_encrypted  │<──┐  │ product_url      │
│ requires_captcha│      │ is_blocked          │   │  │ status           │
│ can_automate    │      │ session_data        │   │  │ assigned_account │
│ login_url       │      │ daily_items_added   │   │  │ attempts         │
│ selectors       │      │ total_items_added   │   │  │ created_at       │
└─────────────────┘      └─────────────────────┘   │  └──────────────────┘
                                                   │
┌─────────────────────┐      ┌──────────────────────┐
│ account_migrations  │      │   user_cart_items    │
├─────────────────────┤      ├──────────────────────┤
│ id (PK)             │      │ id (PK)              │
│ old_account_id (FK) │      │ user_id              │
│ new_account_id (FK) │      │ vendor_account_id(FK)│───┘
│ migrated_items      │      │ product_url          │
│ migrated_at         │      │ product_name         │
└─────────────────────┘      │ added_at             │
                             └──────────────────────┘
```

### 7.2 Table Definitions

#### 7.2.1 vendors

Stores information about supported vendor websites.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key, auto-generated |
| name | VARCHAR(255) | NO | Vendor display name |
| domain | VARCHAR(255) | NO | Vendor domain (unique) |
| is_prioritized | BOOLEAN | NO | Whether vendor is prioritized in search |
| requires_captcha | BOOLEAN | NO | Flag for captcha requirement |
| can_automate | BOOLEAN | NO | Whether automation is possible |
| login_url | VARCHAR(500) | YES | URL for login page |
| cart_url | VARCHAR(500) | YES | URL for cart page |
| selectors | JSONB | YES | CSS selectors for automation |
| rate_limit_daily | INTEGER | NO | Max items per account per day (default 50) |
| created_at | TIMESTAMP | NO | Record creation timestamp |

#### 7.2.2 vendor_accounts

Stores credentials and status for vendor accounts in the shared pool.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| vendor_id | UUID | NO | FK to vendors table |
| email | VARCHAR(255) | NO | Account email |
| password | TEXT | NO | Account password (plain text) |
| is_blocked | BOOLEAN | NO | Whether account is blocked |
| blocked_at | TIMESTAMP | YES | When account was blocked |
| last_used_at | TIMESTAMP | YES | Last successful use |
| session_data | JSONB | YES | Stored cookies/session |
| daily_items_added | INTEGER | NO | Items added today (reset daily) |
| total_items_added | INTEGER | NO | Total items ever added |

**Note:** Accounts are shared system resources, not user-owned. The pool is rotated to prevent blocking.

#### 7.2.3 cart_queue

Queue table for pending cart operations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | Source identifier (use constant 'system' or 'erpnext') |
| vendor_id | UUID | NO | Target vendor |
| product_url | VARCHAR(1000) | NO | Product page URL |
| product_name | VARCHAR(500) | YES | Product display name |
| product_data | JSONB | YES | Additional product metadata |
| status | VARCHAR(50) | NO | pending/processing/completed/failed/manual_required |
| assigned_account_id | UUID | YES | FK to vendor_accounts |
| attempts | INTEGER | NO | Number of attempts made |
| max_attempts | INTEGER | NO | Maximum retry attempts (default 3) |
| error_message | TEXT | YES | Last error message |
| created_at | TIMESTAMP | NO | Record creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |
| completed_at | TIMESTAMP | YES | When operation completed |

**Note:** The `user_id` field is kept for schema flexibility but should be populated with a constant value like `'system'` or `'erpnext'` for ERPNext integration calls. This allows future extensibility while maintaining simplicity for the current use case.

#### 7.2.4 user_cart_items

Tracks items successfully added to vendor carts (for audit trail and reporting).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | Source identifier (constant 'system' or 'erpnext') |
| vendor_account_id | UUID | NO | FK to vendor_accounts (which account was used) |
| product_url | VARCHAR(1000) | NO | Product page URL |
| product_name | VARCHAR(500) | YES | Product display name |
| quantity | INTEGER | NO | Quantity added (default 1) |
| added_at | TIMESTAMP | NO | When item was added |

#### 7.2.5 account_migrations

Tracks account migration history for blocked accounts.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| old_account_id | UUID | NO | FK to blocked vendor_accounts |
| new_account_id | UUID | NO | FK to replacement vendor_accounts |
| migrated_items | JSONB | NO | Array of migrated cart items |
| migrated_at | TIMESTAMP | NO | When migration occurred |

### 7.3 SQL Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vendors table
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

-- Vendor accounts table
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

-- Cart queue table
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

-- User cart items table
CREATE TABLE user_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  vendor_account_id UUID REFERENCES vendor_accounts(id),
  product_url VARCHAR(1000) NOT NULL,
  product_name VARCHAR(500),
  quantity INTEGER DEFAULT 1,
  added_at TIMESTAMP DEFAULT NOW()
);

-- Account migrations table
CREATE TABLE account_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_account_id UUID REFERENCES vendor_accounts(id),
  new_account_id UUID REFERENCES vendor_accounts(id),
  migrated_items JSONB NOT NULL,
  migrated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cart_queue_status ON cart_queue(status);
CREATE INDEX idx_cart_queue_user ON cart_queue(user_id);
CREATE INDEX idx_vendor_accounts_vendor ON vendor_accounts(vendor_id);
CREATE INDEX idx_vendor_accounts_blocked ON vendor_accounts(is_blocked);
CREATE INDEX idx_user_cart_items_user ON user_cart_items(user_id);

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
```

---

## 8. API Specifications

### 8.1 Cart Operations

#### POST /api/cart/add

Add a product to the cart queue for processing (called by ERPNext).

**Request Body:**
```json
{
  "user_id": "system",
  "vendor_id": "uuid",
  "product_url": "https://vendor.com/product/123",
  "product_name": "Product Name",
  "product_data": {
    "price": 29.99,
    "quantity": 1,
    "variant": "Large",
    "erpnext_item_id": "ITEM-12345"
  }
}
```

**Note:** The `user_id` should always be set to the constant value `"system"` for ERPNext integration calls.

**Response (200 OK):**
```json
{
  "success": true,
  "queue_id": "uuid",
  "status": "pending",
  "message": "Item queued for processing",
  "estimated_completion": "2025-12-02T10:30:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid vendor_id",
  "code": "INVALID_VENDOR"
}
```

#### GET /api/cart/status/:queueId

Get status of a specific queue item.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "completed",
  "product_name": "Product Name",
  "vendor_name": "Vendor Co",
  "attempts": 1,
  "created_at": "2025-12-02T10:25:00Z",
  "completed_at": "2025-12-02T10:25:30Z",
  "error_message": null
}
```

#### GET /api/admin/queue

Get all cart queue items (admin view - no user filter).

**Query Parameters:**
- `status` (optional): Filter by status
- `vendor_id` (optional): Filter by vendor
- `limit` (optional): Number of items (default 50)
- `offset` (optional): Pagination offset

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "product_name": "Product Name",
      "product_url": "https://vendor.com/product/123",
      "vendor_name": "Vendor Co",
      "status": "completed",
      "created_at": "2025-12-02T10:25:00Z",
      "account_email": "acc1@vendor.com"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

#### POST /api/cart/retry/:queueId

Retry a failed cart operation.

**Response (200 OK):**
```json
{
  "success": true,
  "queue_id": "uuid",
  "status": "pending",
  "message": "Item re-queued for processing"
}
```

### 8.2 Admin: Vendor Management

#### GET /api/admin/vendors

List all vendors.

**Response (200 OK):**
```json
{
  "vendors": [
    {
      "id": "uuid",
      "name": "Vendor Co",
      "domain": "vendor.com",
      "is_prioritized": true,
      "requires_captcha": false,
      "can_automate": true,
      "account_count": 5,
      "healthy_accounts": 4,
      "blocked_accounts": 1
    }
  ]
}
```

#### POST /api/admin/vendors

Create a new vendor.

**Request Body:**
```json
{
  "name": "Vendor Co",
  "domain": "vendor.com",
  "login_url": "https://vendor.com/login",
  "cart_url": "https://vendor.com/cart",
  "is_prioritized": true,
  "can_automate": true,
  "requires_captcha": false,
  "selectors": {
    "email_input": "#email",
    "password_input": "#password",
    "login_button": "button[type='submit']",
    "add_to_cart": ".add-to-cart-btn",
    "cart_confirmation": ".cart-success-message"
  },
  "rate_limit_daily": 50
}
```

#### PUT /api/admin/vendors/:id

Update a vendor.

#### DELETE /api/admin/vendors/:id

Delete a vendor (cascades to accounts).

### 8.3 Admin: Account Management

#### POST /api/admin/accounts

Create a new vendor account.

**Request Body:**
```json
{
  "vendor_id": "uuid",
  "email": "account@example.com",
  "password": "plaintext_password"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "vendor_id": "uuid",
  "email": "account@example.com",
  "is_blocked": false,
  "created_at": "2025-12-02T10:00:00Z"
}
```

#### GET /api/admin/accounts

List all accounts with optional filters.

**Query Parameters:**
- `vendor_id` (optional): Filter by vendor
- `is_blocked` (optional): Filter by block status
- `page`, `limit`: Pagination parameters

#### GET /api/admin/accounts/:id

Get account details including usage stats.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "vendor_id": "uuid",
  "vendor_name": "Vendor Co",
  "email": "account@example.com",
  "is_blocked": false,
  "daily_items_added": 12,
  "total_items_added": 450,
  "last_used_at": "2025-12-02T09:45:00Z",
  "created_at": "2025-11-01T10:00:00Z"
}
```

#### PUT /api/admin/accounts/:id

Update an account (email, password, unblock).

#### DELETE /api/admin/accounts/:id

Delete an account.

#### POST /api/admin/accounts/:id/test

Test account credentials by attempting login.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "session_valid": true
}
```

#### POST /api/admin/accounts/:id/migrate

Migrate cart data from a blocked account to a new account.

**Request Body:**
```json
{
  "new_account_id": "uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "migrated_items": 15,
  "migration_id": "uuid"
}
```

### 8.4 Admin: Queue Management

#### GET /api/admin/queue

Get queue items with filters.

**Query Parameters:**
- `status`: Filter by status
- `vendor_id`: Filter by vendor
- `date_from`, `date_to`: Date range filter

#### GET /api/admin/queue/stats

Get queue statistics.

**Response (200 OK):**
```json
{
  "pending": 25,
  "processing": 3,
  "completed_today": 150,
  "failed_today": 5,
  "manual_required": 12,
  "average_completion_time_seconds": 22
}
```

#### POST /api/admin/queue/:id/cancel

Cancel a pending queue item.

#### POST /api/admin/queue/manual/:id/complete

Mark a manual queue item as complete.

#### POST /api/admin/queue/manual/:id/fail

Mark a manual queue item as failed.

---

## 9. UI/UX Requirements (Credentials Dashboard)

### 9.1 Dashboard Overview

The Credentials Dashboard is a new admin interface within the existing React application. It provides centralized management of vendors and their associated accounts. This section details the UI components and interactions required.

### 9.2 Navigation & Access

- Dashboard accessible via sidebar menu item 'Credentials' (admin role only)
- Protected route requiring admin authentication
- Breadcrumb navigation: Dashboard > Credentials > [Vendor Name]

### 9.3 Screen Specifications

#### 9.3.1 Vendors List Screen

Primary screen showing all configured vendors with quick status overview.

**Components:**
- Search/filter bar with vendor name search and status filters
- Vendor cards or table rows showing: name, domain, account count, automation status, captcha flag
- Status indicators: green (all accounts healthy), yellow (some blocked), red (all blocked)
- 'Add Vendor' button opening modal form
- Click vendor row to navigate to vendor detail

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Credentials Dashboard                            [+ Add Vendor] │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Search vendors...          [Filter: All ▼] [Status: All ▼]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🟢 Vendor Co            vendor.com                      │    │
│  │    5 accounts | Auto ✓ | Captcha ✗ | 150 items today   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🟡 Shop Direct          shopdirect.co.uk                │    │
│  │    3 accounts (1 blocked) | Auto ✓ | Captcha ✗         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🔴 Manual Mart          manualmart.com                  │    │
│  │    2 accounts | Auto ✗ | Captcha ✓ | Manual only       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

#### 9.3.2 Vendor Detail Screen

Detailed view of single vendor with account management.

**Sections:**
- Vendor Info Card: name, domain, login URL, cart URL, selectors (JSON editor), automation toggle, captcha toggle
- Accounts Table: email, status (active/blocked), daily usage, total usage, last used, actions (edit/delete/test)
- 'Add Account' button with modal form for email/password
- Account health graph showing usage over time

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    Vendor Co                              [Edit] [Delete]│
├─────────────────────────────────────────────────────────────────┤
│  Domain: vendor.com                                              │
│  Login URL: https://vendor.com/login                             │
│  Automation: ✓ Enabled    Captcha: ✗ Not Required               │
│  Daily Limit: 50 items/account                                   │
├─────────────────────────────────────────────────────────────────┤
│  Accounts                                        [+ Add Account] │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Email              │ Status │ Today │ Total │ Last Used   │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ acc1@email.com     │ 🟢     │ 12    │ 450   │ 2 min ago   │  │
│  │ acc2@email.com     │ 🟢     │ 8     │ 320   │ 5 min ago   │  │
│  │ acc3@email.com     │ 🔴     │ 0     │ 200   │ Blocked     │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Selectors (JSON)                                    [Edit]      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ {                                                          │  │
│  │   "email_input": "#email",                                │  │
│  │   "password_input": "#password",                          │  │
│  │   "add_to_cart": ".add-to-cart-btn"                       │  │
│  │ }                                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 9.3.3 Add/Edit Account Modal

Modal form for creating or editing vendor accounts.

**Fields:**
- Email (required, validated format)
- Password (required, masked input with show/hide toggle)
- Notes (optional textarea for admin notes)

**Actions:**
- Save: Validates and saves account
- Test Connection: Attempts login to verify credentials
- Cancel: Closes modal without saving

#### 9.3.4 Queue Monitor Screen

Real-time view of cart queue processing.

**Components:**
- Status summary cards: pending count, processing count, completed today, failed today
- Live queue table with: product name, vendor, status, assigned account, attempts, timestamps
- Filter tabs: All, Pending, Processing, Completed, Failed, Manual Required
- Row actions: Retry (for failed), View Details, Cancel (for pending)
- Auto-refresh toggle with manual refresh button

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Queue Monitor                                   [↻ Auto-refresh]│
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Pending  │ │Processing│ │Completed │ │  Failed  │           │
│  │    25    │ │    3     │ │   150    │ │    5     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│  [All] [Pending] [Processing] [Completed] [Failed] [Manual]     │
├─────────────────────────────────────────────────────────────────┤
│  │ Product           │ Vendor    │ Status     │ Account │ Time │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Blue Widget       │ Vendor Co │ 🔄 Process │ acc1@.. │ 5s   │
│  │ Red Gadget        │ Shop Dir  │ ⏳ Pending │ -       │ 30s  │
│  │ Green Thing       │ Vendor Co │ ✅ Done    │ acc2@.. │ 1m   │
│  │ Yellow Item       │ Manual M  │ 👋 Manual  │ -       │ 2m   │
└─────────────────────────────────────────────────────────────────┘
```

#### 9.3.5 Manual Processing Queue

Queue for items requiring manual intervention.

**Components:**
- List of items flagged for manual processing
- Each item shows: product URL (clickable), vendor, reason for manual flag, created time
- Actions per item: Mark Complete, Mark Failed, Copy Product URL
- Bulk actions: Select multiple items for batch processing

### 9.4 Component Library

Reuse existing React components where possible. New components required:

| Component | Description |
|-----------|-------------|
| VendorCard | Card component displaying vendor summary with status indicators |
| AccountRow | Table row for account with inline actions and status badge |
| AccountModal | Modal form for add/edit account with validation |
| QueueItem | Row component for queue items with real-time status updates |
| StatusBadge | Colored badge component for various statuses |
| JsonEditor | Syntax-highlighted JSON editor for selectors configuration |
| UsageGraph | Chart component showing account usage over time |

### 9.5 Real-time Updates

Implement Supabase real-time subscriptions for:
- Queue status changes
- Account block notifications
- Usage counter updates

```typescript
// Example subscription setup
const subscription = supabase
  .channel('queue-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'cart_queue' },
    (payload) => handleQueueUpdate(payload)
  )
  .subscribe();
```

---

## 10. Security Considerations

### 10.1 Credential Security

| Requirement | Implementation |
|-------------|----------------|
| Encryption in Transit | All API calls over HTTPS. TLS 1.3 minimum. Supabase connection uses SSL. |
| Access Control | Admin-only access to credentials dashboard. Supabase RLS policies restrict data access by role. |
| Audit Logging | All credential access logged with timestamp, admin user, action, and IP address. |
| Credential Isolation | Vendor accounts are system resources, isolated from vendor websites. |

**Note:** Password encryption at rest has been omitted for this internal tool to simplify implementation. Credentials are protected by database access controls and HTTPS in transit.

### 10.2 API Security

- JWT authentication required for all API endpoints
- Rate limiting: 100 requests/minute per user for cart operations
- Admin endpoints require additional role verification
- Input validation on all endpoints using Zod or similar
- CORS configured to allow only known frontend origins

### 10.3 Automation Security

- Stagehand runs in isolated Runpod containers, destroyed after each task
- No credential logging in automation scripts
- Session data encrypted before storage in Supabase
- Runpod API key rotation every 90 days

### 10.4 Data Privacy

- All cart operations are system-generated (ERPNext integration), no end-user personal data
- Vendor credentials are operational data for internal use only
- Data retention policy: Queue items older than 30 days archived
- No GDPR concerns as system is internal automation tool

### 10.5 Password Storage

**Simplified Approach for Internal Tool:**

Passwords are stored in plain text in the database for this internal automation tool. This simplification is acceptable because:
- System is for internal ERPNext use only (not customer-facing)
- Database access is restricted to admin users via Supabase RLS
- All connections are encrypted in transit via HTTPS/TLS
- Vendor accounts are operational credentials, not user personal data

For future versions requiring higher security, implement `pgcrypto` encryption functions.

---

## 11. Success Metrics

### 11.1 Key Performance Indicators

| Metric | Target | Measurement | Frequency |
|--------|--------|-------------|-----------|
| Cart Addition Success Rate | ≥95% | Completed / (Completed + Failed) | Daily |
| Average Time to Cart | <30 seconds | completed_at - created_at | Daily |
| Account Block Rate | <5% per month | Blocked accounts / Total accounts | Monthly |
| Manual Queue Volume | <20% of total | Manual items / Total items | Weekly |
| Vendor Coverage | 80% of prioritized vendors | Automated vendors / Prioritized vendors | Monthly |
| System Uptime | ≥99.5% | Uptime monitoring | Monthly |

### 11.2 Operational Efficiency Metrics

- ERPNext procurement workflow time reduction (target: 80% reduction)
- Manual intervention rate (target: <20% of cart operations require manual handling)
- Admin time saved per week (target: 10+ hours)

### 11.3 Monitoring Dashboard

Track the following in real-time:
- Queue depth and processing rate
- Success/failure rates by vendor
- Account health across all vendors
- Average processing time trends
- Error rate breakdown by error type

---

## 12. Implementation Timeline

### 12.1 Phase Overview

#### Phase 1: Foundation (Weeks 1-3)
- Database schema implementation and migrations
- Basic API endpoints for vendors and accounts
- Credentials dashboard UI (vendors list, add vendor)
- Encryption setup for password storage

#### Phase 2: Account Management (Weeks 4-5)
- Account CRUD operations and UI
- Account selection algorithm implementation
- Daily limit tracking and reset cron job
- Account health monitoring dashboard

#### Phase 3: Queue System (Weeks 6-7)
- Cart queue table and API endpoints
- Queue processor worker implementation
- Real-time status updates via Supabase subscriptions
- Queue monitor UI in dashboard

#### Phase 4: Automation Engine (Weeks 8-10)
- Stagehand integration with Runpod
- Login automation for 5 pilot vendors
- Add-to-cart automation flows
- Captcha and block detection

#### Phase 5: Resilience & Migration (Weeks 11-12)
- Account block detection and flagging
- Account migration service implementation
- Retry logic with exponential backoff
- Manual queue workflow

#### Phase 6: Testing & Launch (Weeks 13-14)
- End-to-end testing with all vendors
- Performance optimization
- Documentation and runbooks
- Staged rollout to production

### 12.2 Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 3 | Foundation Complete | Database + Basic Dashboard |
| 5 | Account Management Live | Full CRUD + Selection Logic |
| 7 | Queue System Operational | Queue + Real-time Updates |
| 10 | Automation MVP | 5 Vendors Automated |
| 12 | Full Feature Complete | All Features Implemented |
| 14 | Production Launch | Live for All Users |

### 12.3 Resource Requirements

| Role | Allocation | Duration |
|------|------------|----------|
| Backend Engineer | 1 FTE | 14 weeks |
| Frontend Engineer | 0.5 FTE | 10 weeks |
| DevOps Engineer | 0.25 FTE | 6 weeks |
| QA Engineer | 0.5 FTE | 4 weeks |
| Product Manager | 0.25 FTE | 14 weeks |

---

## 13. Risks & Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Vendor website changes break automation | High | High | Use Stagehand AI actions for resilience; monitoring alerts for failures; fallback to manual |
| R2 | High account block rate depletes pool | Medium | High | Conservative rate limits; multiple accounts per vendor; proactive account creation process |
| R3 | Vendors implement advanced anti-bot measures | Medium | High | Monitor industry trends; flag vendors for manual; consider captcha solving services for v2 |
| R4 | Runpod infrastructure issues | Low | High | Queue-based architecture allows recovery; items remain pending until processed; consider backup provider |
| R5 | Credential security breach | Low | Critical | Encryption at rest; access controls; audit logging; incident response plan |
| R6 | Legal/ToS concerns from vendors | Medium | Medium | Legal review before launch; respect robots.txt where applicable; rate limiting to avoid abuse |

### 13.1 Contingency Plans

**R1 - Automation Breakage:**
1. Alert triggered on >10% failure rate for any vendor
2. Automatic fallback to manual queue
3. On-call engineer investigates within 4 hours
4. Selector update or vendor flagged as manual-only

**R2 - Account Depletion:**
1. Alert triggered when healthy accounts <2 per vendor
2. Operations team creates new accounts within 24 hours
3. Temporary reduction in rate limits
4. Consider premium account options with higher limits

**R5 - Security Breach:**
1. Immediate rotation of all encryption keys
2. All vendor account passwords reset
3. Audit log review to identify scope
4. User notification if required by GDPR

---

## 14. Appendices

### 14.1 Glossary

| Term | Definition |
|------|------------|
| Stagehand | AI-powered browser automation framework by Browserbase for reliable web interactions |
| Runpod | GPU cloud platform used to host Stagehand automation instances |
| Supabase | Open-source Firebase alternative providing PostgreSQL database with real-time subscriptions |
| Queue Processor | Background worker that polls pending cart operations and dispatches to automation |
| Account Migration | Process of transferring cart tracking data from a blocked account to a replacement account |
| RLS | Row Level Security - Supabase feature for database access control at row level |
| Captcha | Challenge-response test to determine if user is human; blocks automation |

### 14.2 References

- Stagehand Documentation: https://github.com/browserbase/stagehand
- Runpod Documentation: https://docs.runpod.io
- Supabase Documentation: https://supabase.com/docs
- pgcrypto Extension: https://www.postgresql.org/docs/current/pgcrypto.html

### 14.3 Sample Vendor Selectors

```json
{
  "vendor_co": {
    "email_input": "#login-email",
    "password_input": "#login-password",
    "login_button": "button[type='submit']",
    "add_to_cart": ".product-add-to-cart",
    "cart_confirmation": ".cart-notification.success",
    "blocked_indicator": ".account-suspended-message"
  },
  "shop_direct": {
    "email_input": "input[name='email']",
    "password_input": "input[name='password']",
    "login_button": ".login-form button",
    "add_to_cart": "[data-action='add-to-basket']",
    "cart_confirmation": ".basket-confirmation",
    "blocked_indicator": ".error-blocked"
  }
}
```

### 14.4 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 2, 2025 | [Author Name] | Initial draft |

---

*— End of Document —*