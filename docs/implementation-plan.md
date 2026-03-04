# Implementation Plan: Subscription Tier System

## Summary

Introduce a 3-tier subscription model (Essential / Professional / Enterprise) that gates features, analytics, and engine behavior per facility. Essential tier enables day-of surgical flow with only `patient_in` + `patient_out` milestones. Higher tiers unlock analytics, scoring, financials, and integrations progressively.

Key architectural decisions:
- **Extend existing `FeatureGate`** component with tier modes (hide/lock/blur/locked-tab) — no separate TierGate
- **Tiers replace `facility_features`** — `subscription_plans` table becomes the single source of truth for feature access
- **Auto-sync permissions** — tier changes trigger DB function that updates `facility_permissions`
- **Per-case template resolution** — engines read `cases.milestone_template_id` (already exists) to determine expected milestones, not a global hardcoded list
- **Foundation first** — infrastructure before UI gating

## Interview Notes

1. **Gate component:** Extend existing `FeatureGate` rather than creating separate `TierGate`. Add tier modes.
2. **Tier vs features:** Tiers replace the `facility_features` system. `subscription_plans` is single source of truth.
3. **Permission sync:** Tier change auto-syncs `facility_permissions` via DB function. Existing `can()` checks "just work".
4. **Milestone source:** Per-case — engines read the template applied to each case via `cases.milestone_template_id` (3-tier cascade: surgeon override → procedure type → facility default).
5. **Locked nav UX:** Clicking locked sidebar item navigates to the page with a full upgrade prompt.
6. **Wizard placement:** Plan selection goes after name/basics in facility creation wizard.
7. **Blur CTA:** Inline upgrade CTA overlay on blurred widgets (not modal).
8. **Priority:** Foundation first — DB, hooks, gate component, then engines, then page-level gating.

---

## Phases

### Phase 1: Database Schema & Permission Sync
**What:** Create `subscription_plans` table, add `facilities.subscription_plan_id` FK, seed 3 tiers, default existing facilities to Enterprise. Create a DB function that syncs `facility_permissions` when a facility's plan changes.
**Complexity:** Medium

**Files touched:**
- NEW: `supabase/migrations/YYYYMMDD_subscription_plans.sql`

**Details:**
- `subscription_plans` table: `id`, `slug`, `name`, `description`, `price_monthly_cents`, `sort_order`, `features` (JSONB), `is_active`, timestamps
- Seed: essential ($750), professional ($1,500), enterprise ($2,500)
- `facilities.subscription_plan_id` UUID FK → `subscription_plans.id`
- UPDATE existing facilities to enterprise plan
- RLS: all authenticated users can read plans; only service_role can modify
- `sync_facility_permissions_for_tier()` function: when `facilities.subscription_plan_id` changes, update `facility_permissions` based on tier's feature set
- Trigger on `facilities` AFTER UPDATE of `subscription_plan_id`

**Commit:** `feat(tiers): phase 1 - subscription plans schema and permission sync`

**3-stage test gate:**
1. Unit: Verify migration applies cleanly, seed data exists, FK constraint works
2. Integration: Change a facility's plan → verify `facility_permissions` auto-sync
3. Workflow: Create facility → assign plan → verify permissions match tier

---

### Phase 2: Tier Hook & Configuration
**What:** Create `useSubscriptionTier()` hook, `tier-config.ts` with feature mappings, and integrate tier into UserContext so it's globally available.
**Complexity:** Medium

**Files touched:**
- NEW: `lib/tier-config.ts`
- NEW: `lib/hooks/useSubscriptionTier.ts`
- MODIFY: `lib/UserContext.tsx` — add tier to context
- MODIFY: `components/layouts/DashboardLayout.tsx` — provide tier context

**Details:**
- `tier-config.ts`: tier slug → feature map (analytics, financials, flags, orbit_score, data_quality, spd, integrations), tier hierarchy for comparison (`isTierAtLeast()`)
- `useSubscriptionTier()`: fetches facility's plan via `facilities.subscription_plan_id` join to `subscription_plans`, returns `{ tier, features, loading, isTierAtLeast() }`
- Add `tier`, `isTierAtLeast()` to UserContext alongside existing `can()`, `canAny()`, `canAll()`
- DashboardLayout already fetches facility data — extend to include plan

**Commit:** `feat(tiers): phase 2 - tier hook, config, and context integration`

