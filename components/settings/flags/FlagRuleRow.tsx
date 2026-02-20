// components/settings/flags/FlagRuleRow.tsx
// Single flag rule row with CSS Grid layout and inline editing.
// Supports built-in rules (toggle/edit only) and custom rules (archive/restore).

'use client'

import { Toggle } from '@/components/ui/Toggle'
import { categoryColors } from '@/lib/design-tokens'
import { getMetricById } from '@/lib/constants/metrics-catalog'
import { SeverityPills } from './SeverityPills'
import { ScopeBadge } from './ScopeBadge'
import { ThresholdInline } from './ThresholdInline'
import { Archive, RotateCcw } from 'lucide-react'
import type { FlagRule, Severity, ThresholdType, Operator, ComparisonScope } from '@/types/flag-settings'

/** Must match FlagRuleTable header columns */
export const RULE_GRID_COLUMNS = '44px 1fr 230px 160px 80px 36px'

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
  /** If true, show archive button instead of empty action column */
  showArchive?: boolean
  onArchive?: () => void
  /** If true, show restore button (archived view) */
  showRestore?: boolean
  onRestore?: () => void
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
  showArchive,
  onArchive,
  showRestore,
  onRestore,
}: FlagRuleRowProps) {
  const disabled = !rule.is_enabled
  const isArchived = !rule.is_active
  const metric = getMetricById(rule.metric)
  const catColors =
    categoryColors[rule.category as keyof typeof categoryColors] || {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
    }

  return (
    <div
      className={`grid items-center px-4 py-3 gap-x-2.5 border-b border-slate-100 last:border-b-0 transition-opacity ${
        disabled || isArchived ? 'opacity-45' : ''
      }`}
      style={{ gridTemplateColumns: RULE_GRID_COLUMNS, minWidth: 640 }}
    >
      {/* Toggle */}
      <div className="flex justify-center">
        {!isArchived ? (
          <Toggle
            checked={rule.is_enabled}
            onChange={onToggle}
            disabled={isSaving}
            size="sm"
            aria-label={`${rule.is_enabled ? 'Disable' : 'Enable'} ${rule.name}`}
          />
        ) : (
          <span className="w-[34px]" />
        )}
      </div>

      {/* Name + Description + Category Badge + CUSTOM Badge */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[13px] font-semibold truncate ${
              disabled || isArchived ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {rule.name}
          </span>
          <span
            className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${catColors.bg} ${catColors.text}`}
          >
            {rule.category}
          </span>
          {!rule.is_built_in && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
              Custom
            </span>
          )}
        </div>
        {(rule.description || metric?.description) && (
          <span
            className={`text-[11px] truncate block ${
              disabled || isArchived ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {rule.description || metric?.description}
          </span>
        )}
      </div>

      {/* Threshold */}
      {!isArchived ? (
        <ThresholdInline
          rule={rule}
          onThresholdTypeChange={onThresholdTypeChange}
          onOperatorChange={onOperatorChange}
          onValueChange={onValueChange}
          onValueMaxChange={onValueMaxChange}
          disabled={disabled}
          baselines={baselines}
        />
      ) : (
        <span className="text-[11px] text-slate-400">
          {rule.threshold_type} {rule.operator} {rule.threshold_value}
        </span>
      )}

      {/* Severity */}
      {!isArchived ? (
        <SeverityPills value={rule.severity} onChange={onSeverityChange} disabled={disabled} />
      ) : (
        <span className={`text-[11px] capitalize text-slate-400`}>{rule.severity}</span>
      )}

      {/* Scope */}
      <div className="flex justify-center">
        {!isArchived ? (
          <ScopeBadge value={rule.comparison_scope} onChange={onScopeChange} disabled={disabled} />
        ) : (
          <span className="text-[9px] font-bold uppercase text-slate-400">
            {rule.comparison_scope === 'facility' ? 'FAC' : 'PER'}
          </span>
        )}
      </div>

      {/* Action column: archive / restore */}
      <div className="flex justify-center">
        {showArchive && onArchive && !isArchived && (
          <button
            onClick={onArchive}
            disabled={isSaving}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            aria-label={`Archive ${rule.name}`}
            title="Archive rule"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
        {showRestore && onRestore && isArchived && (
          <button
            onClick={onRestore}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            aria-label={`Restore ${rule.name}`}
            title="Restore rule"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
