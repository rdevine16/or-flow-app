// lib/demo-data-generator.ts
// Demo data generation for ORbit analytics
// Generates 6 months historical + 2 weeks future data with realistic patterns

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
  profile: 'high_volume' | 'medium_volume' | 'low_volume'
  operatingDays: number[] // 0=Sunday, 1=Monday, etc.
  preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes'
  procedureTypes: string[] // procedure_type IDs
  useMako: boolean
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

// Surgeon profile timing configurations (in minutes)
const SURGEON_PROFILES = {
  high_volume: {
    casesPerDay: { min: 8, max: 10 },
    roomsUsed: 3,
    startTime: '07:00',
    surgicalTime: { min: 35, max: 45, avg: 40 },
    totalTime: { min: 60, max: 70, avg: 65 },
    turnoverTime: { min: 10, max: 15 },
  },
  medium_volume: {
    casesPerDay: { min: 4, max: 6 },
    roomsUsed: 2,
    startTime: '07:30',
    surgicalTime: { min: 45, max: 60, avg: 52 },
    totalTime: { min: 75, max: 95, avg: 85 },
    turnoverTime: { min: 15, max: 20 },
  },
  low_volume: {
    casesPerDay: { min: 2, max: 3 },
    roomsUsed: 1,
    startTime: '08:00',
    surgicalTime: { min: 60, max: 70, avg: 65 },
    totalTime: { min: 90, max: 105, avg: 97 },
    turnoverTime: { min: 20, max: 25 },
  },
}

// Milestone timing offsets from patient_in (in minutes)
// Format: [high_volume, medium_volume, low_volume]
const MILESTONE_OFFSETS = {
  THA: {
    patient_in: [0, 0, 0],
    anes_start: [2, 3, 4],
    anes_end: [12, 15, 18],
    prepped: [14, 17, 20],
    draping_complete: [18, 22, 28],
    incision: [20, 25, 30],
    closing: [55, 75, 95],
    closing_complete: [60, 82, 103],
    patient_out: [65, 87, 108],
    room_cleaned: [75, 97, 118],
  },
  TKA: {
    patient_in: [0, 0, 0],
    anes_start: [2, 3, 4],
    anes_end: [14, 17, 20],
    prepped: [16, 20, 25],
    draping_complete: [20, 25, 32],
    incision: [22, 28, 35],
    closing: [60, 82, 105],
    closing_complete: [66, 90, 115],
    patient_out: [72, 97, 120],
    room_cleaned: [82, 107, 130],
  },
}

// Implant component specification type
interface ImplantComponent {
  name: string
  sizes: string[]
  common: string[]
}

interface ProcedureImplants {
  [key: string]: ImplantComponent
}

interface VendorImplants {
  THA: ProcedureImplants
  TKA: ProcedureImplants
}

// Implant specifications by vendor
const IMPLANT_SPECS: Record<'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes', VendorImplants> = {
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

// US Holidays (fixed dates for 2024-2025)
const US_HOLIDAYS = [
  // 2024
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-05-27', '2024-07-04',
  '2024-09-02', '2024-10-14', '2024-11-11', '2024-11-28', '2024-11-29',
  '2024-12-24', '2024-12-25', '2024-12-31',
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-07-04',
  '2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-11-28',
  '2025-12-24', '2025-12-25', '2025-12-31',
  // 2026
  '2026-01-01', '2026-01-19',
]

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
  if (array.length === 0) {
    throw new Error('Cannot select from empty array')
  }
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
  // Box-Muller transform for normal distribution
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return z0 * stdDev + mean
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0]
  return US_HOLIDAYS.includes(dateStr)
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date)
}

