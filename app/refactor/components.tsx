'use client'

import { RiskLevel, IssueType } from './page'

interface ProgressBarProps {
  current: number
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">Completion</span>
        <span className="font-semibold text-slate-900">{percentage}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface FilterBarProps {
  filter: {
    risk?: RiskLevel
    type?: IssueType
    file?: string
    showFixed: boolean
  }
  onChange: (filter: any) => void
  stats: any
}

export function FilterBar({ filter, onChange, stats }: FilterBarProps) {
  const issueTypes: { value: IssueType; label: string }[] = [
    { value: 'console-log', label: 'console.log → Toast' },
    { value: 'delete-confirm', label: 'Delete Confirmations' },
    { value: 'hardcoded-color', label: 'Hardcoded Colors' },
    { value: 'inline-spinner', label: 'Inline Spinners' },
    { value: 'status-badge', label: 'Status Badges' },
    { value: 'modal-state', label: 'Modal State Management' },
    { value: 'loading-state', label: 'Loading States' },
    { value: 'pagination', label: 'Pagination Logic' },
    { value: 'form-validation', label: 'Form Validation' },
    { value: 'error-display', label: 'Error Display' },
    { value: 'empty-state', label: 'Empty States' },
    { value: 'search-input', label: 'Search Inputs' },
    { value: 'action-buttons', label: 'Action Button Groups' },
    { value: 'title-tooltip', label: 'Title Tooltips' },
    { value: 'sortable-table', label: 'Sortable Tables' },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-sm font-medium text-slate-700">Filters:</div>

        {/* Risk Level */}
        <select
          value={filter.risk || ''}
          onChange={(e) => onChange({ ...filter, risk: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Risk Levels</option>
          <option value="safe">🟢 Safe ({stats.byRisk.safe})</option>
          <option value="review">🟡 Review ({stats.byRisk.review})</option>
          <option value="manual">🔴 Manual ({stats.byRisk.manual})</option>
        </select>

        {/* Issue Type */}
        <select
          value={filter.type || ''}
          onChange={(e) => onChange({ ...filter, type: e.target.value || undefined })}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Issue Types</option>
          {issueTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label} ({stats.byType[type.value] || 0})
            </option>
          ))}
        </select>

        {/* Show Fixed */}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filter.showFixed}
            onChange={(e) => onChange({ ...filter, showFixed: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          Show fixed issues
        </label>

        {/* Clear Filters */}
        {(filter.risk || filter.type || filter.file) && (
          <button
            onClick={() => onChange({ showFixed: filter.showFixed })}
            className="ml-auto px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}