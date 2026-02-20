// components/settings/flags/RuleConfigureStep.tsx
// Step 2 of the rule builder: configure name, threshold type, operator, value(s),
// severity, scope. Includes live preview sentence at bottom.

'use client'

import { ArrowLeft } from 'lucide-react'
import { OPERATORS, THRESHOLD_TYPES } from '@/lib/constants/metrics-catalog'
import { getCategoryColors } from '@/lib/design-tokens'
import { SeverityPills } from '@/components/settings/flags/SeverityPills'
import { RulePreviewSentence } from '@/components/settings/flags/RulePreviewSentence'
import type {
  CustomRuleFormState,
  MetricCatalogEntry,
  ThresholdType,
  Operator,
  Severity,
  ComparisonScope,
} from '@/types/flag-settings'

interface RuleConfigureStepProps {
  metric: MetricCatalogEntry
  form: CustomRuleFormState
  onFormChange: (updates: Partial<CustomRuleFormState>) => void
  onBack: () => void
  onSubmit: () => void
}

export function RuleConfigureStep({
  metric,
  form,
  onFormChange,
  onBack,
  onSubmit,
}: RuleConfigureStepProps) {
  const categoryColors = getCategoryColors(metric.category)
  const isBetween = form.thresholdType === 'between'
  const isMedianSD = form.thresholdType === 'median_plus_sd'
  const canSubmit = form.name.trim().length > 0

  // Filter threshold types based on metric capabilities
  const availableTypes = THRESHOLD_TYPES.filter((t) => {
    if (t.id === 'median_plus_sd' && !metric.supportsMedian) return false
    if (t.id === 'percentage_of_median' && !metric.supportsMedian) return false
    if (t.id === 'percentile' && !metric.supportsMedian) return false
    return true
  })

  const getStep = () => {
    if (isMedianSD) return 0.5
    if (form.thresholdType === 'percentage_of_median' || form.thresholdType === 'percentile')
      return 5
    if (metric.dataType === 'currency') return 100
    if (metric.dataType === 'percentage') return 5
    return 5
  }

  const getValueLabel = () => {
    if (isMedianSD) return 'Standard Deviations'
    if (form.thresholdType === 'percentage_of_median') return '% of Median'
    if (form.thresholdType === 'percentile') return 'Percentile'
    if (isBetween) return 'Range'
    return 'Value'
  }

  const getValueSuffix = () => {
    if (isMedianSD) return 'SD'
    if (form.thresholdType === 'percentage_of_median') return '%'
    if (form.thresholdType === 'percentile') return 'th'
    return metric.unit
  }

  const handleThresholdTypeChange = (type: ThresholdType) => {
    let defaultValue: number
    switch (type) {
      case 'median_plus_sd':
        defaultValue = 1.0
        break
      case 'absolute':
        defaultValue = 90
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
    onFormChange({
      thresholdType: type,
      thresholdValue: defaultValue,
      thresholdValueMax: type === 'between' ? defaultValue + 100 : null,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back + metric info */}
      <div className="px-6 py-4 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to metrics
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${categoryColors.bg} ${categoryColors.text}`}
          >
            {metric.category.charAt(0).toUpperCase() + metric.category.slice(1)}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{metric.name}</h3>
        </div>
        <p className="text-xs text-slate-500 mt-1">{metric.description}</p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Rule Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Rule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
            placeholder={`e.g., High ${metric.name}`}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            autoFocus
          />
        </div>

        {/* Description (optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
            placeholder="Optional description for this rule"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Threshold Type */}
        <div>
          <label htmlFor="threshold-type" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Threshold Type
          </label>
          <select
            id="threshold-type"
            value={form.thresholdType}
            onChange={(e) => handleThresholdTypeChange(e.target.value as ThresholdType)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            {availableTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {availableTypes.find((t) => t.id === form.thresholdType) && (
            <p className="text-[11px] text-slate-400 mt-1">
              {availableTypes.find((t) => t.id === form.thresholdType)!.description}
            </p>
          )}
        </div>

        {/* Operator (hidden for between) */}
        {!isBetween && (
          <div>
            <label htmlFor="operator" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Operator
            </label>
            <select
              id="operator"
              value={form.operator}
              onChange={(e) => onFormChange({ operator: e.target.value as Operator })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              {OPERATORS.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.symbol} {op.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Value input(s) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {getValueLabel()}
          </label>
          {isBetween ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.thresholdValue}
                step={getStep()}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v)) onFormChange({ thresholdValue: v })
                }}
                className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-xs text-slate-400 shrink-0">to</span>
              <input
                type="number"
                value={form.thresholdValueMax ?? ''}
                step={getStep()}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  onFormChange({ thresholdValueMax: !isNaN(v) ? v : null })
                }}
                className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-xs text-slate-400 shrink-0">{metric.unit}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.thresholdValue}
                step={getStep()}
                min={isMedianSD ? 0.5 : undefined}
                max={
                  isMedianSD ? 5 : form.thresholdType === 'percentile' ? 99 : undefined
                }
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v)) onFormChange({ thresholdValue: v })
                }}
                className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-xs text-slate-400 shrink-0">{getValueSuffix()}</span>
            </div>
          )}
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Severity
          </label>
          <SeverityPills
            value={form.severity}
            onChange={(sev: Severity) => onFormChange({ severity: sev })}
          />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Comparison Scope
          </label>
          <div className="flex gap-2">
            {(['facility', 'personal'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => onFormChange({ comparisonScope: scope as ComparisonScope })}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-all ${
                  form.comparisonScope === scope
                    ? scope === 'personal'
                      ? 'bg-violet-50 text-violet-600 border-violet-200 ring-1 ring-violet-200'
                      : 'bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-300'
                    : 'text-slate-400 border-slate-200 hover:text-slate-500'
                } cursor-pointer`}
              >
                {scope === 'facility' ? 'Facility' : 'Personal'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {form.comparisonScope === 'personal'
              ? "Compare against each surgeon's own historical data"
              : 'Compare against all facility cases'}
          </p>
        </div>

        {/* Preview */}
        <RulePreviewSentence form={form} metric={metric} />
      </div>

      {/* Footer with action buttons */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all ${
            canSubmit
              ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500/20'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Add Rule
        </button>
      </div>
    </div>
  )
}
