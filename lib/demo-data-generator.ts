// lib/demo-data-generator-v2.ts
// ORbit Demo Data Generator v2
//
// Architecture: facility config is permanent, script only generates case-level data.
// Surgeon profiles come from the wizard UI with room assignments, procedure types, etc.
// Staff are assigned at the ROOM level per day: 1 nurse, 2 techs, 1 anesthesiologist.
// No staff member appears in two rooms on the same day.
// Users are NEVER deleted — purge only touches case-level records.

import { SupabaseClient } from '@supabase/supabase-js'
import { getLocalDateString } from '@/lib/date-utils'
import { getHolidayDateSet } from '@/lib/us-holidays'
import type { OutlierProfile } from '@/lib/demo-outlier-engine'
import {
  scheduleBadDays,
  computeLateStartDelay,
  computeCascadeDelay,
  adjustSurgicalTime as outlierAdjustSurgicalTime,
  adjustTurnoverTime as outlierAdjustTurnover,
  computeCallbackDelay as outlierComputeCallbackDelay,
} from '@/lib/demo-outlier-engine'
import { evaluateCasesBatch } from '@/lib/flagEngine'
import type { FlagRule, CaseWithFinancials } from '@/types/flag-settings'

// =====================================================
// TYPES
// =====================================================

/** Per-day room assignments: key = day of week (1=Mon…5=Fri), value = room IDs (max 2 for flip rooms) */
export type DayRoomMap = Record<number, string[]>

export interface SurgeonProfileInput {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[] // 1=Mon … 5=Fri
  dayRoomAssignments: DayRoomMap
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
  procedureTypeIds: string[]      // user-selected procedure types
  /** Outlier profile from wizard config. If omitted, no outliers are applied. */
  outlierProfile?: OutlierProfile
  /** User-configured cases per day range. If omitted, falls back to speed/specialty defaults. */
  casesPerDay?: { min: number; max: number }
}

interface ResolvedSurgeon extends SurgeonProfileInput {
  firstName: string
  lastName: string
  facilityId: string
  closingWorkflow: 'surgeon_closes' | 'pa_closes'
  closingHandoffMinutes: number
}

/** Map of "surgeonId::procedureTypeId" → expected_duration_minutes (surgeon-specific overrides) */
export type SurgeonDurationMap = Map<string, number>

export interface GenerationConfig {
  facilityId: string
  surgeonProfiles: SurgeonProfileInput[]
  monthsOfHistory: number
  purgeFirst: boolean
  createdByUserId?: string
  /** Surgeon-specific duration overrides from surgeon_procedure_duration table */
  surgeonDurations?: SurgeonDurationMap
}

export interface GenerationResult {
  success: boolean
  casesGenerated: number
  error?: string
  details?: {
    milestones: number; staff: number; implants: number
    cancelledCount: number; delayedCount: number; flaggedCount: number
    unvalidatedCount: number
  }
}

interface CaseRecord {
  id: string
  case_number: string
  facility_id: string
  scheduled_date: string
  start_time: string
  or_room_id: string | null
  surgeon_id: string
  procedure_type_id: string | null
  payer_id: string | null
  status_id: string
  created_at?: string
  created_by: string
  called_next_case_id?: string | null
  operative_side?: string | null
  call_time?: string | null
  called_back_at?: string | null
  is_excluded_from_metrics?: boolean
  surgeon_left_at?: string | null
  cancelled_at?: string | null
  cancellation_reason_id?: string | null
  data_validated?: boolean
}

interface MilestoneRecord {
  id?: string
  case_id: string
  facility_milestone_id: string
  recorded_at: string | null
  recorded_by?: string | null
  created_at?: string
}

interface StaffAssignmentRecord {
  case_id: string
  staff_id: string
  role_id: string
}

interface ImplantRecord {
  case_id: string
  implant_name: string
  implant_size: string
  manufacturer: string | null
}

export interface GenerationProgress {
  phase: string; current: number; total: number; message: string
}
export type ProgressCallback = (p: GenerationProgress) => void

// =====================================================
// TIMING PROFILES
// =====================================================

const BATCH_SIZE = 100

const SPEED_CONFIGS = {
  fast:    { casesPerDay: { min: 6, max: 8 }, startTime: '07:00', surgicalTime: { min: 28, max: 35 }, flipInterval: 60 },
  average: { casesPerDay: { min: 4, max: 6 }, startTime: '07:30', surgicalTime: { min: 48, max: 59 }, flipInterval: 90 },
  slow:    { casesPerDay: { min: 3, max: 4 }, startTime: '07:30', surgicalTime: { min: 65, max: 88 }, flipInterval: 0 },
}

const PROCEDURE_SURGICAL_TIMES: Record<string, { min: number; max: number }> = {
  'Distal Radius ORIF': { min: 45, max: 60 }, 'Carpal Tunnel Release': { min: 15, max: 25 },
  'Trigger Finger Release': { min: 10, max: 15 }, 'Wrist Arthroscopy': { min: 30, max: 45 },
  'TFCC Repair': { min: 35, max: 50 }, 'Lumbar Microdiscectomy': { min: 45, max: 60 },
  'ACDF': { min: 60, max: 90 }, 'Lumbar Laminectomy': { min: 50, max: 75 },
  'Posterior Cervical Foraminotomy': { min: 40, max: 55 }, 'Kyphoplasty': { min: 30, max: 45 },
}

const HAND_WRIST_CONFIG = { casesPerDay: { min: 5, max: 7 }, startTime: '07:30' }
const SPINE_CONFIG      = { casesPerDay: { min: 3, max: 5 }, startTime: '07:30' }

// =====================================================
// MILESTONE TEMPLATES (offsets from Patient In = 0)
// =====================================================

const JOINT_MS = {
  fast: {
    patient_in: 0, anes_start: 2, anes_end: 10, prep_drape_start: 12, prep_drape_complete: 18, incision: 20,
    closing: (st: number) => 20 + st, closing_complete: (st: number) => 20 + st + 6,
    patient_out: (st: number) => 20 + st + 10, room_cleaned: (st: number) => 20 + st + 20,
  },
  average: {
    patient_in: 0, anes_start: 3, anes_end: 15, prep_drape_start: 17, prep_drape_complete: 25, incision: 28,
    closing: (st: number) => 28 + st, closing_complete: (st: number) => 28 + st + 8,
    patient_out: (st: number) => 28 + st + 12, room_cleaned: (st: number) => 28 + st + 25,
  },
  slow: {
    patient_in: 0, anes_start: 4, anes_end: 18, prep_drape_start: 20, prep_drape_complete: 30, incision: 35,
    closing: (st: number) => 35 + st, closing_complete: (st: number) => 35 + st + 10,
    patient_out: (st: number) => 35 + st + 15, room_cleaned: (st: number) => 35 + st + 28,
  },
}

const HAND_MS = {
  patient_in: 0, prep_drape_start: 8, prep_drape_complete: 15, incision: 18,
  closing: (st: number) => 18 + st, closing_complete: (st: number) => 18 + st + 5,
  patient_out: (st: number) => 18 + st + 10, room_cleaned: (st: number) => 18 + st + 20,
}

const SPINE_MS = {
  patient_in: 0, anes_start: 3, anes_end: 18, prep_drape_start: 20, prep_drape_complete: 28, incision: 32,
  closing: (st: number) => 32 + st, closing_complete: (st: number) => 32 + st + 12,
  patient_out: (st: number) => 32 + st + 20, room_cleaned: (st: number) => 32 + st + 35,
}

// =====================================================
// IMPLANT SPECS
// =====================================================

