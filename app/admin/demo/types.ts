// app/admin/demo/types.ts
// Shared types, constants, and validation helpers for the Demo Data Wizard

// ============================================================================
// WIZARD STEP DEFINITIONS
// ============================================================================

export type DemoWizardStep = 1 | 2 | 3 | 4 | 5 | 6

export const DEMO_STEP_COUNT = 6

export const DEMO_STEP_LABELS: Record<DemoWizardStep, string> = {
  1: 'Facility',
  2: 'Surgeon Profiles',
  3: 'Room Schedule',
  4: 'Outlier Config',
  5: 'Review',
  6: 'Running',
}

export const DEMO_STEP_DESCRIPTIONS: Record<DemoWizardStep, string> = {
  1: 'Select facility and review config',
  2: 'Speed profiles, specialties, procedures',
  3: 'Per-day room assignments',
  4: 'Outlier types and frequencies',
  5: 'Confirm configuration',
  6: 'Generate demo data',
}

// ============================================================================
// SPEED PROFILES
// ============================================================================

export type SpeedProfile = 'fast' | 'average' | 'slow'

export const SPEED_PROFILE_DEFS: { value: SpeedProfile; label: string; desc: string; multiplier: number }[] = [
  { value: 'fast', label: 'Fast', desc: '~70% of template durations', multiplier: 0.7 },
  { value: 'average', label: 'Average', desc: '~100% of template durations', multiplier: 1.0 },
  { value: 'slow', label: 'Slow', desc: '~130% of template durations', multiplier: 1.3 },
]

// ============================================================================
// SPECIALTIES
// ============================================================================

export type Specialty = 'joint' | 'hand_wrist' | 'spine'

export const SPECIALTIES: { value: Specialty; label: string; icon: string }[] = [
  { value: 'joint', label: 'Joint Replacement', icon: '\u{1F9B4}' },
  { value: 'hand_wrist', label: 'Hand & Wrist', icon: '\u270B' },
  { value: 'spine', label: 'Spine', icon: '\u{1F9B7}' },
]

export const SPECIALTY_PROC_NAMES: Record<Specialty, string[]> = {
  joint: ['THA', 'TKA', 'Mako THA', 'Mako TKA'],
  hand_wrist: ['Distal Radius ORIF', 'Carpal Tunnel Release', 'Trigger Finger Release', 'Wrist Arthroscopy', 'TFCC Repair'],
  spine: ['Lumbar Microdiscectomy', 'ACDF', 'Lumbar Laminectomy', 'Posterior Cervical Foraminotomy', 'Kyphoplasty'],
}

// ============================================================================
// VENDOR OPTIONS
// ============================================================================

export const VENDORS = ['Stryker', 'Zimmer Biomet', 'DePuy Synthes'] as const
export type Vendor = typeof VENDORS[number]

// ============================================================================
// WEEKDAY HELPERS
// ============================================================================

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export const WEEKDAY_VALUES = [1, 2, 3, 4, 5] as const
export type DayOfWeek = 1 | 2 | 3 | 4 | 5

// ============================================================================
// OUTLIER TYPES
// ============================================================================

export type OutlierType = 'lateStarts' | 'longTurnovers' | 'extendedPhases' | 'callbackDelays' | 'fastCases'

export const OUTLIER_DEFS: { type: OutlierType; label: string; description: string }[] = [
  { type: 'lateStarts', label: 'Late Starts', description: 'First case starts 15-45 min late, cascading' },
  { type: 'longTurnovers', label: 'Long Turnovers', description: '30-60 min turnovers vs normal 15-20' },
  { type: 'extendedPhases', label: 'Extended Phases', description: 'Surgical time 40-80% over median' },
  { type: 'callbackDelays', label: 'Callback Delays', description: 'Surgeon called back 10-25 min late' },
  { type: 'fastCases', label: 'Fast Cases', description: 'Cases finish 15-25% faster than median' },
]

export interface OutlierSetting {
  enabled: boolean
  /** % of cases/days affected (0-100) */
  frequency: number
  /** How far from normal: 1 = low, 2 = medium, 3 = high */
  magnitude: number
}

export const DEFAULT_OUTLIER_SETTING: OutlierSetting = {
  enabled: false,
  frequency: 30,
  magnitude: 2,
}

// ============================================================================
// SURGEON PROFILE (per-surgeon wizard config)
// ============================================================================

/** Room assignments per day of week. Key = day (1-5), value = room IDs (max 2) */
export type DayRoomAssignments = Partial<Record<DayOfWeek, string[]>>

export interface SurgeonProfile {
  surgeonId: string
  speedProfile: SpeedProfile
  specialty: Specialty
  operatingDays: DayOfWeek[]
  dayRoomAssignments: DayRoomAssignments
  procedureTypeIds: string[]
  preferredVendor: Vendor | null
  closingWorkflow: string | null
  closingHandoffMinutes: number | null
  outliers: Record<OutlierType, OutlierSetting>
  /** Bad days per month (0-3). All enabled outliers fire with max magnitude. */
  badDaysPerMonth: number
}

export function createDefaultOutlierProfile(): Record<OutlierType, OutlierSetting> {
  return {
    lateStarts: { ...DEFAULT_OUTLIER_SETTING },
    longTurnovers: { ...DEFAULT_OUTLIER_SETTING },
    extendedPhases: { ...DEFAULT_OUTLIER_SETTING },
    callbackDelays: { ...DEFAULT_OUTLIER_SETTING },
    fastCases: { ...DEFAULT_OUTLIER_SETTING },
  }
}

