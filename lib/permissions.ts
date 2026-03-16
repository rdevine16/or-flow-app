// lib/permissions.ts
// Single source of truth for all permission keys.
// Provides IDE autocomplete and compile-time typo prevention.
// Mirrors the `permissions` table in the database.

export const PERMISSION_KEYS = {
  // ── Cases ──────────────────────────────────────────
  CASES_VIEW: 'cases.view',
  CASES_CREATE: 'cases.create',
  CASES_EDIT: 'cases.edit',
  CASES_DELETE: 'cases.delete',

  // ── Case Operations ────────────────────────────────
  MILESTONES_VIEW: 'milestones.view',
  MILESTONES_RECORD: 'milestones.record',
  MILESTONES_EDIT: 'milestones.edit',
  FLAGS_VIEW: 'flags.view',
  FLAGS_CREATE: 'flags.create',
  FLAGS_EDIT: 'flags.edit',
  FLAGS_DELETE: 'flags.delete',
  DELAYS_VIEW: 'delays.view',
  DELAYS_CREATE: 'delays.create',
  DELAYS_EDIT: 'delays.edit',
  DELAYS_DELETE: 'delays.delete',
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_DELETE: 'staff.delete',
  COMPLEXITY_VIEW: 'complexity.view',
  COMPLEXITY_CREATE: 'complexity.create',
  COMPLEXITY_EDIT: 'complexity.edit',
  IMPLANTS_VIEW: 'implants.view',
  IMPLANTS_CREATE: 'implants.create',
  IMPLANTS_EDIT: 'implants.edit',
  IMPLANTS_DELETE: 'implants.delete',

  // ── Case Tabs ──────────────────────────────────────
  TAB_CASE_FINANCIALS: 'tab.case_financials',
  TAB_CASE_MILESTONES: 'tab.case_milestones',
  TAB_CASE_FLAGS: 'tab.case_flags',
  TAB_CASE_VALIDATION: 'tab.case_validation',

  // ── Financials ─────────────────────────────────────
  FINANCIALS_VIEW: 'financials.view',
  FLAGS_FINANCIAL: 'flags.financial',

  // ── Analytics ──────────────────────────────────────
  ANALYTICS_VIEW: 'analytics.view',
  SCORES_VIEW: 'scores.view',

  // ── Scheduling ─────────────────────────────────────
  SCHEDULING_VIEW: 'scheduling.view',
  SCHEDULING_CREATE: 'scheduling.create',
  SCHEDULING_EDIT: 'scheduling.edit',
  SCHEDULING_DELETE: 'scheduling.delete',

  // ── Rooms ──────────────────────────────────────────
  ROOMS_VIEW: 'rooms.view',

  // ── SPD ────────────────────────────────────────────
  SPD_VIEW: 'spd.view',

  // ── Data Quality ───────────────────────────────────
  DATA_QUALITY_VIEW: 'data_quality.view',

  // ── Staff Management ───────────────────────────────
  STAFF_MANAGEMENT_VIEW: 'staff_management.view',

  // ── Integrations ───────────────────────────────────
  INTEGRATIONS_VIEW: 'integrations.view',
  INTEGRATIONS_MANAGE: 'integrations.manage',

  // ── Settings (view) ────────────────────────────────
  SETTINGS_VIEW: 'settings.view',

  // ── Settings (granular) ────────────────────────────
  SETTINGS_GENERAL: 'settings.general',
  SETTINGS_ROOMS: 'settings.rooms',
  SETTINGS_PROCEDURES: 'settings.procedures',
  SETTINGS_MILESTONES: 'settings.milestones',
  SETTINGS_FLAGS: 'settings.flags',
  SETTINGS_DELAYS: 'settings.delays',
  SETTINGS_COMPLEXITIES: 'settings.complexities',
  SETTINGS_IMPLANT_COMPANIES: 'settings.implant_companies',
  SETTINGS_CANCELLATION_REASONS: 'settings.cancellation_reasons',
  SETTINGS_CLOSURES: 'settings.closures',
  SETTINGS_CHECKLIST: 'settings.checklist',
  SETTINGS_CHECKIN: 'settings.checkin',
  SETTINGS_SURGEON_PREFERENCES: 'settings.surgeon_preferences',
  SETTINGS_VOICE_COMMANDS: 'settings.voice_commands',
  SETTINGS_NOTIFICATIONS: 'settings.notifications',
  SETTINGS_DEVICE_REPS: 'settings.device_reps',
  SETTINGS_ANALYTICS: 'settings.analytics',
  SETTINGS_PERMISSIONS: 'settings.permissions',
  SETTINGS_SUBSCRIPTION: 'settings.subscription',
  SETTINGS_INTEGRATIONS: 'settings.integrations',

  // ── Financial Settings ─────────────────────────────
  SETTINGS_FINANCIALS_GENERAL: 'settings.financials_general',
  SETTINGS_FINANCIALS_COSTS: 'settings.financials_costs',
  SETTINGS_FINANCIALS_PAYERS: 'settings.financials_payers',
  SETTINGS_FINANCIALS_PRICING: 'settings.financials_pricing',
  SETTINGS_FINANCIALS_TARGETS: 'settings.financials_targets',
  SETTINGS_FINANCIALS_SURGEON_VARIANCE: 'settings.financials_surgeon_variance',

  // ── Users ──────────────────────────────────────────
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',

  // ── Admin ──────────────────────────────────────────
  AUDIT_VIEW: 'audit.view',
} as const

/** Union type of all valid permission key strings */
export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS]

/** Array of all permission key values (for runtime validation) */
export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSION_KEYS)
