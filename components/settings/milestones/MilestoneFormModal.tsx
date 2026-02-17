// components/settings/milestones/MilestoneFormModal.tsx
'use client'

import { useState, useMemo } from 'react'
import { Info } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { inferPhaseGroup, PHASE_GROUP_OPTIONS } from '@/lib/utils/inferPhaseGroup'

export interface MilestoneFormData {
  displayName: string
  internalName: string
  phaseGroup: string
  minMinutes: number
  maxMinutes: number
  pairWithId: string
  pairRole: 'start' | 'end'
}

export interface PairingCandidate {
  id: string
  display_name: string
  phase_group: string | null
}

interface EditingMilestone {
  id: string
  display_name: string
  name?: string
  source_milestone_type_id: string | null
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  min_minutes: number | null
  max_minutes: number | null
  phase_group: string | null
  validation_type: 'duration' | 'sequence_gap' | null
}

interface MilestoneFormModalProps {
  open: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  milestone?: EditingMilestone | null
  pairedName?: string | null
  saving: boolean
  onSubmit: (data: MilestoneFormData) => void
  onArchive?: () => void
  /** Unpaired milestones available for pairing in add mode */
  availableForPairing?: PairingCandidate[]
  /** Dynamic phase options from phase_definitions. Falls back to PHASE_GROUP_OPTIONS if not provided. */
  phaseOptions?: { value: string; label: string }[]
}

function generateName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}

