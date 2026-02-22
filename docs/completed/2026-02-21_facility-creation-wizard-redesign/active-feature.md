# Feature: Facility Creation Wizard Redesign

## Goal
Complete overhaul of the facility creation wizard at `/admin/facilities/new`. The current 1,555-line monolithic file manually copies 9 template types inline while missing 4+ additional template categories (analytics, payers, notifications, flag rules). The redesign consolidates all template seeding into a single extended RPC, adds all missing template categories, decomposes into clean step components, and delivers a professional 5-step wizard with full shadcn/ui integration.

## Requirements
- All 13+ global admin template categories selectable during facility creation
- Single `seed_facility_with_templates()` RPC call with JSONB config for selective seeding
- 5-step wizard: Facility Details → Administrator → Clinical Templates → Operational Templates → Review
- Decomposed architecture: parent WizardShell + individual step components
- Full shadcn/ui component usage (Input, Select, Checkbox, Card, Badge, Button)
- Template categories show counts, default to all selected
- No OR rooms in wizard (handled by separate "get started" flow)
- Admin user required at creation
- Existing invite flow preserved

## Constraints
- Must use `useSupabaseQuery` pattern for data fetching where applicable
- Must filter by `facility_id` (RLS)
- No `any` types
- Structured logging via `lib/logger.ts`
