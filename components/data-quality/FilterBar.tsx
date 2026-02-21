// FilterBar — issue type select, show resolved, bulk actions, case/issue count

import { Filter, Ban, X } from 'lucide-react'
import type { IssueType } from '@/lib/dataQuality'

interface FilterBarProps {
  filterType: string
  onFilterTypeChange: (value: string) => void
  showResolved: boolean
  onShowResolvedChange: (value: boolean) => void
  issueTypes: IssueType[]
  selectedCount: number
  onBulkExclude: () => void
  caseCount: number
  issueCount: number
  // URL filter chip
  filterCaseId: string | null
  filterCaseNumber: string | null
  onClearCaseFilter: () => void
}

export default function FilterBar({
  filterType,
  onFilterTypeChange,
  showResolved,
  onShowResolvedChange,
  issueTypes,
  selectedCount,
  onBulkExclude,
  caseCount,
  issueCount,
  filterCaseId,
  filterCaseNumber,
  onClearCaseFilter,
}: FilterBarProps) {
  return (
    <div
      data-testid="filter-bar"
      className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-[10px] mb-3"
    >
      {/* Left side — filters */}
      <div className="flex items-center gap-2.5">
        <Filter className="w-[13px] h-[13px] text-stone-400" />

        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value)}
          className="px-2.5 py-1.5 border border-stone-200 rounded-md text-xs font-medium text-stone-800 bg-white cursor-pointer outline-none appearance-none pr-7"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2378716C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          <option value="all">All Issue Types</option>
          {issueTypes.map(type => (
            <option key={type.id} value={type.name}>{type.display_name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => onShowResolvedChange(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          <span className="text-xs font-medium text-stone-500">Show resolved</span>
        </label>

        {/* Case filter chip (from URL param) */}
        {filterCaseId && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-semibold border border-blue-200">
            <span>Case: {filterCaseNumber || '...'}</span>
            <button
              onClick={onClearCaseFilter}
              className="ml-0.5 p-0.5 hover:bg-blue-200 rounded transition-colors"
              aria-label="Clear case filter"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Right side — bulk actions + summary */}
      <div className="flex items-center gap-2.5">
        {selectedCount > 0 && (
          <>
            <span className="text-xs font-semibold text-stone-500">
              {selectedCount} selected
            </span>
            <button
              onClick={onBulkExclude}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-600 text-xs font-semibold cursor-pointer hover:bg-red-100 transition-colors"
            >
              <Ban className="w-3 h-3" />
              Exclude Selected
            </button>
          </>
        )}
        <span className="text-xs text-stone-400">
          {caseCount} case{caseCount !== 1 ? 's' : ''} · {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
