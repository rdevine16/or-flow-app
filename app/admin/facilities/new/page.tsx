// app/admin/facilities/new/page.tsx
// Create Facility Wizard - Professional multi-step form for onboarding new facilities
// v3: Fixed to copy ALL fields from procedure_type_templates including procedure_category_id

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { facilityAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// ============================================================================
// INTERFACES
// ============================================================================

interface FacilityData {
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

interface AdminData {
  firstName: string
  lastName: string
  email: string
  roleId: string
}

interface TemplateOptions {
  rooms: boolean
  procedures: boolean
  milestones: boolean
  delayTypes: boolean
  costCategories: boolean
  implantCompanies: boolean
  complexities: boolean
  cancellationReasons: boolean
}
interface TemplateOptions {
  rooms: boolean
  procedures: boolean
  milestones: boolean
  delayTypes: boolean
  costCategories: boolean
  implantCompanies: boolean
  complexities: boolean
  cancellationReasons: boolean
  checklistFields: boolean  // <-- ADD THIS
}

interface TemplateCounts {
  rooms: number
  procedures: number
  milestones: number
  delayTypes: number
  costCategories: number
  implantCompanies: number
  complexities: number
  cancellationReasons: number
  checklistFields: number
}

interface UserRole {
  id: string
  name: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const US_STATES = [
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
]

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
]

const FACILITY_TYPES = [
  { value: 'asc', label: 'Ambulatory Surgery Center (ASC)' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'hospital_outpatient', label: 'Hospital Outpatient Department' },
  { value: 'clinic', label: 'Surgical Clinic' },
  { value: 'other', label: 'Other' },
]

// ============================================================================
// TEMPLATE CONFIGURATION
// ============================================================================

const TEMPLATE_CONFIG = [
  {
    key: 'rooms' as const,
    label: 'Operating Rooms',
    description: 'Default OR 1, OR 2, and OR 3',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: 'procedures' as const,
    label: 'Procedure Types',
    description: 'Surgical procedures with body region mapping',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: 'milestones' as const,
    label: 'Milestones',
    description: 'Case tracking points (Patient In, Incision, etc.)',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
  key: 'checklistFields' as const,
  label: 'Pre-Op Checklist Fields',
  description: 'Default checklist items for patient check-in',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
},
  {
    key: 'delayTypes' as const,
    label: 'Delay Types',
    description: 'Categories for tracking surgical delays',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    key: 'costCategories' as const,
    label: 'Cost Categories',
    description: 'Financial tracking for analytics and reporting',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'implantCompanies' as const,
    label: 'Implant Companies',
    description: 'Standard implant manufacturers and vendors',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
 key: 'complexities' as const,
    label: 'Complexities',
    description: 'Case complexity modifiers for scheduling',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
 {
    key: 'cancellationReasons' as const,
    label: 'Cancellation Reasons',
    description: 'Categories for tracking why cases are cancelled',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    key: 'checklistFields' as const,
    label: 'Pre-Op Checklist Fields',
    description: 'Default checklist items for patient check-in',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateFacilityPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const toast = useToast()

  // Form state
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingCounts, setLoadingCounts] = useState(true)

  // Step 1: Facility details
  const [facilityData, setFacilityData] = useState<FacilityData>({
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
  })

  // Step 2: Admin user
  const [adminData, setAdminData] = useState<AdminData>({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
  })

  // Step 3: Template options (all enabled by default)
  const [templateOptions, setTemplateOptions] = useState<TemplateOptions>({
    rooms: true,
    procedures: true,
    milestones: true,
    delayTypes: true,
    costCategories: true,
    implantCompanies: true,
    complexities: true,
    cancellationReasons: true,
    checklistFields: true,
  })

  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)

  // Template counts from database
  const [templateCounts, setTemplateCounts] = useState<TemplateCounts>({
    rooms: 3,
    procedures: 0,
    milestones: 0,
    delayTypes: 0,
    costCategories: 0,
    implantCompanies: 0,
    complexities: 0,
    cancellationReasons: 0,
    checklistFields: 0,
  })

  // Available roles
  const [roles, setRoles] = useState<UserRole[]>([])

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // Fetch roles and template counts
  useEffect(() => {
    async function fetchData() {
      setLoadingCounts(true)

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('id, name')
        .order('name')

      if (rolesData) {
        setRoles(rolesData)
        const adminRole = rolesData.find(r => r.name === 'admin')
        if (adminRole) {
          setAdminData(prev => ({ ...prev, roleId: adminRole.id }))
        }
      }

      // Fetch template counts
      // Note: Different tables use different patterns
      const [
        { count: procedureCount },
        { count: milestoneCount },
        { count: delayTypeCount },
        { count: costCategoryCount },
        { count: implantCompanyCount },
        { count: complexityCount },
        { count: cancellationReasonCount },
        { count: checklistFieldCount },
      ] = await Promise.all([
        // procedure_type_templates - separate template table
        supabase
          .from('procedure_type_templates')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        // milestone_types - separate template table
        supabase
          .from('milestone_types')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        // delay_types - HYBRID pattern (facility_id = NULL for templates)
        supabase
          .from('delay_types')
          .select('id', { count: 'exact', head: true })
          .is('facility_id', null)
          .eq('is_active', true)
          .is('deleted_at', null),
        // cost_category_templates - separate template table
        supabase
          .from('cost_category_templates')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        // implant_companies - HYBRID pattern (facility_id = NULL for global)
        supabase
          .from('implant_companies')
          .select('id', { count: 'exact', head: true })
          .is('facility_id', null)
          .is('deleted_at', null),
        // complexity_templates - separate template table
        supabase
          .from('complexity_templates')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        // cancellation_reason_templates - separate template table
        supabase
          .from('cancellation_reason_templates')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
        // preop_checklist_field_templates
        supabase
          .from('preop_checklist_field_templates')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null),
      ])

      setTemplateCounts({
        rooms: 3,
        procedures: procedureCount || 0,
        milestones: milestoneCount || 0,
        delayTypes: delayTypeCount || 0,
        costCategories: costCategoryCount || 0,
        implantCompanies: implantCompanyCount || 0,
        complexities: complexityCount || 0,
        cancellationReasons: cancellationReasonCount || 0,
        checklistFields: checklistFieldCount || 0,
      })


      setLoadingCounts(false)
    }

    if (isGlobalAdmin) {
      fetchData()
    }
  }, [supabase, isGlobalAdmin])

  // Validation
  const isStep1Valid = facilityData.name.trim().length > 0 && facilityData.timezone.length > 0
  const isStep2Valid =
    adminData.firstName.trim().length > 0 &&
    adminData.lastName.trim().length > 0 &&
    adminData.email.trim().length > 0 &&
    adminData.email.includes('@') &&
    adminData.roleId.length > 0

  // Toggle all templates
  const allEnabled = Object.values(templateOptions).every(v => v)
const toggleAll = () => {
    const newValue = !allEnabled
    setTemplateOptions({
      rooms: newValue,
      procedures: newValue,
      milestones: newValue,
      delayTypes: newValue,
      costCategories: newValue,
      implantCompanies: newValue,
      complexities: newValue,
      cancellationReasons: newValue,
      checklistFields: newValue,
    })
  }

  // Count enabled templates
  const enabledCount = Object.values(templateOptions).filter(Boolean).length

  // Format phone number
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // Build full address string
  const getFullAddress = () => {
    const parts = [
      facilityData.streetAddress,
      facilityData.streetAddress2,
      facilityData.city,
      facilityData.state,
      facilityData.zipCode,
    ].filter(Boolean)
    return parts.join(', ')
  }

  // ============================================================================
  // HANDLE SUBMIT
  // ============================================================================

  const handleSubmit = async () => {
    if (!isStep1Valid || !isStep2Valid) return

    setSubmitting(true)
    setError(null)

    try {
      // Calculate trial end date
      const trialEndsAt =
        facilityData.subscriptionStatus === 'trial'
          ? new Date(Date.now() + facilityData.trialDays * 86400000).toISOString()
          : null

      // Build address string for legacy compatibility
      const fullAddress = getFullAddress()

      // 1. Create facility
      const { data: facility, error: facilityError } = await supabase
        .from('facilities')
        .insert({
          name: facilityData.name.trim(),
          address: fullAddress || null,
          street_address: facilityData.streetAddress.trim() || null,
          street_address_2: facilityData.streetAddress2.trim() || null,
          city: facilityData.city.trim() || null,
          state: facilityData.state || null,
          zip_code: facilityData.zipCode.trim() || null,
          phone: facilityData.phone.replace(/\D/g, '') || null,
          facility_type: facilityData.facilityType || null,
          timezone: facilityData.timezone,
          subscription_status: facilityData.subscriptionStatus,
          trial_ends_at: trialEndsAt,
          subscription_started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (facilityError) throw new Error('Failed to create facility: ' + facilityError.message)

      // Track IDs for cross-referencing
      let procedureIdMap: Record<string, string> = {}
      let milestoneIdMap: Record<string, string> = {}

      // 2. Create default OR rooms if selected
      if (templateOptions.rooms) {
        const defaultRooms = ['OR 1', 'OR 2', 'OR 3']
        await supabase.from('or_rooms').insert(
          defaultRooms.map(name => ({
            facility_id: facility.id,
            name,
          }))
        )
      }

      // =====================================================================
      // 3. Copy procedure types if selected - FIXED: Now includes ALL fields
      // =====================================================================
      if (templateOptions.procedures) {
        // Select ALL fields from the template table (using * to future-proof)
        const { data: templates } = await supabase
          .from('procedure_type_templates')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)

        if (templates && templates.length > 0) {
          for (const t of templates) {
            const { data: inserted } = await supabase
              .from('procedure_types')
              .insert({
                facility_id: facility.id,
                name: t.name,
                body_region_id: t.body_region_id,
                procedure_category_id: t.procedure_category_id,
                technique_id: t.technique_id,
                implant_category: t.implant_category,
                source_template_id: t.id,
                is_active: true,
              })
              .select('id')
              .single()

            if (inserted) {
              procedureIdMap[t.id] = inserted.id
            }
          }
        }
      }

      // 4. Copy milestones if selected
      if (templateOptions.milestones) {
        const { data: milestoneTypes } = await supabase
          .from('milestone_types')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order')

        if (milestoneTypes && milestoneTypes.length > 0) {
          // Insert facility milestones
          for (const mt of milestoneTypes) {
            const { data: newMilestone } = await supabase
              .from('facility_milestones')
              .insert({
                facility_id: facility.id,
                name: mt.name,
                display_name: mt.display_name,
                display_order: mt.display_order,
                pair_position: mt.pair_position,
                source_milestone_type_id: mt.id,
                is_active: true,
              })
              .select()
              .single()

            if (newMilestone) {
              milestoneIdMap[mt.id] = newMilestone.id
            }
          }

          // Update pair_with_id references
          for (const mt of milestoneTypes) {
            if (mt.pair_with_id && milestoneIdMap[mt.id] && milestoneIdMap[mt.pair_with_id]) {
              await supabase
                .from('facility_milestones')
                .update({ pair_with_id: milestoneIdMap[mt.pair_with_id] })
                .eq('id', milestoneIdMap[mt.id])
            }
          }

          // Copy procedure-milestone configs if both procedures and milestones are enabled
          if (templateOptions.procedures && Object.keys(procedureIdMap).length > 0) {
            const { data: configs } = await supabase
              .from('procedure_milestone_templates')
              .select('*')

            if (configs && configs.length > 0) {
              const facilityConfigs = configs
                .filter(
                  c =>
                    procedureIdMap[c.procedure_type_template_id] &&
                    milestoneIdMap[c.milestone_type_id]
                )
                .map(c => ({
                  facility_id: facility.id,
                  procedure_type_id: procedureIdMap[c.procedure_type_template_id],
                  facility_milestone_id: milestoneIdMap[c.milestone_type_id],
                  display_order: c.display_order,
                }))

              if (facilityConfigs.length > 0) {
                await supabase.from('procedure_milestone_config').insert(facilityConfigs)
              }
            }
          }
        }
      }

      // 5. Copy delay types if selected (HYBRID PATTERN)
      if (templateOptions.delayTypes) {
        const { data: globalDelayTypes } = await supabase
          .from('delay_types')
          .select('*')
          .is('facility_id', null)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order')

        if (globalDelayTypes && globalDelayTypes.length > 0) {
          await supabase.from('delay_types').insert(
            globalDelayTypes.map(dt => ({
              facility_id: facility.id,
              name: dt.name,
              display_name: dt.display_name,
              description: dt.description,
              category: dt.category,
              display_order: dt.display_order,
              is_active: true,
              source_template_id: dt.id,
            }))
          )
        }
      }

      // 6. Copy cost categories if selected
      if (templateOptions.costCategories) {
        const { data: templates } = await supabase
          .from('cost_category_templates')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order')

        if (templates && templates.length > 0) {
          await supabase.from('cost_categories').insert(
            templates.map(t => ({
              facility_id: facility.id,
              name: t.name,
              display_name: t.display_name,
              description: t.description,
              display_order: t.display_order,
              is_active: true,
              source_template_id: t.id,
            }))
          )
        }
      }

      // 7. Copy implant companies if selected (HYBRID PATTERN)
      if (templateOptions.implantCompanies) {
        const { data: globalCompanies } = await supabase
          .from('implant_companies')
          .select('*')
          .is('facility_id', null)
          .is('deleted_at', null)
          .order('name')

        if (globalCompanies && globalCompanies.length > 0) {
          await supabase.from('implant_companies').insert(
            globalCompanies.map(c => ({
              facility_id: facility.id,
              name: c.name,
              source_global_id: c.id,
            }))
          )
        }
      }

      // 8. Copy complexities if selected
      if (templateOptions.complexities) {
        const { data: templates } = await supabase
          .from('complexity_templates')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order')

        if (templates && templates.length > 0) {
          await supabase.from('complexities').insert(
            templates.map(t => ({
              facility_id: facility.id,
              name: t.name,
              display_name: t.display_name,
              description: t.description,
              procedure_category_ids: t.procedure_category_ids,
              is_active: true,
              display_order: t.display_order,
              source_template_id: t.id,
            }))
          )
        }
      }

      // 9. Copy cancellation reasons if selected
      if (templateOptions.cancellationReasons) {
        const { data: templates, error: fetchError } = await supabase
          .from('cancellation_reason_templates')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('category')
          .order('display_order')

        if (!fetchError && templates && templates.length > 0) {
          const cancellationReasons = templates.map(template => ({
            facility_id: facility.id,
            source_template_id: template.id,
            name: template.name,
            display_name: template.display_name,
            category: template.category,
            display_order: template.display_order,
            is_active: true,
          }))

const { error: insertError } = await supabase
  .from('cancellation_reasons')
  .insert(cancellationReasons)

if (insertError) {
  showToast({
    type: 'error',
    title: 'Error',
    message: insertError.message
  })
  return
}
        }
      }
            // 10. Copy checklist fields if selected
      if (templateOptions.checklistFields) {
        const { data: templates, error: fetchError } = await supabase
          .from('preop_checklist_field_templates')
          .select('*')
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('display_order')

        if (!fetchError && templates && templates.length > 0) {
          const checklistFields = templates.map(template => ({
            facility_id: facility.id,
            source_template_id: template.id,
            field_key: template.field_key,
            display_label: template.display_label,
            field_type: template.field_type,
            options: template.options,
            default_value: template.default_value,
            placeholder: template.placeholder,
            is_required: template.is_required,
            show_on_escort_page: template.show_on_escort_page,
            display_order: template.display_order,
            is_active: true,
          }))

          const { error: insertError } = await supabase
            .from('preop_checklist_fields')
            .insert(checklistFields)

          if (insertError) {
            showToast({
  type: 'error',
  title: 'Error copying checklist fields:',
  message: `Error copying checklist fields: ${insertError.message || insertError}`
})
          }
        }
      }

      // 11. Send invite email if selected
      if (sendWelcomeEmail) {
        const { data: session } = await supabase.auth.getSession()

        const inviteResponse = await fetch('/api/admin/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            email: adminData.email.trim(),
            firstName: adminData.firstName.trim(),
            lastName: adminData.lastName.trim(),
            accessLevel: 'facility_admin',
            facilityId: facility.id,
            roleId: adminData.roleId,
          }),
        })

        if (!inviteResponse.ok) {
          const result = await inviteResponse.json()
          showToast({
  type: 'error',
  title: 'Invite failed:',
  message: result instanceof Error ? result.message : 'Invite failed:'
})
        }
      }

      // 11. Log audit event
      await facilityAudit.created(supabase, facilityData.name.trim(), facility.id)

      // Success! Redirect to facility detail page
      router.push(`/admin/facilities/${facility.id}`)
    } catch (err) {
      showToast({
  type: 'error',
  title: 'Error creating facility:',
  message: err instanceof Error ? err.message : 'Error creating facility:'
})
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  // Step labels
  const stepLabels = ['Facility', 'Administrator', 'Configuration', 'Review']

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create New Facility</h1>
          <p className="text-slate-500 mt-1">Set up a new customer in ORbit</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      s < step
                        ? 'bg-emerald-500 text-white'
                        : s === step
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {s < step ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      s <= step ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {stepLabels[s - 1]}
                  </span>
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition-colors ${
                      s < step ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* ================================================================ */}
          {/* STEP 1: FACILITY DETAILS */}
          {/* ================================================================ */}
          {step === 1 && (
            <div className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Facility Details</h2>
              <p className="text-sm text-slate-500 mb-6">Basic information about the surgery center</p>

              <div className="space-y-5">
                {/* Name and Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Facility Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={facilityData.name}
                      onChange={e => setFacilityData({ ...facilityData, name: e.target.value })}
                      placeholder="e.g., Memorial Surgery Center"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Facility Type
                    </label>
                    <select
                      value={facilityData.facilityType}
                      onChange={e => setFacilityData({ ...facilityData, facilityType: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors"
                    >
                      {FACILITY_TYPES.map(ft => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={facilityData.phone}
                    onChange={e => setFacilityData({ ...facilityData, phone: formatPhone(e.target.value) })}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={facilityData.streetAddress}
                      onChange={e => setFacilityData({ ...facilityData, streetAddress: e.target.value })}
                      placeholder="123 Medical Center Drive"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Suite / Building <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={facilityData.streetAddress2}
                      onChange={e => setFacilityData({ ...facilityData, streetAddress2: e.target.value })}
                      placeholder="Suite 200"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-6 gap-4">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                      <input
                        type="text"
                        value={facilityData.city}
                        onChange={e => setFacilityData({ ...facilityData, city: e.target.value })}
                        placeholder="Chicago"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">State</label>
                      <select
                        value={facilityData.state}
                        onChange={e => setFacilityData({ ...facilityData, state: e.target.value })}
                        className="w-full px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors"
                      >
                        <option value="">--</option>
                        {US_STATES.map(s => (
                          <option key={s.value} value={s.value}>{s.value}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">ZIP Code</label>
                      <input
                        type="text"
                        value={facilityData.zipCode}
                        onChange={e => setFacilityData({ ...facilityData, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                        placeholder="60601"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Timezone <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={facilityData.timezone}
                    onChange={e => setFacilityData({ ...facilityData, timezone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors"
                  >
                    {US_TIMEZONES.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Used for scheduling, analytics, and FCOTS calculations
                  </p>
                </div>

                {/* Subscription */}
                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Subscription Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                        facilityData.subscriptionStatus === 'trial'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={facilityData.subscriptionStatus === 'trial'}
                        onChange={() => setFacilityData({ ...facilityData, subscriptionStatus: 'trial' })}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          facilityData.subscriptionStatus === 'trial'
                            ? 'border-blue-500'
                            : 'border-slate-300'
                        }`}
                      >
                        {facilityData.subscriptionStatus === 'trial' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Trial</p>
                        <p className="text-xs text-slate-500">Free evaluation period</p>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                        facilityData.subscriptionStatus === 'active'
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        checked={facilityData.subscriptionStatus === 'active'}
                        onChange={() => setFacilityData({ ...facilityData, subscriptionStatus: 'active' })}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          facilityData.subscriptionStatus === 'active'
                            ? 'border-emerald-500'
                            : 'border-slate-300'
                        }`}
                      >
                        {facilityData.subscriptionStatus === 'active' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">Active</p>
                        <p className="text-xs text-slate-500">Paid subscription</p>
                      </div>
                    </label>
                  </div>
                </div>

                {facilityData.subscriptionStatus === 'trial' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Trial Length
                    </label>
                    <select
                      value={facilityData.trialDays}
                      onChange={e => setFacilityData({ ...facilityData, trialDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors"
                    >
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: ADMIN USER */}
          {/* ================================================================ */}
          {step === 2 && (
            <div className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">First Administrator</h2>
              <p className="text-sm text-slate-500 mb-6">
                This person will manage the facility and can invite other staff
              </p>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adminData.firstName}
                      onChange={e => setAdminData({ ...adminData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={adminData.lastName}
                      onChange={e => setAdminData({ ...adminData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={adminData.email}
                    onChange={e => setAdminData({ ...adminData, email: e.target.value })}
                    placeholder="admin@hospital.com"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={adminData.roleId}
                    onChange={e => setAdminData({ ...adminData, roleId: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors"
                  >
                    <option value="">Select role...</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-800">
                    They'll receive an email with a link to create their password and access the facility.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 3: CONFIGURATION */}
          {/* ================================================================ */}
          {step === 3 && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-900">Default Configuration</h2>
                <button
                  onClick={toggleAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {allEnabled ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Choose which templates to copy to this facility ({enabledCount} of {TEMPLATE_CONFIG.length} selected)
              </p>

              {loadingCounts ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {TEMPLATE_CONFIG.map(config => {
                    const count = templateCounts[config.key]
                    const enabled = templateOptions[config.key]
                    const noTemplates = count === 0 && config.key !== 'rooms'

                    return (
                      <label
                        key={config.key}
                        className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                          noTemplates
                            ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                            : enabled
                            ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="relative flex items-center pt-0.5">
                          <input
                            type="checkbox"
                            checked={enabled && !noTemplates}
                            disabled={noTemplates}
                            onChange={e =>
                              setTemplateOptions({
                                ...templateOptions,
                                [config.key]: e.target.checked,
                              })
                            }
                            className="sr-only"
                          />
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              noTemplates
                                ? 'border-2 border-slate-200 bg-slate-100'
                                : enabled
                                ? 'bg-blue-600 text-white'
                                : 'border-2 border-slate-300 bg-white'
                            }`}
                          >
                            {enabled && !noTemplates && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                            noTemplates
                              ? 'bg-slate-100 text-slate-400'
                              : enabled
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`font-medium ${enabled && !noTemplates ? 'text-slate-900' : 'text-slate-600'}`}>
                              {config.label}
                            </p>
                            <span
                              className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                                noTemplates
                                  ? 'bg-slate-100 text-slate-400'
                                  : enabled
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{config.description}</p>
                          {noTemplates && (
                            <p className="text-xs text-amber-600 mt-1">No templates configured</p>
                          )}
                        </div>
                      </label>
                    )
                  })}

                  {/* Welcome Email Option */}
                  <div className="pt-4 mt-4 border-t border-slate-200">
                    <label
                      className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                        sendWelcomeEmail
                          ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative flex items-center pt-0.5">
                        <input
                          type="checkbox"
                          checked={sendWelcomeEmail}
                          onChange={e => setSendWelcomeEmail(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            sendWelcomeEmail
                              ? 'bg-emerald-600 text-white'
                              : 'border-2 border-slate-300 bg-white'
                          }`}
                        >
                          {sendWelcomeEmail && (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>

                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                          sendWelcomeEmail
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <p className={`font-medium ${sendWelcomeEmail ? 'text-slate-900' : 'text-slate-600'}`}>
                          Send Welcome Email
                        </p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Email login credentials to {adminData.email || 'the administrator'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* STEP 4: REVIEW */}
          {/* ================================================================ */}
          {step === 4 && (
            <div className="p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Review & Create</h2>
              <p className="text-sm text-slate-500 mb-6">
                Confirm the details before creating the facility
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-6">
                {/* Facility Summary */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Facility
                  </h3>
                  <p className="text-lg font-semibold text-slate-900">{facilityData.name}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {FACILITY_TYPES.find(ft => ft.value === facilityData.facilityType)?.label}
                  </p>
                  {facilityData.phone && (
                    <p className="text-sm text-slate-600 mt-1">{facilityData.phone}</p>
                  )}
                  {getFullAddress() && (
                    <p className="text-sm text-slate-600 mt-1">{getFullAddress()}</p>
                  )}
                  <p className="text-sm text-slate-500 mt-2">
                    {US_TIMEZONES.find(tz => tz.value === facilityData.timezone)?.label}
                  </p>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        facilityData.subscriptionStatus === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {facilityData.subscriptionStatus === 'active'
                        ? '● Active Subscription'
                        : `● ${facilityData.trialDays}-Day Trial`}
                    </span>
                  </div>
                </div>

                {/* Administrator Summary */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Administrator
                  </h3>
                  <p className="text-lg font-semibold text-slate-900">
                    {adminData.firstName} {adminData.lastName}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{adminData.email}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Role: {roles.find(r => r.id === adminData.roleId)?.name || 'Unknown'}
                  </p>
                </div>

                {/* Configuration Summary */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {TEMPLATE_CONFIG.map(config => {
                      const enabled = templateOptions[config.key]
                      const count = templateCounts[config.key]
                      return (
                        <div
                          key={config.key}
                          className={`flex items-center gap-2 text-sm ${
                            enabled ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          <span className={enabled ? 'text-emerald-500' : 'text-slate-300'}>
                            {enabled ? '✓' : '○'}
                          </span>
                          {config.label}
                          {enabled && <span className="text-slate-400">({count})</span>}
                        </div>
                      )
                    })}
                    <div
                      className={`flex items-center gap-2 text-sm ${
                        sendWelcomeEmail ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      <span className={sendWelcomeEmail ? 'text-emerald-500' : 'text-slate-300'}>
                        {sendWelcomeEmail ? '✓' : '○'}
                      </span>
                      Welcome Email
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* FOOTER */}
          {/* ================================================================ */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-slate-50 flex justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                disabled={submitting}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-medium transition-colors disabled:opacity-50"
              >
                ← Back
              </button>
            ) : (
              <button
                onClick={() => router.push('/admin/facilities')}
                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Facility
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function showToast(arg0: { type: string; title: string; message: string }) {
  throw new Error('Function not implemented.')
}
