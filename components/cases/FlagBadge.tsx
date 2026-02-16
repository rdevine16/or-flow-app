'use client'

interface FlagBadgeProps {
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail?: string | null
}

const SEVERITY_STYLES = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-600',
} as const

const DOT_STYLES = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
} as const

export default function FlagBadge({ severity, label, detail }: FlagBadgeProps) {
  const sev = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info
  const dot = DOT_STYLES[severity] || DOT_STYLES.info

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold leading-tight ${sev}`}
      title={detail || undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate max-w-[120px]">{label}</span>
    </span>
  )
}
