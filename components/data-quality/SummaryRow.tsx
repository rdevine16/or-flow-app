// SummaryRow — gauge card + 3 stat cards (Phase 2)
// Placeholder: will be implemented in Phase 2

import type { DataQualitySummary } from '@/lib/dataQuality'

interface SummaryRowProps {
  summary: DataQualitySummary
}

export default function SummaryRow({ summary }: SummaryRowProps) {
  return <div data-testid="summary-row">Score: {summary.qualityScore}%</div>
}
