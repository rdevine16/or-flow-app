// lib/demo-data-generator-enhanced.ts
// Comprehensive demo data generation for ORbit analytics
// Generates 6 surgeons: 4 joint, 1 hand/wrist, 1 spine
// 6 months historical + 1 month future data with realistic patterns and flip rooms

import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// TYPES
// =====================================================

export interface DemoFacility {
  id: string
  name: string
  timezone: string
}

export interface DemoSurgeon {
  id: string
  firstName: string
  lastName: string
  facilityId: string
  specialty: 'joint' | 'hand_wrist' | 'spine'
  speedProfile: 'fast' | 'average' | 'slow'
  operatingDays: number[]
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes' | null
  procedureTypes: string[]
  usesFlipRooms: boolean
  closingWorkflow: 'surgeon_closes' | 'pa_closes'
  closingHandoffMinutes: number
}

export interface GenerationProgress {
  phase: string
  current: number
  total: number
  message: string
}

export type ProgressCallback = (progress: GenerationProgress) => void

// =====================================================
// CONFIGURATION
// =====================================================

const BATCH_SIZE = 100

// Surgeon profile configurations
const SURGEON_PROFILES = {
  fast: {
    casesPerDay: { min: 6, max: 8 },
    startTime: '07:00',
    surgicalTime: { min: 28, max: 35 },
    usesFlipRooms: true,
    closingWorkflow: 'pa_closes' as const,
    closingHandoffMinutes: 0,
    flipInterval: 60, // New case every 60 minutes in alternate room
  },
  average_with_flip: {
    casesPerDay: { min: 4, max: 6 },
    startTime: '07:30',
    surgicalTime: { min: 48, max: 59 },
    usesFlipRooms: true,
    closingWorkflow: 'pa_closes' as const,
    closingHandoffMinutes: 3,
    flipInterval: 90, // New case every 90 minutes
  },
  average_no_flip: {
    casesPerDay: { min: 4, max: 5 },
    startTime: '07:30',
    surgicalTime: { min: 48, max: 59 },
    usesFlipRooms: false,
    closingWorkflow: 'surgeon_closes' as const,
    closingHandoffMinutes: 0,
  },
  slow: {
    casesPerDay: { min: 3, max: 4 },
    startTime: '07:30',
    surgicalTime: { min: 65, max: 88 },
    usesFlipRooms: false,
    closingWorkflow: 'surgeon_closes' as const,
    closingHandoffMinutes: 0,
  },
  hand_wrist: {
    casesPerDay: { min: 5, max: 7 },
    startTime: '07:30',
    surgicalTime: { min: 15, max: 60 },
    usesFlipRooms: false,
    closingWorkflow: 'surgeon_closes' as const,
    closingHandoffMinutes: 0,
  },
  spine: {
    casesPerDay: { min: 3, max: 5 },
    startTime: '07:30',
    surgicalTime: { min: 45, max: 90 },
    usesFlipRooms: false,
    closingWorkflow: 'surgeon_closes' as const,
    closingHandoffMinutes: 0,
  },
}

// Procedure-specific surgical times
const PROCEDURE_SURGICAL_TIMES: Record<string, { min: number; max: number }> = {
  // Joint - use surgeon profile
  'THA': { min: 0, max: 0 },
  'TKA': { min: 0, max: 0 },
  'Mako THA': { min: 0, max: 0 },
  'Mako TKA': { min: 0, max: 0 },
  // Hand/Wrist
  'Distal Radius ORIF': { min: 45, max: 60 },
  'Carpal Tunnel Release': { min: 15, max: 25 },
  'Trigger Finger Release': { min: 10, max: 15 },
  'Wrist Arthroscopy': { min: 30, max: 45 },
  'TFCC Repair': { min: 35, max: 50 },
  // Spine
  'Lumbar Microdiscectomy': { min: 45, max: 60 },
  'ACDF': { min: 60, max: 90 },
  'Lumbar Laminectomy': { min: 50, max: 75 },
  'Posterior Cervical Foraminotomy': { min: 40, max: 55 },
  'Kyphoplasty': { min: 30, max: 45 },
}

// Hard goods costs
const PROCEDURE_COSTS: Record<string, number> = {
  // Hand procedures
  'Distal Radius ORIF': 2000,
  'Carpal Tunnel Release': 2000,
  'Trigger Finger Release': 2000,
  'Wrist Arthroscopy': 2000,
  'TFCC Repair': 2000,
  // Spine procedures
  'Lumbar Microdiscectomy': 5000,
  'ACDF': 5000,
  'Lumbar Laminectomy': 5000,
  'Posterior Cervical Foraminotomy': 5000,
  'Kyphoplasty': 5000,
}

