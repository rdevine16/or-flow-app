// SeverityBadge — dot + count + label (Phase 2)
// Placeholder: will be implemented in Phase 2

interface SeverityBadgeProps {
  severity: 'error' | 'warning' | 'info'
  count: number
  label: string
}

export default function SeverityBadge({ severity, count, label }: SeverityBadgeProps) {
  return (
    <span data-testid={`severity-${severity}`}>
      {count} {label}
    </span>
  )
}