// ============================================================================
// FACILITY ENTITIES (fetched from API)
// ============================================================================

export interface DemoFacility {
  id: string
  name: string
  is_demo: boolean
  case_number_prefix: string | null
  timezone: string
}

export interface DemoSurgeon {
  id: string
  first_name: string
  last_name: string
  closing_workflow: string | null
  closing_handoff_minutes: number | null
}

export interface DemoORRoom {
  id: string
  name: string
}

export interface DemoProcedureType {
  id: string
  name: string
  expected_duration_minutes: number | null
}

// ============================================================================
// BLOCK SCHEDULE ENTRIES (fetched from API for auto-fill)
// ============================================================================

export interface BlockScheduleEntry {
  surgeon_id: string
  day_of_week: number // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string  // "07:00:00"
  end_time: string    // "15:00:00"
}

/** Parse block schedule entries into operating days + formatted time strings per surgeon */
export function parseBlockSchedules(
  blocks: BlockScheduleEntry[],
  surgeonId: string,
): { days: DayOfWeek[]; scheduleLabel: string } {
  const surgeonBlocks = blocks
    .filter((b) => b.surgeon_id === surgeonId && b.day_of_week >= 1 && b.day_of_week <= 5)
  const uniqueDays = [...new Set(surgeonBlocks.map((b) => b.day_of_week as DayOfWeek))].sort()

  const scheduleLabel = uniqueDays
    .map((d) => {
      const block = surgeonBlocks.find((b) => b.day_of_week === d)
      const dayLabel = WEEKDAY_LABELS[d - 1]
      if (block) {
        const start = block.start_time.slice(0, 5) // "07:00"
        const end = block.end_time.slice(0, 5)
        return `${dayLabel} ${start}-${end}`
      }
      return dayLabel
    })
    .join(', ')

  return { days: uniqueDays, scheduleLabel }
}

// ============================================================================
// SURGEON DURATION ENTRIES (fetched from API)
// ============================================================================

export interface SurgeonDurationEntry {
  surgeon_id: string
  procedure_type_id: string
  expected_duration_minutes: number
}

/** Build a lookup map: "surgeonId::procedureTypeId" → duration */
export function buildDurationMap(
  entries: SurgeonDurationEntry[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    map.set(`${e.surgeon_id}::${e.procedure_type_id}`, e.expected_duration_minutes)
  }
  return map
}

// ============================================================================
// CONFIG STATUS (facility readiness)
// ============================================================================

export interface ConfigStatusItem {
  label: string
  count: number
  required: boolean
}

export const CONFIG_STATUS_KEYS = [
  'surgeons',
  'rooms',
  'procedureTypes',
  'payers',
  'facilityMilestones',
  'flagRules',
  'cancellationReasons',
  'delayTypes',
  'cases',
] as const

export type ConfigStatusKey = typeof CONFIG_STATUS_KEYS[number]

export const CONFIG_STATUS_LABELS: Record<ConfigStatusKey, { label: string; required: boolean }> = {
  surgeons: { label: 'Surgeons', required: true },
  rooms: { label: 'OR Rooms', required: true },
  procedureTypes: { label: 'Procedures', required: true },
  payers: { label: 'Payers', required: true },
  facilityMilestones: { label: 'Milestones', required: true },
  flagRules: { label: 'Flag Rules', required: false },
  cancellationReasons: { label: 'Cancel Reasons', required: false },
  delayTypes: { label: 'Delay Types', required: false },
  cases: { label: 'Existing Cases', required: false },
}

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface DemoWizardState {
  facilityId: string | null
  monthsOfHistory: number
  purgeFirst: boolean
  surgeonProfiles: Record<string, SurgeonProfile>
}

export const DEFAULT_WIZARD_STATE: DemoWizardState = {
  facilityId: null,
  monthsOfHistory: 6,
  purgeFirst: true,
  surgeonProfiles: {},
}

// ============================================================================
// VALIDATION
// ============================================================================

export function isFacilityStepValid(state: DemoWizardState): boolean {
  return state.facilityId !== null
}

export function isSurgeonProfilesStepValid(
  profiles: Record<string, SurgeonProfile>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const entries = Object.entries(profiles)
  if (entries.length === 0) {
    errors.push('No surgeons configured')
    return { valid: false, errors }
  }

  for (const [, profile] of entries) {
    if (profile.operatingDays.length === 0) {
      errors.push(`Surgeon has no operating days`)
    }
    if (profile.procedureTypeIds.length === 0) {
      errors.push(`Surgeon has no procedures selected`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function isRoomScheduleStepValid(
  profiles: Record<string, SurgeonProfile>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [, profile] of Object.entries(profiles)) {
    for (const day of profile.operatingDays) {
      const rooms = profile.dayRoomAssignments[day]
      if (!rooms || rooms.length === 0) {
        errors.push(`Surgeon missing room assignment for day ${day}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================================
// CASE ESTIMATION
// ============================================================================

export function estimateTotalCases(
  profiles: Record<string, SurgeonProfile>,
  months: number,
): number {
  const workingDaysPerMonth = 22
  let total = 0
  for (const profile of Object.values(profiles)) {
    const daysPerMonth = (profile.operatingDays.length / 5) * workingDaysPerMonth
    const casesPerDay = profile.speedProfile === 'fast' ? 7
      : profile.speedProfile === 'slow' ? 3.5
      : 5
    total += Math.round(daysPerMonth * casesPerDay * (months + 1))
  }
  return total
}
