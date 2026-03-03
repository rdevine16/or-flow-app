/**
 * IntegrationReviewQueueTab — shared Review Queue tab for all HL7v2 integration pages.
 *
 * Shows pending import reviews in a scannable list with an ImportReviewDrawer for details.
 */

'use client'

import React, { useState, useMemo } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { computeHasUnresolved } from '@/components/integrations/ReviewDetailPanel'
import ImportReviewDrawer from '@/components/integrations/ImportReviewDrawer'
import type { CreateEntityData } from '@/components/integrations/ReviewDetailPanel'
import type {
  EhrIntegrationLog,
  EhrEntityType,
  EhrEntityMapping,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

export interface IntegrationReviewQueueTabProps {
  pendingReviews: EhrIntegrationLog[]
  loading: boolean
  actionLoading: string | null
  approveAllLoading: boolean
  getEntitiesForType: (type: EhrEntityType) => Array<{ id: string; label: string }>
  entityMappings: EhrEntityMapping[]
  /** Column header for incoming data (e.g. "Epic (Incoming)") — passed to ReviewDetailPanel */
  incomingColumnLabel?: string
  onApprove: (entry: EhrIntegrationLog) => Promise<void>
  onApproveAll: (entries: EhrIntegrationLog[]) => Promise<void>
  onReject: (entry: EhrIntegrationLog) => Promise<void>
  onResolveEntity: (
    entry: EhrIntegrationLog, entityType: EhrEntityType,
    extId: string, extName: string, orbitId: string, orbitName: string,
  ) => Promise<void>
  onRemapCaseOnly: (
    entry: EhrIntegrationLog, entityType: EhrEntityType,
    orbitId: string, orbitName: string,
  ) => Promise<void>
  onCreateEntity: (formData: CreateEntityData) => Promise<string | null>
  onPhiAccess: (logEntryId: string, messageType: string) => void
}

// =====================================================
// HELPERS
// =====================================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// =====================================================
// REVIEW QUEUE ROW
// =====================================================

function ReviewQueueRow({
  entry,
  entityMappings,
  isSelected,
  onClick,
}: {
  entry: EhrIntegrationLog
  entityMappings: EhrEntityMapping[]
  isSelected: boolean
  onClick: () => void
}) {
  const parsed = entry.parsed_data as Record<string, unknown> | null
  const hasUnresolved = computeHasUnresolved(entry, entityMappings)

  const patient = parsed?.patient as { firstName?: string; lastName?: string } | null
  const procedure = parsed?.procedure as { name?: string } | null
  const surgeon = parsed?.surgeon as { name?: string } | null

  // Parse date/time directly from string to avoid UTC misinterpretation
  let dateTimeStr = ''
  const scheduledStart = parsed?.scheduledStart as string | undefined
  if (scheduledStart) {
    const [datePart, timePart] = scheduledStart.split('T')
    if (datePart) {
      const [y, m, d] = datePart.split('-').map(Number)
      dateTimeStr = `${m}/${d}/${y}`
      if (timePart) {
        const [hStr, minStr] = timePart.split(':')
        const h = parseInt(hStr, 10)
        const min = minStr || '00'
        const ampm = h >= 12 ? 'pm' : 'am'
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        dateTimeStr += ` ${h12}:${min}${ampm}`
      }
    }
  }

  const procedureName = procedure?.name || 'Unknown Procedure'

  let surgeonDisplay = ''
  if (surgeon?.name) {
    const parts = surgeon.name.split(',')
    if (parts.length > 1) {
      surgeonDisplay = `Dr ${parts[0].trim()}`
    } else {
      const words = surgeon.name.trim().split(/\s+/)
      surgeonDisplay = `Dr ${words[words.length - 1]}`
    }
  }

  const patientDisplay = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'
    : 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      {hasUnresolved ? (
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-900">
          <span className="font-medium">New Case:</span>
          {dateTimeStr && <> {dateTimeStr}</>}
          {procedureName && <> {procedureName}</>}
          {surgeonDisplay && <> {surgeonDisplay}</>}
          {patientDisplay && <> <span className="text-slate-400">-</span> {patientDisplay}</>}
        </span>
      </div>

      <span className="text-xs text-slate-400 flex-shrink-0">
        {formatRelativeTime(entry.created_at)}
      </span>
    </button>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function IntegrationReviewQueueTab({
  pendingReviews,
  loading,
  actionLoading,
  approveAllLoading,
  getEntitiesForType,
  entityMappings,
  incomingColumnLabel,
  onApprove,
  onApproveAll,
  onReject,
  onResolveEntity,
  onRemapCaseOnly,
  onCreateEntity,
  onPhiAccess,
}: IntegrationReviewQueueTabProps) {
  const [selectedEntry, setSelectedEntry] = useState<EhrIntegrationLog | null>(null)

  const approvableEntries = useMemo(
    () => pendingReviews.filter(entry => !computeHasUnresolved(entry, entityMappings)),
    [pendingReviews, entityMappings]
  )

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg" />
        ))}
      </div>
    )
  }

  if (pendingReviews.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-slate-500">No pending reviews. All imports are up to date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {pendingReviews.length} import{pendingReviews.length !== 1 ? 's' : ''} pending review
        </p>
        {approvableEntries.length > 0 && (
          <button
            onClick={() => onApproveAll(approvableEntries)}
            disabled={approveAllLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {approveAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve All ({approvableEntries.length})
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {pendingReviews.map(entry => (
          <ReviewQueueRow
            key={entry.id}
            entry={entry}
            entityMappings={entityMappings}
            isSelected={selectedEntry?.id === entry.id}
            onClick={() => setSelectedEntry(entry)}
          />
        ))}
      </div>

      <ImportReviewDrawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
        allSurgeons={getEntitiesForType('surgeon')}
        allProcedures={getEntitiesForType('procedure')}
        allRooms={getEntitiesForType('room')}
        entityMappings={entityMappings}
        onResolveEntity={onResolveEntity}
        onRemapCaseOnly={onRemapCaseOnly}
        onCreateEntity={onCreateEntity}
        onApprove={async (e) => {
          await onApprove(e)
          setSelectedEntry(null)
        }}
        onReject={async (e) => {
          await onReject(e)
          setSelectedEntry(null)
        }}
        onPhiAccess={onPhiAccess}
        actionLoading={actionLoading}
        incomingColumnLabel={incomingColumnLabel}
      />
    </div>
  )
}
