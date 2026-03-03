// ImportReviewDrawer — Radix Dialog slide-over panel for reviewing HL7v2 imports
// Follows the pattern from components/data-quality/ReviewDrawer.tsx

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {
  ClipboardCheck,
  X,
  CheckCircle2,
  Ban,
  Loader2,
} from 'lucide-react'
import ReviewDetailPanel from '@/components/integrations/ReviewDetailPanel'
import { computeHasUnresolved } from '@/components/integrations/ReviewDetailPanel'
import type { CreateEntityData, ReviewDetailPanelProps } from '@/components/integrations/ReviewDetailPanel'
import type {
  EhrIntegrationLog,
  EhrEntityType,
  EhrEntityMapping,
} from '@/lib/integrations/shared/integration-types'

// ============================================
// TYPES
// ============================================

interface ImportReviewDrawerProps {
  isOpen: boolean
  onClose: () => void
  entry: EhrIntegrationLog | null
  allSurgeons: Array<{ id: string; label: string }>
  allProcedures: Array<{ id: string; label: string }>
  allRooms: Array<{ id: string; label: string }>
  entityMappings: EhrEntityMapping[]
  onResolveEntity: ReviewDetailPanelProps['onResolveEntity']
  onRemapCaseOnly: ReviewDetailPanelProps['onRemapCaseOnly']
  onCreateEntity: (formData: CreateEntityData) => Promise<string | null>
  onApprove: (entry: EhrIntegrationLog) => Promise<void>
  onReject: (entry: EhrIntegrationLog) => Promise<void>
  onPhiAccess: (logEntryId: string, messageType: string) => void
  actionLoading: string | null
  /** Column header for incoming data (e.g. "Epic (Incoming)") — passed to ReviewDetailPanel */
  incomingColumnLabel?: string
}

// ============================================
// HELPERS
// ============================================

function formatSummaryLine(entry: EhrIntegrationLog): string {
  const parsed = entry.parsed_data as Record<string, unknown> | null
  if (!parsed) return 'Unknown import'

  const parts: string[] = []

  // Date/time — parse string components directly to avoid UTC misinterpretation
  // (scheduledStart is local time without timezone suffix)
  const scheduledStart = parsed.scheduledStart as string | undefined
  if (scheduledStart) {
    const [datePart, timePart] = scheduledStart.split('T')
    if (datePart) {
      const [y, m, d] = datePart.split('-').map(Number)
      parts.push(`${m}/${d}/${y}`)
      if (timePart) {
        const [hStr, minStr] = timePart.split(':')
        const h = parseInt(hStr, 10)
        const min = minStr || '00'
        const ampm = h >= 12 ? 'pm' : 'am'
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        parts.push(`${h12}:${min}${ampm}`)
      }
    }
  }

  // Procedure
  const procedure = parsed.procedure as { name?: string } | null
  if (procedure?.name) parts.push(procedure.name)

  // Surgeon
  const surgeon = parsed.surgeon as { name?: string } | null
  if (surgeon?.name) {
    const lastName = surgeon.name.split(',')[0]?.trim() || surgeon.name.split(' ').pop() || surgeon.name
    parts.push(`Dr ${lastName}`)
  }

  return parts.join(' \u00b7 ')
}

// ============================================
// COMPONENT
// ============================================

export default function ImportReviewDrawer({
  isOpen,
  onClose,
  entry,
  allSurgeons,
  allProcedures,
  allRooms,
  entityMappings,
  onResolveEntity,
  onRemapCaseOnly,
  onCreateEntity,
  onApprove,
  onReject,
  onPhiAccess,
  actionLoading,
  incomingColumnLabel,
}: ImportReviewDrawerProps) {
  if (!entry) return null

  const hasUnresolved = computeHasUnresolved(entry, entityMappings)
  const summaryLine = formatSummaryLine(entry)

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Drawer panel */}
        <Dialog.Content
          data-testid="import-review-drawer"
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[580px] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)] border-l border-slate-200 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          aria-describedby={undefined}
        >
          {/* ======== HEADER ======== */}
          <div className="px-5 py-4 border-b border-slate-200 bg-white flex-shrink-0">
            {/* Title row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <Dialog.Title className="text-[15px] font-bold text-slate-900">
                  Review Import
                </Dialog.Title>
              </div>

              <Dialog.Close asChild>
                <button
                  className="w-7 h-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </Dialog.Close>
            </div>

            {/* Summary line */}
            <p className="text-[13px] text-slate-500 mb-3">{summaryLine}</p>

            {/* Approve + Reject buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onApprove(entry)}
                disabled={hasUnresolved || actionLoading === `approve-${entry.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={hasUnresolved ? 'Resolve all unmatched entities first' : 'Approve and create case'}
              >
                {actionLoading === `approve-${entry.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Approve Import
              </button>
              <button
                onClick={() => onReject(entry)}
                disabled={actionLoading === `reject-${entry.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === `reject-${entry.id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                Reject
              </button>
            </div>
          </div>

          {/* ======== SCROLLABLE BODY ======== */}
          <div className="flex-1 overflow-y-auto">
            <ReviewDetailPanel
              entry={entry}
              allSurgeons={allSurgeons}
              allProcedures={allProcedures}
              allRooms={allRooms}
              entityMappings={entityMappings}
              onResolveEntity={onResolveEntity}
              onRemapCaseOnly={onRemapCaseOnly}
              onCreateEntity={onCreateEntity}
              onPhiAccess={onPhiAccess}
              incomingColumnLabel={incomingColumnLabel}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
