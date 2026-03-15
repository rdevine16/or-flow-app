# Feature: Global Announcement System

## Goal
Allow facility admins to create announcements from the Staff Management page that display as a persistent banner at the top of the web app AND send push notifications to iOS devices. Provides cross-platform communication for OR teams.

## Platforms & Scope
- **Web:** Announcement creation UI (Staff Management page) + banner display (global layout)
- **iOS:** Push notification delivery (via existing APNs edge function)
- **Database:** New `announcements` table + triggers for push + notification integration

## Target Audience
- **Creators:** `facility_admin` and `global_admin` only
- **Recipients:** Staff, Surgeons, or Both (selectable per announcement)

---

## Requirements

### Announcement Creation (Staff Management → Announcements Tab)
1. New "Announcements" tab on Staff Management page
2. "Create Announcement" button opens a dialog/form
3. Fields:
   - **Title** (required, max ~100 chars) — displayed in banner
   - **Body** (optional, longer text) — shown on click/expand or in notification panel
   - **Audience**: Staff / Surgeons / Both (radio or select)
   - **Priority**: Normal (blue) / Warning (amber) / Critical (red)
   - **Category**: General / Maintenance / Policy Update / Safety Alert
   - **Duration**: 1–7 days (default: 1 day / 24hrs)
   - **Schedule**: Send Now / Schedule for later (date+time picker)
4. Preview of how the banner will look before sending

### Web Banner Display
5. Persistent banner at top of app (in DashboardLayout, below header)
6. Shows active announcements for the current user's audience
7. Banner styled by priority: Normal=blue, Warning=amber, Critical=red
8. Shows title + category icon + time remaining
9. Click expands to show full body text
10. **Dismissible**: Normal/Warning can be dismissed per user. Critical = non-dismissible.
11. Multiple active announcements stack (most recent / highest priority first)

### Push Notifications
12. When announcement activates → push notification to targeted iOS devices
13. Uses existing `send-push-notification` edge function (broadcast or role-based mode)
14. Push payload includes title, body preview, and deep link data

### Message History
15. Table below the create button showing all announcements
16. Columns: Title, Sender, Audience, Priority, Category, Status, Created, Expires
17. Status: Scheduled (gray) / Active (green) / Expired (muted) / Deactivated (red)
18. Actions: Deactivate (active → deactivated), Delete (soft delete)
19. Filterable by status, priority, category
20. Searchable by title

### Per-User Banner Dismissal
21. Users can dismiss Normal/Warning banners for themselves
22. Dismissal tracked in `announcement_dismissals` table
23. Dismissed announcements don't show banner but remain in notification panel
24. Critical priority: no dismiss button, always visible until expired/deactivated

### Scheduled Send
25. Option to send immediately or at a future date/time
26. Scheduled announcements show in history as "Scheduled" status
27. When scheduled time arrives → banner activates + push notification fires
28. Implemented via DB check (announcements where starts_at <= now() AND expires_at > now())
29. Push notification triggered by pg_net call on activation (or cron check)

### Integration with Notification System
30. Each announcement creates a notification record (category: `announcements`)
31. Appears in NotificationPanel alongside other notifications
32. Respects existing notification_reads for read tracking
33. Add `announcements` category to notification_settings_template

---

## Database

### New Table: `announcements`
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(100) NOT NULL,
  body TEXT,
  audience TEXT NOT NULL CHECK (audience IN ('staff', 'surgeons', 'both')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'warning', 'critical')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'maintenance', 'policy_update', 'safety_alert')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'expired', 'deactivated')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_announcements_facility_active ON announcements(facility_id, status, starts_at, expires_at);
CREATE INDEX idx_announcements_facility_created ON announcements(facility_id, created_at DESC);
```

### New Table: `announcement_dismissals`
```sql
CREATE TABLE announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id),
  user_id UUID NOT NULL REFERENCES users(id),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
```

### RLS Policies
- All users in facility can SELECT announcements (filtered by audience + role)
- Only facility_admin/global_admin can INSERT/UPDATE
- Users can INSERT their own dismissals
- Soft delete pattern on announcements

---

## UI/UX

### Staff Management → Announcements Tab
- Tab with Megaphone icon
- Split layout: Create button at top → History table below
- Create dialog: form with all fields, banner preview at bottom
- History table: sortable, filterable, with status badges and action buttons

### Global Banner (DashboardLayout)
- Positioned between header and page content
- Full-width, compact height
- Priority-colored background with icon
- Title text + "X ago" or "expires in X"
- Expand chevron for body text
- Dismiss X button (Normal/Warning only)
- Stacks vertically if multiple active

---

## Files Likely Involved

### New Files
- `components/staff-management/AnnouncementsTab.tsx` — tab content
- `components/staff-management/CreateAnnouncementDialog.tsx` — creation form
- `components/staff-management/AnnouncementHistoryTable.tsx` — history table
- `components/global/AnnouncementBanner.tsx` — global banner display
- `lib/dal/announcements.ts` — data access layer
- `hooks/useAnnouncements.ts` — data hooks
- `types/announcements.ts` — TypeScript interfaces
- `supabase/migrations/YYYYMMDD_announcements.sql` — schema + RLS + triggers

### Modified Files
- `app/staff-management/PageClient.tsx` — add Announcements tab
- `components/layouts/DashboardLayout.tsx` — render AnnouncementBanner
- `components/layouts/Header.tsx` — (if banner goes in header area)
- `supabase/functions/send-push-notification/index.ts` — may need audience-based targeting
- Notification settings templates — add `announcements` category

---

## Out of Scope
- Multi-facility broadcasting (global admin sends to multiple facilities)
- Rich text / markdown in announcement body
- File/image attachments
- Announcement templates / saved drafts
- Email delivery of announcements
- Web push notifications (only iOS APNs)
- Announcement analytics (open rates, dismiss rates)

---

## Acceptance Criteria
- [ ] Admin can create announcement with all fields from Staff Management
- [ ] Banner appears at top of app for targeted audience
- [ ] Push notification delivered to iOS devices for targeted audience
- [ ] Priority styling: Normal=blue, Warning=amber, Critical=red
- [ ] Category tags displayed with appropriate icons
- [ ] Users can dismiss Normal/Warning banners; Critical stays visible
- [ ] Announcement auto-expires after selected duration
- [ ] Admin can manually deactivate an active announcement
- [ ] Scheduled announcements activate at specified time
- [ ] Message history shows all announcements with filtering/search
- [ ] Announcement appears in notification panel
- [ ] All queries filter by facility_id (RLS compliance)
- [ ] Soft delete pattern followed
- [ ] No TypeScript `any` types
