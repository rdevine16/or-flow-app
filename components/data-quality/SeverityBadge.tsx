// SeverityBadge — dot + count + label badge with severity coloring

interface SeverityBadgeProps {
  severity: 'error' | 'warning' | 'info'
  count: number
  label: string
}

const SEVERITY_CONFIG = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-600',
    countColor: 'text-red-600',
    labelColor: 'text-red-600/80',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
    countColor: 'text-amber-600',
    labelColor: 'text-amber-600/80',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-600',
    countColor: 'text-blue-600',
    labelColor: 'text-blue-600/80',
  },
} as const

export default function SeverityBadge({ severity, count, label }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity]

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${config.bg} border ${config.border}`}
      data-testid={`severity-${severity}`}
    >
      <div className={`w-[7px] h-[7px] rounded-full ${config.dot}`} />
      <span className={`font-mono text-[13px] font-semibold ${config.countColor}`}>
        {count}
      </span>
      <span className={`text-[11px] ${config.labelColor}`}>
        {label}
      </span>
    </div>
  )
}