// Implant specifications by vendor
const IMPLANT_SPECS: Record<'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes', any> = {
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
const PAYER_DISTRIBUTION = {
  'Medicare': 0.45,
  'BCBS': 0.30,
  'Aetna': 0.125,
  'UnitedHealthcare': 0.125,
}

// US Holidays
const US_HOLIDAYS = [
  '2024-07-04', '2024-09-02', '2024-11-28', '2024-11-29', '2024-12-25',
  '2025-01-01', '2025-05-26', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-25',
  '2026-01-01', '2026-05-25', '2026-07-03', '2026-09-07', '2026-11-26', '2026-11-27', '2026-12-25',
]

// Milestone templates
const JOINT_MILESTONES = {
  fast: {
    patient_in: 0,
    anes_start: 2,
    anes_end: 10,
    prep_drape_start: 12,
    prep_drape_complete: 18,
    incision: 20,
    closing: (surgicalTime: number) => 20 + surgicalTime,
    closing_complete: (surgicalTime: number) => 20 + surgicalTime + 6,
    patient_out: (surgicalTime: number) => 20 + surgicalTime + 10,
    room_cleaned: (surgicalTime: number) => 20 + surgicalTime + 20,
  },
  average: {
    patient_in: 0,
    anes_start: 3,
    anes_end: 15,
    prep_drape_start: 17,
    prep_drape_complete: 25,
    incision: 28,
    closing: (surgicalTime: number) => 28 + surgicalTime,
    closing_complete: (surgicalTime: number) => 28 + surgicalTime + 8,
    patient_out: (surgicalTime: number) => 28 + surgicalTime + 12,
    room_cleaned: (surgicalTime: number) => 28 + surgicalTime + 25,
  },
  slow: {
    patient_in: 0,
    anes_start: 4,
    anes_end: 18,
    prep_drape_start: 20,
    prep_drape_complete: 30,
    incision: 35,
    closing: (surgicalTime: number) => 35 + surgicalTime,
    closing_complete: (surgicalTime: number) => 35 + surgicalTime + 10,
    patient_out: (surgicalTime: number) => 35 + surgicalTime + 15,
    room_cleaned: (surgicalTime: number) => 35 + surgicalTime + 28,
  },
}

const HAND_WRIST_MILESTONES = {
  patient_in: 0,
  // NO anes_start or anes_end
  prep_drape_start: 8,
  prep_drape_complete: 15,
  incision: 18,
  closing: (surgicalTime: number) => 18 + surgicalTime,
  closing_complete: (surgicalTime: number) => 18 + surgicalTime + 5,
  patient_out: (surgicalTime: number) => 18 + surgicalTime + 10,
  room_cleaned: (surgicalTime: number) => 18 + surgicalTime + 20,
}

const SPINE_MILESTONES = {
  patient_in: 0,
  anes_start: 3,
  anes_end: 18,
  prep_drape_start: 20,
  prep_drape_complete: 28,
  incision: 32,
  closing: (surgicalTime: number) => 32 + surgicalTime,
  closing_complete: (surgicalTime: number) => 32 + surgicalTime + 12,
  patient_out: (surgicalTime: number) => 32 + surgicalTime + 20,
  room_cleaned: (surgicalTime: number) => 32 + surgicalTime + 35,
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function weightedRandomChoice<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight
  for (let i = 0; i < items.length; i++) {
    random -= weights[i]
    if (random <= 0) return items[i]
  }
  return items[items.length - 1]
}

function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z0 * stdDev + mean
}

function addOutlier(baseValue: number, outlierChance: number, outlierRange: { min: number; max: number }): number {
  if (Math.random() < outlierChance) {
    return randomInt(outlierRange.min, outlierRange.max)
  }
  return baseValue
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0]
  return US_HOLIDAYS.includes(dateStr)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

// =====================================================
// MAIN GENERATION FUNCTION
// =====================================================

