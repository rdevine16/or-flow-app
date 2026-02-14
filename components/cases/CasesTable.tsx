// components/cases/CasesTable.tsx
// Enterprise data table for the Cases page using @tanstack/react-table.
// Supports server-side sorting, pagination, row selection, status badges,
// procedure icons, flag indicators, and per-tab empty states.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import type { CaseListItem } from '@/lib/dal/cases'
import type { CasesPageTab, CaseFlagSummary, SortParams } from '@/lib/dal'
import { resolveDisplayStatus, getCaseStatusConfig } from '@/lib/constants/caseStatusConfig'
import { statusColors } from '@/lib/design-tokens'
import ProcedureIcon from '@/components/ui/ProcedureIcon'
import { EmptyState, EmptyStateIcons } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Loading'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight as ChevronRightIcon,
  Ban,
  Download,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface CasesTableProps {
  cases: CaseListItem[]
  loading: boolean
  error: string | null
  activeTab: CasesPageTab
  sort: SortParams
  onSortChange: (sort: SortParams) => void
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  flagSummaries: Map<string, CaseFlagSummary>
  categoryNameById: Map<string, string>
  selectedRows: Set<string>
  onToggleRow: (id: string) => void
  onToggleAllRows: () => void
  onRowClick: (caseItem: CaseListItem) => void
  onCancelCase: (caseItem: CaseListItem) => void
  onExportSelected: () => void
  dqCaseIds: Set<string>
}

// ============================================
// EMPTY STATES PER TAB
// ============================================

const TAB_EMPTY_STATES: Record<CasesPageTab, { title: string; description: string }> = {
  all: { title: 'No cases found', description: 'Try adjusting your date range or create a new case' },
  today: { title: 'No cases today', description: 'There are no cases scheduled for today' },
  scheduled: { title: 'No scheduled cases', description: 'No scheduled cases in this period' },
  in_progress: { title: 'No cases in progress', description: 'No cases are currently in progress' },
  completed: { title: 'No completed cases', description: 'No completed cases in this period' },
  needs_validation: { title: 'All cases validated!', description: 'No cases need validation at this time' },
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '\u2014'
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function getSurgeonName(surgeon: { first_name: string; last_name: string } | null | undefined): string {
  if (!surgeon) return '\u2014'
  return `Dr. ${surgeon.last_name}`
}

function formatDuration(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return '\u2014'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function getElapsedMinutes(startTime: string | null, scheduledDate: string): number | null {
  if (!startTime) return null
  const start = new Date(`${scheduledDate}T${startTime}`)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / 60000)
  return diff > 0 ? diff : 0
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ statusName }: { statusName: string | null | undefined }) {
  const displayStatus = resolveDisplayStatus(statusName)
  const config = getCaseStatusConfig(displayStatus)
  const colors = statusColors[config.colorKey]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {config.label}
    </span>
  )
}

// ============================================
// VALIDATION BADGE
// ============================================

function ValidationBadge({ caseItem, dqCaseIds }: { caseItem: CaseListItem; dqCaseIds: Set<string> }) {
  const status = caseItem.case_status?.name?.toLowerCase()

  // Scheduled and Cancelled cases: dash (validation not applicable)
  if (status === 'scheduled' || status === 'cancelled') {
    return <span className="text-sm text-slate-400">{'\u2014'}</span>
  }

  // Has unresolved DQ issues
  if (dqCaseIds.has(caseItem.id)) {
    const colors = statusColors.needs_validation
    return (
      <Link
        href={`/dashboard/data-quality?caseId=${caseItem.id}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text} hover:opacity-80 transition-opacity`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          Needs Validation
        </span>
      </Link>
    )
  }

  // Validated (completed/in_progress with no DQ issues)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Validated
    </span>
  )
}

// ============================================
// FLAG INDICATOR
// ============================================

