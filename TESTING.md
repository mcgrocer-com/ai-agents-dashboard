# Blogger Feature Testing Guide

This document provides a comprehensive testing checklist for the Blogger feature implementation.

## Pre-Testing Checklist

- [x] Database migration applied (5 tables created)
- [x] 6 personas seeded
- [x] 9 templates seeded
- [x] All service files created
- [x] All UI components created
- [x] Navigation and routing configured
- [x] Shopify API endpoint updated

## Test Environment

- **Frontend URL**: `http://localhost:5173/#/blogger` (or your local dev server)
- **Shopify Store**: `https://mcgrocer-com.myshopify.com`
- **External API**: `https://mcgrocer-shopify-api.vercel.app`

## 1. Database Verification Tests

### 1.1 Check Tables Exist
```sql
-- Run in Supabase SQL Editor
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'blogger_%'
ORDER BY tablename;
```
**Expected**: 5 tables (blogger_personas, blogger_templates, blogger_keywords, blogger_blogs, blogger_blog_products)

### 1.2 Verify Personas
```sql
SELECT id, name, role FROM blogger_personas ORDER BY name;
```
**Expected**: 6 personas (Dr. Emily Francis, Harriet Greene, Lola Adeyemi, Nathan White, Priya Moore, Alistair Malik)

