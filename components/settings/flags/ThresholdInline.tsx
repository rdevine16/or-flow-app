// components/settings/flags/ThresholdInline.tsx
// Inline threshold editor: type selector + operator + value input(s) + computed baseline.

'use client'

import { OPERATORS, THRESHOLD_TYPES, getMetricById } from '@/lib/constants/metrics-catalog'
import type { FlagRule, ThresholdType, Operator } from '@/types/flag-settings'

interface ThresholdInlineProps {
  rule: FlagRule
  onThresholdTypeChange: (type: ThresholdType, defaultValue: number) => void
  onOperatorChange: (operator: Operator) => void
  onValueChange: (value: number) => void
  onValueMaxChange: (value: number | null) => void
  disabled?: boolean
  baselines?: { median: number; sd: number } | null
}

export function ThresholdInline({
  rule,
  onThresholdTypeChange,
  onOperatorChange,
  onValueChange,
  onValueMaxChange,
  disabled = false,
  baselines,
}: ThresholdInlineProps) {
  const metric = getMetricById(rule.metric)
  const unit = metric?.unit || 'min'
  const isBetween = rule.threshold_type === 'between'
  const isMedianSD = rule.threshold_type === 'median_plus_sd'

  // Filter threshold types based on metric capabilities
  const availableTypes = THRESHOLD_TYPES.filter((t) => {
    if (t.id === 'median_plus_sd' && metric?.supportsMedian === false) return false
    if (t.id === 'percentage_of_median' && metric?.supportsMedian === false) return false
    if (t.id === 'percentile' && metric?.supportsMedian === false) return false
    return true
  })

  // Computed value for median+SD display
  const computedValue =
    isMedianSD && baselines
      ? Math.round(baselines.median + rule.threshold_value * baselines.sd)
      : null

  const handleTypeChange = (newType: ThresholdType) => {
    let defaultValue: number
    switch (newType) {
      case 'median_plus_sd':
        defaultValue = 1.0
        break
      case 'absolute':
        defaultValue = computedValue || 90
        break
      case 'percentage_of_median':
        defaultValue = 120
        break
      case 'percentile':
        defaultValue = 90
        break
      case 'between':
        defaultValue = 0
        break
      default:
        defaultValue = 1.0
    }
    onThresholdTypeChange(newType, defaultValue)
  }

  const getValueSuffix = () => {
    if (isMedianSD) return 'SD'
    if (rule.threshold_type === 'percentage_of_median') return '%'
    if (rule.threshold_type === 'percentile') return 'th'
    return unit
  }

  const getStep = () => {
    if (isMedianSD) return 0.5
    if (rule.threshold_type === 'percentage_of_median' || rule.threshold_type === 'percentile') return 5
    if (metric?.dataType === 'currency') return 100
    if (metric?.dataType === 'percentage') return 5
    return 5
  }

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Threshold type */}
        <select
          value={rule.threshold_type}
          disabled={disabled}
          onChange={(e) => handleTypeChange(e.target.value as ThresholdType)}
          className="text-[11px] px-1.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-default max-w-[100px] shrink-0"
        >
          {availableTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Operator (hidden for "between") */}
        {!isBetween && (
          <select
            value={rule.operator}
            disabled={disabled}
            onChange={(e) => onOperatorChange(e.target.value as Operator)}
            className="text-xs font-semibold px-1 py-1 rounded-md border border-slate-200 bg-white text-slate-600 w-10 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {OPERATORS.map((op) => (
              <option key={op.id} value={op.id}>
                {op.symbol}
              </option>
            ))}
          </select>
        )}

        {/* Value inputs */}
        {isBetween ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={rule.threshold_value}
              disabled={disabled}
              step={getStep()}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onValueChange(v)
              }}
              className="w-14 text-xs font-semibold font-mono text-center px-1 py-1 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className="text-[10px] text-slate-400">to</span>
            <input
              type="number"
              value={rule.threshold_value_max ?? ''}
              disabled={disabled}
              step={getStep()}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                onValueMaxChange(!isNaN(v) ? v : null)
              }}
              className="w-14 text-xs font-semibold font-mono text-center px-1 py-1 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className="text-[10px] text-slate-400">{unit}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {isMedianSD && <span className="text-[10px] text-slate-400">+</span>}
            <input
              type="number"
              value={rule.threshold_value}
              disabled={disabled}
              step={getStep()}
              min={isMedianSD ? 0.5 : undefined}
              max={isMedianSD ? 5 : rule.threshold_type === 'percentile' ? 99 : undefined}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onValueChange(v)
              }}
              className="w-14 text-xs font-semibold font-mono text-center px-1 py-1 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
            />
            <span className="text-[10px] text-slate-400">{getValueSuffix()}</span>
          </div>
        )}
      </div>

      {/* Computed baseline for median+SD */}
      {isMedianSD && (
        <span className="text-[10px] text-slate-400 leading-tight">
          {computedValue != null ? (
            <>
              ≈{' '}
              <span className="font-semibold font-mono text-slate-500">
                {computedValue} {unit}
              </span>
              <span className="opacity-70">
                {' '}
                ({baselines!.median}
                {unit === '$' ? '' : 'm'} +{' '}
                {Math.round(rule.threshold_value * baselines!.sd)})
              </span>
            </>
          ) : (
            <span className="italic">Per surgeon × procedure</span>
          )}
        </span>
      )}
    </div>
  )
}
