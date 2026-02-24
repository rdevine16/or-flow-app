// app/admin/facilities/new/OperationalTemplatesStep.tsx
// Step 4: Operational template selection — TemplateRow pattern with emojis

'use client'

import { useCallback } from 'react'
import { Check } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { OperationalTemplatesStepProps, TemplateConfig } from './types'
import { TEMPLATE_EMOJIS } from './types'

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

interface TemplateCategory {
  key: keyof TemplateConfig
  label: string
  description: string
}

const FINANCIAL_CATEGORIES: TemplateCategory[] = [
  {
    key: 'costCategories',
    label: 'Cost Categories',
    description: 'Financial cost tracking categories',
  },
  {
    key: 'implantCompanies',
    label: 'Implant Companies',
    description: 'Medical device vendor directory',
  },
  {
    key: 'payers',
    label: 'Payer Templates',
    description: 'Insurance payer configurations',
  },
]

const ANALYTICS_CATEGORIES: TemplateCategory[] = [
  {
    key: 'analyticsSettings',
    label: 'Analytics Settings',
    description: 'Default analytics configurations',
  },
  {
    key: 'flagRules',
    label: 'Flag Rules',
    description: 'Automated alert rule templates',
  },
  {
    key: 'notificationSettings',
    label: 'Notification Settings',
    description: 'Default notification preferences',
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
  const allSelected = ALL_OPERATIONAL_KEYS.every(k => config[k])

  const toggleCategory = useCallback(
    (key: keyof TemplateConfig) => {
      onChange({ ...config, [key]: !config[key] })
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
    <div data-testid="operational-templates-step">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header with Select All */}
        <div className="px-7 pt-6 flex justify-between items-start">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Operational Configuration</h3>
            <p className="text-sm text-slate-500 mt-0.5">Financial, analytics, and notification defaults</p>
          </div>
          <button
            type="button"
            onClick={() => toggleAll(!allSelected)}
            className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors shrink-0"
            data-testid="operational-select-all"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="px-7 pt-5 pb-7">
          {/* Financial Section */}
          <div className="mb-5">
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Financial
            </h4>
            <div className="flex flex-col gap-0.5">
              {FINANCIAL_CATEGORIES.map((cat) => (
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

          {/* Analytics & Alerts Section */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Analytics & Alerts
            </h4>
            <div className="flex flex-col gap-0.5">
              {ANALYTICS_CATEGORIES.map((cat) => (
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
