// lib/demo-data-generator-v2.ts
// ORbit Demo Data Generator v2
//
// Architecture: facility config is permanent, script only generates case-level data.
// Surgeon profiles come from the wizard UI with room assignments, procedure types, etc.
// Staff are assigned at the ROOM level per day: 1 nurse, 2 techs, 1 anesthesiologist.
// No staff member appears in two rooms on the same day.
// Users are NEVER deleted — purge only touches case-level records.

import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// TYPES
// =====================================================

export interface SurgeonProfileInput {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  usesFlipRooms: boolean
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[] // 1=Mon … 5=Fri
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
  primaryRoomId: string | null
  flipRoomId: string | null       // only when usesFlipRooms
  procedureTypeIds: string[]      // user-selected procedure types
}

interface ResolvedSurgeon extends SurgeonProfileInput {
  firstName: string
  lastName: string
  facilityId: string
  closingWorkflow: 'surgeon_closes' | 'pa_closes'
  closingHandoffMinutes: number
}

export interface GenerationConfig {
  facilityId: string
  surgeonProfiles: SurgeonProfileInput[]
  monthsOfHistory: number
  purgeFirst: boolean
}

export interface GenerationResult {
  success: boolean
  casesGenerated: number
  error?: string
  details?: { milestones: number; staff: number; implants: number }
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
// HOLIDAYS (US Federal 2024-2026)
// =====================================================

const HOLIDAYS = new Set([
  '2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25',
  '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25',
])

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
function isHoliday(d: Date): boolean { return HOLIDAYS.has(d.toISOString().split('T')[0]) }
function isWeekend(d: Date): boolean { const dow = d.getUTCDay(); return dow === 0 || dow === 6 }
function dateKey(d: Date): string { return d.toISOString().split('T')[0] }

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
  const qs = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId)
      .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()).data?.id ?? ''),
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
  ])
  const s = (i: number) => qs[i]?.count ?? 0
  return {
    cases: s(0), surgeons: s(1), rooms: s(2), procedureTypes: s(3), payers: s(4),
    delayTypes: s(5), costCategories: s(6), facilityMilestones: s(7),
    cancellationReasons: s(8), preopChecklistFields: s(9), complexities: s(10),
    facilityAnalyticsSettings: !!qs[11]?.data,
    procedureReimbursements: s(12), procedureMilestoneConfig: s(13), blockSchedules: s(14),
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
    const { facilityId, surgeonProfiles, monthsOfHistory, purgeFirst } = config

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

    const { data: procedureTypes } = await supabase.from('procedure_types').select('id, name').eq('facility_id', facilityId).eq('is_active', true)
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
    if (!completedStatus) return { success: false, casesGenerated: 0, error: 'No "completed" status' }

    // Load ALL staff by role
    const { data: allStaff } = await supabase.from('users').select('id, role_id, first_name, last_name').eq('facility_id', facilityId).eq('is_active', true)
    const { data: roleData } = await supabase.from('user_roles').select('id, name')
    const roleMap = new Map((roleData || []).map(r => [r.id, r.name]))

    const staffByRole = {
      anesthesiologists: (allStaff || []).filter(u => roleMap.get(u.role_id) === 'anesthesiologist'),
      nurses:            (allStaff || []).filter(u => roleMap.get(u.role_id) === 'nurse'),
      techs:             (allStaff || []).filter(u => roleMap.get(u.role_id) === 'tech'),
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

    // Collect all unique rooms used by surgeons
    const allRoomIds = new Set<string>()
    for (const s of resolved) {
      if (s.primaryRoomId) allRoomIds.add(s.primaryRoomId)
      if (s.usesFlipRooms && s.flipRoomId) allRoomIds.add(s.flipRoomId)
    }

    // For each date, determine which rooms are active and assign staff
    // Key: "YYYY-MM-DD|roomId" → { nurse, techs, anes } with user_id + role_id
    const roomDayStaffMap = new Map<string, RoomDayStaff>()

    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      if (isWeekend(tempDate) || isHoliday(tempDate)) { tempDate.setUTCDate(tempDate.getUTCDate() + 1); continue }
      const dk = dateKey(tempDate)
      const dow = tempDate.getUTCDay() // 0=Sun … 6=Sat

      // Figure out which rooms are active today
      const activeRoomIds: string[] = []
      for (const s of resolved) {
        if (!s.operatingDays.includes(dow)) continue
        if (s.primaryRoomId && !activeRoomIds.includes(s.primaryRoomId)) activeRoomIds.push(s.primaryRoomId)
        if (s.usesFlipRooms && s.flipRoomId && !activeRoomIds.includes(s.flipRoomId)) activeRoomIds.push(s.flipRoomId)
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
        const anes = staffByRole.anesthesiologists.find(a => !usedAnes.has(a.id))

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

    const allCases: any[] = []
    const allMilestones: any[] = []
    const allStaffAssignments: any[] = []
    const allImplants: any[] = []
    const allFlipLinks: { fromCaseId: string; toCaseId: string }[] = []

    let caseNum = 1
    const prefix = facility.case_number_prefix || 'DEMO'

    for (let si = 0; si < resolved.length; si++) {
      const surgeon = resolved[si]
      const result = generateSurgeonCases(
        surgeon, startDate, endDate, procedureTypes, milestoneTypes, procMilestoneMap, payers,
        roomDayStaffMap, completedStatus.id, scheduledStatus?.id || completedStatus.id, prefix, caseNum,
        facility.timezone || 'America/New_York', fmToMtMap
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
      const { error, data, count } = await supabase.from('case_milestones').insert(batch).select('id')
      if (error) { console.error(`Milestone batch ${i} err:`, error.message, 'Code:', error.code, 'Details:', error.details, 'Sample:', JSON.stringify(batch[0])); }
      else { console.log(`[DEMO-GEN] Milestone batch ${i}: inserted ${data?.length ?? 'unknown'} rows`) }
    }

    // ── Build case_milestone_stats (bypasses triggers we disabled) ──
    // Groups milestones by case, finds patient_in time, computes minutes_from_start
    onProgress?.({ phase: 'inserting', current: 75, total: 100, message: 'Building milestone stats...' })
    const allMilestoneStats: any[] = []

    // Build a case lookup from allCases for facility_id, surgeon_id, procedure_type_id, scheduled_date
    const caseMap = new Map<string, any>()
    for (const c of allCases) caseMap.set(c.id, c)

    // Find patient_in facility_milestone_id
    const patientInFmId = milestoneTypes.find(m => m.name === 'patient_in')?.id

    // Group milestones by case_id
    const msByCaseId = new Map<string, any[]>()
    for (const ms of allMilestones) {
      if (!ms.recorded_at) continue  // skip future case placeholders
      if (!msByCaseId.has(ms.case_id)) msByCaseId.set(ms.case_id, [])
      msByCaseId.get(ms.case_id)!.push(ms)
    }

    for (const [caseId, caseMilestones] of msByCaseId) {
      const caseData = caseMap.get(caseId)
      if (!caseData) continue

      // Find patient_in time for this case
      const piMs = caseMilestones.find((m: any) => m.facility_milestone_id === patientInFmId)
      if (!piMs) continue
      const piTime = new Date(piMs.recorded_at).getTime()

      for (const ms of caseMilestones) {
        const mtId = fmToMtMap.get(ms.facility_milestone_id)
        if (!mtId) continue  // skip if no global milestone_type mapping

        const msTime = new Date(ms.recorded_at).getTime()
        const minutesFromStart = Math.round(((msTime - piTime) / 60000) * 100) / 100

        allMilestoneStats.push({
          case_id: caseId,
          facility_id: caseData.facility_id,
          surgeon_id: caseData.surgeon_id,
          procedure_type_id: caseData.procedure_type_id,
          milestone_type_id: mtId,
          case_date: caseData.scheduled_date,
          minutes_from_start: minutesFromStart,
          recorded_at: ms.recorded_at,
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

    onProgress?.({ phase: 'finalizing', current: 92, total: 100, message: 'Recalculating averages...' })
    await supabase.rpc('recalculate_surgeon_averages', { p_facility_id: facilityId }).then(() => {}, (e: any) => console.warn('Avg recalc:', e.message))

    // Refresh materialized views so analytics reflect new data
    onProgress?.({ phase: 'finalizing', current: 96, total: 100, message: 'Refreshing analytics views...' })
    await supabase.rpc('refresh_all_stats').then(
      () => console.log('Refreshed all materialized views'),
      (e: any) => console.warn('MatView refresh failed:', e.message)
    )

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' })
    return { success: true, casesGenerated: allCases.length, details: { milestones: allMilestones.length, staff: allStaffAssignments.length, implants: allImplants.length } }
  } catch (e) {
    await supabase.rpc('enable_demo_triggers').then(() => {}, () => { supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {}) })
    return { success: false, casesGenerated: 0, error: e instanceof Error ? e.message : 'Unknown' }
  }
}

// =====================================================
// CASE GENERATION PER SURGEON
// =====================================================

function generateSurgeonCases(
  surgeon: ResolvedSurgeon,
  startDate: Date,
  endDate: Date,
  allProcedureTypes: { id: string; name: string }[],
  milestoneTypes: { id: string; name: string; source_milestone_type_id: string | null }[],
  procMilestoneMap: Map<string, Set<string>>,
  payers: { id: string; name: string }[],
  roomDayStaffMap: Map<string, RoomDayStaff>,
  completedStatusId: string,
  scheduledStatusId: string,
  prefix: string,
  startingNumber: number,
  facilityTz: string,
  fmToMtMap: Map<string, string>
) {
  const cases: any[] = []
  const milestones: any[] = []
  const staffAssignments: any[] = []
  const implants: any[] = []
  const flipLinks: { fromCaseId: string; toCaseId: string }[] = []

  let caseNum = startingNumber
  const surgeonProcs = allProcedureTypes.filter(pt => surgeon.procedureTypeIds.includes(pt.id))
  if (!surgeonProcs.length) return { cases, milestones, staffAssignments, implants, flipLinks }

  const speedCfg = SPEED_CONFIGS[surgeon.speedProfile]
  const specialtyCfg = surgeon.specialty === 'hand_wrist' ? HAND_WRIST_CONFIG : surgeon.specialty === 'spine' ? SPINE_CONFIG : null
  const casesPerDay = specialtyCfg?.casesPerDay ?? speedCfg.casesPerDay
  const dayStartTime = specialtyCfg?.startTime ?? speedCfg.startTime

  // Determine surgeon's rooms
  const primaryRoom = surgeon.primaryRoomId
  const flipRoom = surgeon.usesFlipRooms ? surgeon.flipRoomId : null
  if (!primaryRoom) return { cases, milestones, staffAssignments, implants, flipLinks }

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dow = currentDate.getUTCDay()
    if (!surgeon.operatingDays.includes(dow) || isWeekend(currentDate) || isHoliday(currentDate)) {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
      continue
    }

    const dk = dateKey(currentDate)
    const numCases = randomInt(casesPerDay.min, casesPerDay.max)
    const [h, m] = dayStartTime.split(':').map(Number)
    // Build start time in facility's local timezone → stored as UTC
    let currentTime = facilityDate(dk, h, m, facilityTz)

    // Track which staff we've already added per room for this day (avoid dupes per case)
    const roomStaffAdded = new Set<string>()
    let roomIdx = 0

    // Track previous case data for flip room callback calculation
    let prevCaseMilestones: any[] = []
    let prevCaseData: any = null
    let prevCaseLinkId: string | null = null  // for called_next_case_id deferred linking

    for (let i = 0; i < numCases; i++) {
      const proc = randomChoice(surgeonProcs)

      // Determine which room this case is in
      let roomId: string
      if (flipRoom) {
        roomId = roomIdx % 2 === 0 ? primaryRoom : flipRoom
      } else {
        roomId = primaryRoom
      }

      // Surgical time
      const override = PROCEDURE_SURGICAL_TIMES[proc.name]
      const surgicalTime = override ? randomInt(override.min, override.max) : randomInt(speedCfg.surgicalTime.min, speedCfg.surgicalTime.max)

      // Start variance: 80% on time (±10min), 20% late
      const variance = Math.random() < 0.8 ? randomInt(-5, 10) : randomInt(10, 30)
      const scheduledStart = new Date(currentTime)
      const patientInTime = addMinutes(scheduledStart, variance)

      const caseId = crypto.randomUUID?.() ?? `c-${caseNum}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      // Today's cases should be scheduled (not completed) — only past days get milestones
      const todayStr = dateKey(new Date())
      const isFuture = dk >= todayStr

      // Lookup anesthesiologist from room-day staff
      const rdStaffForCase = roomDayStaffMap.get(`${dk}|${roomId}`)
      const anesEntry = rdStaffForCase?.anes
      const skipAnes = surgeon.specialty === 'hand_wrist' && Math.random() < 0.3
      const anesId = (anesEntry && !skipAnes) ? anesEntry.userId : null

      // call_time: when patient was called to pre-op (before patient_in)
      // First case: ~30-45 min before scheduled start; subsequent: ~15-25 min before
      const callTimeOffset = i === 0 ? randomInt(30, 45) : randomInt(15, 25)
      const callTime = addMinutes(scheduledStart, -callTimeOffset)

      // Scheduled duration: expected total case time (patient_in → patient_out)
      const scheduledDuration = surgeon.specialty === 'hand_wrist'
        ? surgicalTime + randomInt(25, 35)    // hand: surgical + prep/close overhead
        : surgeon.specialty === 'spine'
        ? surgicalTime + randomInt(45, 60)    // spine: longer setup
        : surgicalTime + randomInt(35, 50)    // joint: anesthesia + prep + close

      const caseData: any = {
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
        anesthesiologist_id: anesId,
        call_time: isFuture ? null : callTime.toISOString(),
        scheduled_duration_minutes: scheduledDuration,
        is_excluded_from_metrics: false,
        surgeon_left_at: null,
      }

      cases.push(caseData)

      // ── Milestones ──
      const allowedMilestones = procMilestoneMap.get(proc.id)
      if (!isFuture) {
        // Completed cases: insert milestones WITH timestamps
        const cms = buildMilestones(caseId, surgeon, proc, milestoneTypes, allowedMilestones, patientInTime, surgicalTime, fmToMtMap)
        milestones.push(...cms)

        // surgeon_left_at
        if (surgeon.closingWorkflow === 'pa_closes') {
          const closingMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'closing'))
          if (closingMs) caseData.surgeon_left_at = addMinutes(new Date(closingMs.recorded_at), surgeon.closingHandoffMinutes).toISOString()
        } else {
          const ccMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'closing_complete'))
          if (ccMs) caseData.surgeon_left_at = ccMs.recorded_at
        }

        // ── Callback timing for flip room cases ──
        if (flipRoom && i > 0 && prevCaseData) {
          const pdcMs = cms.find(ms => milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'prep_drape_complete'))
          if (pdcMs) {
            const pdcTime = new Date(pdcMs.recorded_at)
            let callbackOffset: number
            if (surgeon.speedProfile === 'fast') {
              callbackOffset = randomInt(-3, 3)
            } else if (surgeon.speedProfile === 'slow') {
              callbackOffset = randomInt(5, 15)
            } else {
              callbackOffset = randomInt(-2, 8)
            }
            caseData.called_back_at = addMinutes(pdcTime, callbackOffset).toISOString()
          }
        }

        prevCaseMilestones = cms
        prevCaseData = caseData

        // Link flip room cases (deferred — applied after all cases inserted)
        if (flipRoom && i > 0 && prevCaseLinkId) {
          flipLinks.push({ fromCaseId: prevCaseLinkId, toCaseId: caseId })
        }
        prevCaseLinkId = flipRoom ? caseId : null
      } else {
        // Future/scheduled cases: initialize milestones with recorded_at = NULL
        // This matches the CaseForm.initializeCaseMilestones pattern
        if (allowedMilestones) {
          for (const fmId of allowedMilestones) {
            milestones.push({
              case_id: caseId,
              facility_milestone_id: fmId,
              milestone_type_id: fmToMtMap.get(fmId) || null,
              recorded_at: null,
            })
          }
        }
      }

      // ── Staff (all cases, not just completed) ──
      const rdKey = `${dk}|${roomId}`
      const rdStaff = roomDayStaffMap.get(rdKey)
      if (rdStaff) {
        if (rdStaff.nurse) staffAssignments.push({ case_id: caseId, user_id: rdStaff.nurse.userId, role_id: rdStaff.nurse.roleId })
        for (const tech of rdStaff.techs) staffAssignments.push({ case_id: caseId, user_id: tech.userId, role_id: tech.roleId })
        if (anesId && rdStaff.anes) staffAssignments.push({ case_id: caseId, user_id: rdStaff.anes.userId, role_id: rdStaff.anes.roleId })
      }

      // ── Implants (joint only, all cases) ──
      if (surgeon.specialty === 'joint' && surgeon.preferredVendor) {
        const base = proc.name.replace('Mako ', '')
        const specs = IMPLANT_SPECS[surgeon.preferredVendor]?.[base]
        if (specs) {
          for (const [comp, spec] of Object.entries(specs)) {
            const size = Math.random() < 0.7 ? randomChoice(spec.common) : randomChoice(spec.sizes)
            implants.push({
              case_id: caseId, implant_name: spec.name, implant_size: size,
              manufacturer: surgeon.preferredVendor,

            })
          }
        }
      }

      // Advance time
      if (flipRoom && speedCfg.flipInterval > 0) {
        currentTime = addMinutes(currentTime, speedCfg.flipInterval)
        roomIdx++
      } else {
        const poMs = milestones.filter(ms => ms.case_id === caseId).find(ms =>
          milestoneTypes.find(mt => mt.id === ms.facility_milestone_id && mt.name === 'patient_out'))
        currentTime = poMs ? addMinutes(new Date(poMs.recorded_at), randomInt(15, 25)) : addMinutes(currentTime, 90)
      }

      caseNum++
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return { cases, milestones, staffAssignments, implants, flipLinks }
}

// =====================================================
// MILESTONE BUILDER
// =====================================================

function buildMilestones(
  caseId: string, surgeon: ResolvedSurgeon, proc: { id: string; name: string },
  milestoneTypes: { id: string; name: string; source_milestone_type_id: string | null }[],
  allowedMilestones: Set<string> | undefined,
  patientInTime: Date, surgicalTime: number,
  fmToMtMap: Map<string, string>
): any[] {
  const ms: any[] = []

  // Resolve facility_milestone_id by name, but ONLY if it's in the procedure_milestone_config
  const getFmId = (name: string): string | null => {
    const mt = milestoneTypes.find(m => m.name === name)
    if (!mt) return null
    if (allowedMilestones && !allowedMilestones.has(mt.id)) return null
    return mt.id
  }

  const tmpl = surgeon.specialty === 'joint' ? JOINT_MS[surgeon.speedProfile]
    : surgeon.specialty === 'hand_wrist' ? HAND_MS : SPINE_MS

  const base = new Date(patientInTime)

  let lastOff = -1  // Track last offset to enforce chronological order

  const push = (name: string, offOrFn: number | ((st: number) => number), outlierChance = 0, outlierRange = { min: 0, max: 0 }) => {
    const fmId = getFmId(name); if (!fmId) return
    let off = typeof offOrFn === 'function' ? offOrFn(surgicalTime) : offOrFn
    if (outlierChance > 0) off = addOutlier(off, outlierChance, { min: off + outlierRange.min, max: off + outlierRange.max })
    // Ensure milestones never go backwards — each must be at least 1 min after the previous
    if (off <= lastOff) off = lastOff + 1
    lastOff = off
    ms.push({
      case_id: caseId,
      facility_milestone_id: fmId,
      milestone_type_id: fmToMtMap.get(fmId) || null,
      recorded_at: addMinutes(base, off).toISOString(),
    })
  }

  push('patient_in', tmpl.patient_in)
  if ('anes_start' in tmpl) push('anes_start', (tmpl as any).anes_start)
  if ('anes_end' in tmpl) push('anes_end', (tmpl as any).anes_end, 0.15, { min: 5, max: 12 })
  push('prep_drape_start', tmpl.prep_drape_start)
  push('prep_drape_complete', tmpl.prep_drape_complete)
  push('incision', tmpl.incision)
  push('closing', tmpl.closing, 0.15, { min: 5, max: 15 })
  push('closing_complete', tmpl.closing_complete, 0.15, { min: 5, max: 12 })
  push('patient_out', tmpl.patient_out)
  push('room_cleaned', tmpl.room_cleaned)

  return ms
}
