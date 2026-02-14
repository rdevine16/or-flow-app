'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import DateRangeSelector from '@/components/ui/DateRangeSelector'
import CasesStatusTabs from '@/components/cases/CasesStatusTabs'
import CasesTable from '@/components/cases/CasesTable'
import CasesFilterBar from '@/components/cases/CasesFilterBar'
import CasesSummaryCards from '@/components/cases/CasesSummaryCards'
import CaseDrawer from '@/components/cases/CaseDrawer'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import CallNextPatientModal from '@/components/CallNextPatientModal'
import { NoFacilitySelected } from '@/components/ui/NoFacilitySelected'
import { PageLoader } from '@/components/ui/Loading'
import { useCasesPage } from '@/lib/hooks/useCasesPage'
import { Plus, ChevronDown, List } from 'lucide-react'
import type { CaseListItem } from '@/lib/dal/cases'

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
    statusIds,
    statusIdsReady,
    // Filters
    filters,
    searchInput,
    setSearchInput,
    setSurgeonIds,
    setRoomIds,
    setProcedureIds,
    clearAllFilters,
    hasActiveFilters,
    surgeons,
    rooms,
    procedureTypes,
    // Table
    cases,
    casesLoading,
    casesError,
    totalCount,
    sort,
    setSort,
    page,
    pageSize,
    totalPages,
    setPage,
    flagSummaries,
    categoryNameById,
    selectedRows,
    toggleRow,
    toggleAllRows,
  } = useCasesPage(effectiveFacilityId)

  // Call Next Patient modal
  const [showCallNextPatient, setShowCallNextPatient] = useState(false)

  // Drawer state
  const [drawerCaseId, setDrawerCaseId] = useState<string | null>(null)

  const handleRowClick = (caseItem: CaseListItem) => {
    setDrawerCaseId(caseItem.id)
  }

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

      {/* Summary Metric Cards */}
      <div className="mt-4">
        <CasesSummaryCards
          facilityId={effectiveFacilityId}
          activeTab={activeTab}
          dateRange={dateRange}
          statusIds={statusIds}
          statusIdsReady={statusIdsReady}
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="mt-4">
        <CasesFilterBar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          surgeonIds={filters.surgeonIds}
          onSurgeonIdsChange={setSurgeonIds}
          roomIds={filters.roomIds}
          onRoomIdsChange={setRoomIds}
          procedureIds={filters.procedureIds}
          onProcedureIdsChange={setProcedureIds}
          surgeons={surgeons}
          rooms={rooms}
          procedureTypes={procedureTypes}
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
        />
      </div>

      {/* Data Table */}
      <div className="mt-4">
        {!effectiveFacilityId || userLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <PageLoader message="Loading cases..." />
          </div>
        ) : (
          <CasesTable
            cases={cases}
            loading={casesLoading}
            error={casesError}
            activeTab={activeTab}
            sort={sort}
            onSortChange={setSort}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            flagSummaries={flagSummaries}
            categoryNameById={categoryNameById}
            selectedRows={selectedRows}
            onToggleRow={toggleRow}
            onToggleAllRows={toggleAllRows}
            onRowClick={handleRowClick}
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

      {/* Case Detail Drawer */}
      <CaseDrawer
        caseId={drawerCaseId}
        onClose={() => setDrawerCaseId(null)}
        categoryNameById={categoryNameById}
      />
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