const IMPLANT_SPECS: Record<string, Record<string, Record<string, { name: string; sizes: string[]; common: string[] }>>> = {
  'Stryker': {
    THA: {
      cup:   { name: 'Tritanium Cup', sizes: ['44mm','46mm','48mm','50mm','52mm','54mm','56mm','58mm','60mm'], common: ['52mm','54mm','56mm'] },
      stem:  { name: 'Accolade II', sizes: ['0','1','2','3','4','5','6','7','8','9','10','11'], common: ['3','4','5','6'] },
      head:  { name: 'V40 Head', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
      liner: { name: 'X3 Liner', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
    },
    TKA: {
      femur: { name: 'Triathlon Femur', sizes: ['1','2','3','4','5','6','7','8'], common: ['3','4','5','6'] },
      tibia: { name: 'Triathlon Tibia', sizes: ['1','2','3','4','5','6','7','8'], common: ['3','4','5','6'] },
      poly:  { name: 'Triathlon Poly', sizes: ['9mm','10mm','11mm','12mm','14mm','16mm'], common: ['10mm','11mm','12mm'] },
      patella: { name: 'Triathlon Patella', sizes: ['26mm','29mm','32mm','35mm','38mm','41mm'], common: ['32mm','35mm'] },
    },
  },
  'Zimmer Biomet': {
    THA: {
      cup:   { name: 'G7 Cup', sizes: ['44mm','46mm','48mm','50mm','52mm','54mm','56mm','58mm'], common: ['50mm','52mm','54mm'] },
      stem:  { name: 'Taperloc Complete', sizes: ['4','5','6','7','8','9','10','11','12','13'], common: ['7','8','9','10'] },
      head:  { name: 'Kinectiv Head', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
      liner: { name: 'E1 Liner', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
    },
    TKA: {
      femur: { name: 'Persona Femur', sizes: ['A','B','C','D','E','F','G','H'], common: ['C','D','E','F'] },
      tibia: { name: 'Persona Tibia', sizes: ['1','2','3','4','5','6','7'], common: ['3','4','5'] },
      poly:  { name: 'Persona Poly', sizes: ['9mm','10mm','11mm','12mm','14mm'], common: ['10mm','11mm'] },
      patella: { name: 'Persona Patella', sizes: ['S','M','L','XL'], common: ['M','L'] },
    },
  },
  'DePuy Synthes': {
    THA: {
      cup:   { name: 'Pinnacle Cup', sizes: ['44mm','46mm','48mm','50mm','52mm','54mm','56mm','58mm'], common: ['50mm','52mm','54mm'] },
      stem:  { name: 'Corail', sizes: ['8','9','10','11','12','13','14','15','16'], common: ['11','12','13','14'] },
      head:  { name: 'Articul/EZE Head', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
      liner: { name: 'Marathon Liner', sizes: ['28mm','32mm','36mm','40mm'], common: ['32mm','36mm'] },
    },
    TKA: {
      femur: { name: 'Attune Femur', sizes: ['1','2','3','4','5','6','7','8','9'], common: ['4','5','6','7'] },
      tibia: { name: 'Attune Tibia', sizes: ['1','2','3','4','5','6','7','8','9'], common: ['4','5','6','7'] },
      poly:  { name: 'Attune Poly', sizes: ['9mm','10mm','11mm','12mm','14mm'], common: ['10mm','11mm','12mm'] },
      patella: { name: 'Attune Patella', sizes: ['S','M','L','XL'], common: ['M','L'] },
    },
  },
}

// =====================================================
// PAYER DISTRIBUTION
// =====================================================

const PAYER_WEIGHTS: Record<string, number> = { 'Medicare': 0.45, 'BCBS': 0.30, 'Aetna': 0.125, 'UnitedHealthcare': 0.125 }

// =====================================================
// STAFF TYPES
// =====================================================

type StaffEntry = { userId: string; roleId: string }
type RoomDayStaff = { nurse: StaffEntry | null; techs: StaffEntry[]; anes: StaffEntry | null }

// =====================================================
// HOLIDAYS — computed dynamically via us-holidays.ts
// =====================================================

// Lazily computed for the date range in use (set during generateDemoData)
let holidayDateSet: Set<string> = new Set()

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function addMinutes(d: Date, m: number): Date { return new Date(d.getTime() + m * 60000) }
function formatTime(d: Date, tz?: string): string {
  if (tz) {
    // Convert UTC date back to facility local time for display
    const parts = d.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).split(':')
    return `${parts[0].padStart(2, '0')}:${parts[1]}`
  }
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
function isHoliday(d: Date): boolean { return holidayDateSet.has(getLocalDateString(d)) }
function isWeekend(d: Date): boolean { const dow = d.getUTCDay(); return dow === 0 || dow === 6 }
function dateKey(d: Date): string { return getLocalDateString(d) }

// Build a Date in UTC that represents a specific local time at the facility.
// E.g., facilityDate('2026-01-15', 7, 30, 'America/New_York') → UTC Date for 7:30 AM ET on Jan 15.
// We construct the local time string and use the timezone to find the correct UTC offset.
function facilityDate(dateStr: string, hours: number, minutes: number, tz: string): Date {
  // Build an ISO-like string for the desired local time
  const pad = (n: number) => String(n).padStart(2, '0')
  const localStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`
  // Use Intl to find the UTC offset for this timezone at this date
  // Create a reference date at noon UTC on this day to get the offset
  const refDate = new Date(`${dateStr}T12:00:00Z`)
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = refDate.toLocaleString('en-US', { timeZone: tz })
  const utcMs = new Date(utcStr).getTime()
  const tzMs = new Date(tzStr).getTime()
  const offsetMs = tzMs - utcMs  // positive means tz is ahead of UTC
  // Now construct the UTC date: local time minus offset = UTC
  const localMs = new Date(localStr + 'Z').getTime()  // treat localStr as if it were UTC
  return new Date(localMs - offsetMs)
}

function weightedChoice(items: string[], weights: number[]): string {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

function addOutlier(base: number, chance: number, range: { min: number; max: number }): number {
  return Math.random() < chance ? randomInt(range.min, range.max) : base
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// =====================================================
// PURGE — Only case-level data, NEVER users/config
// =====================================================

export async function purgeCaseData(
  supabase: SupabaseClient, facilityId: string, onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string; casesDeleted: number }> {
  try {
    onProgress?.({ phase: 'clearing', current: 5, total: 100, message: 'Fetching case IDs...' })
    const { data: cases } = await supabase.from('cases').select('id').eq('facility_id', facilityId)
    const count = cases?.length ?? 0

    if (cases && cases.length > 0) {
      const ids = cases.map(c => c.id)
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)
        await supabase.from('case_flags').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_complexities').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_device_activity').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_device_companies').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_implant_companies').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('metric_issues').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_implants').delete().in('case_id', batch)
        await supabase.from('case_milestones').delete().in('case_id', batch)
        await supabase.from('case_milestone_stats').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_completion_stats').delete().in('case_id', batch).then(() => {}, () => {})
        await supabase.from('case_staff').delete().in('case_id', batch)
        await supabase.from('case_delays').delete().in('case_id', batch).then(() => {}, () => {})
        onProgress?.({ phase: 'clearing', current: 10 + Math.floor((i / ids.length) * 60), total: 100, message: `Cleared ${Math.min(i + BATCH_SIZE, ids.length)} of ${ids.length}...` })
      }
    }

    onProgress?.({ phase: 'clearing', current: 70, total: 100, message: 'Deleting cases...' })
    // Clear self-referencing FK before delete to avoid constraint violations
    await supabase.from('cases').update({ called_next_case_id: null }).eq('facility_id', facilityId).not('called_next_case_id', 'is', null)
    const { error } = await supabase.from('cases').delete().eq('facility_id', facilityId)
    if (error) return { success: false, error: `Delete cases: ${error.message}`, casesDeleted: 0 }

    onProgress?.({ phase: 'clearing', current: 85, total: 100, message: 'Clearing computed averages...' })
    const { data: users } = await supabase.from('users').select('id').eq('facility_id', facilityId)
    if (users && users.length > 0) {
      const uids = users.map(u => u.id)
      await supabase.from('surgeon_procedure_averages').delete().in('surgeon_id', uids).then(() => {}, () => {})
      await supabase.from('surgeon_milestone_averages').delete().in('surgeon_id', uids).then(() => {}, () => {})
    }

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Purge complete!' })
    return { success: true, casesDeleted: count }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown', casesDeleted: 0 }
  }
}

// =====================================================
// DETAILED STATUS
// =====================================================

export async function getDetailedStatus(supabase: SupabaseClient, facilityId: string) {
  // Pre-fetch surgeon role ID to avoid fragile nested await inside Promise.all
  const { data: surgeonRole } = await supabase.from('user_roles').select('id').eq('name', 'Surgeon').single()
  const surgeonRoleId = surgeonRole?.id ?? ''

  const qs = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId)
      .eq('role_id', surgeonRoleId).eq('is_active', true),
    supabase.from('or_rooms').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('procedure_types').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('payers').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('delay_types').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('cost_categories').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('facility_milestones').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('cancellation_reasons').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('preop_checklist_fields').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('complexities').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
    supabase.from('facility_analytics_settings').select('id').eq('facility_id', facilityId).maybeSingle(),
    supabase.from('procedure_reimbursements').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('procedure_milestone_config').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('block_schedules').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('flag_rules').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('is_active', true),
  ])
  const s = (i: number) => qs[i]?.count ?? 0
  return {
    cases: s(0), surgeons: s(1), rooms: s(2), procedureTypes: s(3), payers: s(4),
    delayTypes: s(5), costCategories: s(6), facilityMilestones: s(7),
    cancellationReasons: s(8), preopChecklistFields: s(9), complexities: s(10),
    facilityAnalyticsSettings: !!qs[11]?.data,
    procedureReimbursements: s(12), procedureMilestoneConfig: s(13), blockSchedules: s(14),
    flagRules: s(15),
    milestones: 0, staff: 0, implants: 0,
  }
}

// =====================================================
// MAIN GENERATION
// =====================================================

export async function generateDemoData(
  supabase: SupabaseClient, config: GenerationConfig, onProgress?: ProgressCallback
): Promise<GenerationResult> {
  try {
    const { facilityId, surgeonProfiles, monthsOfHistory, purgeFirst, createdByUserId } = config

    // ── Purge ──
    if (purgeFirst) {
      onProgress?.({ phase: 'clearing', current: 0, total: 100, message: 'Purging...' })
      const pr = await purgeCaseData(supabase, facilityId, p => onProgress?.({ ...p, current: Math.floor(p.current * 0.15) }))
      if (!pr.success) return { success: false, casesGenerated: 0, error: `Purge: ${pr.error}` }
    }

    // ── Load facility dependencies ──
    onProgress?.({ phase: 'loading', current: 16, total: 100, message: 'Loading facility config...' })

    const { data: facility } = await supabase.from('facilities').select('id, name, case_number_prefix, timezone').eq('id', facilityId).single()
    if (!facility) return { success: false, casesGenerated: 0, error: 'Facility not found' }

    // Resolve created_by: use provided user, or find the facility admin
    let systemUserId: string | null = createdByUserId || null
    if (!systemUserId) {
      const { data: adminRole } = await supabase.from('user_roles').select('id').eq('name', 'facility_admin').single()
      if (adminRole) {
        const { data: adminUser } = await supabase.from('users').select('id').eq('facility_id', facilityId).eq('role_id', adminRole.id).eq('is_active', true).limit(1).single()
        if (adminUser) systemUserId = adminUser.id
      }
    }

    const { data: procedureTypes } = await supabase.from('procedure_types').select('id, name, expected_duration_minutes').eq('facility_id', facilityId).eq('is_active', true)
    if (!procedureTypes?.length) return { success: false, casesGenerated: 0, error: 'No procedure types' }

    let milestoneTypes: { id: string; name: string; source_milestone_type_id: string | null }[] = []
    const { data: fms } = await supabase.from('facility_milestones').select('id, name, source_milestone_type_id').eq('facility_id', facilityId).eq('is_active', true).order('display_order')
    if (fms?.length) milestoneTypes = fms
    else { const { data: gms } = await supabase.from('milestone_types').select('id, name').eq('is_active', true).order('display_order'); milestoneTypes = (gms || []).map(g => ({ ...g, source_milestone_type_id: g.id })) }
    if (!milestoneTypes.length) return { success: false, casesGenerated: 0, error: 'No milestone types' }

    // Load procedure_milestone_config: which milestones apply to each procedure type
    const { data: procMsConfig } = await supabase.from('procedure_milestone_config')
      .select('procedure_type_id, facility_milestone_id')
      .eq('facility_id', facilityId)
      .eq('is_enabled', true)
    // Map: procedure_type_id → Set<facility_milestone_id>
    const procMilestoneMap = new Map<string, Set<string>>()
    for (const row of (procMsConfig || [])) {
      if (!procMilestoneMap.has(row.procedure_type_id)) procMilestoneMap.set(row.procedure_type_id, new Set())
      procMilestoneMap.get(row.procedure_type_id)!.add(row.facility_milestone_id)
    }

    // Load global milestone_types for case_milestone_stats (the stats pipeline uses these IDs)
    const { data: globalMilestoneTypes } = await supabase.from('milestone_types').select('id, name').eq('is_active', true)
    // Build lookup: facility_milestone_id → global milestone_type_id (via matching name)
    const fmToMtMap = new Map<string, string>()
    for (const fm of milestoneTypes) {
      // Match by source_milestone_type_id first, then by name
      if (fm.source_milestone_type_id) {
        fmToMtMap.set(fm.id, fm.source_milestone_type_id)
      } else {
        const gmt = (globalMilestoneTypes || []).find(g => g.name === fm.name)
        if (gmt) fmToMtMap.set(fm.id, gmt.id)
      }
    }

    const { data: payers } = await supabase.from('payers').select('id, name').eq('facility_id', facilityId)
    if (!payers?.length) return { success: false, casesGenerated: 0, error: 'No payers' }

    const { data: completedStatus } = await supabase.from('case_statuses').select('id').eq('name', 'completed').single()
    const { data: scheduledStatus } = await supabase.from('case_statuses').select('id').eq('name', 'scheduled').maybeSingle()
    const { data: cancelledStatus } = await supabase.from('case_statuses').select('id').eq('name', 'cancelled').maybeSingle()
    if (!completedStatus) return { success: false, casesGenerated: 0, error: 'No "completed" status' }

    // Load Phase 6b dependencies: cancellation reasons, delay types, complexities, implant companies, flag rules
    const { data: cancReasons } = await supabase.from('cancellation_reasons').select('id').eq('facility_id', facilityId).eq('is_active', true)
    const { data: delayTypesList } = await supabase.from('delay_types').select('id').eq('facility_id', facilityId).eq('is_active', true)
    const { data: complexityList } = await supabase.from('complexities').select('id, name').eq('facility_id', facilityId).eq('is_active', true)
    const { data: implantCompanies } = await supabase.from('implant_companies').select('id, name').eq('facility_id', facilityId).eq('is_active', true)
    const { data: flagRulesList } = await supabase.from('flag_rules').select('*').eq('facility_id', facilityId).eq('is_active', true)

    // Load ALL staff by role
    const { data: allStaff } = await supabase.from('users').select('id, role_id, first_name, last_name').eq('facility_id', facilityId).eq('is_active', true)
    const { data: roleData } = await supabase.from('user_roles').select('id, name')
    const roleMap = new Map((roleData || []).map(r => [r.id, r.name]))

    const staffByRole = {
      // Pool anesthesiologists + CRNAs as anesthesia providers (round-robin across rooms)
      anesthesia: (allStaff || []).filter(u => {
        const role = roleMap.get(u.role_id)
        return role === 'anesthesiologist' || role === 'crna'
      }),
      nurses:     (allStaff || []).filter(u => roleMap.get(u.role_id) === 'nurse'),
      techs:      (allStaff || []).filter(u => roleMap.get(u.role_id) === 'tech'),
    }

    // ── Resolve surgeon profiles ──
    onProgress?.({ phase: 'resolving', current: 20, total: 100, message: 'Resolving surgeons...' })

    const resolved: ResolvedSurgeon[] = []
    for (const p of surgeonProfiles) {
      const { data: u } = await supabase.from('users').select('id, first_name, last_name, facility_id, closing_workflow, closing_handoff_minutes').eq('id', p.surgeonId).single()
      if (!u) { console.warn(`Surgeon ${p.surgeonId} not found`); continue }
      // Use wizard-selected procedure types (not name-matched)
      const validProcIds = p.procedureTypeIds.filter(pid => procedureTypes.some(pt => pt.id === pid))
      if (!validProcIds.length) { console.warn(`No valid procedures for Dr. ${u.last_name}`); continue }
      resolved.push({
        ...p,
        procedureTypeIds: validProcIds,
        firstName: u.first_name, lastName: u.last_name, facilityId: u.facility_id,
        closingWorkflow: u.closing_workflow || 'surgeon_closes',
        closingHandoffMinutes: u.closing_handoff_minutes || 0,
      })
    }
    if (!resolved.length) return { success: false, casesGenerated: 0, error: 'No valid surgeons' }

    // ── Build room-day staff assignments ──
    // Each room gets 1 nurse, 2 techs, 1 anesthesiologist for the entire day.
    // No staff member can be in two rooms on the same day.
    onProgress?.({ phase: 'planning', current: 23, total: 100, message: 'Planning staff assignments...' })

    const today = new Date()
    const startDate = new Date(today); startDate.setUTCMonth(startDate.getUTCMonth() - monthsOfHistory)
    const endDate = new Date(today); endDate.setUTCMonth(endDate.getUTCMonth() + 1)

    // Initialize holiday set for the generation date range (algorithmic, not hardcoded)
    holidayDateSet = getHolidayDateSet(startDate.getFullYear(), endDate.getFullYear())

    // Build surgeon duration lookup: "surgeonId::procedureTypeId" → duration
    const surgeonDurationMap: SurgeonDurationMap = config.surgeonDurations ?? new Map()

    // Collect all unique rooms used by surgeons (from per-day assignments)
    const allRoomIds = new Set<string>()
    for (const s of resolved) {
      for (const rooms of Object.values(s.dayRoomAssignments)) {
        for (const rid of rooms) allRoomIds.add(rid)
      }
    }

    // For each date, determine which rooms are active and assign staff
    // Key: "YYYY-MM-DD|roomId" → { nurse, techs, anes } with user_id + role_id
    const roomDayStaffMap = new Map<string, RoomDayStaff>()

    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      if (isWeekend(tempDate) || isHoliday(tempDate)) { tempDate.setUTCDate(tempDate.getUTCDate() + 1); continue }
      const dk = dateKey(tempDate)
      const dow = tempDate.getUTCDay() // 0=Sun … 6=Sat

      // Figure out which rooms are active today (from per-day assignments)
      const activeRoomIds: string[] = []
      for (const s of resolved) {
        if (!s.operatingDays.includes(dow)) continue
        const dayRooms = s.dayRoomAssignments[dow] || []
        for (const rid of dayRooms) {
          if (!activeRoomIds.includes(rid)) activeRoomIds.push(rid)
        }
      }

      // Assign staff to rooms — round-robin, no double-booking
      const usedNurses = new Set<string>()
      const usedTechs = new Set<string>()
      const usedAnes = new Set<string>()

      for (const roomId of activeRoomIds) {
        const nurse = staffByRole.nurses.find(n => !usedNurses.has(n.id))
        const tech1 = staffByRole.techs.find(t => !usedTechs.has(t.id))
        const tech2Candidates = staffByRole.techs.filter(t => !usedTechs.has(t.id) && t.id !== tech1?.id)
        const tech2 = tech2Candidates.length > 0 ? tech2Candidates[0] : null
        const anes = staffByRole.anesthesia.find((a: { id: string }) => !usedAnes.has(a.id))

        if (nurse) usedNurses.add(nurse.id)
        if (tech1) usedTechs.add(tech1.id)
        if (tech2) usedTechs.add(tech2.id)
        if (anes) usedAnes.add(anes.id)

        roomDayStaffMap.set(`${dk}|${roomId}`, {
          nurse: nurse ? { userId: nurse.id, roleId: nurse.role_id } : null,
          techs: [
            tech1 ? { userId: tech1.id, roleId: tech1.role_id } : null,
            tech2 ? { userId: tech2.id, roleId: tech2.role_id } : null,
          ].filter(Boolean) as StaffEntry[],
          anes: anes ? { userId: anes.id, roleId: anes.role_id } : null,
        })
      }
      tempDate.setUTCDate(tempDate.getUTCDate() + 1)
    }

    // ── Generate cases ──
    onProgress?.({ phase: 'generating', current: 25, total: 100, message: 'Generating cases...' })

    const allCases: CaseRecord[] = []
    const allMilestones: MilestoneRecord[] = []
    const allStaffAssignments: StaffAssignmentRecord[] = []
    const allImplants: ImplantRecord[] = []
    const allFlipLinks: { fromCaseId: string; toCaseId: string }[] = []

    let caseNum = 1
    const prefix = facility.case_number_prefix || 'DEMO'

    for (let si = 0; si < resolved.length; si++) {
      const surgeon = resolved[si]
      const result = generateSurgeonCases(
        surgeon, startDate, endDate, procedureTypes, milestoneTypes, procMilestoneMap, payers,
        roomDayStaffMap, completedStatus.id, scheduledStatus?.id || completedStatus.id, prefix, caseNum,
        facility.timezone || 'America/New_York', fmToMtMap, systemUserId, surgeonDurationMap,
        surgeon.outlierProfile
      )
      allCases.push(...result.cases)
      allMilestones.push(...result.milestones)
      allStaffAssignments.push(...result.staffAssignments)
      allImplants.push(...result.implants)
      allFlipLinks.push(...result.flipLinks)
      caseNum += result.cases.length
      onProgress?.({ phase: 'generating', current: 25 + Math.floor(((si + 1) / resolved.length) * 25), total: 100,
        message: `Dr. ${surgeon.lastName}: ${result.cases.length} cases` })
    }

    // ── Post-process: Cancelled cases (~3%) ──
    // Pre-day cancellations: no milestones, no staff, no implants
    const cancelledCaseIds = new Set<string>()
    if (cancelledStatus && cancReasons?.length) {
      const completedCasePool = allCases.filter(c => c.status_id === completedStatus.id)
      const cancelCount = Math.round(completedCasePool.length * 0.03)
      const toCancelIds = shuffle(completedCasePool).slice(0, cancelCount).map(c => c.id)

      for (const cid of toCancelIds) {
        cancelledCaseIds.add(cid)
        const caseRec = allCases.find(c => c.id === cid)!
        caseRec.status_id = cancelledStatus.id
        // Cancelled the evening before — 6-18 hours before scheduled start
        const schedDate = new Date(`${caseRec.scheduled_date}T${caseRec.start_time || '07:30'}:00Z`)
        caseRec.cancelled_at = new Date(schedDate.getTime() - randomInt(6, 18) * 3600000).toISOString()
        caseRec.cancellation_reason_id = randomChoice(cancReasons).id
        // Remove from milestones/staff/implants/flipLinks
        caseRec.surgeon_left_at = null
        caseRec.called_back_at = null
        caseRec.call_time = null
      }

      // Filter out cancelled case data from arrays (mutate in place for efficiency)
      const filterOut = <T extends { case_id: string }>(arr: T[]) => {
        let write = 0
        for (let r = 0; r < arr.length; r++) {
          if (!cancelledCaseIds.has(arr[r].case_id)) arr[write++] = arr[r]
        }
        arr.length = write
      }
      filterOut(allMilestones)
      filterOut(allStaffAssignments)
      filterOut(allImplants)
      // Remove flip links involving cancelled cases
      let flWrite = 0
      for (let r = 0; r < allFlipLinks.length; r++) {
        if (!cancelledCaseIds.has(allFlipLinks[r].fromCaseId) && !cancelledCaseIds.has(allFlipLinks[r].toCaseId)) {
          allFlipLinks[flWrite++] = allFlipLinks[r]
        }
      }
      allFlipLinks.length = flWrite

      onProgress?.({ phase: 'generating', current: 52, total: 100, message: `Marked ${cancelledCaseIds.size} cases as cancelled` })
    }

    // ── Bulk insert ──
    // Disable ALL triggers on cases + case_milestones to prevent trigger errors during bulk insert
    await supabase.rpc('disable_demo_triggers').then(() => {}, () => {
      // Fallback to old function if new one doesn't exist yet
      supabase.rpc('disable_demo_audit_triggers').then(() => {}, () => {})
    })

    onProgress?.({ phase: 'inserting', current: 55, total: 100, message: `Inserting ${allCases.length} cases...` })
    for (let i = 0; i < allCases.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('cases').insert(allCases.slice(i, i + BATCH_SIZE))
      if (error) { await supabase.rpc('enable_demo_triggers').then(() => {}, () => { supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {}) }); return { success: false, casesGenerated: 0, error: `Case insert batch ${i}: ${error.message}` } }
    }

    // Apply flip room links AFTER all cases exist (self-referencing FK)
    if (allFlipLinks.length > 0) {
      for (const link of allFlipLinks) {
        await supabase.from('cases').update({ called_next_case_id: link.toCaseId }).eq('id', link.fromCaseId)
      }
    }

    onProgress?.({ phase: 'inserting', current: 70, total: 100, message: `Inserting ${allMilestones.length} milestones...` })
    console.log(`[DEMO-GEN] Total milestones to insert: ${allMilestones.length}`)
    if (allMilestones.length > 0) {
      console.log('[DEMO-GEN] Sample milestone:', JSON.stringify(allMilestones[0]))
      console.log('[DEMO-GEN] fmToMtMap size:', fmToMtMap.size, 'entries:', [...fmToMtMap.entries()].map(([k,v]) => `${k}->${v}`).join(', '))
    }
    for (let i = 0; i < allMilestones.length; i += BATCH_SIZE) {
      const batch = allMilestones.slice(i, i + BATCH_SIZE)
      const { error, data } = await supabase.from('case_milestones').insert(batch).select('id')
      if (error) { console.error(`Milestone batch ${i} err:`, error.message, 'Code:', error.code, 'Details:', error.details, 'Sample:', JSON.stringify(batch[0])); }
      else { console.log(`[DEMO-GEN] Milestone batch ${i}: inserted ${data?.length ?? 'unknown'} rows`) }
    }

    // ── Build case_milestone_stats (bypasses triggers we disabled) ──
    // Groups milestones by case, finds patient_in time, computes minutes_from_start
    onProgress?.({ phase: 'inserting', current: 75, total: 100, message: 'Building milestone stats...' })
    const allMilestoneStats: Array<{
      case_id: string
      facility_id: string
      surgeon_id: string
      procedure_type_id: string | null
      milestone_type_id: string
      case_date: string
      minutes_from_start: number
      recorded_at: string
    }> = []

    // Build a case lookup from allCases for facility_id, surgeon_id, procedure_type_id, scheduled_date
    const caseMap = new Map<string, CaseRecord>()
    for (const c of allCases) caseMap.set(c.id, c)

    // Find patient_in facility_milestone_id
    const patientInFmId = milestoneTypes.find(m => m.name === 'patient_in')?.id

    // Group milestones by case_id
    const msByCaseId = new Map<string, MilestoneRecord[]>()
    for (const ms of allMilestones) {
      if (!ms.recorded_at) continue  // skip future case placeholders
      if (!msByCaseId.has(ms.case_id)) msByCaseId.set(ms.case_id, [])
      msByCaseId.get(ms.case_id)!.push(ms)
    }

    for (const [caseId, caseMilestones] of msByCaseId) {
      const caseData = caseMap.get(caseId)
      if (!caseData) continue

      // Find patient_in time for this case
      const piMs = caseMilestones.find((m) => m.facility_milestone_id === patientInFmId)
      if (!piMs) continue
      const piTime = new Date(piMs.recorded_at!).getTime()

      for (const ms of caseMilestones) {
        const mtId = fmToMtMap.get(ms.facility_milestone_id)
        if (!mtId) continue  // skip if no global milestone_type mapping

        const msTime = new Date(ms.recorded_at!).getTime()
        const minutesFromStart = Math.round(((msTime - piTime) / 60000) * 100) / 100

        allMilestoneStats.push({
          case_id: caseId,
          facility_id: caseData.facility_id,
          surgeon_id: caseData.surgeon_id,
          procedure_type_id: caseData.procedure_type_id,
          milestone_type_id: mtId,
          case_date: caseData.scheduled_date,
          minutes_from_start: minutesFromStart,
          recorded_at: ms.recorded_at!,
        })
      }
    }

    onProgress?.({ phase: 'inserting', current: 78, total: 100, message: `Inserting ${allMilestoneStats.length} milestone stats...` })
    for (let i = 0; i < allMilestoneStats.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('case_milestone_stats').insert(allMilestoneStats.slice(i, i + BATCH_SIZE))
      if (error) console.error(`MilestoneStats batch ${i} err:`, error.message, 'Sample:', JSON.stringify(allMilestoneStats[i]))
    }

    onProgress?.({ phase: 'inserting', current: 80, total: 100, message: `Inserting ${allStaffAssignments.length} staff...` })
    for (let i = 0; i < allStaffAssignments.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('case_staff').insert(allStaffAssignments.slice(i, i + BATCH_SIZE))
      if (error) console.error('Staff err:', error.message)
    }

    onProgress?.({ phase: 'inserting', current: 88, total: 100, message: `Inserting ${allImplants.length} implants...` })
    for (let i = 0; i < allImplants.length; i += BATCH_SIZE) {
      const { error } = await supabase.from('case_implants').insert(allImplants.slice(i, i + BATCH_SIZE))
      if (error) console.error('Implant err:', error.message)
    }

    await supabase.rpc('enable_demo_triggers').then(() => {}, () => { supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {}) })

    // ── Case delays (~5-8% of completed cases) ──
    let delayedCount = 0
    const nonCancelledCompleted = allCases.filter(c => c.status_id === completedStatus.id && !cancelledCaseIds.has(c.id))
    if (delayTypesList?.length) {
      const delayRate = 0.05 + Math.random() * 0.03
      const delayCount = Math.round(nonCancelledCompleted.length * delayRate)
      const toDelay = shuffle(nonCancelledCompleted).slice(0, delayCount)
      const delayRecords = toDelay.map(c => ({
        case_id: c.id,
        delay_type_id: randomChoice(delayTypesList).id,
        duration_minutes: randomInt(5, 45),
        notes: null as string | null,
        recorded_at: c.start_time ? `${c.scheduled_date}T${c.start_time}:00Z` : new Date().toISOString(),
      }))
      onProgress?.({ phase: 'inserting', current: 82, total: 100, message: `Inserting ${delayRecords.length} case delays...` })
      for (let i = 0; i < delayRecords.length; i += BATCH_SIZE) {
        const { error } = await supabase.from('case_delays').insert(delayRecords.slice(i, i + BATCH_SIZE))
        if (error) console.error('Delay insert err:', error.message)
      }
      delayedCount = delayRecords.length
    }

    // ── Case complexities (joint + spine cases) ──
    if (complexityList?.length) {
      const complexityRecords: { case_id: string; complexity_id: string }[] = []
      // Map complexity names for assignment logic
      const stdComplexity = complexityList.find(c => c.name.toLowerCase().includes('standard'))
      const complexComplexity = complexityList.find(c => c.name.toLowerCase().includes('complex'))

      for (const c of nonCancelledCompleted) {
        const surgeon = resolved.find(s => s.surgeonId === c.surgeon_id)
        if (!surgeon || surgeon.specialty === 'hand_wrist') continue

        if (surgeon.specialty === 'spine') {
          // Spine cases always get 'Complex' if available
          if (complexComplexity) complexityRecords.push({ case_id: c.id, complexity_id: complexComplexity.id })
        } else {
          // Joint: 70% Standard, 30% Complex
          const pick = Math.random() < 0.7 ? stdComplexity : complexComplexity
          if (pick) complexityRecords.push({ case_id: c.id, complexity_id: pick.id })
          // 10% chance of a second complexity factor
          if (Math.random() < 0.1) {
            const other = complexityList.find(cx => cx.id !== pick?.id)
            if (other) complexityRecords.push({ case_id: c.id, complexity_id: other.id })
          }
        }
      }

      if (complexityRecords.length > 0) {
        onProgress?.({ phase: 'inserting', current: 84, total: 100, message: `Inserting ${complexityRecords.length} case complexities...` })
        for (let i = 0; i < complexityRecords.length; i += BATCH_SIZE) {
          const { error } = await supabase.from('case_complexities').insert(complexityRecords.slice(i, i + BATCH_SIZE))
          if (error) console.error('Complexity insert err:', error.message)
        }
      }
    }

    // ── Device data (joint cases with implants → case_implant_companies) ──
    if (implantCompanies?.length) {
      const deviceRecords: { case_id: string; implant_company_id: string }[] = []
      // Build vendor name → implant_company_id lookup
      const vendorMap = new Map<string, string>()
      for (const ic of implantCompanies) vendorMap.set(ic.name, ic.id)

      for (const c of nonCancelledCompleted) {
        const surgeon = resolved.find(s => s.surgeonId === c.surgeon_id)
        if (!surgeon || surgeon.specialty !== 'joint' || !surgeon.preferredVendor) continue
        const companyId = vendorMap.get(surgeon.preferredVendor)
        if (companyId) deviceRecords.push({ case_id: c.id, implant_company_id: companyId })
      }

      if (deviceRecords.length > 0) {
        onProgress?.({ phase: 'inserting', current: 86, total: 100, message: `Inserting ${deviceRecords.length} device records...` })
        for (let i = 0; i < deviceRecords.length; i += BATCH_SIZE) {
          const { error } = await supabase.from('case_implant_companies').insert(deviceRecords.slice(i, i + BATCH_SIZE))
          if (error) console.error('Device insert err:', error.message)
        }
      }
    }

    // ── Validate completed cases (skip ~2% for data quality page) ──
    onProgress?.({ phase: 'finalizing', current: 88, total: 100, message: 'Validating completed cases for financial stats...' })
    const unvalidatedRate = 0.02
    const unvalidatedCount = Math.round(nonCancelledCompleted.length * unvalidatedRate)
    const unvalidatedIds = new Set(shuffle(nonCancelledCompleted).slice(0, unvalidatedCount).map(c => c.id))
    const toValidateIds = nonCancelledCompleted.filter(c => !unvalidatedIds.has(c.id)).map(c => c.id)

    console.log(`[DEMO-GEN] Validating ${toValidateIds.length} completed cases (${unvalidatedIds.size} left unvalidated for Data Quality)...`)
    for (let i = 0; i < toValidateIds.length; i += BATCH_SIZE) {
      const batch = toValidateIds.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('cases').update({ data_validated: true }).in('id', batch)
      if (error) console.error(`Validation batch ${i} err:`, error.message)
    }

    // ── Flag detection ──
    let flaggedCount = 0
    if (!flagRulesList?.length) {
      onProgress?.({ phase: 'detecting_flags', current: 91, total: 100,
        message: '⚠ No flag rules configured for this facility — skipping flag detection' })
    } else {
      onProgress?.({ phase: 'detecting_flags', current: 91, total: 100,
        message: `Running flag engine against ${flagRulesList.length} rules...` })

      // Build CaseWithFinancials from in-memory data for flag evaluation
      const casesForFlags: CaseWithFinancials[] = nonCancelledCompleted.map(c => {
        const caseMilestones = (msByCaseId.get(c.id) || []).map(ms => ({
          facility_milestone_id: ms.facility_milestone_id,
          recorded_at: ms.recorded_at!,
          facility_milestones: { name: milestoneTypes.find(mt => mt.id === ms.facility_milestone_id)?.name ?? '' },
        }))
        return {
          id: c.id,
          case_number: c.case_number,
          facility_id: c.facility_id,
          scheduled_date: c.scheduled_date,
          start_time: c.start_time,
          surgeon_id: c.surgeon_id,
          or_room_id: c.or_room_id,
          procedure_type_id: c.procedure_type_id,
          status_id: c.status_id,
          surgeon_left_at: c.surgeon_left_at,
          is_excluded_from_metrics: c.is_excluded_from_metrics,
          procedure_types: procedureTypes.find(pt => pt.id === c.procedure_type_id)
            ? { id: c.procedure_type_id!, name: procedureTypes.find(pt => pt.id === c.procedure_type_id)!.name }
            : null,
          case_milestones: caseMilestones,
        }
      })

      const flags = evaluateCasesBatch(casesForFlags, flagRulesList as FlagRule[])
      flaggedCount = flags.length

      if (flags.length > 0) {
        onProgress?.({ phase: 'detecting_flags', current: 93, total: 100,
          message: `Inserting ${flags.length} case flags...` })
        for (let i = 0; i < flags.length; i += BATCH_SIZE) {
          const { error } = await supabase.from('case_flags').insert(flags.slice(i, i + BATCH_SIZE))
          if (error) console.error('Flag insert err:', error.message)
        }
      }
    }

    onProgress?.({ phase: 'finalizing', current: 95, total: 100, message: 'Recalculating averages...' })
    await supabase.rpc('recalculate_surgeon_averages', { p_facility_id: facilityId }).then(() => {}, (e: Error) => console.warn('Avg recalc:', e.message))

    // Refresh materialized views so analytics reflect new data
    onProgress?.({ phase: 'finalizing', current: 97, total: 100, message: 'Refreshing analytics views...' })
    await supabase.rpc('refresh_all_stats').then(
      () => console.log('Refreshed all materialized views'),
      (e: Error) => console.warn('MatView refresh failed:', e.message)
    )

    // Verification counts
    const { count: dbCaseCount } = await supabase.from('cases').select('*', { count: 'exact', head: true }).eq('facility_id', facilityId)
    const { count: dbMsCount } = await supabase.from('case_milestones').select('*', { count: 'exact', head: true }).in('case_id', allCases.slice(0, 5).map(c => c.id))
    const { count: dbStatsCount } = await supabase.from('case_completion_stats').select('*', { count: 'exact', head: true }).eq('facility_id', facilityId)
    console.log(`[DEMO-GEN] Verification — DB cases: ${dbCaseCount}, milestones sample (5 cases): ${dbMsCount}, completion_stats: ${dbStatsCount}`)
    console.log(`[DEMO-GEN] Expected — cases: ${allCases.length}, milestones: ${allMilestones.length}, validated: ${toValidateIds.length}`)
    console.log(`[DEMO-GEN] Cancelled: ${cancelledCaseIds.size}, Delays: ${delayedCount}, Flags: ${flaggedCount}, Unvalidated: ${unvalidatedIds.size}`)

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' })
    return {
      success: true,
      casesGenerated: allCases.length,
      details: {
        milestones: allMilestones.length,
        staff: allStaffAssignments.length,
        implants: allImplants.length,
        cancelledCount: cancelledCaseIds.size,
        delayedCount,
        flaggedCount,
        unvalidatedCount: unvalidatedIds.size,
      },
    }
  } catch (e) {
    await supabase.rpc('enable_demo_triggers').then(() => {}, () => { supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {}) })
    return { success: false, casesGenerated: 0, error: e instanceof Error ? e.message : 'Unknown' }
  }
}

// =====================================================
// SPEED PROFILE MULTIPLIERS
// =====================================================

const SPEED_MULTIPLIER: Record<string, number> = { fast: 0.70, average: 1.00, slow: 1.30 }

// =====================================================
// CASE GENERATION PER SURGEON
// =====================================================

function generateSurgeonCases(
  surgeon: ResolvedSurgeon,
  startDate: Date,
  endDate: Date,
  allProcedureTypes: { id: string; name: string; expected_duration_minutes: number | null }[],
  milestoneTypes: { id: string; name: string; source_milestone_type_id: string | null }[],
  procMilestoneMap: Map<string, Set<string>>,
  payers: { id: string; name: string }[],
  roomDayStaffMap: Map<string, RoomDayStaff>,
  completedStatusId: string,
  scheduledStatusId: string,
  prefix: string,
  startingNumber: number,
  facilityTz: string,
  _fmToMtMap: Map<string, string>,
  createdByUserId: string | null,
  surgeonDurationMap: SurgeonDurationMap,
  outlierProfile?: OutlierProfile
) {
  const cases: CaseRecord[] = []
  const milestones: MilestoneRecord[] = []
  const staffAssignments: StaffAssignmentRecord[] = []
  const implants: ImplantRecord[] = []
  const flipLinks: { fromCaseId: string; toCaseId: string }[] = []

  let caseNum = startingNumber
  const surgeonProcs = allProcedureTypes.filter(pt => surgeon.procedureTypeIds.includes(pt.id))
  if (!surgeonProcs.length) return { cases, milestones, staffAssignments, implants, flipLinks }

  const speedCfg = SPEED_CONFIGS[surgeon.speedProfile]
  const speedMultiplier = SPEED_MULTIPLIER[surgeon.speedProfile] ?? 1.0
  const specialtyCfg = surgeon.specialty === 'hand_wrist' ? HAND_WRIST_CONFIG : surgeon.specialty === 'spine' ? SPINE_CONFIG : null
  const casesPerDay = surgeon.casesPerDay ?? specialtyCfg?.casesPerDay ?? speedCfg.casesPerDay
  const dayStartTime = specialtyCfg?.startTime ?? speedCfg.startTime

  // ── Pre-compute bad days for outlier engine ──
  let badDays = new Set<string>()
  if (outlierProfile && outlierProfile.badDaysPerMonth > 0) {
    // Collect all operating dates for this surgeon
    const operatingDates: string[] = []
    const scanDate = new Date(startDate)
    while (scanDate <= endDate) {
      const dow = scanDate.getUTCDay()
      if (surgeon.operatingDays.includes(dow) && !isWeekend(scanDate) && !isHoliday(scanDate)) {
        const dayRooms = surgeon.dayRoomAssignments[dow] || []
        if (dayRooms.length > 0) operatingDates.push(dateKey(scanDate))
      }
      scanDate.setUTCDate(scanDate.getUTCDate() + 1)
    }
    badDays = scheduleBadDays(operatingDates, outlierProfile.badDaysPerMonth)
  }

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dow = currentDate.getUTCDay()
    if (!surgeon.operatingDays.includes(dow) || isWeekend(currentDate) || isHoliday(currentDate)) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
      continue
    }

    // Get this day's room assignments from per-day map
    const dayRooms = surgeon.dayRoomAssignments[dow] || []
    if (dayRooms.length === 0) { currentDate.setUTCDate(currentDate.getUTCDate() + 1); continue }

    const isFlipRoomDay = dayRooms.length >= 2

    const dk = dateKey(currentDate)
    const numCases = randomInt(casesPerDay.min, casesPerDay.max)
    const [h, m] = dayStartTime.split(':').map(Number)
    let currentTime = facilityDate(dk, h, m, facilityTz)

    // ── Outlier: day-level late start check ──
    const isBadDay = badDays.has(dk)
    let dayLateStartDelay = 0
    if (outlierProfile) {
      dayLateStartDelay = computeLateStartDelay(outlierProfile, isBadDay)
    }
    const isLateStartDay = dayLateStartDelay > 0

    let roomIdx = 0
    let prevCaseLinkId: string | null = null

    for (let i = 0; i < numCases; i++) {
      // ── Outlier: cascade delay for subsequent cases on late start days ──
      if (isLateStartDay && i > 0 && outlierProfile) {
        currentTime = addMinutes(currentTime, computeCascadeDelay(outlierProfile, isBadDay))
      }

      const proc = randomChoice(surgeonProcs)

      // Determine which room this case is in (alternate for flip rooms)
      const roomId = isFlipRoomDay ? dayRooms[roomIdx % dayRooms.length] : dayRooms[0]

      // ── Surgical time: 3-tier resolution ──
      // 1. Surgeon-specific override (surgeon_procedure_duration table)
      // 2. Procedure type default (expected_duration_minutes)
      // 3. Hardcoded fallback (PROCEDURE_SURGICAL_TIMES or speed config)
      const SURGICAL_OVERHEAD: Record<string, number> = { joint: 40, spine: 48, hand_wrist: 30 }
      const overhead = SURGICAL_OVERHEAD[surgeon.specialty] ?? 40

      let surgicalTime: number
      const surgeonDuration = surgeonDurationMap.get(`${surgeon.surgeonId}::${proc.id}`)
      if (surgeonDuration != null) {
        // Tier 1: surgeon-specific override
        const derived = Math.max(15, surgeonDuration - overhead)
        surgicalTime = derived + randomInt(-5, 5)
      } else if (proc.expected_duration_minutes != null) {
        // Tier 2: procedure type default
        const derived = Math.max(15, proc.expected_duration_minutes - overhead)
        surgicalTime = derived + randomInt(-5, 5)
      } else {
        // Tier 3: hardcoded fallback
        const override = PROCEDURE_SURGICAL_TIMES[proc.name]
        surgicalTime = override ? randomInt(override.min, override.max) : randomInt(speedCfg.surgicalTime.min, speedCfg.surgicalTime.max)
      }

      // Apply speed profile scaling (fast=0.7x, slow=1.3x)
      surgicalTime = Math.round(surgicalTime * speedMultiplier)

      // ── Outlier: adjust surgical time (extended phases / fast cases) ──
      if (outlierProfile) {
        surgicalTime = outlierAdjustSurgicalTime(outlierProfile, surgicalTime, isBadDay)
      }

      // Start variance: 80% on time (±10min), 20% late
      // On late start days, first case gets significant additional delay
      let variance: number
      if (i === 0 && isLateStartDay) {
        // Late start: patient arrives dayLateStartDelay minutes late (+ small jitter)
        // Keep start_time at original schedule so analytics shows the FCOTS violation
        variance = dayLateStartDelay + randomInt(0, 5)
      } else {
        variance = Math.random() < 0.8 ? randomInt(-5, 10) : randomInt(10, 30)
      }
      const scheduledStart = new Date(currentTime)
      const patientInTime = addMinutes(scheduledStart, variance)

      const caseId = crypto.randomUUID?.() ?? `c-${caseNum}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const todayStr = dateKey(new Date())
      const isFuture = dk >= todayStr

      // Lookup anesthesia provider from room-day staff (pooled anesthesiologists + CRNAs)
      const rdStaffForCase = roomDayStaffMap.get(`${dk}|${roomId}`)
      const anesEntry = rdStaffForCase?.anes
      const skipAnes = surgeon.specialty === 'hand_wrist' && Math.random() < 0.3
      const anesId = (anesEntry && !skipAnes) ? anesEntry.userId : null

      // call_time: when patient was called to pre-op (before patient_in)
      const callTimeOffset = i === 0 ? randomInt(30, 45) : randomInt(15, 25)
      const callTime = addMinutes(scheduledStart, -callTimeOffset)

      const caseData: CaseRecord = {
        id: caseId,
        facility_id: surgeon.facilityId,
        case_number: `${prefix}-${String(caseNum).padStart(5, '0')}`,
        surgeon_id: surgeon.surgeonId,
        procedure_type_id: proc.id,
        or_room_id: roomId,
        scheduled_date: dk,
        start_time: formatTime(scheduledStart, facilityTz),
        status_id: isFuture ? scheduledStatusId : completedStatusId,
        payer_id: weightedChoice(payers.map(p => p.id), payers.map(p => PAYER_WEIGHTS[p.name] || 0.25)),
        operative_side: surgeon.specialty === 'spine' ? 'n/a'
          : surgeon.specialty === 'hand_wrist' ? randomChoice(['left', 'right'])
          : Math.random() < 0.08 ? 'bilateral' : randomChoice(['left', 'right']),
        call_time: isFuture ? null : callTime.toISOString(),
        is_excluded_from_metrics: false,
        surgeon_left_at: null,
        created_by: createdByUserId!,
      }

      cases.push(caseData)

      // ── Milestones ──
      const allowedMilestones = procMilestoneMap.get(proc.id)
      if (!isFuture) {
        // Completed cases: insert milestones WITH timestamps (speed-scaled)
        const cms = buildMilestones(caseId, surgeon, milestoneTypes, allowedMilestones, patientInTime, surgicalTime, speedMultiplier)
        milestones.push(...cms)

        // surgeon_left_at
        if (surgeon.closingWorkflow === 'pa_closes') {
          const closingMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'closing'))
          if (closingMs) caseData.surgeon_left_at = addMinutes(new Date(closingMs.recorded_at!), surgeon.closingHandoffMinutes).toISOString()
        } else {
          const ccMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'closing_complete'))
          if (ccMs) caseData.surgeon_left_at = ccMs.recorded_at
        }

        // ── Callback timing: PARTWAY THROUGH INCISION (not prep_drape_complete) ──
        // Good caller: 20-40% through surgical time → room ready when surgeon arrives
        // Average caller: 50-70% through surgical time → slight idle
        // Late caller: 80-100% through surgical time → significant idle
        if (isFlipRoomDay && i > 0) {
          const incisionMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'incision'))
          if (incisionMs) {
            const incisionTime = new Date(incisionMs.recorded_at!)
            let callbackPct: number
            if (surgeon.speedProfile === 'fast') {
              callbackPct = randomInt(20, 40) / 100  // good caller
            } else if (surgeon.speedProfile === 'slow') {
              callbackPct = randomInt(80, 100) / 100 // late caller
            } else {
              callbackPct = randomInt(50, 70) / 100  // average caller
            }
            const callbackOffset = Math.round(surgicalTime * callbackPct)
            let callbackTime = addMinutes(incisionTime, callbackOffset)

            // ── Outlier: additional callback delay for flip room transitions ──
            if (outlierProfile) {
              const extraDelay = outlierComputeCallbackDelay(outlierProfile, isBadDay)
              if (extraDelay > 0) {
                callbackTime = addMinutes(callbackTime, extraDelay)
              }
            }

            caseData.called_back_at = callbackTime.toISOString()
          }
        }

        // Link flip room cases (deferred — applied after all cases inserted)
        if (isFlipRoomDay && i > 0 && prevCaseLinkId) {
          flipLinks.push({ fromCaseId: prevCaseLinkId, toCaseId: caseId })
        }
        prevCaseLinkId = isFlipRoomDay ? caseId : null
      } else {
        // Future/scheduled cases: initialize milestones with recorded_at = NULL
        if (allowedMilestones) {
          for (const fmId of allowedMilestones) {
            milestones.push({ case_id: caseId, facility_milestone_id: fmId, recorded_at: null })
          }
        }
      }

      // ── Staff (all cases, not just completed) ──
      const rdKey = `${dk}|${roomId}`
      const rdStaff = roomDayStaffMap.get(rdKey)
      if (rdStaff) {
        if (rdStaff.nurse) staffAssignments.push({ case_id: caseId, staff_id: rdStaff.nurse.userId, role_id: rdStaff.nurse.roleId })
        for (const tech of rdStaff.techs) staffAssignments.push({ case_id: caseId, staff_id: tech.userId, role_id: tech.roleId })
        if (anesId && rdStaff.anes) staffAssignments.push({ case_id: caseId, staff_id: rdStaff.anes.userId, role_id: rdStaff.anes.roleId })
      }

      // ── Implants (joint only, all cases) ──
      if (surgeon.specialty === 'joint' && surgeon.preferredVendor) {
        const base = proc.name.replace('Mako ', '')
        const specs = IMPLANT_SPECS[surgeon.preferredVendor]?.[base]
        if (specs) {
          for (const [, spec] of Object.entries(specs)) {
            const size = Math.random() < 0.7 ? randomChoice(spec.common) : randomChoice(spec.sizes)
            implants.push({ case_id: caseId, implant_name: spec.name, implant_size: size, manufacturer: surgeon.preferredVendor })
          }
        }
      }

      // ── Advance time ──
      if (isFlipRoomDay) {
        // Flip room: advance based on surgeon_left_at (actual case timing) for correct cascading
        // Falls back to interval-based advance if milestones weren't generated
        const transitGap = randomInt(3, 8) // transit + scrub gap between rooms
        if (caseData.surgeon_left_at) {
          currentTime = addMinutes(new Date(caseData.surgeon_left_at), transitGap)
        } else {
          const interval = surgeonDurationMap.get(`${surgeon.surgeonId}::${proc.id}`)
            ?? proc.expected_duration_minutes
            ?? speedCfg.flipInterval
          currentTime = addMinutes(currentTime, (interval > 0 ? interval : 90) + transitGap)
        }
        roomIdx++
      } else {
        // Single room: advance based on patient_out milestone + turnover
        const poMs = milestones.filter(ms => ms.case_id === caseId).find(ms =>
          milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'patient_out'))
        // ── Outlier: long turnover adjustment ──
        let turnoverMinutes = randomInt(15, 25)
        if (outlierProfile) {
          turnoverMinutes = outlierAdjustTurnover(outlierProfile, turnoverMinutes, isBadDay)
        }
        currentTime = poMs ? addMinutes(new Date(poMs.recorded_at!), turnoverMinutes) : addMinutes(currentTime, 90)
      }

      caseNum++
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return { cases, milestones, staffAssignments, implants, flipLinks }
}

