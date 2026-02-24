// app/admin/facilities/new/ReviewStep.tsx
// Step 5: Review all selections — gradient banner, colored template chips, edit buttons

'use client'

import {
  Pencil,
} from 'lucide-react'
import type {
  ReviewStepProps,
  WizardStep,
  TemplateConfig,
} from './types'
import {
  FACILITY_TYPES,
  US_TIMEZONES,
  TRIAL_LENGTHS,
  TEMPLATE_EMOJIS,
  buildFullAddress,
} from './types'

// ============================================================================
// TEMPLATE CATEGORY LABELS (for review display)
// ============================================================================

interface ReviewCategory {
  key: keyof TemplateConfig
  label: string
}

const CLINICAL_CATEGORIES: ReviewCategory[] = [
  { key: 'milestones', label: 'Milestone Types' },
  { key: 'procedures', label: 'Procedure Types' },
  { key: 'procedureMilestoneConfig', label: 'Procedure\u2013Milestone Mapping' },
  { key: 'delayTypes', label: 'Delay Categories' },
  { key: 'cancellationReasons', label: 'Cancellation Reasons' },
  { key: 'complexities', label: 'Complexity Tiers' },
  { key: 'checklistFields', label: 'Pre-Op Checklist Fields' },
]

const OPERATIONAL_CATEGORIES: ReviewCategory[] = [
  { key: 'costCategories', label: 'Cost Categories' },
  { key: 'implantCompanies', label: 'Implant Companies' },
  { key: 'payers', label: 'Payer Templates' },
  { key: 'analyticsSettings', label: 'Analytics Settings' },
  { key: 'flagRules', label: 'Flag Rules' },
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
  const trialLabel =
    TRIAL_LENGTHS.find((tl) => tl.value === facilityData.trialDays)?.label ??
    `${facilityData.trialDays} days`

  const enabledClinical = CLINICAL_CATEGORIES.filter(c => templateConfig[c.key])
  const enabledOperational = OPERATIONAL_CATEGORIES.filter(c => templateConfig[c.key])
  const totalItems = enabledClinical.reduce((s, c) => s + templateCounts[c.key], 0) +
    enabledOperational.reduce((s, c) => s + templateCounts[c.key], 0)

  return (
    <div className="flex flex-col gap-5" data-testid="review-step">
      {/* ================================================================ */}
      {/* PROVISION OVERVIEW BANNER                                        */}
      {/* ================================================================ */}
      <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl border border-blue-200/60 px-7 py-5 flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold text-slate-900">Ready to provision</p>
          <p className="text-sm text-slate-600 mt-0.5">
            {enabledClinical.length + enabledOperational.length} template groups &middot; {totalItems} total items
          </p>
        </div>
        <div className="bg-white rounded-[10px] px-4 py-2 border border-blue-200/60 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-slate-900">All validations passed</span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FACILITY DETAILS                                                 */}
      {/* ================================================================ */}
      <ReviewSection
        title="Facility Details"
        stepNum={1}
        onEdit={() => onEditStep(1)}
      >
        <div className="grid grid-cols-3 gap-x-5 gap-y-2.5" data-testid="review-section-step-1">
          <ReviewField label="Name" value={facilityData.name} />
          <ReviewField label="Type" value={facilityTypeLabel} />
          <ReviewField label="Address" value={buildFullAddress(facilityData) || undefined} />
          {facilityData.phone && <ReviewField label="Phone" value={facilityData.phone} />}
          <ReviewField label="Timezone" value={timezoneLabel} />
          <ReviewField
            label="Status"
            value={facilityData.subscriptionStatus === 'trial' ? 'Trial' : 'Active'}
          />
          {facilityData.subscriptionStatus === 'trial' && (
            <ReviewField label="Trial Length" value={trialLabel} />
          )}
        </div>
      </ReviewSection>

      {/* ================================================================ */}
      {/* ADMINISTRATOR                                                    */}
      {/* ================================================================ */}
      <ReviewSection
        title="Administrator"
        stepNum={2}
        onEdit={() => onEditStep(2)}
      >
        <div className="grid grid-cols-3 gap-x-5 gap-y-2.5" data-testid="review-section-step-2">
          <ReviewField label="Name" value={`${adminData.firstName} ${adminData.lastName}`} />
          <ReviewField label="Email" value={adminData.email} />
          <ReviewField label="Welcome email" value={sendWelcomeEmail ? 'Will be sent' : 'Not sending'} />
        </div>
      </ReviewSection>

      {/* ================================================================ */}
      {/* CLINICAL TEMPLATES                                               */}
      {/* ================================================================ */}
      <ReviewSection
        title="Clinical Templates"
        stepNum={3}
        onEdit={() => onEditStep(3)}
      >
        <div className="flex flex-wrap gap-1.5" data-testid="review-section-step-3">
          {enabledClinical.length > 0 ? (
            enabledClinical.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-600"
                data-testid={`review-template-${c.key}`}
              >
                {TEMPLATE_EMOJIS[c.key]} {c.label} ({templateCounts[c.key]})
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400 italic">None selected</span>
          )}
        </div>
      </ReviewSection>

      {/* ================================================================ */}
      {/* OPERATIONAL TEMPLATES                                            */}
      {/* ================================================================ */}
      <ReviewSection
        title="Operational Config"
        stepNum={4}
        onEdit={() => onEditStep(4)}
      >
        <div className="flex flex-wrap gap-1.5" data-testid="review-section-step-4">
          {enabledOperational.length > 0 ? (
            enabledOperational.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-green-50 text-green-600"
                data-testid={`review-template-${c.key}`}
              >
                {TEMPLATE_EMOJIS[c.key]} {c.label} ({templateCounts[c.key]})
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400 italic">None selected</span>
          )}
        </div>
      </ReviewSection>
    </div>
  )
}

// ============================================================================
// REVIEW SECTION
// ============================================================================

interface ReviewSectionProps {
  title: string
  stepNum: WizardStep
  onEdit: () => void
  children: React.ReactNode
}

function ReviewSection({ title, stepNum, onEdit, children }: ReviewSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-5">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-[5px] px-2 py-0.5 font-mono">
            {stepNum}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
          data-testid={`review-edit-step-${stepNum}`}
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// REVIEW FIELD
// ============================================================================

function ReviewField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11.5px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}