function formatDateEST(date: Date): string {
  // Format as YYYY-MM-DD in EST
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function formatTimeEST(date: Date): string {
  // Format as HH:MM:SS - extract the time components we set
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatTimestampEST(date: Date): string {
  // The date was set with setUTCHours to represent local EST time.
  // But the frontend displays timestamps in local time (EST = UTC-5).
  // So we need to add 5 hours to store the correct UTC time that will display as EST.
  // Example: We want 7:00 AM EST to display
  //   - 7:00 AM EST = 12:00 PM UTC
  //   - Store 12:00 PM UTC, frontend shows 7:00 AM EST ✓
  const EST_OFFSET_HOURS = 5
  const utcDate = new Date(date.getTime() + EST_OFFSET_HOURS * 60 * 60 * 1000)
  return utcDate.toISOString()
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000)
}

function generateCaseNumber(facilityPrefix: string, date: Date, sequence: number): string {
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '')
  const seqStr = String(sequence).padStart(3, '0')
  return `${facilityPrefix}-${dateStr}-S${seqStr}`
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// =====================================================
// DATA GENERATION FUNCTIONS
// =====================================================

interface GeneratedCase {
  id: string
  facility_id: string
  case_number: string
  or_room_id: string
  procedure_type_id: string
  status_id: string
  surgeon_id: string
  anesthesiologist_id: string
  scheduled_date: string
  start_time: string
  call_time: string | null
  operative_side: 'left' | 'right' | 'bilateral' | null
  notes: string | null
  payer_id: string
}

interface GeneratedMilestone {
  id: string
  case_id: string
  milestone_type_id: string | null  // source_milestone_type_id from facility_milestones
  facility_milestone_id: string     // The facility_milestones.id - this is what the UI uses
  recorded_at: string
  recorded_by: string
}

interface GeneratedCaseStaff {
  id: string
  case_id: string
  user_id: string
  role_id: string
}

// One implant record per case - matches your actual case_implants schema
interface GeneratedImplant {
  id: string
  case_id: string
  fixation_type: string | null
  // THA (hip) components
  cup_brand: string | null
  cup_size_templated: string | null
  cup_size_final: string | null
  stem_brand: string | null
  stem_size_templated: string | null
  stem_size_final: string | null
  head_size_templated: string | null
  head_size_final: string | null
  liner_size_templated: string | null
  liner_size_final: string | null
  // TKA (knee) components
  femur_brand: string | null
  femur_type: string | null
  femur_size_templated: string | null
  femur_size_final: string | null
  tibia_brand: string | null
  tibia_size_templated: string | null
  tibia_size_final: string | null
  poly_brand: string | null
  poly_size_templated: string | null
  poly_size_final: string | null
  patella_brand: string | null
  patella_type: string | null
  patella_size_templated: string | null
  patella_size_final: string | null
  rep_notes: string | null
}

interface GeneratedDelay {
  id: string
  case_id: string
  delay_type_id: string
  duration_minutes: number
  notes: string | null
}

async function fetchFacilityData(supabase: SupabaseClient, facilityId: string) {
  // Fetch all related data for the facility
  const [
    { data: rooms },
    { data: procedures },
    { data: users },
    { data: facilityMilestones },
    { data: statuses },
    { data: roles },
    { data: payers },
    { data: delayTypes },
    { data: implantCompanies },
  ] = await Promise.all([
    supabase.from('or_rooms').select('*').eq('facility_id', facilityId),
    supabase.from('procedure_types').select('*').eq('facility_id', facilityId),
    supabase.from('users').select('*, user_roles(name)').eq('facility_id', facilityId),
    // Use facility_milestones instead of global milestone_types
    supabase.from('facility_milestones').select('id, name, display_name, display_order, source_milestone_type_id').eq('facility_id', facilityId).eq('is_active', true).order('display_order'),
    supabase.from('case_statuses').select('*'),
    supabase.from('user_roles').select('*'),
    supabase.from('payers').select('*').eq('facility_id', facilityId),
    supabase.from('delay_types').select('*'),
    supabase.from('implant_companies').select('*'),
  ])

  return {
    rooms: rooms || [],
    procedures: procedures || [],
    users: users || [],
    facilityMilestones: facilityMilestones || [],
    statuses: statuses || [],
    roles: roles || [],
    payers: payers || [],
    delayTypes: delayTypes || [],
    implantCompanies: implantCompanies || [],
  }
}

function getSurgeonProfile(userId: string, facilityData: any): DemoSurgeon | null {
  const user = facilityData.users.find((u: any) => u.id === userId)
  if (!user) return null
  
  const surgeonRole = facilityData.roles.find((r: any) => r.name === 'surgeon')
  if (!surgeonRole || user.role_id !== surgeonRole.id) return null

  // Determine profile based on some heuristic (could be enhanced)
  // For now, use first name length as a simple deterministic "randomizer"
  const nameLength = user.first_name?.length || 5
  let profile: 'high_volume' | 'medium_volume' | 'low_volume'
  let operatingDays: number[]
  
  if (nameLength <= 4) {
    profile = 'high_volume'
    operatingDays = [1, 4] // Monday, Thursday
  } else if (nameLength <= 6) {
    profile = 'medium_volume'
    operatingDays = [2, 5] // Tuesday, Friday
  } else {
    profile = 'low_volume'
    operatingDays = [3, 5] // Wednesday, Friday
  }

  // Determine preferred vendor based on last name
  const lastName = user.last_name || ''
  let preferredVendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes'
  const lastNameFirst = lastName.charAt(0).toLowerCase()
  if (lastNameFirst < 'h') {
    preferredVendor = 'Stryker'
  } else if (lastNameFirst < 'p') {
    preferredVendor = 'Zimmer Biomet'
  } else {
    preferredVendor = 'DePuy Synthes'
  }

  // THA and TKA procedures
  const thaProcedure = facilityData.procedures.find((p: any) => 
    p.name.toLowerCase().includes('tha') || p.name.toLowerCase().includes('hip')
  )
  const tkaProcedure = facilityData.procedures.find((p: any) => 
    p.name.toLowerCase().includes('tka') || p.name.toLowerCase().includes('knee')
  )

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    facilityId: user.facility_id,
    profile,
    operatingDays,
    preferredVendor,
    procedureTypes: [thaProcedure?.id, tkaProcedure?.id].filter(Boolean),
    useMako: preferredVendor === 'Stryker', // Only Stryker surgeons use Mako
  }
}