export async function generateDemoData(
  supabase: SupabaseClient,
  facilityId: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; casesGenerated: number; error?: string; details?: any; debug?: any }> {
  try {
    onProgress?.({ phase: 'initializing', current: 0, total: 100, message: 'Starting demo data generation...' })

    // Fetch facility data
    onProgress?.({ phase: 'fetching', current: 5, total: 100, message: 'Fetching facility configuration...' })
    
    const { data: facility } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', facilityId)
      .single()

    if (!facility) {
      return { success: false, casesGenerated: 0, error: 'Facility not found' }
    }

    // Get or create rooms
    onProgress?.({ phase: 'setup', current: 10, total: 100, message: 'Setting up OR rooms...' })
    let rooms = await getOrCreateRooms(supabase, facilityId)

    // Get or create procedure types
    onProgress?.({ phase: 'setup', current: 15, total: 100, message: 'Setting up procedure types...' })
    let procedureTypes = await getOrCreateProcedureTypes(supabase, facilityId)

    // Get milestone types
    const { data: milestoneTypes } = await supabase
      .from('milestone_types')
      .select('*')
      .order('display_order')

    if (!milestoneTypes || milestoneTypes.length === 0) {
      return { success: false, casesGenerated: 0, error: 'No milestone types found' }
    }

    // Get payers
    let payers = await getOrCreatePayers(supabase, facilityId)

    // Get case status
    const { data: completedStatus } = await supabase
      .from('case_statuses')
      .select('id')
      .eq('name', 'completed')
      .single()

    if (!completedStatus) {
      return { success: false, casesGenerated: 0, error: 'Completed status not found' }
    }

    // Create surgeons and staff
    onProgress?.({ phase: 'setup', current: 20, total: 100, message: 'Creating surgeons and staff...' })
    const surgeons = await createDemoSurgeons(supabase, facilityId, procedureTypes)
    const staff = await createDemoStaff(supabase, facilityId)

    if (surgeons.length === 0) {
      return { success: false, casesGenerated: 0, error: 'Failed to create surgeons' }
    }

    // Generate cases for 6 months historical + 1 month future
    onProgress?.({ phase: 'generating', current: 30, total: 100, message: 'Generating cases...' })
    
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 6)
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 1)

    const allCases: any[] = []
    const allMilestones: any[] = []
    const allStaff: any[] = []
    const allImplants: any[] = []

    let caseCounter = 1
    const caseNumberPrefix = facility.case_number_prefix || 'DEMO'

    // Generate cases for each surgeon
    for (const surgeon of surgeons) {
      const surgeonCases = await generateSurgeonCases(
        surgeon,
        startDate,
        endDate,
        rooms,
        procedureTypes,
        milestoneTypes,
        payers,
        staff,
        completedStatus.id,
        caseNumberPrefix,
        caseCounter
      )

      allCases.push(...surgeonCases.cases)
      allMilestones.push(...surgeonCases.milestones)
      allStaff.push(...surgeonCases.staff)
      allImplants.push(...surgeonCases.implants)
      
      caseCounter += surgeonCases.cases.length
    }

    // Disable audit triggers for bulk insert
    const { error: disableError } = await supabase.rpc('disable_demo_audit_triggers')
    if (disableError) {
      console.warn('Could not disable audit triggers:', disableError.message)
    }

    // Insert cases
    onProgress?.({ phase: 'inserting', current: 60, total: 100, message: `Inserting ${allCases.length} cases...` })
    
    for (let i = 0; i < allCases.length; i += BATCH_SIZE) {
      const batch = allCases.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('cases').insert(batch)
      if (error) {
        console.error('Error inserting cases:', error)
        return { success: false, casesGenerated: 0, error: `Failed to insert cases: ${error.message}` }
      }
    }

    // Insert milestones
    onProgress?.({ phase: 'inserting', current: 75, total: 100, message: 'Inserting milestones...' })
    
    for (let i = 0; i < allMilestones.length; i += BATCH_SIZE) {
      const batch = allMilestones.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_milestones').insert(batch)
      if (error) {
        console.error('Error inserting milestones:', error)
      }
    }

    // Insert staff
    onProgress?.({ phase: 'inserting', current: 85, total: 100, message: 'Inserting staff assignments...' })
    
    for (let i = 0; i < allStaff.length; i += BATCH_SIZE) {
      const batch = allStaff.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_staff').insert(batch)
      if (error) {
        console.error('Error inserting staff:', error)
      }
    }

    // Insert implants
    onProgress?.({ phase: 'inserting', current: 90, total: 100, message: 'Inserting implants...' })
    
    for (let i = 0; i < allImplants.length; i += BATCH_SIZE) {
      const batch = allImplants.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_implants').insert(batch)
      if (error) {
        console.error('Error inserting implants:', error)
      }
    }

    // Re-enable audit triggers
    const { error: enableError } = await supabase.rpc('enable_demo_audit_triggers')
    if (enableError) {
      console.warn('Could not re-enable audit triggers:', enableError.message)
    }

    // Recalculate surgeon averages
    onProgress?.({ phase: 'finalizing', current: 95, total: 100, message: 'Recalculating surgeon averages...' })
    
    const { error: avgError } = await supabase.rpc('recalculate_surgeon_averages', {
      p_facility_id: facilityId
    })
    if (avgError) {
      console.error('Error recalculating averages:', avgError)
    }

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Demo data generation complete!' })

    return {
      success: true,
      casesGenerated: allCases.length,
      details: {
        milestones: allMilestones.length,
        staff: allStaff.length,
        implants: allImplants.length,
        delays: 0,
      },
      debug: {
        surgeonsCreated: surgeons.length,
        proceduresFound: procedureTypes.length,
        roomsFound: rooms.length,
        payersFound: payers.length,
      },
    }

  } catch (error) {
    console.error('Demo data generation error:', error)
    try { await supabase.rpc('enable_demo_audit_triggers') } catch (_) {}
    return {
      success: false,
      casesGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// =====================================================
// SURGEON CREATION
// =====================================================

async function createDemoSurgeons(
  supabase: SupabaseClient,
  facilityId: string,
  procedureTypes: any[]
): Promise<DemoSurgeon[]> {
  const surgeons: DemoSurgeon[] = []
  
  const { data: surgeonRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'surgeon')
    .single()
  
  if (!surgeonRole) {
    throw new Error('Surgeon role not found')
  }

  const names = [
    { first: 'Michael', last: 'Anderson', specialty: 'joint', profile: 'fast', vendor: 'Stryker' },
    { first: 'Jennifer', last: 'Williams', specialty: 'joint', profile: 'average_with_flip', vendor: 'Zimmer Biomet' },
    { first: 'Robert', last: 'Johnson', specialty: 'joint', profile: 'average_no_flip', vendor: 'DePuy Synthes' },
    { first: 'Sarah', last: 'Martinez', specialty: 'joint', profile: 'slow', vendor: 'Stryker' },
    { first: 'David', last: 'Chen', specialty: 'hand_wrist', profile: 'hand_wrist', vendor: null },
    { first: 'Elizabeth', last: 'Thompson', specialty: 'spine', profile: 'spine', vendor: null },
  ]

  for (const surgeon of names) {
    const profile = SURGEON_PROFILES[surgeon.profile as keyof typeof SURGEON_PROFILES]
    
    // Get procedure types for this surgeon
    let procTypes: string[] = []
    if (surgeon.specialty === 'joint') {
      procTypes = procedureTypes
        .filter(p => ['THA', 'TKA', 'Mako THA', 'Mako TKA'].includes(p.name))
        .map(p => p.id)
    } else if (surgeon.specialty === 'hand_wrist') {
      procTypes = procedureTypes
        .filter(p => ['Distal Radius ORIF', 'Carpal Tunnel Release', 'Trigger Finger Release', 'Wrist Arthroscopy', 'TFCC Repair'].includes(p.name))
        .map(p => p.id)
    } else if (surgeon.specialty === 'spine') {
      procTypes = procedureTypes
        .filter(p => ['Lumbar Microdiscectomy', 'ACDF', 'Lumbar Laminectomy', 'Posterior Cervical Foraminotomy', 'Kyphoplasty'].includes(p.name))
        .map(p => p.id)
    }

    // Random 2 days per week (Monday-Friday)
    const availableDays = [1, 2, 3, 4, 5]
    const operatingDays = []
    for (let j = 0; j < 2; j++) {
      const dayIndex = randomInt(0, availableDays.length - 1)
      operatingDays.push(availableDays[dayIndex])
      availableDays.splice(dayIndex, 1)
    }
    operatingDays.sort()

    const { data: userData, error } = await supabase
      .from('users')
      .insert({
        facility_id: facilityId,
        first_name: surgeon.first,
        last_name: surgeon.last,
        email: `${surgeon.first.toLowerCase()}.${surgeon.last.toLowerCase()}@demo.orbit.com`,
        role_id: surgeonRole.id,
        access_level: 'surgeon',
        is_active: true,
        closing_workflow: profile.closingWorkflow,
        closing_handoff_minutes: profile.closingHandoffMinutes,
      })
      .select()
      .single()

    if (error || !userData) {
      console.error(`Error creating surgeon ${surgeon.first} ${surgeon.last}:`, error)
      continue
    }

    surgeons.push({
      id: userData.id,
      firstName: surgeon.first,
      lastName: surgeon.last,
      facilityId,
      specialty: surgeon.specialty as 'joint' | 'hand_wrist' | 'spine',
      speedProfile: surgeon.profile === 'fast' ? 'fast' : 
                    surgeon.profile.includes('average') ? 'average' : 
                    surgeon.profile === 'slow' ? 'slow' : 'average',
      operatingDays,
      preferredVendor: surgeon.vendor as any,
      procedureTypes: procTypes,
      usesFlipRooms: profile.usesFlipRooms,
      closingWorkflow: profile.closingWorkflow,
      closingHandoffMinutes: profile.closingHandoffMinutes,
    })
  }

  return surgeons
}

// =====================================================
// STAFF CREATION
// =====================================================

async function createDemoStaff(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{ anesthesiologists: any[]; nurses: any[]; techs: any[] }> {
  const { data: anesthRole } = await supabase.from('roles').select('id').eq('name', 'anesthesiologist').single()
  const { data: nurseRole } = await supabase.from('roles').select('id').eq('name', 'nurse').single()
  const { data: techRole } = await supabase.from('roles').select('id').eq('name', 'surgical_tech').single()

  const anesthesiologists = []
  const nurses = []
  const techs = []

  const anesthNames = [
    { first: 'James', last: 'Miller' },
    { first: 'Lisa', last: 'Davis' },
  ]

  for (const name of anesthNames) {
    if (!anesthRole) continue
    const { data } = await supabase
      .from('users')
      .insert({
        facility_id: facilityId,
        first_name: name.first,
        last_name: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@demo.orbit.com`,
        role_id: anesthRole.id,
        access_level: 'staff',
        is_active: true,
      })
      .select()
      .single()
    
    if (data) anesthesiologists.push(data)
  }

  const nurseNames = [
    { first: 'Amanda', last: 'Brown' },
    { first: 'Kevin', last: 'Garcia' },
    { first: 'Michelle', last: 'Rodriguez' },
    { first: 'Daniel', last: 'Wilson' },
  ]

  for (const name of nurseNames) {
    if (!nurseRole) continue
    const { data } = await supabase
      .from('users')
      .insert({
        facility_id: facilityId,
        first_name: name.first,
        last_name: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@demo.orbit.com`,
        role_id: nurseRole.id,
        access_level: 'staff',
        is_active: true,
      })
      .select()
      .single()
    
    if (data) nurses.push(data)
  }

  const techNames = [
    { first: 'Christopher', last: 'Lee' },
    { first: 'Jessica', last: 'Taylor' },
    { first: 'Matthew', last: 'Thomas' },
    { first: 'Ashley', last: 'Moore' },
  ]

  for (const name of techNames) {
    if (!techRole) continue
    const { data } = await supabase
      .from('users')
      .insert({
        facility_id: facilityId,
        first_name: name.first,
        last_name: name.last,
        email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@demo.orbit.com`,
        role_id: techRole.id,
        access_level: 'staff',
        is_active: true,
      })
      .select()
      .single()
    
    if (data) techs.push(data)
  }

  return { anesthesiologists, nurses, techs }
}

// =====================================================
// ROOM/PROCEDURE/PAYER SETUP
// =====================================================

async function getOrCreateRooms(supabase: SupabaseClient, facilityId: string): Promise<any[]> {
  const { data: existingRooms } = await supabase
    .from('or_rooms')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('is_active', true)

  if (existingRooms && existingRooms.length >= 4) {
    return existingRooms.slice(0, 4)
  }

  // Create 4 rooms
  const roomsToCreate = []
  for (let i = 1; i <= 4; i++) {
    roomsToCreate.push({
      facility_id: facilityId,
      name: `Room ${i}`,
      is_active: true,
      display_order: i,
      available_hours: 10,
    })
  }

  const { data: newRooms } = await supabase
    .from('or_rooms')
    .insert(roomsToCreate)
    .select()

  return newRooms || []
}

async function getOrCreateProcedureTypes(supabase: SupabaseClient, facilityId: string): Promise<any[]> {
  const { data: existing } = await supabase
    .from('procedure_types')
    .select('*')
    .eq('facility_id', facilityId)

  const neededProcedures = [
    'THA', 'TKA', 'Mako THA', 'Mako TKA',
    'Distal Radius ORIF', 'Carpal Tunnel Release', 'Trigger Finger Release', 'Wrist Arthroscopy', 'TFCC Repair',
    'Lumbar Microdiscectomy', 'ACDF', 'Lumbar Laminectomy', 'Posterior Cervical Foraminotomy', 'Kyphoplasty',
  ]

  const existingNames = existing?.map(p => p.name) || []
  const toCreate = neededProcedures.filter(name => !existingNames.includes(name))

  if (toCreate.length > 0) {
    const proceduresToInsert = toCreate.map(name => ({
      facility_id: facilityId,
      name,
      is_active: true,
    }))

    await supabase.from('procedure_types').insert(proceduresToInsert)
  }

  const { data: allProcedures } = await supabase
    .from('procedure_types')
    .select('*')
    .eq('facility_id', facilityId)

  return allProcedures || []
}

async function getOrCreatePayers(supabase: SupabaseClient, facilityId: string): Promise<any[]> {
  const { data: existing } = await supabase
    .from('payers')
    .select('*')
    .eq('facility_id', facilityId)

  const neededPayers = ['Medicare', 'BCBS', 'Aetna', 'UnitedHealthcare']
  const existingNames = existing?.map(p => p.name) || []
  const toCreate = neededPayers.filter(name => !existingNames.includes(name))

  if (toCreate.length > 0) {
    const payersToInsert = toCreate.map(name => ({
      facility_id: facilityId,
      name,
      is_active: true,
    }))

    await supabase.from('payers').insert(payersToInsert)
  }

  const { data: allPayers } = await supabase
    .from('payers')
    .select('*')
    .eq('facility_id', facilityId)

  return allPayers || []
}

// =====================================================
// CASE GENERATION
// =====================================================

async function generateSurgeonCases(
  surgeon: DemoSurgeon,
  startDate: Date,
  endDate: Date,
  rooms: any[],
  procedureTypes: any[],
  milestoneTypes: any[],
  payers: any[],
  staff: { anesthesiologists: any[]; nurses: any[]; techs: any[] },
  completedStatusId: string,
  caseNumberPrefix: string,
  startingCaseNumber: number
): Promise<{
  cases: any[]
  milestones: any[]
  staff: any[]
  implants: any[]
}> {
  const cases: any[] = []
  const milestones: any[] = []
  const staffAssignments: any[] = []
  const implants: any[] = []

  let caseNumber = startingCaseNumber

  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay()

    // Check if surgeon operates on this day
    if (!surgeon.operatingDays.includes(dayOfWeek) || isWeekend(currentDate) || isHoliday(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1)
      continue
    }

    // Determine number of cases for this day
    const profile = SURGEON_PROFILES[surgeon.specialty === 'joint' 
      ? (surgeon.speedProfile === 'fast' ? 'fast' : 
         surgeon.usesFlipRooms ? 'average_with_flip' : 
         surgeon.speedProfile === 'slow' ? 'slow' : 'average_no_flip')
      : surgeon.specialty === 'hand_wrist' ? 'hand_wrist' : 'spine']

    const numCases = randomInt(profile.casesPerDay.min, profile.casesPerDay.max)

    // Generate cases for this day
    const dayCases = generateDayCases(
      surgeon,
      currentDate,
      numCases,
      rooms,
      procedureTypes,
      milestoneTypes,
      payers,
      staff,
      completedStatusId,
      caseNumberPrefix,
      caseNumber,
      profile
    )

    cases.push(...dayCases.cases)
    milestones.push(...dayCases.milestones)
    staffAssignments.push(...dayCases.staff)
    implants.push(...dayCases.implants)

    caseNumber += dayCases.cases.length

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return { cases, milestones, staff: staffAssignments, implants }
}

function generateDayCases(
  surgeon: DemoSurgeon,
  date: Date,
  numCases: number,
  rooms: any[],
  procedureTypes: any[],
  milestoneTypes: any[],
  payers: any[],
  staff: { anesthesiologists: any[]; nurses: any[]; techs: any[] },
  completedStatusId: string,
  caseNumberPrefix: string,
  startingCaseNumber: number,
  profile: any
): {
  cases: any[]
  milestones: any[]
  staff: any[]
  implants: any[]
} {
  const cases: any[] = []
  const milestones: any[] = []
  const staffAssignments: any[] = []
  const implants: any[] = []

  const surgeonProcs = procedureTypes.filter(p => surgeon.procedureTypes.includes(p.id))
  
  // Parse start time
  const [hours, minutes] = profile.startTime.split(':').map(Number)
  let currentTime = new Date(date)
  currentTime.setHours(hours, minutes, 0, 0)

  // Room assignment for flip rooms
  let roomIndex = 0
  const assignedRooms = surgeon.usesFlipRooms ? [rooms[0], rooms[1]] : [rooms[0]]

  for (let i = 0; i < numCases; i++) {
    // Select procedure type
    const procedureType = randomChoice(surgeonProcs)
    
    // Get surgical time for this procedure
    let surgicalTime = 0
    if (PROCEDURE_SURGICAL_TIMES[procedureType.name]?.min > 0) {
      const times = PROCEDURE_SURGICAL_TIMES[procedureType.name]
      surgicalTime = randomInt(times.min, times.max)
    } else {
      surgicalTime = randomInt(profile.surgicalTime.min, profile.surgicalTime.max)
    }

    // Select room
    const room = assignedRooms[roomIndex % assignedRooms.length]

    // On-time start: 5 min early to 30 min late
    const startVariance = Math.random() < 0.8 
      ? randomInt(-5, 10)
      : randomInt(10, 30)

    const scheduledStart = new Date(currentTime)
    const patientInTime = addMinutes(scheduledStart, startVariance)

    // Generate case
    const caseId = `case-${startingCaseNumber + i}-${Date.now()}-${Math.random()}`
    const caseData: any = {
      id: caseId,
      facility_id: surgeon.facilityId,
      case_number: `${caseNumberPrefix}-${String(startingCaseNumber + i).padStart(5, '0')}`,
      surgeon_id: surgeon.id,
      procedure_type_id: procedureType.id,
      or_room_id: room.id,
      scheduled_date: date.toISOString().split('T')[0],
      start_time: `${String(scheduledStart.getHours()).padStart(2, '0')}:${String(scheduledStart.getMinutes()).padStart(2, '0')}:00`,
      status_id: completedStatusId,
      payer_id: weightedRandomChoice(
        payers.map(p => p.id),
        payers.map(p => PAYER_DISTRIBUTION[p.name as keyof typeof PAYER_DISTRIBUTION] || 0.25)
      ),
      operative_side: randomChoice(['Left', 'Right', 'Bilateral', null]),
      is_excluded_from_metrics: false,
      surgeon_left_at: null, // Will be set below based on closing workflow
    }

    cases.push(caseData)

    // Generate milestones
    const caseMilestones = generateMilestones(
      caseId,
      surgeon,
      procedureType,
      milestoneTypes,
      patientInTime,
      surgicalTime
    )
    milestones.push(...caseMilestones.milestones)

    // Set surgeon_left_at on case
    if (surgeon.closingWorkflow === 'pa_closes') {
      const closingMilestone = caseMilestones.milestones.find(m => 
        milestoneTypes.find(mt => mt.id === m.milestone_type_id && mt.name === 'closing')
      )
      if (closingMilestone) {
        const surgeonLeftTime = addMinutes(new Date(closingMilestone.recorded_at), surgeon.closingHandoffMinutes)
        caseData.surgeon_left_at = surgeonLeftTime.toISOString()
      }
    } else {
      const closingCompleteMilestone = caseMilestones.milestones.find(m =>
        milestoneTypes.find(mt => mt.id === m.milestone_type_id && mt.name === 'closing_complete')
      )
      if (closingCompleteMilestone) {
        caseData.surgeon_left_at = closingCompleteMilestone.recorded_at
      }
    }

    // Generate staff assignments
    const caseStaff = generateStaffAssignments(caseId, surgeon, staff, procedureType)
    staffAssignments.push(...caseStaff)

    // Generate implants
    const caseImplants = generateImplants(caseId, surgeon, procedureType)
    implants.push(...caseImplants)

    // Advance time for next case
    if (surgeon.usesFlipRooms && profile.flipInterval) {
      currentTime = addMinutes(currentTime, profile.flipInterval)
      roomIndex++
    } else {
      const patientOutMilestone = caseMilestones.milestones.find(m =>
        milestoneTypes.find(mt => mt.id === m.milestone_type_id && mt.name === 'patient_out')
      )
      if (patientOutMilestone) {
        const turnoverTime = randomInt(15, 25)
        currentTime = addMinutes(new Date(patientOutMilestone.recorded_at), turnoverTime)
      } else {
        currentTime = addMinutes(currentTime, 90)
      }
    }
  }

  return { cases, milestones, staff: staffAssignments, implants }
}

function generateMilestones(
  caseId: string,
  surgeon: DemoSurgeon,
  procedureType: any,
  milestoneTypes: any[],
  patientInTime: Date,
  surgicalTime: number
): { milestones: any[] } {
  const milestones: any[] = []
  
  // Determine milestone template
  let template: any
  if (surgeon.specialty === 'joint') {
    template = surgeon.speedProfile === 'fast' ? JOINT_MILESTONES.fast :
               surgeon.speedProfile === 'slow' ? JOINT_MILESTONES.slow :
               JOINT_MILESTONES.average
  } else if (surgeon.specialty === 'hand_wrist') {
    template = HAND_WRIST_MILESTONES
  } else {
    template = SPINE_MILESTONES
  }

  const getMilestoneId = (name: string) => milestoneTypes.find(mt => mt.name === name)?.id

  let currentTime = new Date(patientInTime)

  // Patient In
  const patientInId = getMilestoneId('patient_in')
  if (patientInId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: patientInId,
      recorded_at: currentTime.toISOString(),
    })
  }

  // Anesthesia Start
  if (template.anes_start !== undefined) {
    const anesStart = addMinutes(currentTime, template.anes_start)
    const anesStartId = getMilestoneId('anes_start')
    if (anesStartId) {
      milestones.push({
        case_id: caseId,
        milestone_type_id: anesStartId,
        recorded_at: anesStart.toISOString(),
      })
    }
  }

  // Anesthesia End (with outliers)
  if (template.anes_end !== undefined) {
    const baseAnesTime = template.anes_end
    const anesTimeWithOutlier = addOutlier(baseAnesTime, 0.15, { min: baseAnesTime + 5, max: baseAnesTime + 12 })
    const anesEnd = addMinutes(currentTime, anesTimeWithOutlier)
    const anesEndId = getMilestoneId('anes_end')
    if (anesEndId) {
      milestones.push({
        case_id: caseId,
        milestone_type_id: anesEndId,
        recorded_at: anesEnd.toISOString(),
      })
    }
  }

  // Prep/Drape Start
  const prepStart = addMinutes(currentTime, template.prep_drape_start)
  const prepStartId = getMilestoneId('prep_drape_start')
  if (prepStartId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: prepStartId,
      recorded_at: prepStart.toISOString(),
    })
  }

  // Prep/Drape Complete
  const prepComplete = addMinutes(currentTime, template.prep_drape_complete)
  const prepCompleteId = getMilestoneId('prep_drape_complete')
  if (prepCompleteId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: prepCompleteId,
      recorded_at: prepComplete.toISOString(),
    })
  }

  // Incision
  const incisionTime = addMinutes(currentTime, template.incision)
  const incisionId = getMilestoneId('incision')
  if (incisionId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: incisionId,
      recorded_at: incisionTime.toISOString(),
    })
  }

  // Closing (with outliers)
  const baseClosingOffset = typeof template.closing === 'function' 
    ? template.closing(surgicalTime) 
    : template.closing
  const closingOffset = addOutlier(baseClosingOffset, 0.15, { min: baseClosingOffset + 5, max: baseClosingOffset + 15 })
  const closingTime = addMinutes(currentTime, closingOffset)
  const closingId = getMilestoneId('closing')
  if (closingId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: closingId,
      recorded_at: closingTime.toISOString(),
    })
  }

  // Closing Complete (with outliers)
  const baseClosingCompleteOffset = typeof template.closing_complete === 'function'
    ? template.closing_complete(surgicalTime)
    : template.closing_complete
  const closingCompleteOffset = addOutlier(baseClosingCompleteOffset, 0.15, { min: baseClosingCompleteOffset + 5, max: baseClosingCompleteOffset + 12 })
  const closingCompleteTime = addMinutes(currentTime, closingCompleteOffset)
  const closingCompleteId = getMilestoneId('closing_complete')
  if (closingCompleteId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: closingCompleteId,
      recorded_at: closingCompleteTime.toISOString(),
    })
  }

  // Patient Out
  const patientOutOffset = typeof template.patient_out === 'function'
    ? template.patient_out(surgicalTime)
    : template.patient_out
  const patientOutTime = addMinutes(currentTime, patientOutOffset)
  const patientOutId = getMilestoneId('patient_out')
  if (patientOutId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: patientOutId,
      recorded_at: patientOutTime.toISOString(),
    })
  }

  // Room Cleaned
  const roomCleanedOffset = typeof template.room_cleaned === 'function'
    ? template.room_cleaned(surgicalTime)
    : template.room_cleaned
  const roomCleanedTime = addMinutes(currentTime, roomCleanedOffset)
  const roomCleanedId = getMilestoneId('room_cleaned')
  if (roomCleanedId) {
    milestones.push({
      case_id: caseId,
      milestone_type_id: roomCleanedId,
      recorded_at: roomCleanedTime.toISOString(),
    })
  }

  return { milestones }
}

function generateStaffAssignments(
  caseId: string,
  surgeon: DemoSurgeon,
  staff: { anesthesiologists: any[]; nurses: any[]; techs: any[] },
  procedureType: any
): any[] {
  const assignments: any[] = []

  // Assign anesthesiologist (skip for some hand cases)
  if (surgeon.specialty !== 'hand_wrist' || Math.random() > 0.3) {
    if (staff.anesthesiologists.length > 0) {
      assignments.push({
        case_id: caseId,
        user_id: randomChoice(staff.anesthesiologists).id,
      })
    }
  }

  // Assign nurse
  if (staff.nurses.length > 0) {
    assignments.push({
      case_id: caseId,
      user_id: randomChoice(staff.nurses).id,
    })
  }

  // Assign tech
  if (staff.techs.length > 0) {
    assignments.push({
      case_id: caseId,
      user_id: randomChoice(staff.techs).id,
    })
  }

  return assignments
}

function generateImplants(
  caseId: string,
  surgeon: DemoSurgeon,
  procedureType: any
): any[] {
  const implants: any[] = []

  // Joint implants
  if (surgeon.specialty === 'joint' && surgeon.preferredVendor) {
    const vendor = surgeon.preferredVendor
    const procedureName = procedureType.name.replace('Mako ', '')
    const specs = IMPLANT_SPECS[vendor]?.[procedureName]

    if (specs) {
      for (const [component, spec] of Object.entries(specs)) {
        const implantSpec = spec as { name: string; sizes: string[]; common: string[] }
        const size = Math.random() < 0.7 
          ? randomChoice(implantSpec.common)
          : randomChoice(implantSpec.sizes)
        
        implants.push({
          case_id: caseId,
          implant_name: implantSpec.name,
          implant_size: size,
          manufacturer: vendor,
          catalog_number: `${component.toUpperCase()}-${size}-${randomInt(1000, 9999)}`,
        })
      }
    }
  }

  return implants
}

// =====================================================
// CLEAR DEMO DATA FUNCTION
// =====================================================

export async function clearDemoData(
  supabase: SupabaseClient,
  facilityId: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.({ phase: 'clearing', current: 10, total: 100, message: 'Fetching case IDs...' })

    const { data: cases } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)

    if (cases && cases.length > 0) {
      const caseIds = cases.map(c => c.id)
      
      onProgress?.({ phase: 'clearing', current: 20, total: 100, message: `Clearing ${caseIds.length} cases...` })
      
      for (let i = 0; i < caseIds.length; i += BATCH_SIZE) {
        const batchIds = caseIds.slice(i, i + BATCH_SIZE)
        
        await supabase.from('case_implants').delete().in('case_id', batchIds)
        await supabase.from('case_milestones').delete().in('case_id', batchIds)
        await supabase.from('case_staff').delete().in('case_id', batchIds)
        
        const progress = 20 + Math.floor((i / caseIds.length) * 40)
        onProgress?.({ phase: 'clearing', current: progress, total: 100, message: `Cleared ${Math.min(i + BATCH_SIZE, caseIds.length)} of ${caseIds.length} cases...` })
      }
    }

    onProgress?.({ phase: 'clearing', current: 60, total: 100, message: 'Clearing cases...' })

    const { error: caseError } = await supabase
      .from('cases')
      .delete()
      .eq('facility_id', facilityId)

    if (caseError) {
      return { success: false, error: `Failed to clear cases: ${caseError.message}` }
    }

    onProgress?.({ phase: 'clearing', current: 70, total: 100, message: 'Clearing surgeon averages...' })

    const { data: facilityUsers } = await supabase
      .from('users')
      .select('id')
      .eq('facility_id', facilityId)

    if (facilityUsers && facilityUsers.length > 0) {
      const userIds = facilityUsers.map(u => u.id)
      await supabase.from('surgeon_procedure_averages').delete().in('surgeon_id', userIds)
      await supabase.from('surgeon_milestone_averages').delete().in('surgeon_id', userIds)
    }

    onProgress?.({ phase: 'clearing', current: 80, total: 100, message: 'Clearing demo users...' })

    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('facility_id', facilityId)
      .like('email', '%@demo.orbit.com')

    if (userError) {
      console.warn('Could not delete demo users:', userError.message)
    }

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Demo data cleared!' })

    return { success: true }
  } catch (error) {
    console.error('Clear demo data error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// =====================================================
// GET DEMO DATA STATUS
// =====================================================

export async function getDemoDataStatus(
  supabase: SupabaseClient,
  facilityId: string
): Promise<{
  cases: number
  milestones: number
  staff: number
  implants: number
  delays: number
}> {
  const { count: caseCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', facilityId)

  const { data: counts, error } = await supabase.rpc('get_facility_demo_counts', {
    p_facility_id: facilityId
  })

  if (error || !counts) {
    return {
      cases: caseCount || 0,
      milestones: 0,
      staff: 0,
      implants: 0,
      delays: 0,
    }
  }

  return {
    cases: caseCount || 0,
    milestones: counts.milestone_count || 0,
    staff: counts.staff_count || 0,
    implants: counts.implant_count || 0,
    delays: counts.delay_count || 0,
  }
}
