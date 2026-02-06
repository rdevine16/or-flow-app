// lib/demo-data-generator-v2.ts
// ORbit Demo Data Generator — v2
// 
// Architecture change from v1:
// - Surgeons, staff, rooms, procedure types, payers are PRE-EXISTING in the facility
// - The script reads them from the DB rather than creating them
// - The wizard UI passes surgeon speed profiles (fast/average/slow) per surgeon
// - Purge only deletes case-level data, never configuration/users
//
// This avoids the "Failed to create surgeons" error from v1 and ensures all
// facility settings (milestone configs, reimbursements, cost categories, etc.)
// are preserved across regenerations.

import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// TYPES
// =====================================================

export interface SurgeonProfileInput {
  surgeonId: string
  speedProfile: 'fast' | 'average' | 'slow'
  usesFlipRooms: boolean
  specialty: 'joint' | 'hand_wrist' | 'spine'
  operatingDays: number[] // 1=Mon, 5=Fri
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
}

interface ResolvedSurgeon extends SurgeonProfileInput {
  firstName: string
  lastName: string
  facilityId: string
  closingWorkflow: 'surgeon_closes' | 'pa_closes'
  closingHandoffMinutes: number
  procedureTypeIds: string[]
}

export interface GenerationProgress {
  phase: string
  current: number
  total: number
  message: string
}

export type ProgressCallback = (progress: GenerationProgress) => void

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
  details?: {
    milestones: number
    staff: number
    implants: number
  }
}

// =====================================================
// CONFIGURATION — Timing Profiles
// =====================================================

const BATCH_SIZE = 100

const SPEED_CONFIGS = {
  fast: {
    casesPerDay: { min: 6, max: 8 },
    startTime: '07:00',
    surgicalTime: { min: 28, max: 35 },
    flipInterval: 60,
  },
  average: {
    casesPerDay: { min: 4, max: 6 },
    startTime: '07:30',
    surgicalTime: { min: 48, max: 59 },
    flipInterval: 90,
  },
  slow: {
    casesPerDay: { min: 3, max: 4 },
    startTime: '07:30',
    surgicalTime: { min: 65, max: 88 },
    flipInterval: 0,
  },
}

// Procedure-specific overrides (when non-zero, use instead of speed profile)
const PROCEDURE_SURGICAL_TIMES: Record<string, { min: number; max: number }> = {
  'Distal Radius ORIF': { min: 45, max: 60 },
  'Carpal Tunnel Release': { min: 15, max: 25 },
  'Trigger Finger Release': { min: 10, max: 15 },
  'Wrist Arthroscopy': { min: 30, max: 45 },
  'TFCC Repair': { min: 35, max: 50 },
  'Lumbar Microdiscectomy': { min: 45, max: 60 },
  'ACDF': { min: 60, max: 90 },
  'Lumbar Laminectomy': { min: 50, max: 75 },
  'Posterior Cervical Foraminotomy': { min: 40, max: 55 },
  'Kyphoplasty': { min: 30, max: 45 },
}

// Hand/wrist specialty has its own timing envelope regardless of speed profile
const HAND_WRIST_CONFIG = {
  casesPerDay: { min: 5, max: 7 },
  startTime: '07:30',
}

// Spine specialty
const SPINE_CONFIG = {
  casesPerDay: { min: 3, max: 5 },
  startTime: '07:30',
}

// =====================================================
// MILESTONE TEMPLATES — per specialty × speed
// =====================================================

