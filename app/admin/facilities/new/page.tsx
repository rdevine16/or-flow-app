// app/admin/facilities/new/page.tsx
// Create Facility Wizard — 5-step wizard with vertical sidebar navigation

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import {
  Building2,
  User,
  Stethoscope,
  Settings,
  ClipboardCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
  STEP_DESCRIPTIONS,
  DEFAULT_FACILITY_DATA,
  DEFAULT_ADMIN_DATA,
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_TEMPLATE_COUNTS,
  CLINICAL_CONFIG_KEYS,
  OPERATIONAL_CONFIG_KEYS,
  isStep1Valid,
  isStep2Valid,
} from './types'
import type {
  FacilityData,
  AdminData,
  TemplateConfig,
  TemplateCounts,
} from './types'

// ============================================================================
// STEP CONFIG
// ============================================================================

interface StepDef {
  id: WizardStep
  label: string
  description: string
  Icon: LucideIcon
}

const STEPS: StepDef[] = [
  { id: 1, label: STEP_LABELS[1], description: STEP_DESCRIPTIONS[1], Icon: Building2 },
  { id: 2, label: STEP_LABELS[2], description: STEP_DESCRIPTIONS[2], Icon: User },
  { id: 3, label: STEP_LABELS[3], description: STEP_DESCRIPTIONS[3], Icon: Stethoscope },
  { id: 4, label: STEP_LABELS[4], description: STEP_DESCRIPTIONS[4], Icon: Settings },
  { id: 5, label: STEP_LABELS[5], description: STEP_DESCRIPTIONS[5], Icon: ClipboardCheck },
]

const TOTAL_STEPS = 5

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateFacilityPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Wizard navigation state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [createdFacilityId, setCreatedFacilityId] = useState<string | null>(null)

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

  // Provision summary counts
  const clinicalEnabled = CLINICAL_CONFIG_KEYS.filter(k => templateConfig[k]).length
  const operationalEnabled = OPERATIONAL_CONFIG_KEYS.filter(k => templateConfig[k]).length

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
      case 3: return true
      case 4: return true
      case 5: return false
      default: return false
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step)
  }, [])

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS && canAdvanceFrom(currentStep)) {
      setCompletedSteps(prev => new Set([...prev, currentStep]))
      setCurrentStep((currentStep + 1) as WizardStep)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, facilityData, adminData])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep)
    }
  }, [currentStep])

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

    // Show success screen instead of redirecting
    setCreatedFacilityId(result.facilityId ?? null)
    setSubmitted(true)
  }

  // ============================================================================
  // RESET (for "Create Another")
  // ============================================================================

  const handleReset = useCallback(() => {
    setSubmitted(false)
    setCreatedFacilityId(null)
    setCurrentStep(1)
    setCompletedSteps(new Set())
    setFacilityData(DEFAULT_FACILITY_DATA)
    setAdminData(DEFAULT_ADMIN_DATA)
    setTemplateConfig(DEFAULT_TEMPLATE_CONFIG)
    setSendWelcomeEmail(true)
    setSubmitting(false)
  }, [])

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
  // SUCCESS SCREEN
  // ============================================================================

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="success-screen">
          <div className="text-center max-w-md animate-[scaleIn_0.5s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <div className="w-[72px] h-[72px] rounded-2xl mx-auto mb-6 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Check className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Facility Created
            </h1>
            <p className="text-base text-slate-500 leading-relaxed mb-8">
              <strong>{facilityData.name}</strong> has been provisioned with all
              selected templates.
              {sendWelcomeEmail && ' The admin invite has been sent.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={handleReset}
                data-testid="create-another-btn"
              >
                Create Another
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (createdFacilityId) {
                    router.push(`/admin/facilities/${createdFacilityId}`)
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30 transition-all"
                data-testid="view-facility-btn"
              >
                View Facility &rarr;
              </button>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </DashboardLayout>
    )
  }

  // ============================================================================
  // SIDEBAR ACCESSIBILITY
  // ============================================================================

  const maxAccessibleStep = Math.max(currentStep, ...[...completedSteps], 0) + 1

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <DashboardLayout>
      <div className="max-w-[1120px] mx-auto py-8 px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Create New Facility</h1>
          <p className="text-slate-500 mt-1">Set up a new customer in ORbit</p>
        </div>

        <div className="flex gap-8">
          {/* ================================================================ */}
          {/* SIDEBAR NAVIGATION                                               */}
          {/* ================================================================ */}
          <aside className="w-[264px] shrink-0 hidden lg:block">
            <div className="sticky top-8">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4 pl-3">
                Setup Steps
              </p>
              <nav className="flex flex-col gap-0.5" data-testid="wizard-progress">
                {STEPS.map((step) => {
                  const isActive = step.id === currentStep
                  const isCompleted = completedSteps.has(step.id)
                  const isAccessible = step.id <= maxAccessibleStep
                  const StepIcon = step.Icon

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => { if (isAccessible) goToStep(step.id) }}
                      disabled={!isAccessible}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border-none text-left transition-all ${
                        isActive
                          ? 'bg-blue-50'
                          : isAccessible
                          ? 'bg-transparent hover:bg-slate-50'
                          : 'bg-transparent'
                      } ${!isAccessible ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                    >
                      <div
                        data-testid={`step-indicator-${step.id}`}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-[15px] h-[15px]" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-[13.5px] leading-tight ${
                            isActive
                              ? 'font-semibold text-blue-600'
                              : 'font-medium text-slate-900'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">
                          {step.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </nav>

              {/* Provision Summary */}
              <div className="mt-7 p-4 bg-white rounded-xl border border-slate-200">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                  Provision Summary
                </p>
                <div className="flex flex-col gap-1.5">
                  <SummaryRow
                    label="Clinical templates"
                    value={`${clinicalEnabled}/${CLINICAL_CONFIG_KEYS.length}`}
                  />
                  <SummaryRow
                    label="Operational configs"
                    value={`${operationalEnabled}/${OPERATIONAL_CONFIG_KEYS.length}`}
                  />
                  <SummaryRow
                    label="Welcome email"
                    value={sendWelcomeEmail ? 'Enabled' : 'Disabled'}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* ================================================================ */}
          {/* MAIN CONTENT                                                      */}
          {/* ================================================================ */}
          <main className="flex-1 min-w-0">
            {/* Step Content with enter animation */}
            <div key={currentStep} className="wizard-step-enter">
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
                  sendWelcomeEmail={sendWelcomeEmail}
                  onSendWelcomeEmailChange={setSendWelcomeEmail}
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
            </div>

            {/* Footer Navigation */}
            <div className="flex justify-between items-center mt-7 pt-5 border-t border-slate-200">
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
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canAdvanceFrom(currentStep)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Facility
                    </>
                  )}
                </button>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Step transition animation */}
      <style>{`
        @keyframes wizardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wizard-step-enter {
          animation: wizardFadeIn 0.2s ease-out;
        }
      `}</style>
    </DashboardLayout>
  )
}

// ============================================================================
// PROVISION SUMMARY ROW
// ============================================================================

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 font-mono text-[12px]">{value}</span>
    </div>
  )
}
