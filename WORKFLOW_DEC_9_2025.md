# Weekly Workflow - December 9, 2024

## Overview
Focus areas for this week: Blogger Agent completion, Supabase storage management, and Shopping Assistant groundwork.

---

## 1. Blogger Agent - Complete & Test End-to-End

### Current Status
- 9-step wizard implemented
- Database schema deployed
- Service layer complete

### Tasks
- [x] Test full blog creation flow (topic → publish)
- [x] Verify persona selection and template functionality
- [x] Test keyword research API integration
- [x] Validate meta data generation (title 50-60 chars, description 140-160 chars)
- [x] Test content generation with different personas/templates
- [x] Verify SEO scoring calculation
- [x] Test Shopify product search and linking
- [x] Test publish to Shopify CMS
- [x] Test draft save and resume functionality
- [ ] Verify dashboard filtering, search, and pagination
- [ ] Test duplicate, archive, and delete actions

### Key Files
- [BloggerCreatePage.tsx](src/pages/blogger/BloggerCreatePage.tsx)
- [BloggerDashboardPage.tsx](src/pages/blogger/BloggerDashboardPage.tsx)
- [system-prompt.ts](src/services/blogger/system-prompt.ts)
- [ai.service.ts](src/services/blogger/ai.service.ts)

---

## 2. Supabase Storage Cleanup Cron Job

### Problem
Exceeded Supabase storage limits due to large 3D data files.

### Solution
Create and deploy a scheduled cleanup API to manage storage.

### Tasks
- [ ] Audit current storage usage (identify large/unused files)
- [ ] Define cleanup rules:
  - Delete files older than X days
  - Remove orphaned files (no DB reference)
  - Compress or archive old 3D data
- [ ] Create Edge Function: `cleanup-storage`
- [ ] Implement cleanup logic with safety checks
- [ ] Add logging for deleted files
- [ ] Set up cron schedule (daily/weekly)
- [ ] Deploy to Supabase
- [ ] Test in staging before production
- [ ] Monitor first few runs

### Proposed Structure
```
supabase/functions/cleanup-storage/
├── index.ts        # Main handler
└── config.ts       # Retention policies
```

---

## 3. Shopping Assistant Agent (Initial)

### Scope
Light exploration and planning - not full implementation this week.

### Tasks
- [ ] Review existing shopping assistant codebase
- [ ] Document current capabilities
- [ ] Identify gaps and improvements needed
- [ ] Outline integration points with product catalog
- [ ] Draft basic agent architecture

---

## Priority Order
1. **High**: Blogger Agent testing (blocking for launch)
2. **High**: Storage cleanup (operational issue)
3. **Low**: Shopping Assistant (planning only)

---

## Notes
- Storage cleanup should include dry-run mode for safety
- Blogger testing should cover both happy path and edge cases
- Keep shopping assistant scope minimal this week