// Offsets are minutes from Patient In (time 0)
const JOINT_MILESTONES = {
  fast: {
    patient_in: 0,
    anes_start: 2,
    anes_end: 10,
    prep_drape_start: 12,
    prep_drape_complete: 18,
    incision: 20,
    closing: (st: number) => 20 + st,
    closing_complete: (st: number) => 20 + st + 6,
    patient_out: (st: number) => 20 + st + 10,
    room_cleaned: (st: number) => 20 + st + 20,
  },
  average: {
    patient_in: 0,
    anes_start: 3,
    anes_end: 15,
    prep_drape_start: 17,
    prep_drape_complete: 25,
    incision: 28,
    closing: (st: number) => 28 + st,
    closing_complete: (st: number) => 28 + st + 8,
    patient_out: (st: number) => 28 + st + 12,
    room_cleaned: (st: number) => 28 + st + 25,
  },
  slow: {
    patient_in: 0,
    anes_start: 4,
    anes_end: 18,
    prep_drape_start: 20,
    prep_drape_complete: 30,
    incision: 35,
    closing: (st: number) => 35 + st,
    closing_complete: (st: number) => 35 + st + 10,
    patient_out: (st: number) => 35 + st + 15,
    room_cleaned: (st: number) => 35 + st + 28,
  },
}

const HAND_WRIST_MILESTONES = {
  patient_in: 0,
  prep_drape_start: 8,
  prep_drape_complete: 15,
  incision: 18,
  closing: (st: number) => 18 + st,
  closing_complete: (st: number) => 18 + st + 5,
  patient_out: (st: number) => 18 + st + 10,
  room_cleaned: (st: number) => 18 + st + 20,
}

const SPINE_MILESTONES = {
  patient_in: 0,
  anes_start: 3,
  anes_end: 18,
  prep_drape_start: 20,
  prep_drape_complete: 28,
  incision: 32,
  closing: (st: number) => 32 + st,
  closing_complete: (st: number) => 32 + st + 12,
  patient_out: (st: number) => 32 + st + 20,
  room_cleaned: (st: number) => 32 + st + 35,
}

// =====================================================
// IMPLANT SPECS
// =====================================================

