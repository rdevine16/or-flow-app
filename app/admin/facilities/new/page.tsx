// app/admin/facilities/new/page.tsx
// Create Facility Wizard — 5-step decomposed wizard with WizardShell
// Phase 2: Full scaffold with step navigation, progress indicator, and stub step components

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Card from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

import FacilityStep from './FacilityStep'
import AdminStep from './AdminStep'
import ClinicalTemplatesStep from './ClinicalTemplatesStep'
import OperationalTemplatesStep from './OperationalTemplatesStep'
import ReviewStep from './ReviewStep'
import { createFacilityWithTemplates } from './actions'
import { createClient } from '@/lib/supabase'

import type { WizardStep } from './types'
import {
  STEP_LABELS,
  DEFAULT_FACILITY_DATA,
  DEFAULT_ADMIN_DATA,
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_TEMPLATE_COUNTS,
  isStep1Valid,
  isStep2Valid,
} from './types'
import type {
  FacilityData,
  AdminData,
  TemplateConfig,
  TemplateCounts,
} from './types'

const TOTAL_STEPS = 5

export default function CreateFacilityPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Wizard navigation state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: Facility data
  const [facilityData, setFacilityData] = useState<FacilityData>(DEFAULT_FACILITY_DATA)

  // Step 2: Admin data
  const [adminData, setAdminData] = useState<AdminData>(DEFAULT_ADMIN_DATA)

  // Steps 3 & 4: Template config + counts
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG)
  const [templateCounts, setTemplateCounts] = useState<TemplateCounts>(DEFAULT_TEMPLATE_COUNTS)
  const [loadingCounts, setLoadingCounts] = useState(true)

  // Welcome email toggle
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)

  // ============================================================================
  // AUTH CHECK
  // ============================================================================

  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // ============================================================================
  // FETCH TEMPLATE COUNTS
  // ============================================================================

  useEffect(() => {
    if (!isGlobalAdmin) return

    async function fetchTemplateCounts() {
      setLoadingCounts(true)

      const [
        { count: milestoneCount },
        { count: procedureCount },
        { count: procedureMilestoneConfigCount },
        { count: delayTypeCount },
        { count: cancellationReasonCount },
        { count: complexityCount },
        { count: checklistFieldCount },
        { count: costCategoryCount },
        { count: implantCompanyCount },
        { count: payerCount },
        { count: analyticsSettingsCount },
        { count: flagRuleCount },
        { count: phaseDefinitionCount },
        { count: notificationSettingsCount },
      ] = await Promise.all([
        supabase.from('milestone_types').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('procedure_type_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('procedure_milestone_templates').select('id', { count: 'exact', head: true }),
        supabase.from('delay_types').select('id', { count: 'exact', head: true }).is('facility_id', null).eq('is_active', true).is('deleted_at', null),
        supabase.from('cancellation_reason_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('complexity_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('preop_checklist_field_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('cost_category_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('implant_companies').select('id', { count: 'exact', head: true }).is('facility_id', null).is('deleted_at', null),
        supabase.from('payer_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('analytics_settings_template').select('id', { count: 'exact', head: true }),
        supabase.from('flag_rule_templates').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
        supabase.from('facility_phase_definitions').select('id', { count: 'exact', head: true }).is('facility_id', null),
        supabase.from('notification_settings_template').select('id', { count: 'exact', head: true }),
      ])

      setTemplateCounts({
        milestones: milestoneCount ?? 0,
        procedures: procedureCount ?? 0,
        procedureMilestoneConfig: procedureMilestoneConfigCount ?? 0,
        delayTypes: delayTypeCount ?? 0,
        cancellationReasons: cancellationReasonCount ?? 0,
        complexities: complexityCount ?? 0,
        checklistFields: checklistFieldCount ?? 0,
        costCategories: costCategoryCount ?? 0,
        implantCompanies: implantCompanyCount ?? 0,
        payers: payerCount ?? 0,
        analyticsSettings: analyticsSettingsCount ?? 0,
        flagRules: flagRuleCount ?? 0,
        phaseDefinitions: phaseDefinitionCount ?? 0,
        notificationSettings: notificationSettingsCount ?? 0,
      })

      setLoadingCounts(false)
    }

    fetchTemplateCounts()
  }, [supabase, isGlobalAdmin])

  // ============================================================================
  // STEP VALIDATION
  // ============================================================================

  function canAdvanceFrom(step: WizardStep): boolean {
    switch (step) {
      case 1: return isStep1Valid(facilityData)
      case 2: return isStep2Valid(adminData)
      case 3: return true // template selection always valid
      case 4: return true // template selection always valid
      case 5: return false // last step — submit instead
      default: return false
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS && canAdvanceFrom(currentStep)) {
      setCurrentStep((currentStep + 1) as WizardStep)
    }
  }, [currentStep, facilityData, adminData, canAdvanceFrom])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep)
    }
  }, [currentStep])

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step)
  }, [])

  // ============================================================================
  // SUBMISSION
  // ============================================================================

  const handleSubmit = async () => {
    if (!isStep1Valid(facilityData) || !isStep2Valid(adminData)) return

    setSubmitting(true)

    const result = await createFacilityWithTemplates({
      supabase,
      facilityData,
      adminData,
      templateConfig,
      sendWelcomeEmail,
    })

    setSubmitting(false)

    if (!result.success) {
      showToast({
        type: 'error',
        title: 'Create Facility Failed',
        message: result.error ?? 'An unexpected error occurred',
      })
      return
    }

    if (result.inviteWarning) {
      showToast({
        type: 'error',
        title: 'Invite Warning',
        message: result.inviteWarning,
      })
    }

    showToast({
      type: 'success',
      title: 'Facility Created',
      message: `${facilityData.name} has been created successfully.`,
    })

    router.push(`/admin/facilities/${result.facilityId}`)
  }

  // ============================================================================
  // LOADING & AUTH GUARD
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Create New Facility</h1>
          <p className="text-slate-500 mt-1">Set up a new customer in ORbit</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8" data-testid="wizard-progress">
          <div className="flex items-center justify-between">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      step < currentStep
                        ? 'bg-green-500 text-white'
                        : step === currentStep
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                    data-testid={`step-indicator-${step}`}
                  >
                    {step < currentStep ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center ${
                      step <= currentStep ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </div>
                {step < TOTAL_STEPS && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition-colors ${
                      step < currentStep ? 'bg-green-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card padding="none">
          {currentStep === 1 && (
            <FacilityStep
              data={facilityData}
              onChange={setFacilityData}
            />
          )}
          {currentStep === 2 && (
            <AdminStep
              data={adminData}
              onChange={setAdminData}
            />
          )}
          {currentStep === 3 && (
            <ClinicalTemplatesStep
              config={templateConfig}
              counts={templateCounts}
              loadingCounts={loadingCounts}
              onChange={setTemplateConfig}
            />
          )}
          {currentStep === 4 && (
            <OperationalTemplatesStep
              config={templateConfig}
              counts={templateCounts}
              loadingCounts={loadingCounts}
              onChange={setTemplateConfig}
            />
          )}
          {currentStep === 5 && (
            <ReviewStep
              facilityData={facilityData}
              adminData={adminData}
              templateConfig={templateConfig}
              templateCounts={templateCounts}
              sendWelcomeEmail={sendWelcomeEmail}
              onEditStep={goToStep}
            />
          )}

          {/* Navigation Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-slate-50 flex justify-between">
            {currentStep > 1 ? (
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={submitting}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => router.push('/admin/facilities')}
              >
                Cancel
              </Button>
            )}

            {currentStep < TOTAL_STEPS ? (
              <Button
                onClick={goNext}
                disabled={!canAdvanceFrom(currentStep)}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={submitting}
              >
                <Check className="w-4 h-4" />
                Create Facility
              </Button>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
