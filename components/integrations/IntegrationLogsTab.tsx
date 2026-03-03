/**
 * IntegrationLogsTab — shared Logs tab for all HL7v2 integration pages.
 *
 * Shows a paginated, filterable table of HL7v2 integration log entries
 * with expandable rows showing raw HL7 message content.
 */

'use client'

import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import HL7MessageViewer from '@/components/integrations/HL7MessageViewer'
import type { EhrIntegrationLog, EhrProcessingStatus } from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

export interface IntegrationLogsTabProps {
  logEntries: EhrIntegrationLog[]
  loading: boolean
  statusFilter: EhrProcessingStatus | ''
  setStatusFilter: (f: EhrProcessingStatus | '') => void
  page: number
  setPage: (p: number) => void
  pageSize: number
  onRefresh: () => void
  onPhiAccess: (logEntryId: string, messageType: string) => void
}

// =====================================================
// HELPERS
// =====================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}

function StatusBadge({ status }: { status: EhrProcessingStatus }) {
  const config: Record<EhrProcessingStatus, { color: string; label: string }> = {
    received: { color: 'bg-blue-100 text-blue-700', label: 'Received' },
    pending_review: { color: 'bg-amber-100 text-amber-700', label: 'Pending Review' },
    processed: { color: 'bg-emerald-100 text-emerald-700', label: 'Processed' },
    error: { color: 'bg-red-100 text-red-700', label: 'Error' },
    ignored: { color: 'bg-slate-100 text-slate-600', label: 'Ignored' },
  }
  const c = config[status]
  return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${c.color}`}>{c.label}</span>
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function IntegrationLogsTab({
  logEntries,
  loading,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  pageSize,
  onRefresh,
  onPhiAccess,
}: IntegrationLogsTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filterOptions: Array<{ value: EhrProcessingStatus | ''; label: string }> = [
    { value: '', label: 'All' },
    { value: 'processed', label: 'Processed' },
    { value: 'pending_review', label: 'Pending' },
    { value: 'error', label: 'Errors' },
    { value: 'ignored', label: 'Ignored' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : logEntries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">
              {statusFilter ? `No ${statusFilter.replace('_', ' ')} messages found.` : 'No messages received yet.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 w-8" />
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">External ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map(entry => {
                  const isExpanded = expandedRow === entry.id
                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          entry.processing_status === 'error' ? 'bg-red-50/50' : ''
                        }`}
                        onClick={() => {
                          const expanding = !isExpanded
                          setExpandedRow(expanding ? entry.id : null)
                          if (expanding && entry.raw_message) {
                            onPhiAccess(entry.id, entry.message_type)
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{entry.message_type}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{entry.external_case_id || '\u2014'}</td>
                        <td className="px-4 py-3"><StatusBadge status={entry.processing_status} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                          {entry.error_message || (entry.case_id ? `Case: ${entry.case_id.substring(0, 8)}...` : '\u2014')}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-slate-50/50 border-b border-slate-200">
                            <HL7MessageViewer rawMessage={entry.raw_message} parsedData={entry.parsed_data} />
                            {entry.error_message && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{entry.error_message}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logEntries.length < pageSize}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
