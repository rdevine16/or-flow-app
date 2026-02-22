// app/admin/facilities/new/ClinicalTemplatesStep.tsx
// Step 3: Clinical template selection — milestones, procedures, delay types, etc.

'use client'

import { useCallback } from 'react'
import {
  Clock,
  FlaskConical,
  Link2,
  Timer,
  Ban,
  Layers,
  ClipboardCheck,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { LucideIcon } from 'lucide-react'
import type { ClinicalTemplatesStepProps, TemplateConfig, TemplateCategoryDef } from './types'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

interface CategoryWithIcon extends TemplateCategoryDef {
  icon: LucideIcon
  autoLinked?: boolean
}

const CLINICAL_DATA_CATEGORIES: CategoryWithIcon[] = [
  {
    key: 'milestones',
    label: 'Milestones',
    description: 'Surgical workflow milestone types (e.g., Wheels In, Incision, Wheels Out)',
    icon: Clock,
  },
  {
    key: 'procedures',
    label: 'Procedures',
    description: 'Procedure type definitions with specialty classifications',
    icon: FlaskConical,
  },
  {
    key: 'procedureMilestoneConfig',
    label: 'Procedure-Milestone Config',
    description: 'Links procedures to their required milestone sequences',
    icon: Link2,
    autoLinked: true,
  },
]

const WORKFLOW_CATEGORIES: CategoryWithIcon[] = [
  {
    key: 'delayTypes',
    label: 'Delay Types',
    description: 'Standard delay reason classifications for tracking',
    icon: Timer,
  },
  {
    key: 'cancellationReasons',
    label: 'Cancellation Reasons',
    description: 'Case cancellation reason options',
    icon: Ban,
  },
  {
    key: 'complexities',
    label: 'Complexities',
    description: 'Case complexity level definitions',
    icon: Layers,
  },
  {
    key: 'checklistFields',
    label: 'Pre-Op Checklist Fields',
    description: 'Pre-operative checklist items for case readiness',
    icon: ClipboardCheck,
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
  const allClinicalDataSelected = CLINICAL_DATA_CATEGORIES.every(c => config[c.key])
  const allWorkflowSelected = WORKFLOW_CATEGORIES.every(c => config[c.key])
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

  const toggleSection = useCallback(
    (categories: CategoryWithIcon[], enable: boolean) => {
      const next = { ...config }
      for (const cat of categories) {
        next[cat.key] = enable
      }
      // Re-evaluate auto-link
      next.procedureMilestoneConfig = next.milestones && next.procedures
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
      // Auto-link follows the master toggle
      if (!enable) next.procedureMilestoneConfig = false
      onChange(next)
    },
    [config, onChange],
  )

  return (
    <div className="p-6 sm:p-8" data-testid="clinical-templates-step">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Clinical Templates</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Select which clinical data templates to seed for this facility
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleAll(!allSelected)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          data-testid="clinical-select-all"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Clinical Data Section */}
      <TemplateSection
        title="Clinical Data"
        categories={CLINICAL_DATA_CATEGORIES}
        config={config}
        counts={counts}
        loadingCounts={loadingCounts}
        allSelected={allClinicalDataSelected}
        onToggleCategory={toggleCategory}
        onToggleSection={(enable) => toggleSection(CLINICAL_DATA_CATEGORIES, enable)}
      />

      {/* Workflow & Policies Section */}
      <TemplateSection
        title="Workflow & Policies"
        categories={WORKFLOW_CATEGORIES}
        config={config}
        counts={counts}
        loadingCounts={loadingCounts}
        allSelected={allWorkflowSelected}
        onToggleCategory={toggleCategory}
        onToggleSection={(enable) => toggleSection(WORKFLOW_CATEGORIES, enable)}
        className="mt-6"
      />
    </div>
  )
}

// ============================================================================
// SECTION COMPONENT
// ============================================================================

interface TemplateSectionProps {
  title: string
  categories: CategoryWithIcon[]
  config: TemplateConfig
  counts: Record<string, number>
  loadingCounts: boolean
  allSelected: boolean
  onToggleCategory: (key: keyof TemplateConfig) => void
  onToggleSection: (enable: boolean) => void
  className?: string
}

function TemplateSection({
  title,
  categories,
  config,
  counts,
  loadingCounts,
  allSelected,
  onToggleCategory,
  onToggleSection,
  className = '',
}: TemplateSectionProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => onToggleSection(!allSelected)}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          {allSelected ? 'Deselect Section' : 'Select Section'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {categories.map((cat) => (
          <TemplateCategoryCard
            key={cat.key}
            category={cat}
            checked={config[cat.key]}
            count={counts[cat.key]}
            loadingCount={loadingCounts}
            disabled={
              (counts[cat.key] === 0 && !loadingCounts) ||
              (cat.autoLinked === true && !(config.milestones && config.procedures))
            }
            onToggle={() => onToggleCategory(cat.key)}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

interface TemplateCategoryCardProps {
  category: CategoryWithIcon
  checked: boolean
  count: number
  loadingCount: boolean
  disabled: boolean
  onToggle: () => void
}

function TemplateCategoryCard({
  category,
  checked,
  count,
  loadingCount,
  disabled,
  onToggle,
}: TemplateCategoryCardProps) {
  const Icon = category.icon
  const isAutoLinkedDisabled = category.autoLinked === true && disabled

  return (
    <label
      data-testid={`template-card-${category.key}`}
      className={`flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
          : checked
          ? 'border-blue-200 bg-blue-50/50 hover:border-blue-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 disabled:opacity-50"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700">{category.label}</span>
          {loadingCount ? (
            <Skeleton className="h-5 w-8 rounded-full" />
          ) : (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                count > 0
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
        {isAutoLinkedDisabled && (
          <p className="text-xs text-blue-500 mt-1 italic">
            Auto-enabled when both Milestones and Procedures are selected
          </p>
        )}
      </div>
    </label>
  )
}