const IMPLANT_SPECS: Record<string, Record<string, Record<string, { name: string; sizes: string[]; common: string[] }>>> = {
  'Stryker': {
    THA: {
      cup: { name: 'Tritanium Cup', sizes: ['44mm', '46mm', '48mm', '50mm', '52mm', '54mm', '56mm', '58mm', '60mm'], common: ['52mm', '54mm', '56mm'] },
      stem: { name: 'Accolade II', sizes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'], common: ['3', '4', '5', '6'] },
      head: { name: 'V40 Head', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
      liner: { name: 'X3 Liner', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
    },
    TKA: {
      femur: { name: 'Triathlon Femur', sizes: ['1', '2', '3', '4', '5', '6', '7', '8'], common: ['3', '4', '5', '6'] },
      tibia: { name: 'Triathlon Tibia', sizes: ['1', '2', '3', '4', '5', '6', '7', '8'], common: ['3', '4', '5', '6'] },
      poly: { name: 'Triathlon Insert', sizes: ['9mm', '10mm', '11mm', '12mm', '14mm', '16mm', '18mm'], common: ['10mm', '11mm', '12mm'] },
      patella: { name: 'Triathlon Patella', sizes: ['29mm', '32mm', '35mm', '38mm'], common: ['32mm', '35mm'] },
    },
  },
  'Zimmer Biomet': {
    THA: {
      cup: { name: 'G7 Cup', sizes: ['44mm', '46mm', '48mm', '50mm', '52mm', '54mm', '56mm', '58mm', '60mm'], common: ['50mm', '52mm', '54mm', '56mm'] },
      stem: { name: 'Taperloc', sizes: ['4', '6', '8', '10', '12', '14', '16', '18', '20'], common: ['10', '12', '14'] },
      head: { name: 'Biolox Head', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
      liner: { name: 'E1 Liner', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
    },
    TKA: {
      femur: { name: 'Persona Femur', sizes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], common: ['3', '4', '5', '6', '7'] },
      tibia: { name: 'Persona Tibia', sizes: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], common: ['3', '4', '5', '6'] },
      poly: { name: 'Persona Bearing', sizes: ['8mm', '9mm', '10mm', '11mm', '12mm', '13mm', '14mm'], common: ['10mm', '11mm', '12mm'] },
      patella: { name: 'Persona Patella', sizes: ['8mm', '10mm', '12mm', '14mm'], common: ['10mm', '12mm'] },
    },
  },
  'DePuy Synthes': {
    THA: {
      cup: { name: 'Pinnacle Cup', sizes: ['44mm', '46mm', '48mm', '50mm', '52mm', '54mm', '56mm', '58mm', '60mm'], common: ['50mm', '52mm', '54mm', '56mm'] },
      stem: { name: 'Corail Stem', sizes: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'], common: ['11', '12', '13', '14'] },
      head: { name: 'Articul/eze Head', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
      liner: { name: 'Marathon Liner', sizes: ['28mm', '32mm', '36mm', '40mm'], common: ['32mm', '36mm'] },
    },
    TKA: {
      femur: { name: 'ATTUNE Femur', sizes: ['3', '4', '5', '6', '7', '8', '9', '10'], common: ['5', '6', '7', '8'] },
      tibia: { name: 'ATTUNE Tibia', sizes: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], common: ['4', '5', '6', '7'] },
      poly: { name: 'ATTUNE Insert', sizes: ['8mm', '9mm', '10mm', '11mm', '12mm', '14mm', '16mm', '18mm'], common: ['10mm', '11mm', '12mm'] },
      patella: { name: 'ATTUNE Patella', sizes: ['29mm', '32mm', '35mm', '38mm', '41mm'], common: ['32mm', '35mm'] },
    },
  },
}

// Payer distribution
const PAYER_DISTRIBUTION: Record<string, number> = {
  'Medicare': 0.45,
  'BCBS': 0.30,
  'Aetna': 0.125,
  'UnitedHealthcare': 0.125,
}

// US Holidays (2024-2026)
const US_HOLIDAYS = new Set([
  '2024-07-04', '2024-09-02', '2024-11-28', '2024-11-29', '2024-12-25',
  '2025-01-01', '2025-05-26', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-25',
  '2026-01-01', '2026-05-25', '2026-07-03', '2026-09-07', '2026-11-26', '2026-11-27', '2026-12-25',
])

// Specialty → procedure name mappings
const SPECIALTY_PROCEDURES: Record<string, string[]> = {
  joint: ['THA', 'TKA', 'Mako THA', 'Mako TKA'],
  hand_wrist: ['Distal Radius ORIF', 'Carpal Tunnel Release', 'Trigger Finger Release', 'Wrist Arthroscopy', 'TFCC Repair'],
  spine: ['Lumbar Microdiscectomy', 'ACDF', 'Lumbar Laminectomy', 'Posterior Cervical Foraminotomy', 'Kyphoplasty'],
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function weightedRandomChoice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function addOutlier(base: number, chance: number, range: { min: number; max: number }): number {
  return Math.random() < chance ? randomInt(range.min, range.max) : base
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

function isHoliday(date: Date): boolean {
  return US_HOLIDAYS.has(date.toISOString().split('T')[0])
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`
}

// =====================================================
// PURGE — Only deletes case-level data
// =====================================================

export async function purgeCaseData(
  supabase: SupabaseClient,
  facilityId: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string; casesDeleted: number }> {
  try {
    onProgress?.({ phase: 'clearing', current: 5, total: 100, message: 'Fetching case IDs...' })

    const { data: cases } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)

    const caseCount = cases?.length ?? 0

    if (cases && cases.length > 0) {
      const caseIds = cases.map(c => c.id)

      for (let i = 0; i < caseIds.length; i += BATCH_SIZE) {
        const batch = caseIds.slice(i, i + BATCH_SIZE)

        // Delete child records first
        await supabase.from('case_implants').delete().in('case_id', batch)
        await supabase.from('case_milestones').delete().in('case_id', batch)
        await supabase.from('case_staff').delete().in('case_id', batch)
        // Also delete case delays if the table exists
        await supabase.from('case_delays').delete().in('case_id', batch).then(() => {}, () => {})

        const progress = 10 + Math.floor((i / caseIds.length) * 60)
        onProgress?.({ phase: 'clearing', current: progress, total: 100, message: `Cleared ${Math.min(i + BATCH_SIZE, caseIds.length)} of ${caseIds.length} cases...` })
      }
    }

    onProgress?.({ phase: 'clearing', current: 70, total: 100, message: 'Deleting cases...' })

    const { error: caseError } = await supabase
      .from('cases')
      .delete()
      .eq('facility_id', facilityId)

    if (caseError) {
      return { success: false, error: `Failed to delete cases: ${caseError.message}`, casesDeleted: 0 }
    }

    // Clear computed surgeon averages (these will be recalculated)
    onProgress?.({ phase: 'clearing', current: 85, total: 100, message: 'Clearing computed averages...' })

    const { data: facilityUsers } = await supabase
      .from('users')
      .select('id')
      .eq('facility_id', facilityId)

    if (facilityUsers && facilityUsers.length > 0) {
      const userIds = facilityUsers.map(u => u.id)
      await supabase.from('surgeon_procedure_averages').delete().in('surgeon_id', userIds).then(() => {}, () => {})
      await supabase.from('surgeon_milestone_averages').delete().in('surgeon_id', userIds).then(() => {}, () => {})
    }

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Purge complete!' })

    return { success: true, casesDeleted: caseCount }
  } catch (error) {
    console.error('Purge error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', casesDeleted: 0 }
  }
}

// =====================================================
// DETAILED STATUS — for the wizard config step
// =====================================================

export async function getDetailedStatus(
  supabase: SupabaseClient,
  facilityId: string
) {
  const queries = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('facility_id', facilityId).eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()).data?.id ?? ''),
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

  // Extract counts safely (some tables might not exist in all installations)
  const safe = (idx: number) => queries[idx]?.count ?? 0

  return {
    cases: safe(0),
    surgeons: safe(1),
    rooms: safe(2),
    procedureTypes: safe(3),
    payers: safe(4),
    delayTypes: safe(5),
    costCategories: safe(6),
    facilityMilestones: safe(7),
    cancellationReasons: safe(8),
    preopChecklistFields: safe(9),
    complexities: safe(10),
    facilityAnalyticsSettings: !!queries[11]?.data,
    procedureReimbursements: safe(12),
    procedureMilestoneConfig: safe(13),
    blockSchedules: safe(14),
    milestones: 0,
    staff: 0,
    implants: 0,
  }
}

// =====================================================
// MAIN GENERATION
// =====================================================

export async function generateDemoData(
  supabase: SupabaseClient,
  config: GenerationConfig,
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  try {
    const { facilityId, surgeonProfiles, monthsOfHistory, purgeFirst } = config

    // ── Step 0: Purge if requested ──
    if (purgeFirst) {
      onProgress?.({ phase: 'clearing', current: 0, total: 100, message: 'Purging existing data...' })
      const purgeResult = await purgeCaseData(supabase, facilityId, (p) => {
        onProgress?.({ ...p, current: Math.floor(p.current * 0.15) }) // 0-15% of total
      })
      if (!purgeResult.success) {
        return { success: false, casesGenerated: 0, error: `Purge failed: ${purgeResult.error}` }
      }
    }

    // ── Step 1: Load facility dependencies ──
    onProgress?.({ phase: 'loading', current: 16, total: 100, message: 'Loading facility configuration...' })

    const { data: facility } = await supabase
      .from('facilities')
      .select('id, name, case_number_prefix, timezone')
      .eq('id', facilityId)
      .single()

    if (!facility) return { success: false, casesGenerated: 0, error: 'Facility not found' }

    // Load rooms
    const { data: rooms } = await supabase
      .from('or_rooms')
      .select('id, name')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order')

    if (!rooms || rooms.length === 0) return { success: false, casesGenerated: 0, error: 'No OR rooms found — add rooms first' }

    // Load procedure types
    const { data: procedureTypes } = await supabase
      .from('procedure_types')
      .select('id, name')
      .eq('facility_id', facilityId)
      .eq('is_active', true)

    if (!procedureTypes || procedureTypes.length === 0) return { success: false, casesGenerated: 0, error: 'No procedure types found — add procedures first' }

    // Load milestone types (global or facility-level depending on your schema)
    // Try facility_milestones first, fallback to milestone_types
    let milestoneTypes: any[] = []
    const { data: facilityMilestones } = await supabase
      .from('facility_milestones')
      .select('id, name, source_milestone_type_id')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('display_order')

    if (facilityMilestones && facilityMilestones.length > 0) {
      milestoneTypes = facilityMilestones
    } else {
      const { data: globalMilestones } = await supabase
        .from('milestone_types')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order')
      milestoneTypes = globalMilestones || []
    }

    if (milestoneTypes.length === 0) return { success: false, casesGenerated: 0, error: 'No milestone types found' }

    // Load payers
    const { data: payers } = await supabase
      .from('payers')
      .select('id, name')
      .eq('facility_id', facilityId)

    if (!payers || payers.length === 0) return { success: false, casesGenerated: 0, error: 'No payers found — add payers first' }

    // Load completed status
    const { data: completedStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!completedStatus) return { success: false, casesGenerated: 0, error: 'Completed case status not found' }

    // Load staff for assignments
    const { data: allStaff } = await supabase
      .from('users')
      .select('id, role_id')
      .eq('facility_id', facilityId)
      .eq('is_active', true)

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('id, name')

    const roleMap = new Map((roleData || []).map(r => [r.id, r.name]))
    const staff = {
      anesthesiologists: (allStaff || []).filter(u => roleMap.get(u.role_id) === 'anesthesiologist'),
      nurses: (allStaff || []).filter(u => roleMap.get(u.role_id) === 'nurse'),
      techs: (allStaff || []).filter(u => roleMap.get(u.role_id) === 'tech'),
    }

    // ── Step 2: Resolve surgeon profiles ──
    onProgress?.({ phase: 'resolving', current: 20, total: 100, message: 'Resolving surgeon profiles...' })

    const resolvedSurgeons: ResolvedSurgeon[] = []
    for (const profile of surgeonProfiles) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, facility_id, closing_workflow, closing_handoff_minutes')
        .eq('id', profile.surgeonId)
        .single()

      if (!userData) {
        console.warn(`Surgeon ${profile.surgeonId} not found, skipping`)
        continue
      }

      // Map specialty → procedure type IDs
      const procNames = SPECIALTY_PROCEDURES[profile.specialty] || []
      const procIds = procedureTypes
        .filter(pt => procNames.includes(pt.name))
        .map(pt => pt.id)

      if (procIds.length === 0) {
        console.warn(`No matching procedures for surgeon ${userData.first_name} ${userData.last_name} (${profile.specialty})`)
        continue
      }

      resolvedSurgeons.push({
        ...profile,
        firstName: userData.first_name,
        lastName: userData.last_name,
        facilityId: userData.facility_id,
        closingWorkflow: userData.closing_workflow || 'surgeon_closes',
        closingHandoffMinutes: userData.closing_handoff_minutes || 0,
        procedureTypeIds: procIds,
      })
    }

    if (resolvedSurgeons.length === 0) {
      return { success: false, casesGenerated: 0, error: 'No surgeons could be resolved. Check that surgeon IDs exist and matching procedures are configured.' }
    }

    // ── Step 3: Generate all case data in memory ──
    onProgress?.({ phase: 'generating', current: 25, total: 100, message: 'Generating case data...' })

    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - monthsOfHistory)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 1)

    const allCases: any[] = []
    const allMilestones: any[] = []
    const allStaffAssignments: any[] = []
    const allImplants: any[] = []

    let caseCounter = 1
    const prefix = facility.case_number_prefix || 'DEMO'

    for (const surgeon of resolvedSurgeons) {
      const result = generateSurgeonCases(
        surgeon, startDate, endDate, rooms, procedureTypes,
        milestoneTypes, payers, staff, completedStatus.id, prefix, caseCounter
      )

      allCases.push(...result.cases)
      allMilestones.push(...result.milestones)
      allStaffAssignments.push(...result.staffAssignments)
      allImplants.push(...result.implants)
      caseCounter += result.cases.length

      onProgress?.({
        phase: 'generating',
        current: 25 + Math.floor((resolvedSurgeons.indexOf(surgeon) / resolvedSurgeons.length) * 25),
        total: 100,
        message: `Generated cases for Dr. ${surgeon.lastName} (${result.cases.length} cases)...`,
      })
    }

    // ── Step 4: Bulk insert ──
    // Disable audit triggers if the RPC exists
    await supabase.rpc('disable_demo_audit_triggers').then(() => {}, () => {})

    // Insert cases
    onProgress?.({ phase: 'inserting', current: 55, total: 100, message: `Inserting ${allCases.length} cases...` })
    for (let i = 0; i < allCases.length; i += BATCH_SIZE) {
      const batch = allCases.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('cases').insert(batch)
      if (error) {
        console.error('Case insert error:', error)
        await supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {})
        return { success: false, casesGenerated: 0, error: `Insert failed at case batch ${i}: ${error.message}` }
      }
    }

    // Insert milestones
    onProgress?.({ phase: 'inserting', current: 70, total: 100, message: `Inserting ${allMilestones.length} milestones...` })
    for (let i = 0; i < allMilestones.length; i += BATCH_SIZE) {
      const batch = allMilestones.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_milestones').insert(batch)
      if (error) console.error('Milestone insert error at batch', i, error.message)
    }

    // Insert staff
    onProgress?.({ phase: 'inserting', current: 80, total: 100, message: `Inserting ${allStaffAssignments.length} staff assignments...` })
    for (let i = 0; i < allStaffAssignments.length; i += BATCH_SIZE) {
      const batch = allStaffAssignments.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_staff').insert(batch)
      if (error) console.error('Staff insert error at batch', i, error.message)
    }

    // Insert implants
    onProgress?.({ phase: 'inserting', current: 88, total: 100, message: `Inserting ${allImplants.length} implants...` })
    for (let i = 0; i < allImplants.length; i += BATCH_SIZE) {
      const batch = allImplants.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_implants').insert(batch)
      if (error) console.error('Implant insert error at batch', i, error.message)
    }

    // Re-enable triggers
    await supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {})

    // Recalculate averages
    onProgress?.({ phase: 'finalizing', current: 95, total: 100, message: 'Recalculating surgeon averages...' })
    await supabase.rpc('recalculate_surgeon_averages', { p_facility_id: facilityId }).then(() => {}, (e: any) => {
      console.warn('Averages recalc skipped:', e.message)
    })

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Done!' })

    return {
      success: true,
      casesGenerated: allCases.length,
      details: {
        milestones: allMilestones.length,
        staff: allStaffAssignments.length,
        implants: allImplants.length,
      },
    }
  } catch (error) {
    console.error('Generation error:', error)
    await supabase.rpc('enable_demo_audit_triggers').then(() => {}, () => {})
    return {
      success: false,
      casesGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// =====================================================
// CASE GENERATION PER SURGEON
// =====================================================

function generateSurgeonCases(
  surgeon: ResolvedSurgeon,
  startDate: Date,
  endDate: Date,
  rooms: any[],
  allProcedureTypes: any[],
  milestoneTypes: any[],
  payers: any[],
  staff: { anesthesiologists: any[]; nurses: any[]; techs: any[] },
  completedStatusId: string,
  prefix: string,
  startingNumber: number
) {
  const cases: any[] = []
  const milestones: any[] = []
  const staffAssignments: any[] = []
  const implants: any[] = []

  let caseNum = startingNumber
  const surgeonProcs = allProcedureTypes.filter(pt => surgeon.procedureTypeIds.includes(pt.id))

  // Determine timing config
  const speedCfg = SPEED_CONFIGS[surgeon.speedProfile]
  const specialtyCfg = surgeon.specialty === 'hand_wrist' ? HAND_WRIST_CONFIG
    : surgeon.specialty === 'spine' ? SPINE_CONFIG
    : null

  const casesPerDay = specialtyCfg?.casesPerDay ?? speedCfg.casesPerDay
  const dayStartTime = specialtyCfg?.startTime ?? speedCfg.startTime

  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    const dow = currentDate.getDay()

    if (!surgeon.operatingDays.includes(dow) || isWeekend(currentDate) || isHoliday(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    const numCases = randomInt(casesPerDay.min, casesPerDay.max)
    const [h, m] = dayStartTime.split(':').map(Number)
    let currentTime = new Date(currentDate)
    currentTime.setHours(h, m, 0, 0)

    const assignedRooms = surgeon.usesFlipRooms && rooms.length >= 2
      ? [rooms[0], rooms[1]]
      : [rooms[randomInt(0, rooms.length - 1)]]
    let roomIdx = 0

    for (let i = 0; i < numCases; i++) {
      const proc = randomChoice(surgeonProcs)
      const room = assignedRooms[roomIdx % assignedRooms.length]

      // Determine surgical time
      let surgicalTime: number
      const override = PROCEDURE_SURGICAL_TIMES[proc.name]
      if (override) {
        surgicalTime = randomInt(override.min, override.max)
      } else {
        surgicalTime = randomInt(speedCfg.surgicalTime.min, speedCfg.surgicalTime.max)
      }

      // Start variance: 80% on time (±10min), 20% late (10-30min)
      const variance = Math.random() < 0.8 ? randomInt(-5, 10) : randomInt(10, 30)
      const scheduledStart = new Date(currentTime)
      const patientInTime = addMinutes(scheduledStart, variance)

      // Build case record
      const caseId = crypto.randomUUID?.() ?? `case-${caseNum}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const isFuture = currentDate > new Date()

      const caseData: any = {
        id: caseId,
        facility_id: surgeon.facilityId,
        case_number: `${prefix}-${String(caseNum).padStart(5, '0')}`,
        surgeon_id: surgeon.surgeonId,
        procedure_type_id: proc.id,
        or_room_id: room.id,
        scheduled_date: currentDate.toISOString().split('T')[0],
        start_time: formatTime(scheduledStart),
        status_id: isFuture ? completedStatusId : completedStatusId, // You could use a 'scheduled' status for future
        payer_id: payers.length > 0 ? weightedRandomChoice(
          payers.map((p: any) => p.id),
          payers.map((p: any) => PAYER_DISTRIBUTION[p.name] || 0.25)
        ) : null,
        operative_side: randomChoice(['Left', 'Right', 'Bilateral', null]),
        is_excluded_from_metrics: false,
        surgeon_left_at: null,
      }

      cases.push(caseData)

      // Generate milestones (only for past cases)
      if (!isFuture) {
        const caseMilestones = buildMilestones(caseId, surgeon, proc, milestoneTypes, patientInTime, surgicalTime)
        milestones.push(...caseMilestones)

        // Set surgeon_left_at
        if (surgeon.closingWorkflow === 'pa_closes') {
          const closingMs = caseMilestones.find(ms =>
            milestoneTypes.find(mt => mt.id === ms.milestone_type_id && mt.name === 'closing')
          )
          if (closingMs) {
            caseData.surgeon_left_at = addMinutes(new Date(closingMs.recorded_at), surgeon.closingHandoffMinutes).toISOString()
          }
        } else {
          const closingCompleteMs = caseMilestones.find(ms =>
            milestoneTypes.find(mt => mt.id === ms.milestone_type_id && mt.name === 'closing_complete')
          )
          if (closingCompleteMs) {
            caseData.surgeon_left_at = closingCompleteMs.recorded_at
          }
        }

        // Staff assignments
        if (staff.anesthesiologists.length > 0 && (surgeon.specialty !== 'hand_wrist' || Math.random() > 0.3)) {
          staffAssignments.push({ case_id: caseId, user_id: randomChoice(staff.anesthesiologists).id })
        }
        if (staff.nurses.length > 0) {
          staffAssignments.push({ case_id: caseId, user_id: randomChoice(staff.nurses).id })
        }
        if (staff.techs.length > 0) {
          staffAssignments.push({ case_id: caseId, user_id: randomChoice(staff.techs).id })
        }

        // Implants (joint only)
        if (surgeon.specialty === 'joint' && surgeon.preferredVendor) {
          const procBase = proc.name.replace('Mako ', '')
          const vendorSpecs = IMPLANT_SPECS[surgeon.preferredVendor]?.[procBase]
          if (vendorSpecs) {
            for (const [component, spec] of Object.entries(vendorSpecs)) {
              const size = Math.random() < 0.7 ? randomChoice(spec.common) : randomChoice(spec.sizes)
              implants.push({
                case_id: caseId,
                implant_name: spec.name,
                implant_size: size,
                manufacturer: surgeon.preferredVendor,
                catalog_number: `${component.toUpperCase()}-${size}-${randomInt(1000, 9999)}`,
              })
            }
          }
        }
      }

      // Advance time
      if (surgeon.usesFlipRooms && speedCfg.flipInterval > 0) {
        currentTime = addMinutes(currentTime, speedCfg.flipInterval)
        roomIdx++
      } else {
        // Use patient_out milestone to determine next case start
        const patientOutMs = milestones.filter(ms => ms.case_id === caseId).find(ms =>
          milestoneTypes.find(mt => mt.id === ms.milestone_type_id && mt.name === 'patient_out')
        )
        if (patientOutMs) {
          currentTime = addMinutes(new Date(patientOutMs.recorded_at), randomInt(15, 25))
        } else {
          currentTime = addMinutes(currentTime, 90)
        }
      }

      caseNum++
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return { cases, milestones, staffAssignments, implants }
}

// =====================================================
// MILESTONE BUILDER
// =====================================================

function buildMilestones(
  caseId: string,
  surgeon: ResolvedSurgeon,
  proc: any,
  milestoneTypes: any[],
  patientInTime: Date,
  surgicalTime: number
): any[] {
  const ms: any[] = []
  const getMsId = (name: string) => milestoneTypes.find(mt => mt.name === name)?.id

  // Pick template
  let template: any
  if (surgeon.specialty === 'joint') {
    template = JOINT_MILESTONES[surgeon.speedProfile]
  } else if (surgeon.specialty === 'hand_wrist') {
    template = HAND_WRIST_MILESTONES
  } else {
    template = SPINE_MILESTONES
  }

  const base = new Date(patientInTime)

  const push = (name: string, offsetOrFn: number | ((st: number) => number), outlierChance = 0, outlierExtra = { min: 0, max: 0 }) => {
    const id = getMsId(name)
    if (!id) return
    let offset = typeof offsetOrFn === 'function' ? offsetOrFn(surgicalTime) : offsetOrFn
    if (outlierChance > 0) {
      offset = addOutlier(offset, outlierChance, { min: offset + outlierExtra.min, max: offset + outlierExtra.max })
    }
    ms.push({
      case_id: caseId,
      milestone_type_id: id,
      recorded_at: addMinutes(base, offset).toISOString(),
    })
  }

  push('patient_in', template.patient_in)
  if (template.anes_start !== undefined) push('anes_start', template.anes_start)
  if (template.anes_end !== undefined) push('anes_end', template.anes_end, 0.15, { min: 5, max: 12 })
  push('prep_drape_start', template.prep_drape_start)
  push('prep_drape_complete', template.prep_drape_complete)
  push('incision', template.incision)
  push('closing', template.closing, 0.15, { min: 5, max: 15 })
  push('closing_complete', template.closing_complete, 0.15, { min: 5, max: 12 })
  push('patient_out', template.patient_out)
  push('room_cleaned', template.room_cleaned)

  return ms
}