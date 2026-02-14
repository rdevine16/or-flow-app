// components/cases/CasesSummaryCards.tsx
// Tab-aware summary metric cards for the Cases page.
// Renders 3 contextual MetricCards that change based on the active tab.

'use client'

import { MetricCard, MetricCardGrid } from '@/components/ui/MetricCard'
import { useCaseMetrics } from '@/lib/hooks/useCaseMetrics'
import type { CasesPageTab } from '@/lib/dal'

interface CasesSummaryCardsProps {
  facilityId: string | null
  activeTab: CasesPageTab
  dateRange: { start: string; end: string }
  statusIds: Record<string, string>
  statusIdsReady: boolean
}

export default function CasesSummaryCards({
  facilityId,
  activeTab,
  dateRange,
  statusIds,
  statusIdsReady,
}: CasesSummaryCardsProps) {
  const { metrics, loading } = useCaseMetrics(facilityId, activeTab, dateRange, statusIds)

  const isLoading = loading || !statusIdsReady

  const columns = (activeTab === 'all' || activeTab === 'today') ? 4 : 3
  const skeletonCount = columns

  if (isLoading) {
    return (
      <MetricCardGrid columns={columns}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <MetricCard key={i} title="" value={0} loading size="sm" />
        ))}
      </MetricCardGrid>
    )
  }

  if (metrics.length === 0) return null

  return (
    <MetricCardGrid columns={columns as 3 | 4}>
      {metrics.map((m, i) => (
        <MetricCard
          key={`${activeTab}-${i}`}
          title={m.title}
          value={m.value}
          suffix={m.suffix}
          prefix={m.prefix}
          decimals={m.decimals}
          color={m.color}
          size="sm"
        />
      ))}
    </MetricCardGrid>
  )
}