/** Inner form — receives initial values as props, resets when key changes */
function MilestoneFormContent({
  mode,
  milestone,
  pairedName,
  saving,
  onSubmit,
  onArchive,
  onClose,
  availableForPairing,
  phaseOptions,
}: Omit<MilestoneFormModalProps, 'open'>) {
  const [displayName, setDisplayName] = useState(
    mode === 'edit' && milestone ? milestone.display_name : ''
  )
  const [internalName, setInternalName] = useState('')
  const [phaseGroup, setPhaseGroup] = useState<string>(
    mode === 'edit' && milestone ? (milestone.phase_group ?? '') : ''
  )
  const [minMinutes, setMinMinutes] = useState(
    mode === 'edit' && milestone ? (milestone.min_minutes ?? 1) : 1
  )
  const [maxMinutes, setMaxMinutes] = useState(
    mode === 'edit' && milestone ? (milestone.max_minutes ?? 90) : 90
  )
  const [pairWithId, setPairWithId] = useState('')
  const [pairRole, setPairRole] = useState<'start' | 'end'>('start')

  // Filter available pairing candidates by selected phase
  const phaseFilteredForPairing = useMemo(() => {
    if (!availableForPairing || !phaseGroup) return []
    return availableForPairing.filter(m => m.phase_group === phaseGroup)
  }, [availableForPairing, phaseGroup])

  const handleSubmit = () => {
    if (!displayName.trim()) return
    onSubmit({
      displayName: displayName.trim(),
      internalName: internalName.trim() || generateName(displayName),
      phaseGroup,
      minMinutes,
      maxMinutes,
      pairWithId,
      pairRole,
    })
  }

  const isGlobal = mode === 'edit' && milestone?.source_milestone_type_id

  return (
    <>
      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Display Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g., Array Placement"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Internal Name (add mode only) */}
      {mode === 'add' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Internal Name <span className="text-slate-400 font-normal">(auto-generated if blank)</span>
          </label>
          <input
            type="text"
            value={internalName}
            onChange={(e) => setInternalName(e.target.value)}
            placeholder={displayName ? generateName(displayName) : 'e.g., array_placement'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>
      )}

      {/* Paired milestone info (edit mode, if paired) */}
      {mode === 'edit' && milestone?.pair_with_id && pairedName && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-900">Paired Milestone</p>
          <p className="text-sm text-green-600 mt-1">
            {milestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{pairedName}</span>
          </p>
        </div>
      )}

      {/* Global milestone info (edit mode) */}
      {isGlobal && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            This is a global milestone. You can edit the name and validation range, but it cannot be archived.
          </p>
        </div>
      )}

      {/* Phase Group */}
      <div className={mode === 'edit' ? 'pt-2 border-t border-slate-200' : ''}>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Phase Group{' '}
          <span className="text-slate-400 font-normal">
            {mode === 'add' ? '(auto-inferred from name)' : ''}
          </span>
        </label>
        {mode === 'edit' && (
          <p className="text-xs text-slate-500 mb-2">Used for time allocation bucketing in milestone analytics</p>
        )}
        <select
          value={phaseGroup}
          onChange={(e) => setPhaseGroup(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">
            {mode === 'add'
              ? (() => {
                  const inferred = inferPhaseGroup(internalName.trim() || generateName(displayName))
                  return inferred ? `Auto: ${PHASE_GROUP_OPTIONS.find(o => o.value === inferred)?.label}` : 'None (unassigned)'
                })()
              : 'None (unassigned)'
            }
          </option>
          {(phaseOptions || PHASE_GROUP_OPTIONS).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Pair With (add mode only) */}
      {mode === 'add' && availableForPairing && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Pair With <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            value={pairWithId}
            onChange={(e) => setPairWithId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None &mdash; standalone milestone</option>
            {phaseFilteredForPairing.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
          {!phaseGroup && (
            <p className="text-xs text-slate-400 mt-1">Select a phase group first to see available milestones.</p>
          )}
          {pairWithId && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-500">This milestone is the:</span>
              {(['start', 'end'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPairRole(r)}
                  className={`px-3 py-1 border rounded text-xs font-semibold uppercase ${
                    pairRole === r
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Validation Range (edit mode only) */}
      {mode === 'edit' && milestone && (
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">Expected Duration Range</label>
          <p className="text-xs text-slate-500 mb-3">
            {milestone.validation_type === 'duration' && milestone.pair_with_id && pairedName
              ? `Time between ${milestone.display_name} and ${pairedName}`
              : 'Time from previous milestone to this one'
            }
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Min (minutes)</label>
              <input
                type="number"
                min="0"
                max="999"
                value={minMinutes}
                onChange={(e) => setMinMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
              />
            </div>
            <span className="text-slate-400 pt-4">&mdash;</span>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Max (minutes)</label>
              <input
                type="number"
                min="1"
                max="999"
                value={maxMinutes}
                onChange={(e) => setMaxMinutes(Math.max(1, parseInt(e.target.value) || 90))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Milestones outside this range will be flagged for review in Data Quality.
          </p>
        </div>
      )}

      {/* Footer */}
      {mode === 'edit' ? (
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
          {milestone && !milestone.source_milestone_type_id && onArchive ? (
            <Button variant="dangerGhost" onClick={onArchive} disabled={saving}>
              Archive
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <Modal.Cancel onClick={onClose} />
            <Modal.Action onClick={handleSubmit} loading={saving} disabled={!displayName.trim()}>
              Save Changes
            </Modal.Action>
          </div>
        </div>
      ) : (
        <Modal.Footer>
          <Modal.Cancel onClick={onClose} />
          <Modal.Action onClick={handleSubmit} loading={saving} disabled={!displayName.trim()}>
            Add Milestone
          </Modal.Action>
        </Modal.Footer>
      )}
    </>
  )
}

export function MilestoneFormModal({
  open,
  onClose,
  mode,
  milestone,
  pairedName,
  saving,
  onSubmit,
  onArchive,
  availableForPairing,
  phaseOptions,
}: MilestoneFormModalProps) {
  // Key forces inner form to remount (reset state) when modal reopens or milestone changes
  const formKey = `${mode}-${milestone?.id ?? 'new'}-${open}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'add' ? 'Add Milestone' : 'Edit Milestone'}
    >
      {open && (
        <MilestoneFormContent
          key={formKey}
          mode={mode}
          milestone={milestone}
          pairedName={pairedName}
          saving={saving}
          onSubmit={onSubmit}
          onArchive={onArchive}
          onClose={onClose}
          availableForPairing={availableForPairing}
          phaseOptions={phaseOptions}
        />
      )}
    </Modal>
  )
}