**3-stage test gate:**
1. Unit: `isTierAtLeast('professional')` returns correct boolean for each tier
2. Integration: `useSubscriptionTier()` returns correct tier for a facility with plan set
3. Workflow: Login as facility user → verify tier is available in context → check feature access

---

### Phase 3: FeatureGate Extension
**What:** Extend existing `FeatureGate` component with tier-based gating modes: `hide`, `lock`, `blur`, `locked-tab`. Add `UpgradePrompt` overlay component for blurred/locked content.
**Complexity:** Medium

**Files touched:**
- MODIFY: `components/FeatureGate.tsx` — add `requires` tier prop, `mode` prop, tier-based rendering
- NEW: `components/ui/UpgradePrompt.tsx` — inline upgrade CTA overlay
- MODIFY: `lib/features/useFeature.ts` — integrate tier checks (or deprecate in favor of tier)

**Details:**
- `FeatureGate` new props: `requires?: 'essential' | 'professional' | 'enterprise'`, `mode?: 'hide' | 'lock' | 'blur' | 'locked-tab'`
- `hide`: renders nothing (for settings pages)
- `lock`: greyed out + lock icon + tier badge (for sidebar items)
- `blur`: blurred preview + UpgradePrompt overlay (for dashboard widgets)
- `locked-tab`: disabled tab with upgrade tooltip (for analytics tabs)
- `UpgradePrompt`: lock icon, "Upgrade to [Tier]" message, "View Plans" button → `/settings/subscription`
- When `requires` prop is set, check `isTierAtLeast(requires)` from context

**Commit:** `feat(tiers): phase 3 - FeatureGate tier modes and UpgradePrompt`

**3-stage test gate:**
1. Unit: FeatureGate renders correctly for each mode when tier is below required
2. Integration: FeatureGate with `requires="professional"` + Essential tier → shows blur/lock/hide correctly
3. Workflow: Switch facility to Essential → verify FeatureGate hides/blurs/locks content across modes

---

### Phase 4: Sidebar & Navigation Gating
**What:** Apply tier-based gating to sidebar navigation and settings navigation. Locked items show tier badge, click navigates to page with upgrade prompt.
**Complexity:** Small

**Files touched:**
- MODIFY: `components/layouts/navigation-config.tsx` — add `requiredTier` to NavItem, render locked state
- MODIFY: `lib/settings-nav-config.ts` — add `requiredTier` to settings items, filter/lock by tier
- MODIFY: sidebar rendering component (within DashboardLayout or dedicated sidebar component)

**Details:**
- Add `requiredTier?: 'professional' | 'enterprise'` to `NavItem` and `SettingsNavItem` interfaces
- Items requiring higher tier: Financials (enterprise), Flags (professional), ORbit Score (professional), Data Quality (professional), SPD (professional), Integrations (enterprise)
- Locked items: greyed text + `Lock` icon + "Pro"/"Enterprise" badge pill
- Clicking locked item navigates to the page (page itself shows upgrade prompt via FeatureGate)
- Settings: hide entire categories for features not in tier (Financials category hidden for Essential/Professional)

**Commit:** `feat(tiers): phase 4 - sidebar and settings navigation tier gating`

**3-stage test gate:**
1. Unit: `getFilteredNavigation()` returns locked items for lower tiers
2. Integration: Essential tier user sees locked sidebar items with correct badges
3. Workflow: Essential user clicks locked "Financials" → navigates to page → sees upgrade prompt

---

### Phase 5: Engine — Template-Defaults (Tier-Aware)
**What:** Make `template-defaults.ts` tier-aware so Essential tier facilities can create templates with only `patient_in` + `patient_out`. Remove hardcoded enforcement of 7 required milestones for lower tiers.
**Complexity:** Small

**Files touched:**
- MODIFY: `lib/template-defaults.ts` — add `getRequiredMilestonesForTier()`, make `isRequiredMilestone()` tier-aware
- MODIFY: any template creation/validation UI that enforces required milestones

**Details:**
- `getRequiredMilestonesForTier(tier)`: Essential → `['patient_in', 'patient_out']`, Professional/Enterprise → current 7
- `getRequiredPhasesForTier(tier)`: Essential → `['pre_op', 'post_op']`, Professional/Enterprise → all 4
- Update template creation validation to accept tier parameter
- Existing "grandfathered" templates behavior already aligns with Essential needs

