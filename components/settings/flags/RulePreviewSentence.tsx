// components/settings/flags/RulePreviewSentence.tsx
// Natural-language preview of a configured flag rule.
// Handles all 5 threshold types and per-data-type formatting.

'use client'

import { OPERATORS, THRESHOLD_TYPES } from '@/lib/constants/metrics-catalog'
import type { CustomRuleFormState, MetricCatalogEntry } from '@/types/flag-settings'

interface RulePreviewSentenceProps {
  form: CustomRuleFormState
  metric: MetricCatalogEntry | undefined
}

function formatValue(value: number, dataType: string, unit: string): string {
  switch (dataType) {
    case 'currency':
      return `$${value.toLocaleString()}`
    case 'percentage':
      return `${value}%`
    case 'minutes':
      return `${value} ${unit}`
    case 'count':
      return `${value}`
    default:
      return `${value} ${unit}`
  }
}

export function RulePreviewSentence({ form, metric }: RulePreviewSentenceProps) {
  if (!metric) return null

  const operatorEntry = OPERATORS.find((o) => o.id === form.operator)
  const thresholdEntry = THRESHOLD_TYPES.find((t) => t.id === form.thresholdType)
  const operatorLabel = operatorEntry?.label.toLowerCase() ?? form.operator
  const metricName = metric.name.toLowerCase()

  const buildSentence = (): string => {
    switch (form.thresholdType) {
      case 'median_plus_sd':
        return `Flag cases where ${metricName} is ${operatorLabel} ${form.thresholdValue} standard deviation${form.thresholdValue !== 1 ? 's' : ''} from the ${form.comparisonScope} median`

      case 'absolute':
        return `Flag cases where ${metricName} is ${operatorLabel} ${formatValue(form.thresholdValue, metric.dataType, metric.unit)}`

      case 'percentage_of_median':
        return `Flag cases where ${metricName} is ${operatorLabel} ${form.thresholdValue}% of the ${form.comparisonScope} median`

      case 'percentile':
        return `Flag cases where ${metricName} is ${operatorLabel} the ${form.thresholdValue}${getOrdinalSuffix(form.thresholdValue)} percentile`

      case 'between': {
        const lo = formatValue(form.thresholdValue, metric.dataType, metric.unit)
        const hi = form.thresholdValueMax != null
          ? formatValue(form.thresholdValueMax, metric.dataType, metric.unit)
          : '...'
        return `Flag cases where ${metricName} is between ${lo} and ${hi}`
      }

      default:
        return `Flag cases where ${metricName} ${operatorLabel} ${form.thresholdValue}`
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        Rule Preview
      </p>
      <p className="text-sm text-slate-700 leading-relaxed">
        {buildSentence()}
      </p>
      {thresholdEntry && (
        <p className="text-[11px] text-slate-400 mt-1">
          {thresholdEntry.description}
        </p>
      )}
    </div>
  )
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
