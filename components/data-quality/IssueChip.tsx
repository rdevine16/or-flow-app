// IssueChip — severity-colored issue type badge (Phase 4)
// Placeholder: will be implemented in Phase 4

interface IssueChipProps {
  label: string
  severity: 'error' | 'warning' | 'info'
  count?: number
}

export default function IssueChip({ label, severity, count }: IssueChipProps) {
  return (
    <span data-testid={`issue-chip-${severity}`}>
      {label}{count && count > 1 ? ` (${count})` : ''}
    </span>
  )
}