**Commit:** `feat(tiers): phase 5 - tier-aware template defaults`

**3-stage test gate:**
1. Unit: `getRequiredMilestonesForTier('essential')` returns `['patient_in', 'patient_out']`
2. Integration: Create template for Essential facility → validates with only 2 milestones
3. Workflow: Essential facility creates new template → only patient_in/patient_out required → saves successfully

---

### Phase 6: Engine — Flag Engine (Template-Driven)
**What:** Replace hardcoded `CORE_MILESTONE_SEQUENCE` with per-case template lookup. Add `canEvaluateMetric()` guard that skips flag rules whose prerequisite milestones aren't in the case's template.
**Complexity:** Large

**Files touched:**
- MODIFY: `lib/flagEngine.ts` — make `countMissingMilestones()` and `countSequenceViolations()` template-aware, add `canEvaluateMetric()`

**Details:**
- `countMissingMilestones(milestones, expectedMilestones)` — count missing from expected list, not CORE_MILESTONE_SEQUENCE
- `countSequenceViolations(milestones, expectedMilestones)` — only check order of milestones in the template
- `canEvaluateMetric(metric, templateMilestones)` — check if all prerequisite milestones for the metric exist in the template
- `extractMetricValue()` — skip metrics that can't be evaluated (return null instead of computing with missing data)
- Expected milestones derived from case's template: query `milestone_template_items` via `cases.milestone_template_id`, join to `facility_milestones.name`
- This data should be fetched once per case batch and passed through, not re-queried per metric

**Commit:** `feat(tiers): phase 6 - template-driven flag engine`

**3-stage test gate:**
1. Unit: `countMissingMilestones()` with Essential template (2 milestones) counts correctly
2. Integration: Flag evaluation for Essential case → skips surgical_time, anesthesia rules → only evaluates total_case_time, FCOTS, turnover
3. Workflow: Create case on Essential facility → flag engine runs → no false-positive missing milestone flags

---

### Phase 7: Engine — Data Quality Edge Function (Template-Driven)
**What:** Replace hardcoded `requiredMilestones` and `checkPairs` in the DQ edge function with per-case template lookup. Only flag milestones that are in the case's template but missing.
**Complexity:** Large

**Files touched:**
- MODIFY: `supabase/functions/run-data-quality-detection/index.ts` — template-driven milestone checks

**Details:**
- For each case, query `cases.milestone_template_id` → `milestone_template_items` → `facility_milestones.name` to get expected milestones
- Replace `const requiredMilestones = ['patient_in', 'incision', 'closing', 'patient_out']` with template-derived list
- Replace `checkPairs` with dynamically built pairs from template milestones (only check pairs where both milestones exist in template)
- Keep `patient_in`/`patient_out` impossible duration check (always in every template)
- Batch template lookups per facility to avoid N+1 queries
- Deploy via `supabase functions deploy run-data-quality-detection`

**Commit:** `feat(tiers): phase 7 - template-driven data quality edge function`

**3-stage test gate:**
1. Unit: Template lookup returns correct milestones for different templates
2. Integration: DQ detection on Essential case → only flags patient_in/patient_out missing, not incision/closing
3. Workflow: Run DQ detection nightly → Essential facility cases produce no false-positive missing milestone issues

---

### Phase 8: Engine — Dashboard Alerts (Template-Scoped)
**What:** Scope "missing milestones" dashboard alerts to only flag milestones expected by the case's template.
**Complexity:** Medium

**Files touched:**
- MODIFY: `lib/hooks/useDashboardAlerts.ts` — join to template items, only count milestones in template as "missing"

