// IssuesTable — CSS Grid case-grouped table (Phase 4)
// Placeholder: will be implemented in Phase 4

import type { MetricIssue } from '@/lib/dataQuality'

interface IssuesTableProps {
  issues: MetricIssue[]
}

export default function IssuesTable({ issues }: IssuesTableProps) {
  return <div data-testid="issues-table">{issues.length} issues</div>
}
