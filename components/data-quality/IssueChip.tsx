// IssueChip — severity-colored issue type badge

interface IssueChipProps {
  label: string
  severity: 'error' | 'warning' | 'info'
  count?: number
}

const severityStyles: Record<string, string> = {
  error: 'bg-red-100 text-red-900 border-red-200',
  warning: 'bg-amber-100 text-amber-900 border-amber-200',
  info: 'bg-blue-100 text-blue-900 border-blue-200',
}

export default function IssueChip({ label, severity, count }: IssueChipProps) {
  return (
    <span
      data-testid={`issue-chip-${severity}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide border ${severityStyles[severity] || severityStyles.info}`}
    >
      {label}{count && count > 1 ? ` (${count})` : ''}
    </span>
  )
}
