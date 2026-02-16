// components/cases/CaseDrawer.tsx
// Case detail drawer using Radix Dialog (sheet pattern).
// Slim header with case metadata + content tabs.
// Slides from right, ~550px wide, overlay dims background.

'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { useCaseDrawer } from '@/lib/hooks/useCaseDrawer'
import { useFinancialComparison } from '@/lib/hooks/useFinancialComparison'
import { resolveDisplayStatus, getCaseStatusConfig } from '@/lib/constants/caseStatusConfig'
import { statusColors } from '@/lib/design-tokens'
import ProcedureIcon from '@/components/ui/ProcedureIcon'
import CaseDrawerFlags from '@/components/cases/CaseDrawerFlags'
import CaseDrawerFinancials from '@/components/cases/CaseDrawerFinancials'
import CaseDrawerMilestones from '@/components/cases/CaseDrawerMilestones'
import CaseDrawerValidation from '@/components/cases/CaseDrawerValidation'
import { fetchMetricIssues, type MetricIssue } from '@/lib/dataQuality'
import type { CaseDetail } from '@/lib/dal/cases'
import {
  X,
  Ban,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CaseDrawerProps {
  caseId: string | null
  onClose: () => void
  categoryNameById: Map<string, string>
  /** Case IDs with unresolved DQ issues — enables conditional Validation tab */
  dqCaseIds?: Set<string>
  /** Called after a case update to refresh table data */
  onCaseUpdated?: () => void
  /** Called when cancel button is clicked */
  onCancelCase?: (caseId: string, caseNumber: string) => void
}

type DrawerTab = 'financials' | 'milestones' | 'flags' | 'validation'

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

// ============================================
// TAB CONFIG
// ============================================

const BASE_TABS: { key: DrawerTab; label: string }[] = [
  { key: 'financials', label: 'Financials' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'flags', label: 'Flags' },
]

const VALIDATION_TAB: { key: DrawerTab; label: string } = {
  key: 'validation', label: 'Validation',
}

// ============================================
// SUB-COMPONENTS
// ============================================

function DrawerSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/3" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-200 rounded w-1/2" />
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
  dqCaseIds,
  onCaseUpdated,
  onCancelCase,
}: CaseDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('financials')
  const prevCaseIdRef = useRef(caseId)
  const { can } = useUser()
  const { caseDetail, loading, error } = useCaseDrawer(caseId)

  // Reset to default tab when switching cases
  useEffect(() => {
    prevCaseIdRef.current = caseId
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('financials')
  }, [caseId])

  // Whether this case has DQ issues (drives conditional Validation tab)
  const hasValidationIssues = !!(caseId && dqCaseIds?.has(caseId))

  // Build tabs dynamically — filter by permissions + include Validation when case has DQ issues
  const tabs = useMemo(() => {
    const visible = BASE_TABS.filter((tab) => {
      if (tab.key === 'financials') return can('tab.case_financials')
      if (tab.key === 'milestones') return can('tab.case_milestones')
      if (tab.key === 'flags') return can('tab.case_flags')
      return true
    })
    if (hasValidationIssues && can('tab.case_validation')) return [...visible, VALIDATION_TAB]
    return visible
  }, [hasValidationIssues, can])

  // Lazy-load metric issues only when validation tab is active
  const { data: validationIssues, loading: validationLoading } = useSupabaseQuery<MetricIssue[]>(
    async (supabase) => {
      if (!caseDetail?.facility_id || !caseId) return []
      return fetchMetricIssues(supabase, caseDetail.facility_id, {
        caseId,
        unresolvedOnly: true,
      })
    },
    {
      deps: [caseDetail?.facility_id, caseId, activeTab],
      enabled: activeTab === 'validation' && !!caseDetail && hasValidationIssues,
    }
  )

  // Surgeon display name (needed before hook calls)
  const surgeonName = caseDetail?.surgeon
    ? `Dr. ${caseDetail.surgeon.first_name} ${caseDetail.surgeon.last_name}`
    : null

  // Lazy-load financial data only when financials tab is active
  const {
    data: financialData,
    loading: financialsLoading,
    error: financialsError,
  } = useFinancialComparison(
    caseDetail?.id ?? null,
    caseDetail?.facility_id ?? null,
    caseDetail?.surgeon_id ?? null,
    caseDetail?.procedure_type?.id ?? null,
    caseDetail?.scheduled_duration_minutes ?? null,
    caseDetail?.scheduled_date ?? null,
    surgeonName,
    activeTab === 'financials' && !!caseDetail,
  )

  // Resolve display status
  const displayStatus = useMemo(() => {
    if (!caseDetail) return 'scheduled'
    return resolveDisplayStatus(caseDetail.case_status?.name ?? null)
  }, [caseDetail])

  const statusConfig = getCaseStatusConfig(displayStatus)
  const colors = statusColors[statusConfig.colorKey]

  // Resolve category name for procedure icon
  const categoryName = useMemo(() => {
    if (!caseDetail?.procedure_type?.procedure_category_id) return null
    return categoryNameById.get(caseDetail.procedure_type.procedure_category_id) ?? null
  }, [caseDetail, categoryNameById])

  return (
    <Dialog.Root open={!!caseId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="drawer-content fixed right-0 top-0 h-full w-[580px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col"
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
                        className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors"
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

                {/* Open full detail link + conditional Cancel Case */}
                <div className="flex items-center justify-between px-4 pt-2 pb-3">
                  <Link
                    href={`/cases/${caseDetail.id}`}
                    className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Open full detail
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                  {displayStatus === 'scheduled' && onCancelCase && can('cases.delete') && (
                    <button
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                      onClick={() => onCancelCase(caseDetail.id, caseDetail.case_number || '')}
                    >
                      <Ban className="w-3 h-3" />
                      Cancel Case
                    </button>
                  )}
                </div>

                {/* Tab bar */}
                <div className="flex px-5 border-t border-slate-100">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                          isActive
                            ? 'text-teal-600 border-teal-600'
                            : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {tab.label}
                        {tab.key === 'flags' && caseDetail.case_flags.length > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                            {caseDetail.case_flags.length}
                          </span>
                        )}
                        {tab.key === 'validation' && (
                          <span className="ml-1 inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-400" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ---- SCROLLABLE TAB CONTENT ---- */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4">
                {activeTab === 'flags' && (
                  <div className="animate-fade-in">
                    <CaseDrawerFlags flags={caseDetail.case_flags} />
                  </div>
                )}

                {activeTab === 'milestones' && (
                  <div className="animate-fade-in">
                    <CaseDrawerMilestones
                      caseId={caseDetail.id}
                      surgeonId={caseDetail.surgeon_id}
                      procedureTypeId={caseDetail.procedure_type?.id ?? null}
                      facilityId={caseDetail.facility_id}
                      caseStatus={displayStatus}
                    />
                  </div>
                )}

                {activeTab === 'financials' && (
                  <div className="animate-fade-in">
                    <CaseDrawerFinancials
                      data={financialData}
                      displayStatus={displayStatus}
                      surgeonName={surgeonName}
                      loading={financialsLoading}
                      error={financialsError}
                    />
                  </div>
                )}

                {activeTab === 'validation' && caseId && (
                  <div className="animate-fade-in">
                    <CaseDrawerValidation
                      issues={validationIssues ?? []}
                      loading={validationLoading}
                      caseId={caseId}
                    />
                  </div>
                )}
              </div>

            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