function FlagIndicator({ flagSummary }: { flagSummary: CaseFlagSummary | undefined }) {
  if (!flagSummary) return null

  const dotColor = flagSummary.max_severity === 'critical'
    ? 'bg-red-500'
    : flagSummary.max_severity === 'warning'
      ? 'bg-amber-500'
      : 'bg-blue-500'

  return (
    <div className="flex items-center gap-1.5" title={`${flagSummary.flag_count} flag${flagSummary.flag_count > 1 ? 's' : ''}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="text-xs text-slate-500">{flagSummary.flag_count}</span>
    </div>
  )
}

// ============================================
// SORT HEADER
// ============================================

function SortableHeader({
  label,
  columnKey,
  currentSort,
  onSort,
}: {
  label: string
  columnKey: string
  currentSort: SortParams
  onSort: (sort: SortParams) => void
}) {
  const isActive = currentSort.sortBy === columnKey

  const handleClick = () => {
    if (isActive) {
      onSort({
        sortBy: columnKey,
        sortDirection: currentSort.sortDirection === 'asc' ? 'desc' : 'asc',
      })
    } else {
      onSort({ sortBy: columnKey, sortDirection: 'asc' })
    }
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
    >
      {label}
      {isActive ? (
        currentSort.sortDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  )
}

// ============================================
// PAGINATION
// ============================================

function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <span className="text-sm text-slate-500">
        {totalCount > 0 ? `${start}\u2013${end} of ${totalCount}` : 'No results'}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 text-sm font-medium text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ============================================
// INDETERMINATE CHECKBOX (HTML has no indeterminate attribute)
// ============================================

function IndeterminateCheckbox({
  indeterminate,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate
    }
  }, [indeterminate])

  return <input type="checkbox" ref={ref} {...rest} />
}

// ============================================
// MAIN TABLE COMPONENT
// ============================================

export default function CasesTable({
  cases,
  loading,
  error,
  activeTab,
  sort,
  onSortChange,
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  flagSummaries,
  categoryNameById,
  selectedRows,
  onToggleRow,
  onToggleAllRows,
  onRowClick,
  onCancelCase,
  onExportSelected,
  dqCaseIds,
}: CasesTableProps) {
  // ---- 60s tick for live elapsed timers on in-progress cases ----
  const hasInProgress = cases.some(c => c.case_status?.name?.toLowerCase() === 'in_progress')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!hasInProgress) return
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [hasInProgress])

  // ---- Column Definitions ----
  const columns = useMemo<ColumnDef<CaseListItem, unknown>[]>(() => [
    // Checkbox
    {
      id: 'select',
      header: () => (
        <IndeterminateCheckbox
          checked={cases.length > 0 && selectedRows.size === cases.length}
          indeterminate={selectedRows.size > 0 && selectedRows.size < cases.length}
          onChange={onToggleAllRows}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.original.id)}
          onChange={(e) => {
            e.stopPropagation()
            onToggleRow(row.original.id)
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
          aria-label={`Select case ${row.original.case_number}`}
        />
      ),
      size: 40,
      enableSorting: false,
    },

    // Procedure + Name
    {
      id: 'procedure',
      header: () => (
        <SortableHeader label="Procedure" columnKey="procedure" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => {
        const proc = row.original.procedure_type
        const categoryId = proc?.procedure_category_id
        const categoryName = categoryId ? categoryNameById.get(categoryId) ?? null : null
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <ProcedureIcon categoryName={categoryName} size={18} className="text-slate-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {proc?.name ?? 'Unknown Procedure'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {row.original.case_number}
              </div>
            </div>
          </div>
        )
      },
      size: 260,
    },

    // Surgeon
    {
      id: 'surgeon',
      header: () => (
        <SortableHeader label="Surgeon" columnKey="surgeon" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">
          {getSurgeonName(row.original.surgeon)}
        </span>
      ),
      size: 150,
    },

    // Room
    {
      id: 'room',
      header: () => (
        <SortableHeader label="Room" columnKey="room" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-slate-600">
          {row.original.or_room?.name ?? '\u2014'}
        </span>
      ),
      size: 100,
    },

    // Date
    {
      id: 'date',
      header: () => (
        <SortableHeader label="Date" columnKey="date" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => (
        <div>
          <div className="text-sm text-slate-700">{formatDate(row.original.scheduled_date)}</div>
          <div className="text-xs text-slate-500">{formatTime(row.original.start_time)}</div>
        </div>
      ),
      size: 130,
    },

    // Status
    {
      id: 'status',
      header: () => (
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</span>
      ),
      cell: ({ row }) => (
        <StatusBadge statusName={row.original.case_status?.name} />
      ),
      size: 140,
      enableSorting: false,
    },

    // Duration
    {
      id: 'duration',
      header: () => (
        <SortableHeader label="Duration" columnKey="duration" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => {
        const status = row.original.case_status?.name?.toLowerCase()
        if (status === 'completed') {
          return (
            <span className="text-sm text-slate-600 tabular-nums">
              {formatDuration(row.original.scheduled_duration_minutes)}
            </span>
          )
        }
        if (status === 'in_progress') {
          const elapsed = getElapsedMinutes(row.original.start_time, row.original.scheduled_date)
          return (
            <span className="text-sm text-green-600 tabular-nums">
              {formatDuration(elapsed)}
            </span>
          )
        }
        return <span className="text-sm text-slate-400">{'\u2014'}</span>
      },
      size: 100,
    },

    // Validation
    {
      id: 'validation',
      header: () => (
        <SortableHeader label="Validation" columnKey="validation" currentSort={sort} onSort={onSortChange} />
      ),
      cell: ({ row }) => (
        <ValidationBadge caseItem={row.original} dqCaseIds={dqCaseIds} />
      ),
      size: 140,
    },

    // Flags
    {
      id: 'flags',
      header: () => (
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Flags</span>
      ),
      cell: ({ row }) => (
        <FlagIndicator flagSummary={flagSummaries.get(row.original.id)} />
      ),
      size: 70,
      enableSorting: false,
    },

    // Hover actions
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const statusName = row.original.case_status?.name?.toLowerCase()
        const isCancellable = statusName === 'scheduled' || statusName === 'in_progress'
        return (
          <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            {isCancellable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCancelCase(row.original)
                }}
                className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                title="Cancel case"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRowClick(row.original)
              }}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 transition-colors"
              title="Open details"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )
      },
      size: 90,
      enableSorting: false,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces re-render for live elapsed timers
  ], [cases.length, selectedRows, sort, onSortChange, onToggleAllRows, onToggleRow, flagSummaries, categoryNameById, onRowClick, onCancelCase, activeTab, dqCaseIds, tick])

  // ---- Table Instance ----
  // Sorting is handled server-side, so we use manual sorting
  const sorting = useMemo<SortingState>(() => [{
    id: sort.sortBy,
    desc: sort.sortDirection === 'desc',
  }], [sort])

  const table = useReactTable({
    data: cases,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    state: {
      sorting,
    },
  })

  // ---- Loading State ----
  if (loading && cases.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <PageLoader message="Loading cases..." />
      </div>
    )
  }

  // ---- Error State ----
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <EmptyState
          icon={EmptyStateIcons.Inbox}
          title="Failed to load cases"
          description={error}
          className="py-16"
        />
      </div>
    )
  }

  // ---- Empty State ----
  if (cases.length === 0 && !loading) {
    const emptyConfig = TAB_EMPTY_STATES[activeTab]
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <EmptyState
          icon={EmptyStateIcons.Clipboard}
          title={emptyConfig.title}
          description={emptyConfig.description}
          className="py-16"
        />
      </div>
    )
  }

  // ---- Bulk Action Bar ----
  const hasBulkSelection = selectedRows.size > 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Bulk action bar */}
      {hasBulkSelection && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <span className="text-sm font-medium text-blue-700">
            {selectedRows.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50/50">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.original)}
                className={`
                  group/row cursor-pointer transition-colors
                  ${selectedRows.has(row.original.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}
                `}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className="px-3 py-2"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Loading overlay for subsequent fetches */}
      {loading && cases.length > 0 && (
        <div className="px-4 py-2 text-center">
          <span className="text-sm text-slate-400">Updating...</span>
        </div>
      )}

      {/* Pagination */}
      {totalCount > pageSize && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
