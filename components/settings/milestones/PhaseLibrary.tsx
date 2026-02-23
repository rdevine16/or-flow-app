// components/settings/milestones/PhaseLibrary.tsx
'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { COLOR_KEY_PALETTE, resolveColorKey } from '@/lib/milestone-phase-config'
import { Plus, Pencil, Archive, CornerDownRight } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

interface FacilityPhase {
  id: string
  facility_id: string
  name: string
  display_name: string
  color_key: string | null
  display_order: number
  parent_phase_id: string | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
}

// ─── Phase Library Component ─────────────────────────────

export function PhaseLibrary() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const { data: phases, loading, error, setData: setPhases } = useSupabaseQuery<FacilityPhase[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('facility_phases')
        .select('id, facility_id, name, display_name, color_key, display_order, parent_phase_id, is_active, deleted_at, deleted_by')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // Form modal
  const [showFormModal, setShowFormModal] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingPhase, setEditingPhase] = useState<FacilityPhase | null>(null)

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: () => {},
  })

  // Show archived toggle
  const [showArchived, setShowArchived] = useState(false)

  // Filtered lists
  const activePhases = useMemo(
    () => (phases || []).filter(p => !p.deleted_at && p.is_active),
    [phases]
  )

  const archivedPhases = useMemo(
    () => (phases || []).filter(p => p.deleted_at),
    [phases]
  )

  const filteredPhases = useMemo(() => {
    if (!search.trim()) return activePhases
    const q = search.toLowerCase()
    return activePhases.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    )
  }, [activePhases, search])

  // Parent phase lookup (for sub-phase indicator)
  const phaseById = useMemo(() => {
    const map = new Map<string, FacilityPhase>()
    for (const p of activePhases) map.set(p.id, p)
    return map
  }, [activePhases])

  // Top-level phases (for parent dropdown in form)
  const topLevelPhases = useMemo(
    () => activePhases.filter(p => !p.parent_phase_id),
    [activePhases]
  )

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // ── Handlers ───────────────────────────────────────────

  const openAddModal = () => {
    setFormMode('add')
    setEditingPhase(null)
    setShowFormModal(true)
  }

  const openEditModal = (phase: FacilityPhase) => {
    setFormMode('edit')
    setEditingPhase(phase)
    setShowFormModal(true)
  }

  const handleArchive = (phase: FacilityPhase) => {
    // Check if any sub-phases reference this phase
    const children = activePhases.filter(p => p.parent_phase_id === phase.id)

    setConfirmModal({
      isOpen: true,
      title: 'Archive Phase',
      message: (
        <div>
          <p>Archive <strong>&ldquo;{phase.display_name}&rdquo;</strong>?</p>
          {children.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-sm">
                This phase has <strong>{children.length} sub-phase{children.length !== 1 ? 's' : ''}</strong> that will become parentless.
              </p>
            </div>
          )}
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this phase from the archived section below.
          </p>
        </div>
      ),
      confirmLabel: 'Archive',
      onConfirm: async () => {
        setSaving(true)
        try {
          const { error: archiveError } = await supabase
            .from('facility_phases')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              is_active: false,
            })
            .eq('id', phase.id)

          if (archiveError) throw archiveError

          // Clear parent references on children
          if (children.length > 0) {
            const { error: clearErr } = await supabase
              .from('facility_phases')
              .update({ parent_phase_id: null })
              .eq('parent_phase_id', phase.id)
            if (clearErr) throw clearErr
          }

          setPhases((phases || []).map(p => {
            if (p.id === phase.id) {
              return { ...p, deleted_at: new Date().toISOString(), deleted_by: currentUserId, is_active: false }
            }
            if (p.parent_phase_id === phase.id) {
              return { ...p, parent_phase_id: null }
            }
            return p
          }))
          showToast({ type: 'success', title: `"${phase.display_name}" archived` })
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive phase' })
        }
        closeConfirmModal()
        setSaving(false)
      },
    })
  }

  const handleRestore = async (phase: FacilityPhase) => {
    setSaving(true)
    try {
      const { error: restoreError } = await supabase
        .from('facility_phases')
        .update({ deleted_at: null, deleted_by: null, is_active: true })
        .eq('id', phase.id)

      if (restoreError) throw restoreError

      setPhases((phases || []).map(p =>
        p.id === phase.id ? { ...p, deleted_at: null, deleted_by: null, is_active: true } : p
      ))
      showToast({ type: 'success', title: `"${phase.display_name}" restored` })
    } catch {
      showToast({ type: 'error', title: 'Failed to restore phase' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ErrorBanner message={error} />

      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search phases..."
          className="flex-1 max-w-sm"
        />
        <Button onClick={openAddModal} size="sm">
          <Plus className="w-4 h-4" />
          Add Phase
        </Button>
      </div>

      {/* Phase list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_120px_80px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <span>Phase</span>
              <span>Color</span>
              <span>Parent</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            {filteredPhases.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {search ? 'No phases match your search.' : 'No phases configured yet.'}
              </div>
            ) : (
              filteredPhases.map(phase => {
                const colorConfig = resolveColorKey(phase.color_key)
                const parentPhase = phase.parent_phase_id ? phaseById.get(phase.parent_phase_id) : null

                return (
                  <div
                    key={phase.id}
                    className="grid grid-cols-[1fr_100px_120px_80px] gap-2 px-4 py-2.5 border-b border-slate-100 last:border-b-0 items-center"
                  >
                    {/* Name with color swatch */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${colorConfig.swatch}`} />
                      <span className="text-sm font-medium text-slate-900 truncate">{phase.display_name}</span>
                      <span className="text-xs text-slate-400 truncate">{phase.name}</span>
                    </div>

                    {/* Color label */}
                    <div>
                      <span className={`text-xs font-medium ${colorConfig.accentText}`}>
                        {colorConfig.label}
                      </span>
                    </div>

                    {/* Parent indicator */}
                    <div>
                      {parentPhase ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <CornerDownRight className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{parentPhase.display_name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">&mdash;</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(phase)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(phase)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Summary footer */}
          <div className="mt-3 px-3.5 py-2 bg-white rounded-md border border-slate-100 text-xs text-slate-400">
            {activePhases.length} phase{activePhases.length !== 1 ? 's' : ''}
            {search && filteredPhases.length !== activePhases.length && (
              <> &middot; {filteredPhases.length} shown</>
            )}
          </div>
        </>
      )}

      {/* Archived phases */}
      {archivedPhases.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>&#x25B6;</span>
            Archived ({archivedPhases.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedPhases.map(phase => (
                <div
                  key={phase.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${resolveColorKey(phase.color_key).swatch} opacity-50`} />
                    <span className="text-sm font-medium text-slate-500 line-through">{phase.display_name}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(phase)}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase Form Modal */}
      <PhaseFormModal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingPhase(null) }}
        mode={formMode}
        phase={editingPhase}
        parentOptions={topLevelPhases}
        saving={saving}
        onSave={async (data) => {
          setSaving(true)
          try {
            if (formMode === 'add') {
              const maxOrder = activePhases.length > 0
                ? Math.max(...activePhases.map(p => p.display_order))
                : 0

              const { data: inserted, error: insertErr } = await supabase
                .from('facility_phases')
                .insert({
                  facility_id: effectiveFacilityId,
                  name: data.name,
                  display_name: data.displayName,
                  color_key: data.colorKey,
                  display_order: maxOrder + 1,
                  parent_phase_id: data.parentPhaseId || null,
                  is_active: true,
                })
                .select()
                .single()

              if (insertErr) throw insertErr

              setPhases([...(phases || []), { ...inserted, deleted_at: null } as FacilityPhase])
              showToast({ type: 'success', title: `"${data.displayName}" created` })
            } else if (editingPhase) {
              const { error: updateErr } = await supabase
                .from('facility_phases')
                .update({
                  display_name: data.displayName,
                  color_key: data.colorKey,
                  parent_phase_id: data.parentPhaseId || null,
                })
                .eq('id', editingPhase.id)

              if (updateErr) throw updateErr

              setPhases((phases || []).map(p =>
                p.id === editingPhase.id
                  ? { ...p, display_name: data.displayName, color_key: data.colorKey, parent_phase_id: data.parentPhaseId || null }
                  : p
              ))
              showToast({ type: 'success', title: `"${data.displayName}" updated` })
            }
            setShowFormModal(false)
            setEditingPhase(null)
          } catch (err) {
            showToast({ type: 'error', title: err instanceof Error ? err.message : `Failed to ${formMode} phase` })
          } finally {
            setSaving(false)
          }
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant="danger"
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </>
  )
}