function generateMilestones(
  caseId: string,
  patientInTime: Date,
  procedureType: 'THA' | 'TKA',
  surgeonProfile: 'high_volume' | 'medium_volume' | 'low_volume',
  isOutlier: boolean,
  facilityMilestones: any[],
  recordedBy: string
): GeneratedMilestone[] {
  const milestones: GeneratedMilestone[] = []
  const profileIndex = surgeonProfile === 'high_volume' ? 0 : surgeonProfile === 'medium_volume' ? 1 : 2
  const offsets = MILESTONE_OFFSETS[procedureType]

  // Add variance to times
  const variance = isOutlier ? randomInt(25, 45) : randomInt(-3, 5)

  // Standard milestones to generate (must match names in facility_milestones)
  const milestoneNames = ['patient_in', 'anes_start', 'anes_end', 'prepped', 'draping_complete', 'incision', 'closing', 'closing_complete', 'patient_out']

  for (const name of milestoneNames) {
    // Find the facility milestone by name
    const facilityMilestone = facilityMilestones.find((fm: any) => fm.name === name)
    if (!facilityMilestone) continue

    const baseOffset = (offsets as any)[name]?.[profileIndex] || 0
    const actualOffset = baseOffset + (name !== 'patient_in' ? variance : 0)
    const timestamp = addMinutes(patientInTime, Math.max(0, actualOffset))
    
    // Add random seconds (0-59) for realistic timestamps
    timestamp.setUTCSeconds(randomInt(0, 59))

    milestones.push({
      id: generateUUID(),
      case_id: caseId,
      milestone_type_id: facilityMilestone.source_milestone_type_id || null,
      facility_milestone_id: facilityMilestone.id,
      recorded_at: formatTimestampEST(timestamp),
      recorded_by: recordedBy,
    })
  }

  return milestones
}

function generateImplants(
  caseId: string,
  procedureType: 'THA' | 'TKA',
  vendor: 'Stryker' | 'Zimmer Biomet' | 'DePuy Synthes',
  implantCompanies: any[]
): GeneratedImplant | null {
  // Helper to pick a size with possible variance
  const pickSize = (sizes: string[], commonSizes: string[]): { templated: string; final: string } => {
    const sizePool = Math.random() < 0.7 ? commonSizes : sizes
    const templated = sizePool[Math.floor(Math.random() * sizePool.length)]
    let final = templated
    if (Math.random() < 0.3) {
      const idx = sizes.indexOf(templated)
      const newIdx = Math.max(0, Math.min(sizes.length - 1, idx + (Math.random() < 0.5 ? -1 : 1)))
      final = sizes[newIdx]
    }
    return { templated, final }
  }

  // Brand names by vendor
  const brandNames: Record<string, Record<string, string>> = {
    'Stryker': {
      cup: 'Stryker Tritanium',
      stem: 'Stryker Accolade II',
      head: 'Stryker V40',
      liner: 'Stryker X3',
      femur: 'Stryker Triathlon',
      tibia: 'Stryker Triathlon',
      poly: 'Stryker Triathlon X3',
      patella: 'Stryker Triathlon',
    },
    'Zimmer Biomet': {
      cup: 'Zimmer G7',
      stem: 'Zimmer Taperloc',
      head: 'Zimmer',
      liner: 'Zimmer Vivacit-E',
      femur: 'Zimmer Persona',
      tibia: 'Zimmer Persona',
      poly: 'Zimmer Persona Vivacit-E',
      patella: 'Zimmer Persona',
    },
    'DePuy Synthes': {
      cup: 'DePuy Pinnacle',
      stem: 'DePuy Corail',
      head: 'DePuy',
      liner: 'DePuy Marathon',
      femur: 'DePuy ATTUNE',
      tibia: 'DePuy ATTUNE',
      poly: 'DePuy ATTUNE',
      patella: 'DePuy ATTUNE',
    },
  }

  const brands = brandNames[vendor] || brandNames['Stryker']
  const specs = IMPLANT_SPECS[vendor]?.[procedureType]
  if (!specs) return null

  if (procedureType === 'THA') {
    const cup = pickSize(specs.cup.sizes, specs.cup.common)
    const stem = pickSize(specs.stem.sizes, specs.stem.common)
    const head = pickSize(specs.head.sizes, specs.head.common)
    const liner = pickSize(specs.liner.sizes, specs.liner.common)

    return {
      id: generateUUID(),
      case_id: caseId,
      fixation_type: Math.random() < 0.85 ? 'pressfit' : 'cemented',
      // THA components
      cup_brand: brands.cup,
      cup_size_templated: cup.templated,
      cup_size_final: cup.final,
      stem_brand: brands.stem,
      stem_size_templated: stem.templated,
      stem_size_final: stem.final,
      head_size_templated: head.templated,
      head_size_final: head.final,
      liner_size_templated: liner.templated,
      liner_size_final: liner.final,
      // TKA components (null for THA)
      femur_brand: null,
      femur_type: null,
      femur_size_templated: null,
      femur_size_final: null,
      tibia_brand: null,
      tibia_size_templated: null,
      tibia_size_final: null,
      poly_brand: null,
      poly_size_templated: null,
      poly_size_final: null,
      patella_brand: null,
      patella_type: null,
      patella_size_templated: null,
      patella_size_final: null,
      rep_notes: null,
    }
  } else {
    // TKA
    const femur = pickSize(specs.femur.sizes, specs.femur.common)
    const tibia = pickSize(specs.tibia.sizes, specs.tibia.common)
    const poly = pickSize(specs.poly.sizes, specs.poly.common)
    const patella = pickSize(specs.patella.sizes, specs.patella.common)

    return {
      id: generateUUID(),
      case_id: caseId,
      fixation_type: Math.random() < 0.7 ? 'pressfit' : 'cemented',
      // THA components (null for TKA)
      cup_brand: null,
      cup_size_templated: null,
      cup_size_final: null,
      stem_brand: null,
      stem_size_templated: null,
      stem_size_final: null,
      head_size_templated: null,
      head_size_final: null,
      liner_size_templated: null,
      liner_size_final: null,
      // TKA components
      femur_brand: brands.femur,
      femur_type: Math.random() < 0.6 ? 'PS' : 'CR',
      femur_size_templated: femur.templated,
      femur_size_final: femur.final,
      tibia_brand: brands.tibia,
      tibia_size_templated: tibia.templated,
      tibia_size_final: tibia.final,
      poly_brand: brands.poly,
      poly_size_templated: poly.templated,
      poly_size_final: poly.final,
      patella_brand: brands.patella,
      patella_type: Math.random() < 0.7 ? 'asymmetric' : 'symmetric',
      patella_size_templated: patella.templated,
      patella_size_final: patella.final,
      rep_notes: null,
    }
  }
}

