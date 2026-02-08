'use client'

import { useState } from 'react'
import { RefactorIssue } from './page'
import { CheckIcon, ClipboardIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface IssueCardProps {
  issue: RefactorIssue
  isFixed: boolean
  onMarkFixed: () => void
  onMarkUnfixed: () => void
}

const riskConfig = {
  safe: {
    label: 'Safe',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: '🟢',
  },
  review: {
    label: 'Review',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: '🟡',
  },
  manual: {
    label: 'Manual',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '🔴',
  },
}

const typeLabels: Record<string, string> = {
  'console-log': 'console.log → Toast',
  'delete-confirm': 'Inline Confirmation → Dialog',
  'hardcoded-color': 'Hardcoded Color → Token',
  'inline-spinner': 'Inline Spinner → Component',
  'status-badge': 'Inline Badge → Component',
  'modal-state': 'Modal State → Shared Pattern',
  'loading-state': 'Loading State → Loading Component',
  'pagination': 'Pagination → Shared Logic',
  'form-validation': 'Form Validation → Shared Validators',
  'error-display': 'Error Display → Alert/Toast',
  'empty-state': 'Empty State → EmptyState Component',
  'search-input': 'Search Input → SearchInput Component',
  'action-buttons': 'Action Buttons → TableActions Component',
  'title-tooltip': 'Title Attribute → Tooltip Component',
  'sortable-table': 'Sortable Table → DataTable Component',
}

export function IssueCard({ issue, isFixed, onMarkFixed, onMarkUnfixed }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const config = riskConfig[issue.risk]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(issue.afterCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div 
      className={`
        bg-white rounded-lg shadow-sm border-2 transition-all
        ${isFixed ? 'border-green-200 bg-green-50/30' : config.border}
      `}
    >
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h3 className="font-semibold text-slate-900">
                {typeLabels[issue.type] || issue.type}
              </h3>
              <p className="text-sm text-slate-600">
                {issue.file}:{issue.line}
              </p>
            </div>
          </div>
          
          <p className="text-sm text-slate-700 mt-2">
            {issue.description}
          </p>

          {/* Warnings */}
          {issue.warnings && issue.warnings.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-sm font-medium">⚠️ Warning:</span>
                <div className="text-sm text-amber-700 space-y-1">
                  {issue.warnings.map((warning, i) => (
                    <div key={i}>{warning}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          <span className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.color}`}>
            {config.label}
          </span>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-200">
          {/* Context */}
          {issue.context && (
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="text-xs font-medium text-slate-600 mb-2">CONTEXT:</div>
              <pre className="text-sm font-mono text-slate-700 overflow-x-auto">
                {issue.context}
              </pre>
            </div>
          )}

          {/* Before/After */}
          <div className="grid grid-cols-2 divide-x divide-slate-200">
            {/* Before */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-red-600">BEFORE:</div>
              </div>
              <pre className="text-sm font-mono text-slate-900 bg-red-50 p-3 rounded border border-red-200 overflow-x-auto">
                {issue.beforeCode}
              </pre>
            </div>

            {/* After */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-green-600">AFTER:</div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="w-3 h-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="text-sm font-mono text-slate-900 bg-green-50 p-3 rounded border border-green-200 overflow-x-auto">
                {issue.afterCode}
              </pre>
            </div>
          </div>

          {/* Required Imports */}
          {issue.imports && issue.imports.length > 0 && (
            <div className="p-4 bg-blue-50 border-t border-slate-200">
              <div className="text-xs font-medium text-blue-600 mb-2">REQUIRED IMPORTS:</div>
              <div className="space-y-1">
                {issue.imports.map((imp, i) => (
                  <pre key={i} className="text-sm font-mono text-blue-900">
                    {imp}
                  </pre>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {isFixed ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckIcon className="w-4 h-4" />
                  Marked as fixed
                </span>
              ) : (
                'Copy the code above and apply it manually'
              )}
            </div>
            
            <div className="flex gap-2">
              {isFixed ? (
                <button
                  onClick={onMarkUnfixed}
                  className="px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Mark as Unfixed
                </button>
              ) : (
                <button
                  onClick={onMarkFixed}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckIcon className="w-4 h-4" />
                  Mark as Fixed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}