// ─── Phase Form Modal ────────────────────────────────────

interface PhaseFormData {
  name: string
  displayName: string
  colorKey: string
  parentPhaseId: string | null
}

interface PhaseFormModalProps {
  open: boolean
  onClose: () => void
  mode: 'add' | 'edit'
  phase: FacilityPhase | null
  parentOptions: FacilityPhase[]
  saving: boolean
  onSave: (data: PhaseFormData) => void
}

function generatePhaseName(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50)
}

function PhaseFormModal({ open, onClose, mode, phase, parentOptions, saving, onSave }: PhaseFormModalProps) {
  const formKey = `${mode}-${phase?.id ?? 'new'}-${open}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'add' ? 'Add Phase' : 'Edit Phase'}
    >
      {open && (
        <PhaseFormContent
          key={formKey}
          mode={mode}
          phase={phase}
          parentOptions={parentOptions}
          saving={saving}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function PhaseFormContent({
  mode,
  phase,
  parentOptions,
  saving,
  onSave,
  onClose,
}: Omit<PhaseFormModalProps, 'open'>) {
  const [displayName, setDisplayName] = useState(phase?.display_name ?? '')
  const [colorKey, setColorKey] = useState(phase?.color_key ?? 'blue')
  const [parentPhaseId, setParentPhaseId] = useState(phase?.parent_phase_id ?? '')

  const handleSubmit = () => {
    if (!displayName.trim()) return
    onSave({
      name: mode === 'add' ? generatePhaseName(displayName) : (phase?.name ?? generatePhaseName(displayName)),
      displayName: displayName.trim(),
      colorKey,
      parentPhaseId: parentPhaseId || null,
    })
  }

  // Filter out self and own children from parent options
  const availableParents = parentOptions.filter(p => p.id !== phase?.id)

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
          placeholder="e.g., Pre-Op"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
        {mode === 'add' && displayName && (
          <p className="text-xs text-slate-400 mt-1">
            Internal name: <span className="font-mono">{generatePhaseName(displayName)}</span>
          </p>
        )}
      </div>

      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEY_PALETTE.map(color => (
            <button
              key={color.key}
              type="button"
              onClick={() => setColorKey(color.key)}
              className={`
                w-8 h-8 rounded-md ${color.swatch} transition-all
                ${colorKey === color.key
                  ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                  : 'hover:scale-105 opacity-70 hover:opacity-100'
                }
              `}
              title={color.label}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Selected: {COLOR_KEY_PALETTE.find(c => c.key === colorKey)?.label ?? 'None'}
        </p>
      </div>

      {/* Parent Phase (for sub-phases) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Parent Phase <span className="text-slate-400 font-normal">(optional — makes this a sub-phase)</span>
        </label>
        <select
          value={parentPhaseId}
          onChange={(e) => setParentPhaseId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">None (top-level phase)</option>
          {availableParents.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      </div>

      {/* Footer */}
      <Modal.Footer>
        <Modal.Cancel onClick={onClose} />
        <Modal.Action onClick={handleSubmit} loading={saving} disabled={!displayName.trim()}>
          {mode === 'add' ? 'Add Phase' : 'Save Changes'}
        </Modal.Action>
      </Modal.Footer>
    </>
  )
}
