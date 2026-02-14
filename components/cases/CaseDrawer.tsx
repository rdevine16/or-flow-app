// components/cases/CaseDrawer.tsx
// Case detail drawer using Radix Dialog (sheet pattern).
// Fixed header with case metadata + quick stats + 3 content tabs.
// Slides from right, ~550px wide, overlay dims background.

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { useCaseDrawer, useMilestoneComparisons } from '@/lib/hooks/useCaseDrawer'
import { useCaseFinancials } from '@/lib/hooks/useCaseFinancials'
import { resolveDisplayStatus, getCaseStatusConfig } from '@/lib/constants/caseStatusConfig'
import { statusColors } from '@/lib/design-tokens'
import ProcedureIcon from '@/components/ui/ProcedureIcon'
import CaseDrawerFlags from '@/components/cases/CaseDrawerFlags'
import CaseDrawerFinancials from '@/components/cases/CaseDrawerFinancials'
import CaseDrawerMilestones from '@/components/cases/CaseDrawerMilestones'
import type { CaseDetail, CaseMilestone } from '@/lib/dal/cases'
import {
  X,
  ExternalLink,
  Clock,
  Timer,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Milestone as MilestoneIcon,
  Flag,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CaseDrawerProps {
  caseId: string | null
  onClose: () => void
  categoryNameById: Map<string, string>
  /** Called after a validate action succeeds to refresh table data */
  onCaseUpdated?: () => void
}

type DrawerTab = 'financials' | 'milestones' | 'flags'

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '—'
  // timeStr may be "HH:MM:SS" or ISO datetime
  const parts = timeStr.includes('T') ? timeStr.split('T')[1] : timeStr
  const [h, m] = parts.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${m} ${ampm}`
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hrs === 0) return `${mins}m`
  return `${hrs}h ${mins}m`
}

/** Compute surgical time from milestones (Incision → Closing) */
function computeSurgicalTime(milestones: CaseMilestone[]): number | null {
  const incision = milestones.find(
    (m) => m.facility_milestone?.name?.toLowerCase().includes('incision')
  )
  const closing = milestones.find(
    (m) => m.facility_milestone?.name?.toLowerCase().includes('closing')
  )

  if (!incision?.recorded_at || !closing?.recorded_at) return null
  const diff = new Date(closing.recorded_at).getTime() - new Date(incision.recorded_at).getTime()
  return diff > 0 ? diff / 60000 : null
}

/** Compute total case time from first to last milestone */
function computeTotalFromMilestones(milestones: CaseMilestone[]): number | null {
  const recorded = milestones
    .filter((m) => m.recorded_at)
    .map((m) => new Date(m.recorded_at).getTime())

  if (recorded.length < 2) return null
  const diff = Math.max(...recorded) - Math.min(...recorded)
  return diff > 0 ? diff / 60000 : null
}

// ============================================
// TAB CONFIG
// ============================================

const TABS: { key: DrawerTab; label: string; icon: typeof Flag }[] = [
  { key: 'financials', label: 'Financials', icon: DollarSign },
  { key: 'milestones', label: 'Milestones', icon: MilestoneIcon },
  { key: 'flags', label: 'Flags', icon: Flag },
]

// ============================================
// SUB-COMPONENTS
// ============================================

function QuickStats({ caseDetail }: { caseDetail: CaseDetail }) {
  const totalDuration = caseDetail.actual_duration_minutes
    ?? computeTotalFromMilestones(caseDetail.case_milestones)
  const surgicalTime = computeSurgicalTime(caseDetail.case_milestones)

  const stats = [
    { label: 'Total Duration', value: formatDuration(totalDuration), icon: Clock },
    { label: 'Surgical Time', value: formatDuration(surgicalTime), icon: Timer },
    { label: 'Milestones', value: `${caseDetail.case_milestones.filter(m => m.recorded_at).length}/${caseDetail.case_milestones.length}`, icon: RotateCcw },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-slate-50 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <stat.icon className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {stat.label}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900">{stat.value}</span>
        </div>
      ))}
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/3" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-200 rounded w-1/2" />
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-100 rounded-lg" />
        ))}
      </div>
      <div className="h-8 bg-slate-100 rounded mt-6" />
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-slate-50 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CaseDrawer({
  caseId,
  onClose,
  categoryNameById,
  onCaseUpdated: _onCaseUpdated,
}: CaseDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('flags')
  const { caseDetail, loading, error } = useCaseDrawer(caseId)

  // Lazy-load milestone comparison data only when milestones tab is active
  const {
    surgeonStats,
    facilityStats,
    loading: comparisonLoading,
  } = useMilestoneComparisons(
    caseDetail?.facility_id ?? null,
    caseDetail?.surgeon_id ?? null,
    caseDetail?.procedure_type?.id ?? null,
    activeTab === 'milestones' && !!caseDetail,
  )

  // Lazy-load financial data only when financials tab is active
  const {
    projection: financialProjection,
    comparison: financialComparison,
    actual: financialActual,
    loading: financialsLoading,
    error: financialsError,
  } = useCaseFinancials(
    caseDetail?.id ?? null,
    caseDetail?.facility_id ?? null,
    caseDetail?.surgeon_id ?? null,
    caseDetail?.procedure_type?.id ?? null,
    caseDetail?.estimated_duration_minutes ?? null,
    caseDetail?.surgeon
      ? `Dr. ${caseDetail.surgeon.first_name} ${caseDetail.surgeon.last_name}`
      : null,
    activeTab === 'financials' && !!caseDetail,
  )

  // Resolve display status
  const displayStatus = useMemo(() => {
    if (!caseDetail) return 'scheduled'
    return resolveDisplayStatus(
      caseDetail.case_status?.name ?? null,
      caseDetail.data_validated,
    )
  }, [caseDetail])

  const statusConfig = getCaseStatusConfig(displayStatus)
  const colors = statusColors[statusConfig.colorKey]

  // Resolve category name for procedure icon
  const categoryName = useMemo(() => {
    if (!caseDetail?.procedure_type?.procedure_category_id) return null
    return categoryNameById.get(caseDetail.procedure_type.procedure_category_id) ?? null
  }, [caseDetail, categoryNameById])

  // Surgeon display name
  const surgeonName = caseDetail?.surgeon
    ? `Dr. ${caseDetail.surgeon.first_name} ${caseDetail.surgeon.last_name}`
    : null

  return (
    <Dialog.Root open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="drawer-content fixed right-0 top-0 h-full w-[550px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            {caseDetail ? `Case Details: ${caseDetail.case_number}` : 'Loading case details'}
          </Dialog.Title>

          {/* Loading state */}
          {loading && !caseDetail && <DrawerSkeleton />}

          {/* Error state */}
          {error && (
            <div className="p-6 text-center">
              <p className="text-sm text-red-600">Failed to load case details</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
          )}

          {/* Content */}
          {caseDetail && (
            <>
              {/* ---- FIXED HEADER ---- */}
              <div className="flex-shrink-0 border-b border-slate-200">
                {/* Top row: case number + close */}
                <div className="flex items-start justify-between p-4 pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        href={`/cases/${caseDetail.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {caseDetail.case_number || 'Untitled Case'}
                      </Link>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Procedure */}
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <ProcedureIcon categoryName={categoryName} size={16} className="text-slate-400" />
                      <span>{caseDetail.procedure_type?.name ?? 'Unknown Procedure'}</span>
                    </div>

                    {/* Surgeon + Room + Date */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-500">
                      {surgeonName && (
                        <Link
                          href={`/analytics/surgeons?surgeon=${caseDetail.surgeon_id}`}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {surgeonName}
                        </Link>
                      )}
                      {caseDetail.or_room?.name && (
                        <span>{caseDetail.or_room.name}</span>
                      )}
                      <span>
                        {formatDate(caseDetail.scheduled_date)}
                        {caseDetail.start_time && ` at ${formatTime(caseDetail.start_time)}`}
                      </span>
                    </div>
                  </div>

                  <Dialog.Close asChild>
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Close drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Open full detail link */}
                <div className="px-4 pt-2">
                  <Link
                    href={`/cases/${caseDetail.id}`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Open full detail
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {/* Quick Stats */}
                <div className="px-4 pt-3 pb-3">
                  <QuickStats caseDetail={caseDetail} />
                </div>

                {/* Validate button for unvalidated completed cases */}
                {displayStatus === 'needs_validation' && (
                  <div className="px-4 pb-3">
                    <button
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      disabled
                      title="Validate action coming in Phase 9"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Validate Case
                    </button>
                  </div>
                )}

                {/* Tab bar */}
                <div className="flex border-t border-slate-100">
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.key
                    const TabIcon = tab.icon
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                          isActive
                            ? 'text-blue-600 border-blue-600'
                            : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <TabIcon className="w-4 h-4" />
                        {tab.label}
                        {tab.key === 'flags' && caseDetail.case_flags.length > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                            {caseDetail.case_flags.length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ---- SCROLLABLE TAB CONTENT ---- */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'flags' && (
                  <CaseDrawerFlags flags={caseDetail.case_flags} />
                )}

                {activeTab === 'milestones' && (
                  <CaseDrawerMilestones
                    milestones={caseDetail.case_milestones}
                    surgeonStats={surgeonStats}
                    facilityStats={facilityStats}
                    comparisonLoading={comparisonLoading}
                    surgeonName={
                      caseDetail.surgeon
                        ? `${caseDetail.surgeon.first_name} ${caseDetail.surgeon.last_name}`
                        : null
                    }
                  />
                )}

                {activeTab === 'financials' && (
                  <CaseDrawerFinancials
                    displayStatus={displayStatus}
                    projection={financialProjection}
                    comparison={financialComparison}
                    actual={financialActual}
                    loading={financialsLoading}
                    error={financialsError}
                    surgeonName={surgeonName}
                  />
                )}
              </div>

            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
