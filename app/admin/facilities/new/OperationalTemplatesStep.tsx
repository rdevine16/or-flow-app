// app/admin/facilities/new/OperationalTemplatesStep.tsx
// Step 4: Operational template selection — cost categories, payers, analytics, flags, etc.

'use client'

import { useCallback } from 'react'
import {
  DollarSign,
  Package,
  Wallet,
  BarChart3,
  Flag,
  GitBranch,
  Bell,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { LucideIcon } from 'lucide-react'
import type { OperationalTemplatesStepProps, TemplateConfig, TemplateCategoryDef } from './types'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

interface CategoryWithIcon extends TemplateCategoryDef {
  icon: LucideIcon
}

const FINANCIAL_CATEGORIES: CategoryWithIcon[] = [
  {
    key: 'costCategories',
    label: 'Cost Categories',
    description: 'Financial cost tracking categories for case costing',
    icon: DollarSign,
  },
  {
    key: 'implantCompanies',
    label: 'Implant Companies',
    description: 'Implant vendor definitions for supply tracking',
    icon: Package,
  },
  {
    key: 'payers',
    label: 'Payers',
    description: 'Insurance payer definitions for reimbursement tracking',
    icon: Wallet,
  },
]

const ANALYTICS_CATEGORIES: CategoryWithIcon[] = [
  {
    key: 'analyticsSettings',
    label: 'Analytics Settings',
    description: 'Default analytics dashboard configuration',
    icon: BarChart3,
  },
  {
    key: 'flagRules',
    label: 'Flag Rules',
    description: 'Automated alert and flag rule definitions',
    icon: Flag,
  },
  {
    key: 'phaseDefinitions',
    label: 'Phase Definitions',
    description: 'Surgical workflow phase configurations',
    icon: GitBranch,
  },
  {
    key: 'notificationSettings',
    label: 'Notification Settings',
    description: 'Default notification preferences and channels',
    icon: Bell,
  },
]

const ALL_OPERATIONAL_KEYS = [...FINANCIAL_CATEGORIES, ...ANALYTICS_CATEGORIES].map(c => c.key)

// ============================================================================
// COMPONENT
// ============================================================================

export default function OperationalTemplatesStep({
  config,
  counts,
  loadingCounts,
  onChange,
}: OperationalTemplatesStepProps) {
  const allFinancialSelected = FINANCIAL_CATEGORIES.every(c => config[c.key])
  const allAnalyticsSelected = ANALYTICS_CATEGORIES.every(c => config[c.key])
  const allSelected = ALL_OPERATIONAL_KEYS.every(k => config[k])

  const toggleCategory = useCallback(
    (key: keyof TemplateConfig) => {
      onChange({ ...config, [key]: !config[key] })
    },
    [config, onChange],
  )

  const toggleSection = useCallback(
    (categories: CategoryWithIcon[], enable: boolean) => {
      const next = { ...config }
      for (const cat of categories) {
        next[cat.key] = enable
      }
      onChange(next)
    },
    [config, onChange],
  )

  const toggleAll = useCallback(
    (enable: boolean) => {
      const next = { ...config }
      for (const key of ALL_OPERATIONAL_KEYS) {
        next[key] = enable
      }
      onChange(next)
    },
    [config, onChange],
  )

  return (
    <div className="p-6 sm:p-8" data-testid="operational-templates-step">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Operational Templates</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Select which operational and analytics templates to seed for this facility
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleAll(!allSelected)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          data-testid="operational-select-all"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Financial Section */}
      <TemplateSection
        title="Financial"
        categories={FINANCIAL_CATEGORIES}
        config={config}
        counts={counts}
        loadingCounts={loadingCounts}
        allSelected={allFinancialSelected}
        onToggleCategory={toggleCategory}
        onToggleSection={(enable) => toggleSection(FINANCIAL_CATEGORIES, enable)}
      />

      {/* Analytics & Alerts Section */}
      <TemplateSection
        title="Analytics & Alerts"
        categories={ANALYTICS_CATEGORIES}
        config={config}
        counts={counts}
        loadingCounts={loadingCounts}
        allSelected={allAnalyticsSelected}
        onToggleCategory={toggleCategory}
        onToggleSection={(enable) => toggleSection(ANALYTICS_CATEGORIES, enable)}
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
        {categories.map((cat) => {
          const count = counts[cat.key]
          const isDisabled = count === 0 && !loadingCounts

          return (
            <TemplateCategoryCard
              key={cat.key}
              category={cat}
              checked={config[cat.key]}
              count={count}
              loadingCount={loadingCounts}
              disabled={isDisabled}
              onToggle={() => onToggleCategory(cat.key)}
            />
          )
        })}
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
      </div>
    </label>
  )
}
