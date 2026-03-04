'use client'

import type { VoiceCommandAlias } from '@/lib/dal/voice-commands'
import { AliasRow } from './AliasRow'
import { AddAliasInput } from './AddAliasInput'

/** Human-readable labels for action_type values */
const ACTION_TYPE_LABELS: Record<string, string> = {
  record: 'Record',
  cancel: 'Cancel',
  next_patient: 'Next Patient',
  surgeon_left: 'Surgeon Left',
  undo_last: 'Undo Last',
  confirm_pending: 'Confirm Pending',
  cancel_pending: 'Cancel Pending',
}

interface AliasGroupSectionProps {
  actionType: string
  aliases: VoiceCommandAlias[]
  milestoneTypeId: string | null
  facilityId: string | null
  onDelete: (aliasId: string) => Promise<void>
  onAdded: () => void
  readOnly?: boolean
}

export function AliasGroupSection({
  actionType,
  aliases,
  milestoneTypeId,
  facilityId,
  onDelete,
  onAdded,
  readOnly = false,
}: AliasGroupSectionProps) {
  const label = ACTION_TYPE_LABELS[actionType] || actionType

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 pb-1.5">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </h3>
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500">
          {aliases.length}
        </span>
      </div>

      {/* Alias rows */}
      {aliases.length === 0 ? (
        <div className="px-3 py-2">
          <p className="text-[11px] text-slate-400 italic">No aliases yet</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {aliases.map((alias) => (
            <AliasRow key={alias.id} alias={alias} onDelete={onDelete} readOnly={readOnly} />
          ))}
        </div>
      )}

      {/* Add input — hidden in read-only mode */}
      {!readOnly && (
        <div className="px-3">
          <AddAliasInput
            actionType={actionType}
            milestoneTypeId={milestoneTypeId}
            facilityId={facilityId}
            onAdded={onAdded}
          />
        </div>
      )}
    </div>
  )
}
