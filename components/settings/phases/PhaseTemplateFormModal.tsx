// components/settings/phases/PhaseTemplateFormModal.tsx
'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { COLOR_KEY_PALETTE } from '@/lib/milestone-phase-config'

export interface PhaseTemplateFormData {
  displayName: string
  internalName: string
  startMilestoneTypeId: string
  endMilestoneTypeId: string
  colorKey: string
}

interface MilestoneTypeOption {
  id: string
  display_name: string
}

interface PhaseTemplateFormModalProps {
  open: boolean
  onClose: () => void
  milestoneTypes: MilestoneTypeOption[]
  saving: boolean
  onSubmit: (data: PhaseTemplateFormData) => void
}

function generateName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}

function PhaseTemplateFormContent({
  milestoneTypes,
  saving,
  onSubmit,
  onClose,
}: Omit<PhaseTemplateFormModalProps, 'open'>) {
  const [displayName, setDisplayName] = useState('')
  const [startMilestoneTypeId, setStartMilestoneTypeId] = useState('')
  const [endMilestoneTypeId, setEndMilestoneTypeId] = useState('')
  const [colorKey, setColorKey] = useState('blue')

  const handleSubmit = () => {
    if (!displayName.trim() || !startMilestoneTypeId || !endMilestoneTypeId) return
    onSubmit({
      displayName: displayName.trim(),
      internalName: generateName(displayName),
      startMilestoneTypeId,
      endMilestoneTypeId,
      colorKey,
    })
  }

  const isValid = displayName.trim() && startMilestoneTypeId && endMilestoneTypeId

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

      {/* Start Milestone Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Start Milestone Type <span className="text-red-600">*</span>
        </label>
        <select
          value={startMilestoneTypeId}
          onChange={(e) => setStartMilestoneTypeId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select start milestone type...</option>
          {milestoneTypes.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>

      {/* End Milestone Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          End Milestone Type <span className="text-red-600">*</span>
        </label>
        <select
          value={endMilestoneTypeId}
          onChange={(e) => setEndMilestoneTypeId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select end milestone type...</option>
          {milestoneTypes.map((m) => (
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
          Add Phase Template
        </Modal.Action>
      </Modal.Footer>
    </>
  )
}

export function PhaseTemplateFormModal({
  open,
  onClose,
  milestoneTypes,
  saving,
  onSubmit,
}: PhaseTemplateFormModalProps) {
  const formKey = `add-phase-template-${open}`

  return (
    <Modal open={open} onClose={onClose} title="Add Phase Template">
      {open && (
        <PhaseTemplateFormContent
          key={formKey}
          milestoneTypes={milestoneTypes}
          saving={saving}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}
