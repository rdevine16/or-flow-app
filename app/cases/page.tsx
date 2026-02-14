'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import DateRangeSelector from '@/components/ui/DateRangeSelector'
import CasesStatusTabs from '@/components/cases/CasesStatusTabs'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import CallNextPatientModal from '@/components/CallNextPatientModal'
import { NoFacilitySelected } from '@/components/ui/NoFacilitySelected'
import { PageLoader } from '@/components/ui/Loading'
import { EmptyState, EmptyStateIcons } from '@/components/ui/EmptyState'
import { useCasesPage } from '@/lib/hooks/useCasesPage'
import { Plus, ChevronDown, List } from 'lucide-react'
import type { CasesPageTab } from '@/lib/dal'

// ============================================================================
// SPLIT BUTTON — New Case / Bulk Create
// ============================================================================

function CreateCaseSplitButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex rounded-xl shadow-sm">
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-l-xl hover:bg-blue-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          New Case
        </Link>
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="inline-flex items-center px-2.5 py-2.5 bg-blue-600 text-white border-l border-blue-500 rounded-r-xl hover:bg-blue-700 transition-all duration-200"
          aria-label="More create options"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
          <Link
            href="/cases/bulk-create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <List className="w-4 h-4 text-slate-400" />
            Bulk Create
          </Link>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EMPTY STATES PER TAB
// ============================================================================

const TAB_EMPTY_STATES: Record<CasesPageTab, { title: string; description: string }> = {
  all: { title: 'No cases found', description: 'Try adjusting your date range or create a new case' },
  today: { title: 'No cases today', description: 'There are no cases scheduled for today' },
  scheduled: { title: 'No scheduled cases', description: 'No scheduled cases in this period' },
  in_progress: { title: 'No cases in progress', description: 'No cases are currently in progress' },
  completed: { title: 'No completed cases', description: 'No completed cases in this period' },
  needs_validation: { title: 'All cases validated!', description: 'No cases need validation at this time' },
}

// ============================================================================
// MAIN CONTENT COMPONENT
// ============================================================================

function CasesPageContent() {
  const {
    userData,
    loading: userLoading,
    effectiveFacilityId,
    isGlobalAdmin,
    isImpersonating,
    canCreateCases,
  } = useUser()

  const {
    activeTab,
    setActiveTab,
    tabCounts,
    tabCountsLoading,
    dateRange,
    setDateRange,
  } = useCasesPage(effectiveFacilityId)

  // Call Next Patient modal
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)

  // --- No Facility Selected ---
  if (isGlobalAdmin && !isImpersonating) {
    return (
      <DashboardLayout>
        <NoFacilitySelected />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
          <p className="text-slate-500 text-sm mt-1">Manage surgical cases and track progress</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector
            value={dateRange.preset}
            onChange={setDateRange}
          />
          {canCreateCases && <CreateCaseSplitButton />}
        </div>
      </div>

      {/* Status Tabs */}
      <CasesStatusTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        loading={tabCountsLoading}
      />

      {/* Table Area — Phase 3 will replace this placeholder with CasesTable */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {!effectiveFacilityId || userLoading ? (
          <PageLoader message="Loading cases..." />
        ) : (
          <EmptyState
            icon={EmptyStateIcons.Clipboard}
            title={TAB_EMPTY_STATES[activeTab].title}
            description={TAB_EMPTY_STATES[activeTab].description}
            className="py-16"
          />
        )}
      </div>

      {/* Floating Action Button */}
      {effectiveFacilityId && userData.userId && userData.userEmail && (
        <FloatingActionButton
          actions={[
            {
              id: 'call-next-patient',
              label: 'Call Next Patient',
              icon: 'megaphone',
              onClick: () => setShowCallNextPatient(true),
            },
          ]}
        />
      )}

      {/* Call Next Patient Modal */}
      {effectiveFacilityId && userData.userId && userData.userEmail && (
        <CallNextPatientModal
          isOpen={showCallNextPatient}
          onClose={() => setShowCallNextPatient(false)}
          facilityId={effectiveFacilityId}
          userId={userData.userId}
          userEmail={userData.userEmail}
        />
      )}
    </DashboardLayout>
  )
}

// ============================================================================
// EXPORT WITH SUSPENSE BOUNDARY (required for useSearchParams)
// ============================================================================

export default function CasesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    }>
      <CasesPageContent />
    </Suspense>
  )
}
