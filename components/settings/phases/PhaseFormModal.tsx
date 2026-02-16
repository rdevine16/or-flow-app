// components/settings/phases/PhaseFormModal.tsx
'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { COLOR_KEY_PALETTE } from '@/lib/milestone-phase-config'

export interface PhaseFormData {
  displayName: string
  internalName: string
  startMilestoneId: string
  endMilestoneId: string
  colorKey: string
}

interface FacilityMilestoneOption {
  id: string
  display_name: string
}

interface PhaseFormModalProps {
  open: boolean
  onClose: () => void
  milestones: FacilityMilestoneOption[]
  saving: boolean
  onSubmit: (data: PhaseFormData) => void
}

function generateName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}

function PhaseFormContent({
  milestones,
  saving,
  onSubmit,
  onClose,
}: Omit<PhaseFormModalProps, 'open'>) {
  const [displayName, setDisplayName] = useState('')
  const [startMilestoneId, setStartMilestoneId] = useState('')
  const [endMilestoneId, setEndMilestoneId] = useState('')
  const [colorKey, setColorKey] = useState('blue')

  const handleSubmit = () => {
    if (!displayName.trim() || !startMilestoneId || !endMilestoneId) return
    onSubmit({
      displayName: displayName.trim(),
      internalName: generateName(displayName),
      startMilestoneId,
      endMilestoneId,
      colorKey,
    })
  }

  const isValid = displayName.trim() && startMilestoneId && endMilestoneId

  return (
    <>
      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Phase Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g., Pre-Op"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
      </div>

      {/* Start Milestone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Start Milestone <span className="text-red-600">*</span>
        </label>
        <select
          value={startMilestoneId}
          onChange={(e) => setStartMilestoneId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select start milestone...</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      {/* End Milestone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          End Milestone <span className="text-red-600">*</span>
        </label>
        <select
          value={endMilestoneId}
          onChange={(e) => setEndMilestoneId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select end milestone...</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEY_PALETTE.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColorKey(c.key)}
              className={`w-8 h-8 rounded-full ${c.swatch} ring-1 ring-black/10 hover:ring-2 hover:ring-offset-1 transition-all ${
                colorKey === c.key ? 'ring-2 ring-offset-2 ring-slate-900' : ''
              }`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <Modal.Footer>
        <Modal.Cancel onClick={onClose} />
        <Modal.Action onClick={handleSubmit} loading={saving} disabled={!isValid}>
          Add Phase
        </Modal.Action>
      </Modal.Footer>
    </>
  )
}

export function PhaseFormModal({
  open,
  onClose,
  milestones,
  saving,
  onSubmit,
}: PhaseFormModalProps) {
  const formKey = `add-phase-${open}`

  return (
    <Modal open={open} onClose={onClose} title="Add Phase">
      {open && (
        <PhaseFormContent
          key={formKey}
          milestones={milestones}
          saving={saving}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
