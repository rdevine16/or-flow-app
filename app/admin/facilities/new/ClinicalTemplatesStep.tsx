// app/admin/facilities/new/ClinicalTemplatesStep.tsx
// Step 3: Clinical template selection — TemplateRow pattern with emojis

'use client'

import { useCallback } from 'react'
import { Check } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { ClinicalTemplatesStepProps, TemplateConfig } from './types'
import { TEMPLATE_EMOJIS } from './types'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

interface TemplateCategory {
  key: keyof TemplateConfig
  label: string
  description: string
  autoLinked?: boolean
}

const CLINICAL_DATA_CATEGORIES: TemplateCategory[] = [
  {
    key: 'milestones',
    label: 'Milestone Types',
    description: 'Standard surgical workflow milestones',
  },
  {
    key: 'procedures',
    label: 'Procedure Types',
    description: 'Common surgical procedure templates',
  },
  {
    key: 'procedureMilestoneConfig',
    label: 'Procedure\u2013Milestone Mapping',
    description: 'Expected milestones per procedure',
    autoLinked: true,
  },
]

const WORKFLOW_CATEGORIES: TemplateCategory[] = [
  {
    key: 'delayTypes',
    label: 'Delay Categories',
    description: 'Standardized delay reason codes',
  },
  {
    key: 'cancellationReasons',
    label: 'Cancellation Reasons',
    description: 'Case cancellation tracking codes',
  },
  {
    key: 'complexities',
    label: 'Complexity Tiers',
    description: 'Surgical complexity classifications',
  },
  {
    key: 'checklistFields',
    label: 'Pre-Op Checklist Fields',
    description: 'Pre-operative checklist templates',
  },
]

const ALL_CLINICAL_KEYS = [...CLINICAL_DATA_CATEGORIES, ...WORKFLOW_CATEGORIES].map(c => c.key)

// ============================================================================
// COMPONENT
// ============================================================================

export default function ClinicalTemplatesStep({
  config,
  counts,
  loadingCounts,
  onChange,
}: ClinicalTemplatesStepProps) {
  const allSelected = ALL_CLINICAL_KEYS.every(k => config[k])

  const toggleCategory = useCallback(
    (key: keyof TemplateConfig) => {
      const next = { ...config, [key]: !config[key] }
      // Auto-link: procedureMilestoneConfig follows milestones + procedures
      if (key === 'milestones' || key === 'procedures') {
        next.procedureMilestoneConfig = next.milestones && next.procedures
      }
      onChange(next)
    },
    [config, onChange],
  )

  const toggleAll = useCallback(
    (enable: boolean) => {
      const next = { ...config }
      for (const key of ALL_CLINICAL_KEYS) {
        next[key] = enable
      }
      if (!enable) next.procedureMilestoneConfig = false
      onChange(next)
    },
    [config, onChange],
  )

  return (
    <div data-testid="clinical-templates-step">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header with Select All */}
        <div className="px-7 pt-6 flex justify-between items-start">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Clinical Templates</h3>
            <p className="text-sm text-slate-500 mt-0.5">Select which clinical configurations to provision</p>
          </div>
          <button
            type="button"
            onClick={() => toggleAll(!allSelected)}
            className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors shrink-0"
            data-testid="clinical-select-all"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="px-7 pt-5 pb-7">
          {/* Clinical Data Section */}
          <div className="mb-5">
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Clinical Data
            </h4>
            <div className="flex flex-col gap-0.5">
              {CLINICAL_DATA_CATEGORIES.map((cat) => (
                <TemplateRow
                  key={cat.key}
                  category={cat}
                  checked={config[cat.key]}
                  count={counts[cat.key]}
                  loadingCount={loadingCounts}
                  disabled={
                    (counts[cat.key] === 0 && !loadingCounts) ||
                    (cat.autoLinked === true && !(config.milestones && config.procedures))
                  }
                  onToggle={() => toggleCategory(cat.key)}
                />
              ))}
            </div>
          </div>

          {/* Workflow & Policies Section */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Workflow & Policies
            </h4>
            <div className="flex flex-col gap-0.5">
              {WORKFLOW_CATEGORIES.map((cat) => (
                <TemplateRow
                  key={cat.key}
                  category={cat}
                  checked={config[cat.key]}
                  count={counts[cat.key]}
                  loadingCount={loadingCounts}
                  disabled={counts[cat.key] === 0 && !loadingCounts}
                  onToggle={() => toggleCategory(cat.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// TEMPLATE ROW COMPONENT
// ============================================================================

interface TemplateRowProps {
  category: TemplateCategory
  checked: boolean
  count: number
  loadingCount: boolean
  disabled: boolean
  onToggle: () => void
}

function TemplateRow({
  category,
  checked,
  count,
  loadingCount,
  disabled,
  onToggle,
}: TemplateRowProps) {
  const emoji = TEMPLATE_EMOJIS[category.key]

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-testid={`template-card-${category.key}`}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`flex items-center justify-between w-full px-3.5 py-3 rounded-[10px] border-none text-left transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : checked
          ? 'bg-blue-50/60 hover:bg-blue-50'
          : 'bg-transparent hover:bg-slate-50'
      } ${!disabled ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Visual checkbox */}
        <div
          className={`w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0 transition-all ${
            checked
              ? 'bg-blue-600'
              : 'bg-transparent border-2 border-slate-300'
          }`}
        >
          {checked && <Check className="w-3 h-3 text-white" />}
        </div>

        {/* Emoji icon */}
        <span className="text-[17px] leading-none">{emoji}</span>

        {/* Label + description */}
        <div>
          <p className="text-sm font-medium text-slate-900">{category.label}</p>
          <p className="text-xs text-slate-500">{category.description}</p>
          {category.autoLinked && disabled && (
            <p className="text-[11px] text-blue-500 italic mt-0.5">
              Auto-enabled when both Milestones and Procedures are selected
            </p>
          )}
        </div>
      </div>

      {/* Count badge */}
      {loadingCount ? (
        <Skeleton className="h-6 w-10 rounded-md" />
      ) : (
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-md font-mono transition-all shrink-0 ${
            checked
              ? 'bg-blue-100 text-blue-600'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
