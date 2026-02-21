// app/admin/facilities/new/types.ts
// Shared interfaces for the facility creation wizard

// ============================================================================
// WIZARD STEP DEFINITIONS
// ============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5

export const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Facility Details',
  2: 'Administrator',
  3: 'Clinical Templates',
  4: 'Operational Templates',
  5: 'Review & Create',
}

// ============================================================================
// STEP 1: FACILITY DATA
// ============================================================================

export interface FacilityData {
  name: string
  facilityType: string
  phone: string
  streetAddress: string
  streetAddress2: string
  city: string
  state: string
  zipCode: string
  timezone: string
  subscriptionStatus: 'trial' | 'active'
  trialDays: number
}

export const DEFAULT_FACILITY_DATA: FacilityData = {
  name: '',
  facilityType: 'asc',
  phone: '',
  streetAddress: '',
  streetAddress2: '',
  city: '',
  state: '',
  zipCode: '',
  timezone: 'America/New_York',
  subscriptionStatus: 'trial',
  trialDays: 30,
}

// ============================================================================
// STEP 2: ADMIN DATA
// ============================================================================

export interface AdminData {
  firstName: string
  lastName: string
  email: string
  roleId: string
}

export const DEFAULT_ADMIN_DATA: AdminData = {
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
}

// ============================================================================
// STEPS 3 & 4: TEMPLATE CONFIG
// ============================================================================

/**
 * All template categories available for seeding.
 * Maps to the JSONB config parameter in seed_facility_with_templates().
 */
export interface TemplateConfig {
  // Clinical (Step 3)
  milestones: boolean
  procedures: boolean
  procedureMilestoneConfig: boolean // auto-linked when both milestones + procedures enabled
  delayTypes: boolean
  cancellationReasons: boolean
  complexities: boolean
  checklistFields: boolean

  // Operational (Step 4)
  costCategories: boolean
  implantCompanies: boolean
  payers: boolean
  analyticsSettings: boolean
  flagRules: boolean
  phaseDefinitions: boolean
  notificationSettings: boolean
}

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  milestones: true,
  procedures: true,
  procedureMilestoneConfig: true,
  delayTypes: true,
  cancellationReasons: true,
  complexities: true,
  checklistFields: true,
  costCategories: true,
  implantCompanies: true,
  payers: true,
  analyticsSettings: true,
  flagRules: true,
  phaseDefinitions: true,
  notificationSettings: true,
}

/** Count of items available in each template category */
export type TemplateCounts = Record<keyof TemplateConfig, number>

export const DEFAULT_TEMPLATE_COUNTS: TemplateCounts = {
  milestones: 0,
  procedures: 0,
  procedureMilestoneConfig: 0,
  delayTypes: 0,
  cancellationReasons: 0,
  complexities: 0,
  checklistFields: 0,
  costCategories: 0,
  implantCompanies: 0,
  payers: 0,
  analyticsSettings: 0,
  flagRules: 0,
  phaseDefinitions: 0,
  notificationSettings: 0,
}

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface WizardState {
  currentStep: WizardStep
  facilityData: FacilityData
  adminData: AdminData
  templateConfig: TemplateConfig
  sendWelcomeEmail: boolean
}

// ============================================================================
// STEP COMPONENT PROPS
// ============================================================================

export interface FacilityStepProps {
  data: FacilityData
  onChange: (data: FacilityData) => void
}

export interface AdminStepProps {
  data: AdminData
  onChange: (data: AdminData) => void
}

export interface ClinicalTemplatesStepProps {
  config: TemplateConfig
  counts: TemplateCounts
  loadingCounts: boolean
  onChange: (config: TemplateConfig) => void
}

export interface OperationalTemplatesStepProps {
  config: TemplateConfig
  counts: TemplateCounts
  loadingCounts: boolean
  onChange: (config: TemplateConfig) => void
}

export interface ReviewStepProps {
  facilityData: FacilityData
  adminData: AdminData
  templateConfig: TemplateConfig
  templateCounts: TemplateCounts
  sendWelcomeEmail: boolean
  onEditStep: (step: WizardStep) => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const

export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
] as const

export const FACILITY_TYPES = [
  { value: 'asc', label: 'Ambulatory Surgery Center (ASC)' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'hospital_outpatient', label: 'Hospital Outpatient Department' },
  { value: 'clinic', label: 'Surgical Clinic' },
  { value: 'other', label: 'Other' },
] as const

export const TRIAL_LENGTHS = [
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
] as const

// ============================================================================
// VALIDATION
// ============================================================================

export function isStep1Valid(data: FacilityData): boolean {
  return data.name.trim().length > 0 && data.timezone.length > 0
}

export function isStep2Valid(data: AdminData): boolean {
  return (
    data.firstName.trim().length > 0 &&
    data.lastName.trim().length > 0 &&
    data.email.trim().length > 0 &&
    data.email.includes('@') &&
    data.roleId.length > 0
  )
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

export function buildFullAddress(data: FacilityData): string {
  const parts = [
    data.streetAddress,
    data.streetAddress2,
    data.city,
    data.state,
    data.zipCode,
  ].filter(Boolean)
  return parts.join(', ')
}