// =====================================================
// MILESTONE BUILDER (with speed profile scaling)
// =====================================================

function buildMilestones(
  caseId: string, surgeon: ResolvedSurgeon,
  milestoneTypes: { id: string; name: string; source_milestone_type_id: string | null }[],
  allowedMilestones: Set<string> | undefined,
  patientInTime: Date, surgicalTime: number, speedMultiplier: number
): MilestoneRecord[] {
  const ms: MilestoneRecord[] = []

  const getFmId = (name: string): string | null => {
    const mt = milestoneTypes.find(m => m.name === name)
    if (!mt) return null
    if (allowedMilestones && !allowedMilestones.has(mt.id)) return null
    return mt.id
  }

  // Use the 'average' template as base, then scale all offsets by speed multiplier
  // This replaces the old pattern of having separate fast/average/slow templates
  const baseTmpl = surgeon.specialty === 'joint' ? JOINT_MS.average
    : surgeon.specialty === 'hand_wrist' ? HAND_MS : SPINE_MS

  const base = new Date(patientInTime)
  let lastOff = -1

  const push = (name: string, offOrFn: number | ((st: number) => number), outlierChance = 0, outlierRange = { min: 0, max: 0 }) => {
    const fmId = getFmId(name); if (!fmId) return
    let off = typeof offOrFn === 'function' ? offOrFn(surgicalTime) : offOrFn
    // Apply speed multiplier to pre-incision offsets (prep time scales with surgeon speed)
    if (typeof offOrFn === 'number') off = Math.round(off * speedMultiplier)
    if (outlierChance > 0) off = addOutlier(off, outlierChance, { min: off + outlierRange.min, max: off + outlierRange.max })
    if (off <= lastOff) off = lastOff + 1
    lastOff = off
    ms.push({
      id: crypto.randomUUID(),
      case_id: caseId,
      facility_milestone_id: fmId,
      recorded_at: addMinutes(base, off).toISOString(),
      recorded_by: null,
      created_at: new Date().toISOString(),
    })
  }

  push('patient_in', baseTmpl.patient_in)
  if ('anes_start' in baseTmpl) push('anes_start', (baseTmpl as typeof JOINT_MS.average).anes_start)
  if ('anes_end' in baseTmpl) push('anes_end', (baseTmpl as typeof JOINT_MS.average).anes_end, 0.15, { min: 5, max: 12 })
  push('prep_drape_start', baseTmpl.prep_drape_start)
  push('prep_drape_complete', baseTmpl.prep_drape_complete)
  push('incision', baseTmpl.incision)
  // Post-incision offsets use functions of surgicalTime (already speed-scaled)
  push('closing', baseTmpl.closing, 0.15, { min: 5, max: 15 })
  push('closing_complete', baseTmpl.closing_complete, 0.15, { min: 5, max: 12 })
  push('patient_out', baseTmpl.patient_out)
  push('room_cleaned', baseTmpl.room_cleaned)

  return ms
}