// =====================================================
// MAIN GENERATION FUNCTION
// =====================================================

export async function generateDemoData(
  supabase: SupabaseClient,
  facilityId: string,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; casesGenerated: number; error?: string; details?: { milestones: number; staff: number; implants: number; delays: number }; debug?: { milestoneTypesFound: number; surgeonsFound: number; proceduresFound: number; roomsFound: number; payersFound: number; milestoneErrors: string[] | null; staffErrors: string[] | null; implantErrors: string[] | null } }> {
  try {
    onProgress?.({ phase: 'setup', current: 0, total: 100, message: 'Loading facility data...' })

    // Fetch facility data
    const facilityData = await fetchFacilityData(supabase, facilityId)
    
    const { data: facility } = await supabase
      .from('facilities')
      .select('name, case_number_prefix')
      .eq('id', facilityId)
      .single()

    if (!facility) {
      return { success: false, casesGenerated: 0, error: 'Facility not found' }
    }

    const facilityPrefix = facility.case_number_prefix || 'DEMO'

    // Find surgeons
    const surgeonRole = facilityData.roles.find((r: any) => r.name === 'surgeon')
    const surgeons = facilityData.users.filter((u: any) => u.role_id === surgeonRole?.id)
    
    if (surgeons.length === 0) {
      return { success: false, casesGenerated: 0, error: 'No surgeons found in facility' }
    }

    // Build surgeon profiles
    const surgeonProfiles: DemoSurgeon[] = surgeons
      .map((s: any) => getSurgeonProfile(s.id, facilityData))
      .filter(Boolean) as DemoSurgeon[]

    // Find anesthesiologists
    const anesRole = facilityData.roles.find((r: any) => r.name === 'anesthesiologist')
    const anesthesiologists = facilityData.users.filter((u: any) => u.role_id === anesRole?.id)
    
    // Find nurses and techs
    const nurseRole = facilityData.roles.find((r: any) => r.name === 'nurse')
    const techRole = facilityData.roles.find((r: any) => r.name === 'tech')
    const nurses = facilityData.users.filter((u: any) => u.role_id === nurseRole?.id)
    const techs = facilityData.users.filter((u: any) => u.role_id === techRole?.id)

    // Find status IDs
    const scheduledStatus = facilityData.statuses.find((s: any) => s.name === 'scheduled')
    const inProgressStatus = facilityData.statuses.find((s: any) => s.name === 'in_progress')
    const completedStatus = facilityData.statuses.find((s: any) => s.name === 'completed')

    if (!scheduledStatus || !completedStatus) {
      return { success: false, casesGenerated: 0, error: 'Required case statuses not found' }
    }

    // Date range: 6 months ago to 2 weeks from now
    const today = new Date()
    const startDate = new Date(today)
    startDate.setMonth(startDate.getMonth() - 6)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 14)

    // Pick one surgeon to be "chronically late" for first cases (for realistic analytics story)
    // This surgeon will be late ~60% of the time for first cases
    const problemSurgeonId = surgeonProfiles.length > 1 
      ? surgeonProfiles[Math.floor(Math.random() * surgeonProfiles.length)].id 
      : null
    
    // Track late starts per surgeon per month (for non-problem surgeons)
    // Key: `${surgeonId}-${year}-${month}`, Value: count of late starts
    const lateStartsPerMonth: Map<string, number> = new Map()
    const MAX_LATE_STARTS_PER_MONTH = 3 // Max late starts for non-problem surgeons

    onProgress?.({ phase: 'generating', current: 5, total: 100, message: 'Generating cases...' })

    // Generate all cases
    const allCases: GeneratedCase[] = []
    const allMilestones: GeneratedMilestone[] = []
    const allCaseStaff: GeneratedCaseStaff[] = []
    const allImplants: GeneratedImplant[] = []
    const allDelays: GeneratedDelay[] = []

    let caseSequence = 1
    let currentDate = new Date(startDate)
    let processedDays = 0
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    while (currentDate <= endDate) {
      if (!isBusinessDay(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      const dayOfWeek = currentDate.getDay()
      const dateStr = formatDateEST(currentDate)
      const isPastDate = currentDate < today

      // Find surgeons operating today
      const operatingSurgeons = surgeonProfiles.filter(s => s.operatingDays.includes(dayOfWeek))

      for (const surgeon of operatingSurgeons) {
        const profile = SURGEON_PROFILES[surgeon.profile]
        const casesForDay = randomInt(profile.casesPerDay.min, profile.casesPerDay.max)
        
        // Get rooms for this surgeon
        const availableRooms = facilityData.rooms.slice(0, profile.roomsUsed)
        if (availableRooms.length === 0) continue

        // Parse scheduled start time
        const [startHour, startMin] = profile.startTime.split(':').map(Number)
        let scheduledStartTime = new Date(currentDate)
        scheduledStartTime.setUTCHours(startHour, startMin, 0, 0)

        // Find all 4 procedure types
        const makoTHA = facilityData.procedures.find((p: any) => 
          p.name.toLowerCase().includes('mako') && (p.name.toLowerCase().includes('tha') || p.name.toLowerCase().includes('hip'))
        )
        const makoTKA = facilityData.procedures.find((p: any) => 
          p.name.toLowerCase().includes('mako') && (p.name.toLowerCase().includes('tka') || p.name.toLowerCase().includes('knee'))
        )
        const standardTHA = facilityData.procedures.find((p: any) => 
          !p.name.toLowerCase().includes('mako') && (p.name.toLowerCase().includes('tha') || p.name.toLowerCase().includes('hip'))
        )
        const standardTKA = facilityData.procedures.find((p: any) => 
          !p.name.toLowerCase().includes('mako') && (p.name.toLowerCase().includes('tka') || p.name.toLowerCase().includes('knee'))
        )

        // Build available procedures for this surgeon based on their preference
        let availableProcedures: any[] = []
        if (surgeon.useMako) {
          // Mako surgeons: 70% Mako, 30% standard
          if (makoTHA) availableProcedures.push({ proc: makoTHA, weight: 35 })
          if (makoTKA) availableProcedures.push({ proc: makoTKA, weight: 35 })
          if (standardTHA) availableProcedures.push({ proc: standardTHA, weight: 15 })
          if (standardTKA) availableProcedures.push({ proc: standardTKA, weight: 15 })
        } else {
          // Non-Mako surgeons: mostly standard, occasional Mako
          if (standardTHA) availableProcedures.push({ proc: standardTHA, weight: 40 })
          if (standardTKA) availableProcedures.push({ proc: standardTKA, weight: 40 })
          if (makoTHA) availableProcedures.push({ proc: makoTHA, weight: 10 })
          if (makoTKA) availableProcedures.push({ proc: makoTKA, weight: 10 })
        }

        // Fallback if no procedures found
        if (availableProcedures.length === 0) {
          const anyProc = facilityData.procedures[0]
          if (anyProc) availableProcedures.push({ proc: anyProc, weight: 100 })
        }

        // Track current time for case scheduling
        let currentTime = new Date(scheduledStartTime)

        for (let i = 0; i < casesForDay; i++) {
          const room = availableRooms[i % availableRooms.length]
          
          // Select procedure with weights
          const totalWeight = availableProcedures.reduce((sum, p) => sum + p.weight, 0)
          let rand = Math.random() * totalWeight
          let procedure = availableProcedures[0].proc
          for (const p of availableProcedures) {
            rand -= p.weight
            if (rand <= 0) {
              procedure = p.proc
              break
            }
          }
          if (!procedure) continue

          const procedureType: 'THA' | 'TKA' = procedure.name.toLowerCase().includes('tha') || 
            procedure.name.toLowerCase().includes('hip') ? 'THA' : 'TKA'

          // FIRST CASE TIMING LOGIC
          let patientInTime = new Date(currentTime)
          if (i === 0) {
            // First case of the day - timing depends on surgeon
            const isProblemSurgeon = surgeon.id === problemSurgeonId
            const monthKey = `${surgeon.id}-${currentDate.getFullYear()}-${currentDate.getMonth()}`
            const currentMonthLateStarts = lateStartsPerMonth.get(monthKey) || 0
            
            let shouldBeLate = false
            
            if (isProblemSurgeon) {
              // Problem surgeon: 60% late first cases
              shouldBeLate = Math.random() < 0.60
            } else {
              // Other surgeons: only late if under monthly limit (2-3 per month)
              // ~10% chance but capped at MAX_LATE_STARTS_PER_MONTH
              if (currentMonthLateStarts < MAX_LATE_STARTS_PER_MONTH && Math.random() < 0.10) {
                shouldBeLate = true
              }
            }
            
            if (shouldBeLate) {
              // Late start: 15-30 minutes AFTER scheduled start
              patientInTime = addMinutes(scheduledStartTime, randomInt(15, 30))
              // Track this late start
              lateStartsPerMonth.set(monthKey, currentMonthLateStarts + 1)
            } else {
              // On time or early
              const earlyRand = Math.random()
              if (earlyRand < 0.75) {
                // 75% - Patient in 5-12 minutes BEFORE scheduled start
                patientInTime = addMinutes(scheduledStartTime, -randomInt(5, 12))
              } else {
                // 25% - Slightly early (1-4 minutes before)
                patientInTime = addMinutes(scheduledStartTime, -randomInt(1, 4))
              }
            }
          } else {
            // Subsequent cases - use current time (after previous case turnover)
            patientInTime = new Date(currentTime)
          }

          // Is this an outlier case? (5-10% chance)
          const isOutlier = Math.random() < 0.08

          // Select payer based on distribution
          // Outliers are more likely to have lower-paying payers (Medicaid, Self-Pay)
          let selectedPayer = null
          if (isOutlier && Math.random() < 0.50) {
            // 50% of outliers get low-paying payers
            const lowPayers = ['medicaid', 'self']
            const lowPayerName = randomChoice(lowPayers)
            selectedPayer = facilityData.payers.find((p: any) => 
              p.name.toLowerCase().includes(lowPayerName)
            )
          }
          
          if (!selectedPayer) {
            // Normal payer distribution
            const payerNames = Object.keys(PAYER_DISTRIBUTION)
            const payerWeights = Object.values(PAYER_DISTRIBUTION)
            const selectedPayerName = weightedRandomChoice(payerNames, payerWeights)
            selectedPayer = facilityData.payers.find((p: any) => 
              p.name.toLowerCase().includes(selectedPayerName.toLowerCase())
            )
          }

          // Generate operative side
          let operativeSide: 'left' | 'right' | 'bilateral' | null = null
          const sideRand = Math.random()
          if (sideRand < 0.48) {
            operativeSide = 'left'
          } else if (sideRand < 0.96) {
            operativeSide = 'right'
          } else if (procedureType === 'TKA') {
            operativeSide = 'bilateral'
          } else {
            operativeSide = Math.random() < 0.5 ? 'left' : 'right'
          }

          // Calculate call time (15-30 min before patient_in, except first case)
          const callTime = i === 0 ? null : addMinutes(patientInTime, -randomInt(15, 30))

          const caseId = generateUUID()
          const caseNumber = generateCaseNumber(facilityPrefix, currentDate, caseSequence++)

          // Determine status based on date
          const status = isPastDate ? completedStatus : scheduledStatus

          // Skip case if no payer found (shouldn't happen if SQL migration ran)
          if (!selectedPayer) {
            console.warn(`No payer found for ${selectedPayer}, skipping case`)
            continue
          }

          // For first case, use scheduled start time; for others use expected start
          const displayStartTime = i === 0 ? scheduledStartTime : currentTime

          const newCase: GeneratedCase = {
            id: caseId,
            facility_id: facilityId,
            case_number: caseNumber,
            or_room_id: room.id,
            procedure_type_id: procedure.id,
            status_id: status.id,
            surgeon_id: surgeon.id,
            anesthesiologist_id: anesthesiologists.length > 0 
              ? randomChoice(anesthesiologists).id 
              : surgeon.id,
            scheduled_date: dateStr,
            start_time: formatTimeEST(displayStartTime),
            call_time: callTime ? formatTimestampEST(callTime) : null,
            operative_side: operativeSide,
            notes: isOutlier ? 'Complex case - extended surgical time' : null,
            payer_id: selectedPayer.id,
          }

          allCases.push(newCase)

          // Generate milestones for past cases - use patientInTime as the actual start
          if (isPastDate) {
            const milestones = generateMilestones(
              caseId,
              patientInTime,
              procedureType,
              surgeon.profile,
              isOutlier,
              facilityData.facilityMilestones,
              surgeon.id
            )
            allMilestones.push(...milestones)
          }

          // Note: Surgeon and Anesthesiologist are already on the case record 
          // (surgeon_id, anesthesiologist_id) - don't add to case_staff to avoid duplicates

          // Add nurses (1-2)
          if (nurses.length > 0 && nurseRole) {
            const numNurses = Math.min(nurses.length, randomInt(1, 2))
            const selectedNurses = [...nurses].sort(() => Math.random() - 0.5).slice(0, numNurses)
            for (const nurse of selectedNurses) {
              allCaseStaff.push({
                id: generateUUID(),
                case_id: caseId,
                user_id: nurse.id,
                role_id: nurseRole.id,
              })
            }
          }

          // Add tech
          if (techs.length > 0 && techRole) {
            allCaseStaff.push({
              id: generateUUID(),
              case_id: caseId,
              user_id: randomChoice(techs).id,
              role_id: techRole.id,
            })
          }

          // Generate implants (one record per case)
          const vendor = surgeon.useMako ? 'Stryker' : surgeon.preferredVendor
          const implant = generateImplants(caseId, procedureType, vendor, facilityData.implantCompanies)
          if (implant) {
            allImplants.push(implant)
          }

          // Generate delays for outlier cases - ALWAYS add a delay so the cause is clear
          if (isOutlier && isPastDate && facilityData.delayTypes.length > 0) {
            // Pick a delay type that makes sense
            const delayCategories = [
              { keywords: ['equipment', 'instrument'], notes: 'Equipment malfunction required troubleshooting' },
              { keywords: ['staff', 'personnel'], notes: 'Staff availability delay' },
              { keywords: ['patient', 'medical'], notes: 'Patient-related medical issue' },
              { keywords: ['anesthesia'], notes: 'Anesthesia complications required additional time' },
              { keywords: ['room', 'turnover'], notes: 'Room turnover delay from previous case' },
            ]
            
            // Try to find a matching delay type, otherwise use random
            let delayType = facilityData.delayTypes[0]
            let delayNotes = 'Unexpected delay during procedure'
            
            const categoryIndex = randomInt(0, delayCategories.length - 1)
            const category = delayCategories[categoryIndex]
            
            const matchingType = facilityData.delayTypes.find((dt: any) => 
              category.keywords.some(kw => dt.name?.toLowerCase().includes(kw))
            )
            
            if (matchingType) {
              delayType = matchingType
              delayNotes = category.notes
            } else {
              delayType = randomChoice(facilityData.delayTypes)
            }
            
            allDelays.push({
              id: generateUUID(),
              case_id: caseId,
              delay_type_id: delayType.id,
              duration_minutes: randomInt(15, 45),
              notes: delayNotes,
            })
          }

          // Move to next case time (from actual patient_in time + case duration + turnover)
          const caseEndOffset = MILESTONE_OFFSETS[procedureType].room_cleaned[
            surgeon.profile === 'high_volume' ? 0 : surgeon.profile === 'medium_volume' ? 1 : 2
          ]
          const turnover = randomInt(profile.turnoverTime.min, profile.turnoverTime.max)
          currentTime = addMinutes(patientInTime, caseEndOffset + turnover + (isOutlier ? randomInt(25, 45) : 0))
        }
      }

      processedDays++
      const progress = Math.floor((processedDays / totalDays) * 80) + 10
      onProgress?.({ 
        phase: 'generating', 
        current: progress, 
        total: 100, 
        message: `Processing ${dateStr}... (${allCases.length} cases)` 
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    onProgress?.({ phase: 'inserting', current: 90, total: 100, message: `Inserting ${allCases.length} cases...` })

    // Disable audit triggers (they require user session which service role doesn't have)
    const { error: disableError } = await supabase.rpc('disable_demo_audit_triggers')
    if (disableError) {
      console.error('Could not disable audit triggers:', disableError)
      return { 
        success: false, 
        casesGenerated: 0, 
        error: `Failed to disable audit triggers: ${disableError.message}. Run this SQL manually: ALTER TABLE case_implants DISABLE TRIGGER audit_case_implants_trigger;` 
      }
    }

    // Batch insert all data
    const BATCH_SIZE = 100

    // Insert cases
    for (let i = 0; i < allCases.length; i += BATCH_SIZE) {
      const batch = allCases.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('cases').insert(batch)
      if (error) {
        console.error('Error inserting cases:', error)
        // Re-enable triggers before returning
        try { await supabase.rpc('enable_demo_audit_triggers') } catch (_) {}
        return { success: false, casesGenerated: i, error: `Failed to insert cases: ${error.message}` }
      }
    }

    onProgress?.({ phase: 'inserting', current: 93, total: 100, message: 'Inserting milestones...' })

    // Insert milestones
    let milestoneErrors: string[] = []
    for (let i = 0; i < allMilestones.length; i += BATCH_SIZE) {
      const batch = allMilestones.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_milestones').insert(batch)
      if (error) {
        console.error('Error inserting milestones:', error)
        milestoneErrors.push(error.message)
      }
    }

    onProgress?.({ phase: 'inserting', current: 95, total: 100, message: 'Inserting staff assignments...' })

    // Insert case staff
    let staffErrors: string[] = []
    for (let i = 0; i < allCaseStaff.length; i += BATCH_SIZE) {
      const batch = allCaseStaff.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_staff').insert(batch)
      if (error) {
        console.error('Error inserting case staff:', error)
        staffErrors.push(error.message)
      }
    }

    onProgress?.({ phase: 'inserting', current: 97, total: 100, message: 'Inserting implants...' })

    // Insert implants
    let implantErrors: string[] = []
    for (let i = 0; i < allImplants.length; i += BATCH_SIZE) {
      const batch = allImplants.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_implants').insert(batch)
      if (error) {
        console.error('Error inserting implants:', error)
        implantErrors.push(error.message)
      }
    }

    // Insert delays
    for (let i = 0; i < allDelays.length; i += BATCH_SIZE) {
      const batch = allDelays.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('case_delays').insert(batch)
      if (error) {
        console.error('Error inserting delays:', error)
      }
    }

    // Re-enable audit triggers
    const { error: enableError } = await supabase.rpc('enable_demo_audit_triggers')
    if (enableError) {
      console.warn('Could not re-enable audit triggers:', enableError.message)
    }

    onProgress?.({ phase: 'finalizing', current: 98, total: 100, message: 'Recalculating surgeon averages...' })

    // Recalculate surgeon averages
    const { error: avgError } = await supabase.rpc('recalculate_surgeon_averages')
    if (avgError) {
      console.error('Error recalculating averages:', avgError)
    }

    onProgress?.({ phase: 'complete', current: 100, total: 100, message: 'Demo data generation complete!' })

    // Build debug info
    const debugInfo = {
      milestoneTypesFound: facilityData.facilityMilestones.length,
      surgeonsFound: surgeonProfiles.length,
      proceduresFound: facilityData.procedures.length,
      roomsFound: facilityData.rooms.length,
      payersFound: facilityData.payers.length,
      milestoneErrors: milestoneErrors.length > 0 ? milestoneErrors.slice(0, 3) : null,
      staffErrors: staffErrors.length > 0 ? staffErrors.slice(0, 3) : null,
      implantErrors: implantErrors.length > 0 ? implantErrors.slice(0, 3) : null,
    }

    console.log('Generation debug info:', debugInfo)
    console.log('Generated counts:', {
      cases: allCases.length,
      milestones: allMilestones.length,
      staff: allCaseStaff.length,
      implants: allImplants.length,
      delays: allDelays.length,
    })

    return { 
      success: true, 
      casesGenerated: allCases.length,
      details: {
        milestones: allMilestones.length,
        staff: allCaseStaff.length,
        implants: allImplants.length,
        delays: allDelays.length,
      },
      debug: debugInfo,
    }
  } catch (error) {
    console.error('Demo data generation error:', error)
    // Try to re-enable triggers in case of error
    try { await supabase.rpc('enable_demo_audit_triggers') } catch (_) {}
    return { 
      success: false, 
      casesGenerated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
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

    // Get all case IDs for this facility first
    const { data: cases } = await supabase
      .from('cases')
      .select('id')
      .eq('facility_id', facilityId)

    if (cases && cases.length > 0) {
      const caseIds = cases.map(c => c.id)
      
      onProgress?.({ phase: 'clearing', current: 20, total: 100, message: `Clearing ${caseIds.length} cases...` })
      
      // Delete related records in batches
      const BATCH_SIZE = 100
      for (let i = 0; i < caseIds.length; i += BATCH_SIZE) {
        const batchIds = caseIds.slice(i, i + BATCH_SIZE)
        
        await supabase.from('case_implants').delete().in('case_id', batchIds)
        await supabase.from('case_milestones').delete().in('case_id', batchIds)
        await supabase.from('case_staff').delete().in('case_id', batchIds)
        await supabase.from('case_delays').delete().in('case_id', batchIds)
        
        const progress = 20 + Math.floor((i / caseIds.length) * 50)
        onProgress?.({ phase: 'clearing', current: progress, total: 100, message: `Cleared ${Math.min(i + BATCH_SIZE, caseIds.length)} of ${caseIds.length} cases...` })
      }
    }

    onProgress?.({ phase: 'clearing', current: 70, total: 100, message: 'Clearing cases...' })

    // Now delete cases
    const { error: caseError } = await supabase
      .from('cases')
      .delete()
      .eq('facility_id', facilityId)

    if (caseError) {
      return { success: false, error: `Failed to clear cases: ${caseError.message}` }
    }

    onProgress?.({ phase: 'clearing', current: 90, total: 100, message: 'Clearing surgeon averages...' })

    // Clear surgeon averages for this facility's surgeons
    const { data: facilityUsers } = await supabase
      .from('users')
      .select('id')
      .eq('facility_id', facilityId)

    if (facilityUsers && facilityUsers.length > 0) {
      const userIds = facilityUsers.map(u => u.id)
      await supabase.from('surgeon_procedure_averages').delete().in('surgeon_id', userIds)
      await supabase.from('surgeon_milestone_averages').delete().in('surgeon_id', userIds)
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
  // Get case count
  const { count: caseCount } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true })
    .eq('facility_id', facilityId)

  // Use RPC function to count related records efficiently
  const { data: counts, error } = await supabase.rpc('get_facility_demo_counts', {
    p_facility_id: facilityId
  })

  if (error || !counts) {
    console.error('Error getting demo counts:', error)
    // Fallback to basic count
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