### 1.3 Verify Templates
```sql
SELECT id, name, description FROM blogger_templates ORDER BY name;
```
**Expected**: 9 templates (How-to Post, Listicle, Product Review, Beginner's Guide, Case Study, Comparison Post, Ultimate Guide, Industry Insights, Seasonal/Trend Post)

## 2. Navigation Tests

### 2.1 Sidebar Navigation
- [ ] Navigate to `/dashboard`
- [ ] Verify "Blogger" link appears in Agents section with PenTool icon
- [ ] Click "Blogger" link
- [ ] Verify redirects to `/blogger` (Dashboard)

## 3. Dashboard Tests

### 3.1 Initial Load
- [ ] Navigate to `/blogger`
- [ ] Verify stats cards show: Total Blogs (0), Drafts (0), Published (0), Archived (0)
- [ ] Verify "Create New Blog" button is visible
- [ ] Verify empty state message: "No blogs found"

### 3.2 Search and Filter
- [ ] Test search input (should show no results initially)
- [ ] Test status filter dropdown (All Status, Draft, Published, Archived)
- [ ] Click "Refresh" button (should reload with no errors)

## 4. Blog Creation Wizard Tests

### 4.1 Step 1: Topic Input
- [ ] Click "Create New Blog" from dashboard
- [ ] Verify wizard shows "Step 1 of 9: Topic Input"
- [ ] Verify progress bar shows ~11% (1/9)
- [ ] Enter topic: "Best Gluten-Free Products for Celiac Disease"
- [ ] Verify "Next" button becomes enabled
- [ ] Verify "Previous" button is disabled
- [ ] Click "Next"

### 4.2 Step 2: Persona Selection
- [ ] Verify wizard shows "Step 2 of 9: Persona Selection"
- [ ] Verify 6 persona cards are displayed in grid
- [ ] Click on "Dr. Emily Francis - Medical Expert & Dietary Specialist"
- [ ] Verify card shows checkmark and blue border
- [ ] Verify "Next" button becomes enabled
- [ ] Click "Next"

### 4.3 Step 3: Template Selection
- [ ] Verify wizard shows "Step 3 of 9: Template Selection"
- [ ] Verify 9 template cards are displayed in grid
- [ ] Click on "Product Review" template
- [ ] Verify card shows checkmark and blue border
- [ ] Click "Next"

### 4.4 Step 4: Keyword Research
- [ ] Verify wizard shows "Step 4 of 9: Keyword Research"
- [ ] Verify search input pre-filled with topic
- [ ] Click "Research" button
- [ ] **Expected Behavior**:
  - Loading state: "Researching..." button disabled
  - On success: List of keywords with search volume, competition, and intent
  - On error: Error message in console (check external API availability)
- [ ] Select a keyword from the list (if available)
- [ ] Verify keyword shows checkmark
- [ ] Click "Next"

**Note**: If keyword research fails due to external API, manually add test data:
```typescript
// In browser console:
const testKeywords = [
  { keyword: "gluten free bread", search_volume: 12000, competition: "medium", intent: "transactional" },
  { keyword: "celiac disease diet", search_volume: 8000, competition: "low", intent: "informational" }
];
```

### 4.5 Step 5: Meta Data
- [ ] Verify wizard shows "Step 5 of 9: Meta Data"
- [ ] Enter Meta Title (50-60 chars recommended): "Best Gluten-Free Products: Complete Guide 2025"
- [ ] Verify character counter shows current length and optimal range indicator
- [ ] Enter Meta Description (140-160 chars): "Discover the best gluten-free products for celiac disease. Expert-reviewed recommendations for bread, pasta, snacks, and more. Shop McGrocer's curated selection."
- [ ] Verify character counter shows optimal length (green checkmark)
- [ ] Click "Next"

### 4.6 Step 6: Content Editor
- [ ] Verify wizard shows "Step 6 of 9: Content Preview"
- [ ] Verify two text areas: "Markdown Content" and "HTML Content"
- [ ] Toggle between "Edit" and "Preview" modes
- [ ] Enter sample markdown content:
```markdown
# Best Gluten-Free Products for Celiac Disease

Living with celiac disease requires strict adherence to a gluten-free diet...

## Top Gluten-Free Products

1. **Schär Gluten-Free Bread** - Award-winning taste and texture
2. **Barilla Gluten-Free Pasta** - Perfect al dente every time
```
- [ ] Switch to "Preview" mode
- [ ] Verify HTML rendering with proper headings and formatting
- [ ] Click "Next"

### 4.7 Step 7: SEO Optimization
- [ ] Verify wizard shows "Step 7 of 9: SEO Optimization"
- [ ] Verify SEO Score and Readability Score cards display
- [ ] Verify scores are calculated (0-100 range)
- [ ] Edit meta title/description if needed
- [ ] Verify real-time character count updates
- [ ] Click "Next"

### 4.8 Step 8: Product Links (Shopify Integration)
- [ ] Verify wizard shows "Step 8 of 9: Images & Links"
- [ ] Enter search query: "gluten free bread"
- [ ] Click "Search" button
- [ ] **Critical Test**: Verify products load from Shopify API
  - **Expected**: List of products with titles and "Add" buttons
  - **API Endpoint**: `https://mcgrocer-com.myshopify.com/search/suggest.json`
- [ ] Click "Add" button on a product
- [ ] Verify product moves to "Selected Products" section
- [ ] Verify product shows full URL and "Remove" button
- [ ] Click "Remove" (X) button
- [ ] Verify product is removed from selected list
- [ ] Re-add product and click "Next"

**Shopify API Test** (can run in browser console):
```javascript
fetch('https://mcgrocer-com.myshopify.com/search/suggest.json?q=gluten&resources[type]=product&resources[limit]=5')
  .then(r => r.json())
  .then(d => console.log('Products:', d.resources?.results?.products));
```

### 4.9 Step 9: Final Preview
- [ ] Verify wizard shows "Step 9 of 9: Final Preview"
- [ ] Verify complete blog preview with:
  - Title, metadata, persona info, word count
  - Meta title and meta description
  - SEO and readability scores
  - Full HTML content rendered
- [ ] Verify "Finish" button is visible (not "Next")
- [ ] Click "Finish"
- [ ] Verify redirects to `/blogger` dashboard

### 4.10 Auto-Save Test
- [ ] Start a new blog creation
- [ ] Fill in topic and persona
- [ ] **Close browser tab without finishing**
- [ ] Reopen `/blogger/create`
- [ ] **Expected**: Wizard state restored from localStorage
  - Topic pre-filled
  - Persona selected
  - Current step restored
- [ ] Complete or clear by finishing wizard

## 5. Blog Management Tests

### 5.1 View Blog
- [ ] From dashboard, verify created blog appears in grid
- [ ] Verify BlogCard shows:
  - Title, status badge (Draft), creation date
  - Persona name, template name
  - SEO score, readability score, word count
  - Action buttons: View, Edit, Duplicate, Delete
- [ ] Click "View" button
- [ ] Verify redirects to `/blogger/{id}`
- [ ] Verify BloggerDetailPage shows:
  - Full blog preview with metadata
  - Action buttons: Edit, Publish, Archive, Delete

### 5.2 Edit Blog
- [ ] From detail page, click "Edit" button
- [ ] Verify redirects to `/blogger/{id}/edit` (reuses create wizard)
- [ ] **Note**: Edit mode not fully implemented - will show create wizard
- [ ] Navigate back to dashboard

### 5.3 Duplicate Blog
- [ ] From dashboard BlogCard, click "Duplicate" (copy icon)
- [ ] Verify duplicate blog appears with " (Copy)" suffix
- [ ] Verify duplicate has status "Draft"
- [ ] Verify duplicate has new ID (different URL)

### 5.4 Delete Blog
- [ ] From dashboard BlogCard, click "Delete" (trash icon)
- [ ] Verify confirmation dialog: "Are you sure you want to delete this blog?"
- [ ] Click "Cancel" - verify blog remains
- [ ] Click "Delete" again, then "OK"
- [ ] Verify blog is removed from list
- [ ] Verify stats updated (Total Blogs count decreased)

### 5.5 Publish to Shopify
- [ ] Navigate to blog detail page
- [ ] Verify "Publish to Shopify" button is visible (green, with Send icon)
- [ ] Click "Publish to Shopify"
- [ ] **Expected Behavior**:
  - Button shows "Publishing..." with disabled state
  - On success: Status changes to "Published", published_at timestamp set
  - On error: Error logged to console (check external API)
- [ ] Verify "Unpublish" button replaces "Publish" button
- [ ] Click "Unpublish"
- [ ] Verify status returns to "Draft"

**Note**: Shopify publishing requires mcgrocer-shopify-api.vercel.app to be operational.

### 5.6 Archive Blog
- [ ] From detail page, click "Archive" button
- [ ] Verify status changes to "Archived"
- [ ] Return to dashboard
- [ ] Change status filter to "Archived"
- [ ] Verify archived blog appears

## 6. Filter and Search Tests

### 6.1 Status Filter
- [ ] Create blogs with different statuses (Draft, Published, Archived)
- [ ] Use status dropdown to filter:
  - "All Status" - shows all blogs
  - "Draft" - shows only drafts
  - "Published" - shows only published
  - "Archived" - shows only archived

### 6.2 Search Functionality
- [ ] Create blogs with distinct titles
- [ ] Enter search term in search input
- [ ] Verify real-time filtering (debounced)
- [ ] Test partial matches
- [ ] Test case-insensitive search

### 6.3 Stats Accuracy
- [ ] Verify stats cards update correctly:
  - Total Blogs = count of all blogs
  - Drafts = count of draft blogs
  - Published = count of published blogs
  - Archived = count of archived blogs
- [ ] Create new blog - verify Total and Drafts increment
- [ ] Publish a blog - verify Drafts decrement, Published increments
- [ ] Archive a blog - verify appropriate counts update

## 7. Error Handling Tests

### 7.1 Network Errors
- [ ] Disable network (or use DevTools offline mode)
- [ ] Try creating a blog
- [ ] Verify error messages in console
- [ ] Verify user sees loading states
- [ ] Re-enable network

### 7.2 Validation Errors
- [ ] Try to advance wizard without filling required fields
- [ ] Verify "Next" button stays disabled
- [ ] Fill required fields
- [ ] Verify "Next" button enables

### 7.3 Missing Data
- [ ] Manually delete localStorage `blogger_draft` key
- [ ] Navigate to `/blogger/create`
- [ ] Verify wizard starts fresh at Step 1

## 8. Accessibility Tests

### 8.1 Keyboard Navigation
- [ ] Use Tab key to navigate through wizard
- [ ] Verify all interactive elements are focusable
- [ ] Verify focus indicators are visible (blue ring)
- [ ] Use Enter/Space to activate buttons
- [ ] Use arrow keys in select/radio groups

### 8.2 Screen Reader Compatibility
- [ ] Use screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify labels are read correctly
- [ ] Verify button purposes are clear
- [ ] Verify form field instructions are announced

## 9. Mobile Responsiveness Tests

### 9.1 Mobile Layout (375px width)
- [ ] Open DevTools, set viewport to 375px
- [ ] Navigate to dashboard
- [ ] Verify grid switches to single column
- [ ] Verify stats cards stack vertically
- [ ] Verify navigation is accessible

### 9.2 Tablet Layout (768px width)
- [ ] Set viewport to 768px
- [ ] Verify 2-column grid layout
- [ ] Verify wizard remains usable
- [ ] Verify all buttons are clickable

## 10. Performance Tests

### 10.1 Auto-Save Performance
- [ ] Open browser DevTools Performance tab
- [ ] Start blog creation
- [ ] Type in content editor
- [ ] Verify auto-save debounces (1 second delay)
- [ ] Verify no performance degradation

### 10.2 Large Content Handling
- [ ] Create blog with 3000+ word content
- [ ] Verify wizard remains responsive
- [ ] Verify SEO score calculates correctly
- [ ] Verify save operation completes

## Known Limitations & Future Enhancements

### Not Implemented (Per PRD)
- [ ] Google API integration for keyword research (using external API instead)
- [ ] Top 3 competitive content retrieval
- [ ] Plagiarism detection API
- [ ] Citation mandate validation
- [ ] Performance tracking dashboard
- [ ] Adaptive AI feedback loop
- [ ] Location-aware modulation
- [ ] Persona fusion mode (co-authoring)
- [ ] Geo-targeting customization
- [ ] Schema markup (FAQ JSON-LD)

### Current Implementation
- ✓ 6 personas with E-E-A-T compliance
- ✓ 9 blog templates
- ✓ Keyword research (via external API)
- ✓ SEO meta generation
- ✓ AI content generation
- ✓ Client-side SEO scoring
- ✓ Client-side readability scoring
- ✓ Shopify product search and linking
- ✓ Shopify blog publishing
- ✓ Auto-save to localStorage
- ✓ Blog CRUD operations
- ✓ Status management (Draft/Published/Archived)
- ✓ Filtering and search

## Test Summary Report Template

```markdown
# Blogger Feature Test Report
**Date**: [DATE]
**Tester**: [NAME]
**Environment**: [LOCAL/STAGING/PRODUCTION]

## Test Results Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X
- Not Tested: X

## Critical Issues
1. [Issue description]
2. [Issue description]

## Minor Issues
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]
```

## Quick Start Test Script

For rapid testing, run this sequence:

1. **Verify Database**: Check tables exist
2. **Create Blog**: Navigate to `/blogger/create`, fill wizard end-to-end
3. **Test Shopify**: Search for "gluten free" products in Step 8
4. **Save Blog**: Complete wizard, verify redirect to dashboard
5. **Test Actions**: View, Duplicate, Delete from dashboard
6. **Test Filters**: Change status filter, use search

**Estimated Time**: 15-20 minutes for complete test pass
