// components/settings/flags/FlagRuleRow.tsx
// Single flag rule row with CSS Grid layout and inline editing.

'use client'

import { Toggle } from '@/components/ui/Toggle'
import { categoryColors } from '@/lib/design-tokens'
import { getMetricById } from '@/lib/constants/metrics-catalog'
import { SeverityPills } from './SeverityPills'
import { ScopeBadge } from './ScopeBadge'
import { ThresholdInline } from './ThresholdInline'
import type { FlagRule, Severity, ThresholdType, Operator, ComparisonScope } from '@/types/flag-settings'

/** Must match FlagRuleTable header columns */
export const RULE_GRID_COLUMNS = '44px 1fr 230px 160px 80px'

interface FlagRuleRowProps {
  rule: FlagRule
  onToggle: () => void
  onSeverityChange: (severity: Severity) => void
  onThresholdTypeChange: (type: ThresholdType, defaultValue: number) => void
  onOperatorChange: (operator: Operator) => void
  onValueChange: (value: number) => void
  onValueMaxChange: (value: number | null) => void
  onScopeChange: (scope: ComparisonScope) => void
  isSaving: boolean
  baselines?: { median: number; sd: number } | null
}

export function FlagRuleRow({
  rule,
  onToggle,
  onSeverityChange,
  onThresholdTypeChange,
  onOperatorChange,
  onValueChange,
  onValueMaxChange,
  onScopeChange,
  isSaving,
  baselines,
}: FlagRuleRowProps) {
  const disabled = !rule.is_enabled
  const metric = getMetricById(rule.metric)
  const catColors =
    categoryColors[rule.category as keyof typeof categoryColors] || {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
    }

  return (
    <div
      className={`grid items-center px-4 py-3 gap-x-2.5 border-b border-slate-100 last:border-b-0 transition-opacity ${
        disabled ? 'opacity-45' : ''
      }`}
      style={{ gridTemplateColumns: RULE_GRID_COLUMNS }}
    >
      {/* Toggle */}
      <div className="flex justify-center">
        <Toggle
          checked={rule.is_enabled}
          onChange={onToggle}
          disabled={isSaving}
          size="sm"
          aria-label={`${rule.is_enabled ? 'Disable' : 'Enable'} ${rule.name}`}
        />
      </div>

      {/* Name + Description + Category Badge */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[13px] font-semibold truncate ${
              disabled ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {rule.name}
          </span>
          <span
            className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${catColors.bg} ${catColors.text}`}
          >
            {rule.category}
          </span>
        </div>
        {(rule.description || metric?.description) && (
          <span
            className={`text-[11px] truncate block ${
              disabled ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {rule.description || metric?.description}
          </span>
        )}
      </div>

      {/* Threshold */}
      <ThresholdInline
        rule={rule}
        onThresholdTypeChange={onThresholdTypeChange}
        onOperatorChange={onOperatorChange}
        onValueChange={onValueChange}
        onValueMaxChange={onValueMaxChange}
        disabled={disabled}
        baselines={baselines}
      />

      {/* Severity */}
      <SeverityPills value={rule.severity} onChange={onSeverityChange} disabled={disabled} />

      {/* Scope */}
      <div className="flex justify-center">
        <ScopeBadge value={rule.comparison_scope} onChange={onScopeChange} disabled={disabled} />
      </div>
    </div>
  )
}
