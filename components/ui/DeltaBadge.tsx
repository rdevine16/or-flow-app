// components/ui/DeltaBadge.tsx
// Reusable delta indicator badge for showing comparison metrics.
// Supports time (+9m), currency (+$380), and percentage (+12%) formats.
// Extracted from KPICard.tsx and extended for milestone/financial analytics.

interface DeltaBadgeProps {
  /** The raw delta value */
  delta: number
  /** Format to display: 'percentage' = "12%", 'time' = "9m", 'currency' = "$380" */
  format?: 'percentage' | 'time' | 'currency'
  /** Whether decrease is good (e.g. for costs, duration) */
  invert?: boolean
  /** Override severity: skip auto-detection from delta sign */
  severity?: 'faster' | 'on-pace' | 'slower' | 'critical' | 'neutral'
}

const SEVERITY_STYLES: Record<string, string> = {
  faster: 'bg-green-50 text-green-700 ring-green-600/20',
  'on-pace': 'bg-amber-50 text-amber-700 ring-amber-500/20',
  slower: 'bg-red-50 text-red-600 ring-red-600/20',
  critical: 'bg-red-100 text-red-800 ring-red-700/20',
  neutral: 'bg-slate-50 text-slate-600 ring-slate-500/20',
}

function formatDeltaValue(delta: number, format: 'percentage' | 'time' | 'currency'): string {
  const abs = Math.abs(delta)
  switch (format) {
    case 'time': {
      const hrs = Math.floor(abs / 60)
      const mins = Math.round(abs % 60)
      if (hrs === 0) return `${mins}m`
      return `${hrs}h ${mins}m`
    }
    case 'currency':
      return `$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    case 'percentage':
    default:
      return `${abs}%`
  }
}

function getAutoSeverity(delta: number, invert: boolean): string {
  if (delta === 0) return 'neutral'
  const isPositiveGood = invert ? delta < 0 : delta > 0
  return isPositiveGood ? 'faster' : 'slower'
}

export function DeltaBadge({
  delta,
  format = 'percentage',
  invert = false,
  severity,
}: DeltaBadgeProps) {
  const resolvedSeverity = severity ?? getAutoSeverity(delta, invert)
  const style = SEVERITY_STYLES[resolvedSeverity] ?? SEVERITY_STYLES.neutral

  const sign = delta > 0 ? '+' : delta < 0 ? '-' : ''
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const formatted = formatDeltaValue(delta, format)

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ring-1 ring-inset ${style}`}
      aria-label={`${sign}${formatted}, ${resolvedSeverity}`}
    >
      {arrow} {sign}{formatted}
    </span>
  )
}

export default DeltaBadge