**Details:**
- Current logic: counts ANY null `case_milestones.recorded_at` for completed cases
- New logic: join `case_milestones` → `milestone_template_items` (via case's template) → only count milestones that are IN the template but have null `recorded_at`
- Essential tier cases with only patient_in/patient_out template → alert only fires if those 2 are missing
- Alternative approach: query through `cases.milestone_template_id` to `milestone_template_items` to know which facility_milestone_ids are expected

**Commit:** `feat(tiers): phase 8 - template-scoped dashboard alerts`

**3-stage test gate:**
1. Unit: Alert query returns 0 for Essential case with both milestones recorded
2. Integration: Essential case missing patient_out → alert fires; case missing incision → no alert (not in template)
3. Workflow: Dashboard for Essential facility → "Needs Attention" only shows relevant missing milestones

---

### Phase 9: Dashboard Widget Gating
**What:** Gate dashboard widgets by tier — blur Facility Score ring, Insights section for Essential. Limit "Needs Attention" for Essential (no flags/DQ references).
**Complexity:** Small

**Files touched:**
- MODIFY: `app/dashboard/PageClient.tsx` — wrap widgets in FeatureGate with blur mode

**Details:**
- Facility Score ring: `<FeatureGate requires="professional" mode="blur">` — shows blurred ring with UpgradePrompt
- Insights section: `<FeatureGate requires="professional" mode="blur">`
- Needs Attention panel: hide flag-related and DQ-related items for Essential (keep delayed cases)
- KPI cards: all 5 visible for Essential (cases, utilization, turnover, on-time starts — all calculable from patient_in/out); Score card hidden/blurred
- Room Status cards: visible for all tiers

**Commit:** `feat(tiers): phase 9 - dashboard widget tier gating`

**3-stage test gate:**
1. Unit: FeatureGate renders blur overlay for Essential tier on Score ring
2. Integration: Essential dashboard → Score ring blurred, KPI cards visible, Insights blurred
3. Workflow: Essential user views dashboard → sees operational data, upgrade prompts for premium widgets

---

### Phase 10: Analytics Page Gating
**What:** Gate analytics page tabs and sections by tier. Surgeon Performance, Block Utilization, KPIs, and Financials pages.
**Complexity:** Medium

**Files touched:**
- MODIFY: `app/analytics/surgeons/PageClient.tsx` — blur milestone phases, lock Day Analysis tab
- MODIFY: `app/analytics/block-utilization/PageClient.tsx` — blur "What Fits", capacity insights
- MODIFY: `app/analytics/kpi/PageClient.tsx` — blur advanced KPIs, insights panel
- MODIFY: `app/analytics/financials/PageClient.tsx` — entire page gated (already permission-gated, add tier gate)

**Details:**
- Surgeon Performance: Overview tab — case counts + OR time visible for all; milestone phase durations + subphase chart blurred for Essential. Day Analysis tab locked for Essential.
- Block Utilization: Summary metrics + surgeon table visible; "What Fits" suggestions + capacity insights blurred for Essential. Room Utilization visible for all.
- KPIs: Basic KPIs (FCOTS, turnover, volume, room utilization) visible; advanced KPIs + insights panel blurred for Essential.
- Financials: entire page wrapped in `<FeatureGate requires="enterprise" mode="hide">` (already hidden via sidebar gating + permission gating, this adds defense-in-depth)

**Commit:** `feat(tiers): phase 10 - analytics page tier gating`

**3-stage test gate:**
1. Unit: Surgeon page renders locked Day Analysis tab for Essential tier
2. Integration: Essential user on KPIs page → basic KPIs visible, advanced blurred with upgrade CTA
3. Workflow: Essential user navigates analytics → sees available data, clear upgrade paths for premium sections

---

### Phase 11: Case Form & Drawer Gating
**What:** Gate case form fields and drawer tabs by tier. Hide financial fields, non-template milestones, complexity scoring for Essential.
**Complexity:** Small

**Files touched:**
- MODIFY: `components/cases/CaseForm.tsx` — hide complexity selector for Essential, keep payer visible
- MODIFY: `components/cases/CaseDrawer.tsx` — tier-gate financial tab, add tier checks alongside permission checks
- MODIFY: `components/cases/CaseDrawerMilestones.tsx` — only show milestones from case's template (already template-driven via case_milestones, verify behavior)

**Details:**
- CaseForm: hide `CaseComplexitySelector` for Essential tier; hide implant cost / financial note fields (if they exist in form) for Essential + Professional; keep payer field visible for all
- CaseDrawer: financial tab requires `isTierAtLeast('enterprise')` in addition to `can('tab.case_financials')`; flags tab requires `isTierAtLeast('professional')`; validation (DQ) tab requires `isTierAtLeast('professional')`
- Milestone display already scoped to case_milestones (which come from template) — verify this is correct for Essential cases with only 2 milestones

**Commit:** `feat(tiers): phase 11 - case form and drawer tier gating`

**3-stage test gate:**
1. Unit: CaseForm hides complexity selector when tier is Essential
2. Integration: Essential user opens case drawer → financial tab hidden, milestones tab shows only patient_in/patient_out
3. Workflow: Create case on Essential facility → form shows only relevant fields → drawer shows only relevant tabs

---

### Phase 12: Admin — Plan Management & Wizard
**What:** Global admin can assign plans to facilities. Facility list shows plan badge. Facility creation wizard includes plan selection step after name/basics.
**Complexity:** Medium

**Files touched:**
- MODIFY: `app/admin/facilities/PageClient.tsx` — add plan badge, plan filter
- MODIFY: `app/admin/facilities/[id]/PageClient.tsx` (or detail component) — plan assignment dropdown
- MODIFY: `app/admin/facilities/new/` — add plan selection step after name/basics
- MODIFY: `app/admin/PageClient.tsx` — add plan-based metrics to admin dashboard

**Details:**
- Facility list: show tier badge (Essential/Pro/Enterprise) alongside existing subscription_status badge; add tier filter dropdown
- Facility detail: plan assignment dropdown (triggers permission sync via DB trigger)
- Facility creation wizard: new step after name/basics — plan selection with 3 cards showing feature comparison; selected plan determines initial permission template and default milestone template
- Admin dashboard: metrics by tier (how many facilities on each plan)

**Commit:** `feat(tiers): phase 12 - admin plan management and facility wizard`

**3-stage test gate:**
1. Unit: Plan badge renders correctly for each tier
2. Integration: Admin changes facility plan → permissions auto-sync → facility user sees updated feature access
3. Workflow: Admin creates new facility with Essential plan → facility has correct permissions + Basic Flow template → admin views tier distribution

---

### Phase 13: Subscription Settings Page
**What:** Wire up existing subscription page stub at `/settings/subscription`. Show current plan, feature comparison, usage stats, and upgrade request flow.
**Complexity:** Small

**Files touched:**
- MODIFY: `app/settings/subscription/PageClient.tsx` — replace hardcoded stub with live data
- MODIFY: `lib/settings-nav-config.ts` — remove `badge: 'soon'` from subscription item

**Details:**
- Current plan card: reads from `useSubscriptionTier()`, shows plan name, price, description
- Feature comparison grid: 3-column table showing what each tier includes (from `tier-config.ts`)
- Usage stats: cases this month, active users (from existing queries)
- Upgrade request: "Contact Sales" / "Request Upgrade" button → `mailto:support@orbitsurgical.com` (no self-service Stripe yet — out of scope)
- Remove "Coming Soon" banner
- Remove hardcoded plan data, use live DB data

**Commit:** `feat(tiers): phase 13 - subscription settings page`

**3-stage test gate:**
1. Unit: Page renders current plan from DB, not hardcoded data
2. Integration: Essential facility → page shows Essential plan highlighted, upgrade CTA for Professional/Enterprise
3. Workflow: Facility admin views subscription → sees current plan + features → clicks "Request Upgrade" → email opens

---

## Phase Summary

| # | Phase | Complexity | Key Files |
|---|-------|-----------|-----------|
| 1 | Database schema & permission sync | Medium | New migration |
| 2 | Tier hook & configuration | Medium | tier-config.ts, useSubscriptionTier.ts, UserContext.tsx |
| 3 | FeatureGate extension | Medium | FeatureGate.tsx, UpgradePrompt.tsx |
| 4 | Sidebar & navigation gating | Small | navigation-config.tsx, settings-nav-config.ts |
| 5 | Engine: template-defaults | Small | template-defaults.ts |
| 6 | Engine: flag engine | Large | flagEngine.ts |
| 7 | Engine: DQ edge function | Large | run-data-quality-detection/index.ts |
| 8 | Engine: dashboard alerts | Medium | useDashboardAlerts.ts |
| 9 | Dashboard widget gating | Small | dashboard/PageClient.tsx |
| 10 | Analytics page gating | Medium | surgeons, block-util, kpi, financials PageClient.tsx |
| 11 | Case form & drawer gating | Small | CaseForm.tsx, CaseDrawer.tsx |
| 12 | Admin plan management & wizard | Medium | admin facilities pages |
| 13 | Subscription settings page | Small | settings/subscription/PageClient.tsx |

**Total: 13 phases** (5 small, 6 medium, 2 large)
