'use client'

import { useState } from 'react'
import { tokens } from '@/lib/design-tokens'
import SearchableDropdown from '@/components/ui/SearchableDropdown'
import { AlertTriangle } from 'lucide-react'

interface IncompleteCaseModalProps {
  caseId: string
  missingFields: {
    surgeon_id: boolean
    procedure_type_id: boolean
    or_room_id: boolean
  }
  surgeons: { id: string; label: string }[]
  procedures: { id: string; label: string }[]
  rooms: { id: string; label: string }[]
  existingValues: {
    surgeon_id: string | null
    procedure_type_id: string | null
    or_room_id: string | null
  }
  onSave: (values: {
    surgeon_id?: string
    procedure_type_id?: string
    or_room_id?: string
  }) => Promise<void>
}

export default function IncompleteCaseModal({
  missingFields,
  surgeons,
  procedures,
  rooms,
  existingValues,
  onSave,
}: IncompleteCaseModalProps) {
  const [surgeonId, setSurgeonId] = useState(existingValues.surgeon_id || '')
  const [procedureTypeId, setProcedureTypeId] = useState(existingValues.procedure_type_id || '')
  const [orRoomId, setOrRoomId] = useState(existingValues.or_room_id || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const missingCount = [missingFields.surgeon_id, missingFields.procedure_type_id, missingFields.or_room_id].filter(Boolean).length

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}

    if (missingFields.surgeon_id && !surgeonId) {
      newErrors.surgeon_id = 'Surgeon is required'
    }
    if (missingFields.procedure_type_id && !procedureTypeId) {
      newErrors.procedure_type_id = 'Procedure is required'
    }
    if (missingFields.or_room_id && !orRoomId) {
      newErrors.or_room_id = 'Room is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    const updates: Record<string, string> = {}
    if (missingFields.surgeon_id && surgeonId) updates.surgeon_id = surgeonId
    if (missingFields.procedure_type_id && procedureTypeId) updates.procedure_type_id = procedureTypeId
    if (missingFields.or_room_id && orRoomId) updates.or_room_id = orRoomId

    await onSave(updates)
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ zIndex: tokens.zIndex.modalBackdrop }}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: tokens.zIndex.modal }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="incomplete-case-title"
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3
                id="incomplete-case-title"
                className="text-lg font-semibold text-slate-900"
              >
                Incomplete Case
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                This case is missing {missingCount} required {missingCount === 1 ? 'field' : 'fields'}.
                Please fill {missingCount === 1 ? 'it' : 'them'} in to continue.
              </p>
            </div>
          </div>

          {/* Missing Fields */}
          <div className="space-y-4 mb-6">
            {missingFields.surgeon_id && (
              <SearchableDropdown
                label="Surgeon *"
                placeholder="Select Surgeon"
                value={surgeonId}
                onChange={(id) => {
                  setSurgeonId(id)
                  setErrors(prev => { const next = { ...prev }; delete next.surgeon_id; return next })
                }}
                options={surgeons}
                error={errors.surgeon_id}
              />
            )}

            {missingFields.procedure_type_id && (
              <SearchableDropdown
                label="Procedure Type *"
                placeholder="Select Procedure"
                value={procedureTypeId}
                onChange={(id) => {
                  setProcedureTypeId(id)
                  setErrors(prev => { const next = { ...prev }; delete next.procedure_type_id; return next })
                }}
                options={procedures}
                error={errors.procedure_type_id}
              />
            )}

            {missingFields.or_room_id && (
              <SearchableDropdown
                label="OR Room *"
                placeholder="Select Room"
                value={orRoomId}
                onChange={(id) => {
                  setOrRoomId(id)
                  setErrors(prev => { const next = { ...prev }; delete next.or_room_id; return next })
                }}
                options={rooms}
                error={errors.or_room_id}
              />
            )}
          </div>

          {/* Action */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Complete Case Details'}
          </button>
        </div>
      </div>
    </>
  )
}
