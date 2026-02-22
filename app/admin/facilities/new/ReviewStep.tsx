// app/admin/facilities/new/ReviewStep.tsx
// Step 5: Review all selections before creating the facility

'use client'

import {
  Building2,
  UserPlus,
  MapPin,
  Clock,
  Mail,
  Check,
  X,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type {
  ReviewStepProps,
  WizardStep,
  TemplateConfig,
  TemplateCounts,
} from './types'
import {
  FACILITY_TYPES,
  US_STATES,
  US_TIMEZONES,
  TRIAL_LENGTHS,
  buildFullAddress,
} from './types'

// ============================================================================
// TEMPLATE CATEGORY LABELS (for review display)
// ============================================================================

interface ReviewCategory {
  key: keyof TemplateConfig
  label: string
}

const CLINICAL_DATA_CATEGORIES: ReviewCategory[] = [
  { key: 'milestones', label: 'Milestones' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'procedureMilestoneConfig', label: 'Procedure-Milestone Config' },
]

const WORKFLOW_CATEGORIES: ReviewCategory[] = [
  { key: 'delayTypes', label: 'Delay Types' },
  { key: 'cancellationReasons', label: 'Cancellation Reasons' },
  { key: 'complexities', label: 'Complexities' },
  { key: 'checklistFields', label: 'Pre-Op Checklist Fields' },
]

const FINANCIAL_CATEGORIES: ReviewCategory[] = [
  { key: 'costCategories', label: 'Cost Categories' },
  { key: 'implantCompanies', label: 'Implant Companies' },
  { key: 'payers', label: 'Payers' },
]

const ANALYTICS_CATEGORIES: ReviewCategory[] = [
  { key: 'analyticsSettings', label: 'Analytics Settings' },
  { key: 'flagRules', label: 'Flag Rules' },
  { key: 'phaseDefinitions', label: 'Phase Definitions' },
  { key: 'notificationSettings', label: 'Notification Settings' },
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function ReviewStep({
  facilityData,
  adminData,
  templateConfig,
  templateCounts,
  sendWelcomeEmail,
  onEditStep,
}: ReviewStepProps) {
  const facilityTypeLabel =
    FACILITY_TYPES.find((ft) => ft.value === facilityData.facilityType)?.label ??
    facilityData.facilityType
  const timezoneLabel =
    US_TIMEZONES.find((tz) => tz.value === facilityData.timezone)?.label ??
    facilityData.timezone
  const stateLabel =
    US_STATES.find((s) => s.value === facilityData.state)?.label ??
    facilityData.state
  const fullAddress = buildFullAddress(facilityData)
  const trialLabel =
    TRIAL_LENGTHS.find((tl) => tl.value === facilityData.trialDays)?.label ??
    `${facilityData.trialDays} days`

  const clinicalEnabled = [...CLINICAL_DATA_CATEGORIES, ...WORKFLOW_CATEGORIES].filter(
    (c) => templateConfig[c.key],
  ).length
  const clinicalTotal = CLINICAL_DATA_CATEGORIES.length + WORKFLOW_CATEGORIES.length

  const operationalEnabled = [...FINANCIAL_CATEGORIES, ...ANALYTICS_CATEGORIES].filter(
    (c) => templateConfig[c.key],
  ).length
  const operationalTotal = FINANCIAL_CATEGORIES.length + ANALYTICS_CATEGORIES.length

  return (
    <div className="p-6 sm:p-8" data-testid="review-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Review & Create</h2>
      <p className="text-sm text-slate-500 mb-6">
        Confirm the details below before creating the facility
      </p>

      <div className="space-y-4">
        {/* ================================================================ */}
        {/* FACILITY DETAILS */}
        {/* ================================================================ */}
        <ReviewSection
          title="Facility Details"
          icon={<Building2 className="w-4 h-4" />}
          step={1}
          onEdit={onEditStep}
        >
          <div className="space-y-2">
            <ReviewRow label="Name" value={facilityData.name} />
            <ReviewRow label="Type" value={facilityTypeLabel} />
            {facilityData.phone && (
              <ReviewRow label="Phone" value={facilityData.phone} />
            )}
            {fullAddress && (
              <ReviewRow
                label="Address"
                value={
                  <span className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>
                      {facilityData.streetAddress}
                      {facilityData.streetAddress2 && (
                        <>, {facilityData.streetAddress2}</>
                      )}
                      {facilityData.city && (
                        <>
                          <br />
                          {facilityData.city}
                          {stateLabel ? `, ${stateLabel}` : ''}
                          {facilityData.zipCode ? ` ${facilityData.zipCode}` : ''}
                        </>
                      )}
                    </span>
                  </span>
                }
              />
            )}
            <ReviewRow
              label="Timezone"
              value={
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {timezoneLabel}
                </span>
              }
            />
            <ReviewRow
              label="Subscription"
              value={
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      facilityData.subscriptionStatus === 'trial'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {facilityData.subscriptionStatus === 'trial' ? 'Trial' : 'Active'}
                  </span>
                  {facilityData.subscriptionStatus === 'trial' && (
                    <span className="text-xs text-slate-500">{trialLabel}</span>
                  )}
                </span>
              }
            />
          </div>
        </ReviewSection>

        {/* ================================================================ */}
        {/* ADMINISTRATOR */}
        {/* ================================================================ */}
        <ReviewSection
          title="Administrator"
          icon={<UserPlus className="w-4 h-4" />}
          step={2}
          onEdit={onEditStep}
        >
          <div className="space-y-2">
            <ReviewRow
              label="Name"
              value={`${adminData.firstName} ${adminData.lastName}`}
            />
            <ReviewRow
              label="Email"
              value={
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {adminData.email}
                </span>
              }
            />
            <ReviewRow
              label="Welcome Email"
              value={
                sendWelcomeEmail ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                    <Check className="w-3.5 h-3.5" /> Will be sent
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                    <X className="w-3.5 h-3.5" /> Not sending
                  </span>
                )
              }
            />
          </div>
        </ReviewSection>

        {/* ================================================================ */}
        {/* CLINICAL TEMPLATES */}
        {/* ================================================================ */}
        <ReviewSection
          title={`Clinical Templates (${clinicalEnabled}/${clinicalTotal})`}
          step={3}
          onEdit={onEditStep}
        >
          <div className="space-y-3">
            <TemplateCategoryGroup
              title="Clinical Data"
              categories={CLINICAL_DATA_CATEGORIES}
              config={templateConfig}
              counts={templateCounts}
            />
            <TemplateCategoryGroup
              title="Workflow & Policies"
              categories={WORKFLOW_CATEGORIES}
              config={templateConfig}
              counts={templateCounts}
            />
          </div>
        </ReviewSection>

        {/* ================================================================ */}
        {/* OPERATIONAL TEMPLATES */}
        {/* ================================================================ */}
        <ReviewSection
          title={`Operational Templates (${operationalEnabled}/${operationalTotal})`}
          step={4}
          onEdit={onEditStep}
        >
          <div className="space-y-3">
            <TemplateCategoryGroup
              title="Financial"
              categories={FINANCIAL_CATEGORIES}
              config={templateConfig}
              counts={templateCounts}
            />
            <TemplateCategoryGroup
              title="Analytics & Alerts"
              categories={ANALYTICS_CATEGORIES}
              config={templateConfig}
              counts={templateCounts}
            />
          </div>
        </ReviewSection>
      </div>
    </div>
  )
}

// ============================================================================
// REVIEW SECTION WRAPPER
// ============================================================================

interface ReviewSectionProps {
  title: string
  icon?: React.ReactNode
  step: WizardStep
  onEdit: (step: WizardStep) => void
  children: React.ReactNode
}

function ReviewSection({ title, icon, step, onEdit, children }: ReviewSectionProps) {
  return (
    <div
      className="border border-slate-200 rounded-lg overflow-hidden"
      data-testid={`review-section-step-${step}`}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon}
          {title}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(step)}
          data-testid={`review-edit-step-${step}`}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// ============================================================================
// REVIEW ROW (label: value)
// ============================================================================

interface ReviewRowProps {
  label: string
  value: React.ReactNode
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-medium text-slate-500 w-24 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  )
}

// ============================================================================
// TEMPLATE CATEGORY GROUP
// ============================================================================

interface TemplateCategoryGroupProps {
  title: string
  categories: ReviewCategory[]
  config: TemplateConfig
  counts: TemplateCounts
}

function TemplateCategoryGroup({
  title,
  categories,
  config,
  counts,
}: TemplateCategoryGroupProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {categories.map((cat) => {
          const enabled = config[cat.key]
          const count = counts[cat.key]

          return (
            <div
              key={cat.key}
              className={`flex items-center gap-2 py-1 px-2 rounded text-sm ${
                enabled ? 'text-slate-700' : 'text-slate-400'
              }`}
              data-testid={`review-template-${cat.key}`}
            >
              {enabled ? (
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              )}
              <span className={enabled ? '' : 'line-through'}>{cat.label}</span>
              {enabled && count > 0 && (
                <span className="text-xs text-slate-400">({count})</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
