// app/settings/milestones/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { Archive, Check, Clock, Info, Link2, Pencil, Plus } from 'lucide-react'


interface FacilityMilestone {
  id: string
  facility_id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  source_milestone_type_id: string | null
  is_active: boolean
  deleted_at: string | null
    deleted_by: string | null
  // Phase 2: Validation fields
  min_minutes: number | null
  max_minutes: number | null
  validation_type: 'duration' | 'sequence_gap' | null
}

export default function MilestonesSettingsPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const { data: milestones, loading, error, setData: setMilestones, refetch: refetchMilestones } = useSupabaseQuery<FacilityMilestone[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('facility_milestones')
        .select('id, facility_id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id, is_active, deleted_at, deleted_by, min_minutes, max_minutes, validation_type')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')
      if (error) throw error
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<FacilityMilestone | null>(null)
  const [pairingMilestone, setPairingMilestone] = useState<FacilityMilestone | null>(null)
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel: string
    confirmVariant: 'danger' | 'primary'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
  })
  
  // Form states
  const [newName, setNewName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [selectedPairId, setSelectedPairId] = useState<string>('')

  // Phase 2: Validation range form state
  const [editMinMinutes, setEditMinMinutes] = useState<number>(0)
  const [editMaxMinutes, setEditMaxMinutes] = useState<number>(90)

  // Usage counts for milestones
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  // Fetch usage counts when milestones load
  useEffect(() => {
    if (effectiveFacilityId && milestones) {
      fetchUsageCounts()
    }
  }, [effectiveFacilityId, milestones])

  // Check how many cases use each milestone
  const fetchUsageCounts = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('case_milestones')
        .select('facility_milestone_id')
        .not('facility_milestone_id', 'is', null)

      if (fetchError) throw fetchError
      if (data) {
        const counts: Record<string, number> = {}
        data.forEach(row => {
          if (row.facility_milestone_id) {
            counts[row.facility_milestone_id] = (counts[row.facility_milestone_id] || 0) + 1
          }
        })
        setUsageCounts(counts)
      }
    } catch {
      // Non-critical - usage counts are informational
    }
  }

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleAdd = async () => {
    if (!newDisplayName.trim() || !effectiveFacilityId) return
    
    setSaving(true)
    try {
      const name = newName.trim() || generateName(newDisplayName)
      const maxOrder = (milestones || []).length > 0 
        ? Math.max(...(milestones || []).map(m => m.display_order)) 
        : 0

      const { data, error } = await supabase
        .from('facility_milestones')
        .insert({
          facility_id: effectiveFacilityId,
          name,
          display_name: newDisplayName.trim(),
          display_order: maxOrder + 1,
          source_milestone_type_id: null,
          is_active: true,
          min_minutes: 1,
          max_minutes: 90,
          validation_type: 'sequence_gap',
        })
        .select()
        .single()

      if (error) throw error

      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      setMilestones([...(milestones || []), { ...data, deleted_at: null }])
      setNewName('')
      setNewDisplayName('')
      setShowAddModal(false)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to create milestone' })
    } finally {
      setSaving(false)
    }
  }

  // Phase 2: Updated edit handler to save validation ranges
  const handleEdit = async () => {
    if (!editingMilestone || !editDisplayName.trim()) return
    
    setSaving(true)
    try {
      const oldDisplayName = editingMilestone.display_name

      const { error } = await supabase
        .from('facility_milestones')
        .update({ 
          display_name: editDisplayName.trim(),
          min_minutes: editMinMinutes,
          max_minutes: editMaxMinutes,
        })
        .eq('id', editingMilestone.id)

      if (error) throw error

      if (oldDisplayName !== editDisplayName.trim()) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, editDisplayName.trim())
      }

      setMilestones(
        (milestones || []).map(m => m.id === editingMilestone.id 
          ? { ...m, display_name: editDisplayName.trim(), min_minutes: editMinMinutes, max_minutes: editMaxMinutes } 
          : m
        )
      )
      setShowEditModal(false)
      setEditingMilestone(null)
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to update milestone' })
    } finally {
      setSaving(false)
    }
  }

  // Toggle active/inactive
  const handleToggleActive = async (milestone: FacilityMilestone) => {
    const newActiveState = !milestone.is_active

    if (!newActiveState && milestone.pair_with_id) {
      const partner = (milestones || []).find(m => m.id === milestone.pair_with_id)
      
      setConfirmModal({
        isOpen: true,
        title: 'Deactivate Paired Milestone',
        message: (
          <div>
            <p>This will deactivate both milestones in the pair:</p>
            <ul className="mt-2 ml-4 list-disc text-slate-700">
              <li><strong>{milestone.display_name}</strong></li>
              {partner && <li><strong>{partner.display_name}</strong></li>}
            </ul>
          </div>
        ),
        confirmLabel: 'Deactivate Both',
        confirmVariant: 'danger',
        onConfirm: async () => {
          setSaving(true)
          try {
            await supabase
              .from('facility_milestones')
              .update({ is_active: false })
              .eq('id', milestone.id)

            if (partner) {
              await supabase
                .from('facility_milestones')
                .update({ is_active: false })
                .eq('id', partner.id)
            }

            setMilestones((milestones || []).map(m => {
              if (m.id === milestone.id || m.id === milestone.pair_with_id) {
                return { ...m, is_active: false }
              }
              return m
            }))

            closeConfirmModal()
          } catch (err) {
            showToast({ type: 'error', title: 'Failed to deactivate milestones' })
          } finally {
            setSaving(false)
          }
        },
      })
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('facility_milestones')
        .update({ is_active: newActiveState })
        .eq('id', milestone.id)

      if (error) throw error

      setMilestones((milestones || []).map(m => 
        m.id === milestone.id ? { ...m, is_active: newActiveState } : m
      ))
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to update milestone' })
    } finally {
      setSaving(false)
    }
  }

  // Soft delete (move to deleted bucket)
  const handleDelete = async (milestone: FacilityMilestone) => {
    const usageCount = usageCounts[milestone.id] || 0
    const partner = milestone.pair_with_id 
      ? (milestones || []).find(m => m.id === milestone.pair_with_id) 
      : null

    // If used in cases, show warning but still allow soft delete
    setConfirmModal({
      isOpen: true,
      title: 'Delete Milestone',
      message: (
        <div>
          <p>Delete <strong>"{milestone.display_name}"</strong>?</p>
          
          {usageCount > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                This milestone has been used in <strong>{usageCount} case{usageCount !== 1 ? 's' : ''}</strong>. 
                Historical data will be preserved.
              </p>
            </div>
          )}
          
          {partner && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                This milestone is paired with <strong>"{partner.display_name}"</strong>. 
                The pairing will be removed but the partner milestone will remain.
              </p>
            </div>
          )}
          
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this milestone from the "Recently Deleted" section.
          </p>
        </div>
      ),
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)

        try {
          // If paired, unlink partner first
          if (milestone.pair_with_id) {
            const { error: unlinkErr } = await supabase
              .from('facility_milestones')
              .update({ pair_with_id: null, pair_position: null })
              .eq('id', milestone.pair_with_id)
            if (unlinkErr) throw unlinkErr

            await milestoneTypeAudit.unlinked(
              supabase,
              milestone.display_name,
              partner?.display_name || 'Unknown'
            )
          }
          // Soft delete - set deleted_at and deleted_by
          const { error } = await supabase
            .from('facility_milestones')
            .update({ 
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              is_active: false,
              pair_with_id: null,
              pair_position: null,
            })
            .eq('id', milestone.id)

          if (error) throw error

          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
          
          setMilestones((milestones || []).map(m => {
            if (m.id === milestone.id) {
              return { ...m, deleted_at: new Date().toISOString(), deleted_by: currentUserId, is_active: false, pair_with_id: null, pair_position: null }
            }
            if (m.id === milestone.pair_with_id) {
              return { ...m, pair_with_id: null, pair_position: null }
            }
            return m
          }))
          showToast({ type: 'success', title: `"${milestone.display_name}" moved to archive` })
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete milestone' })
        }

        closeConfirmModal()
        setShowEditModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  // Restore deleted milestone
const handleRestore = async (milestone: FacilityMilestone) => {
  setSaving(true)
  try {
    const { error } = await supabase
      .from('facility_milestones')
      .update({ 
        deleted_at: null,
        deleted_by: null,
        is_active: true,
      })
      .eq('id', milestone.id)

    if (error) throw error

    await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)
    
    setMilestones((milestones || []).map(m => 
      m.id === milestone.id 
        ? { ...m, deleted_at: null, deleted_by: null, is_active: true } 
        : m
    ))
    showToast({ type: 'success', title: `"${milestone.display_name}" restored successfully` })
  } catch (err) {
    showToast({ type: 'error', title: 'Failed to restore milestone' })
  } finally {
    setSaving(false)
  }
}

  // Unlink milestones
  const handleUnlink = async (milestone: FacilityMilestone) => {
    if (!milestone.pair_with_id) return

    const partner = (milestones || []).find(m => m.id === milestone.pair_with_id)
    
    setConfirmModal({
      isOpen: true,
      title: 'Unlink Milestones',
      message: (
        <div>
          <p>Remove the pairing between these milestones?</p>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Start</span>
              <span className="font-medium text-slate-900">{milestone.pair_position === 'start' ? milestone.display_name : partner?.display_name}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">End</span>
              <span className="font-medium text-slate-900">{milestone.pair_position === 'end' ? milestone.display_name : partner?.display_name}</span>
            </div>
          </div>
          <p className="mt-3 text-slate-500">This only affects how buttons display. Historical data is not affected.</p>
        </div>
      ),
      confirmLabel: 'Unlink',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setSaving(true)

        try {
          const { error: err1 } = await supabase
            .from('facility_milestones')
            .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
            .eq('id', milestone.id)
          if (err1) throw err1

          const { error: err2 } = await supabase
            .from('facility_milestones')
            .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
            .eq('id', milestone.pair_with_id)
          if (err2) throw err2

          await milestoneTypeAudit.unlinked(
            supabase,
            milestone.display_name,
            partner?.display_name || 'Unknown'
          )

          setMilestones((milestones || []).map(m => {
            if (m.id === milestone.id || m.id === milestone.pair_with_id) {
              return { ...m, pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' }
            }
            return m
          }))
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to unlink milestones' })
        }

        closeConfirmModal()
        setShowPairModal(false)
        setPairingMilestone(null)
        setSaving(false)
      },
    })
  }

  // Set up new pairing
  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return

    const partner = (milestones || []).find(m => m.id === selectedPairId)
    if (!partner) return

    setSaving(true)
    try {
      // If either was previously paired, unlink first
      if (pairingMilestone.pair_with_id && pairingMilestone.pair_with_id !== selectedPairId) {
        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
          .eq('id', pairingMilestone.pair_with_id)
      }

      if (partner.pair_with_id && partner.pair_with_id !== pairingMilestone.id) {
        await supabase
          .from('facility_milestones')
          .update({ pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' })
          .eq('id', partner.pair_with_id)
      }

      // Set the pairing: first selected is start, second is end
      // The START milestone gets validation_type = 'duration'
      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: selectedPairId, pair_position: 'start', validation_type: 'duration' })
        .eq('id', pairingMilestone.id)

      await supabase
        .from('facility_milestones')
        .update({ pair_with_id: pairingMilestone.id, pair_position: 'end', validation_type: 'sequence_gap' })
        .eq('id', selectedPairId)

      await milestoneTypeAudit.linked(
        supabase,
        pairingMilestone.display_name,
        partner.display_name
      )

      // Update local state
      setMilestones((milestones || []).map(m => {
        // Clear old pairings
        if (m.id === pairingMilestone.pair_with_id || m.id === partner.pair_with_id) {
          if (m.id !== pairingMilestone.id && m.id !== selectedPairId) {
            return { ...m, pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' }
          }
        }
        // Set new pairing
        if (m.id === pairingMilestone.id) {
          return { ...m, pair_with_id: selectedPairId, pair_position: 'start' as const, validation_type: 'duration' as const }
        }
        if (m.id === selectedPairId) {
          return { ...m, pair_with_id: pairingMilestone.id, pair_position: 'end' as const, validation_type: 'sequence_gap' as const }
        }
        return m
      }))

      setShowPairModal(false)
      setPairingMilestone(null)
      setSelectedPairId('')
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to set milestone pairing' })
    } finally {
      setSaving(false)
    }
  }

  // Get paired milestone name
  const getPairedName = (pairWithId: string): string => {
    const paired = (milestones || []).find(m => m.id === pairWithId)
    return paired?.display_name || 'Unknown'
  }

  // Get milestones available for pairing (active, not deleted, not already paired)
  const getAvailableForPairing = (excludeId: string): FacilityMilestone[] => {
    return (milestones || []).filter(m => 
      m.id !== excludeId && 
      !m.deleted_at && 
      m.is_active && 
      !m.pair_with_id
    )
  }

  const openPairModal = (milestone: FacilityMilestone) => {
    setPairingMilestone(milestone)
    setSelectedPairId(milestone.pair_with_id || '')
    setShowPairModal(true)
  }

  const formatDeletedDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Phase 2: Helper to get validation description
  const getValidationDescription = (milestone: FacilityMilestone): string => {
    if (milestone.validation_type === 'duration' && milestone.pair_with_id) {
      const partner = (milestones || []).find(m => m.id === milestone.pair_with_id)
      return `Duration: ${milestone.min_minutes || 0}-${milestone.max_minutes || 90} min (${milestone.display_name} → ${partner?.display_name || 'End'})`
    }
    return `Gap from previous: ${milestone.min_minutes || 0}-${milestone.max_minutes || 90} min`
  }

  // Filter milestones
  const activeMilestones = (milestones || []).filter(m => !m.deleted_at && m.is_active)
  const inactiveMilestones = (milestones || []).filter(m => !m.deleted_at && !m.is_active)
  const deletedMilestones = (milestones || []).filter(m => m.deleted_at)

  const visibleMilestones = (milestones || []).filter(m => {
    if (m.deleted_at) return false
    if (!m.is_active && !showInactive) return false
    return true
  })

  return (
    <DashboardLayout>
      <Container className="py-8">
          <ErrorBanner message={error} />
        <SettingsLayout
          title="Milestones"
          description="Configure the surgical milestones tracked during cases."
        >
          {loading ? (
            <PageLoader message="Loading milestones..." />
          ) : (
            <>
              {/* Info Banner */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Global vs Custom Milestones</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    <strong>Global milestones</strong> (blue badge) are provided by ORbit.
                    <strong> Custom milestones</strong> (purple badge) are created by your facility.
                    Deleted milestones can be restored from the "Recently Deleted" section.
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  {inactiveMilestones.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={(e) => setShowInactive(e.target.checked)}
                        className="w-4 h-4 text-slate-600 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">
                        Show inactive ({inactiveMilestones.length})
                      </span>
                    </label>
                  )}
                  {deletedMilestones.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDeleted}
                        onChange={(e) => setShowDeleted(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-600">
                        Recently deleted ({deletedMilestones.length})
                      </span>
                    </label>
                  )}
                </div>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  Add Custom Milestone
                </Button>
              </div>

              {/* Active Milestones List */}
              <div className="space-y-2">
                {visibleMilestones.map((milestone, index) => {
                  const isGlobal = !!milestone.source_milestone_type_id
                  const usageCount = usageCounts[milestone.id] || 0

                  return (
                    <div
                      key={milestone.id}
                      className={`bg-white border rounded-xl p-4 transition-colors ${
                        milestone.is_active 
                          ? 'hover:border-blue-300' 
                          : 'opacity-60 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Active Toggle */}
                        <button
                          onClick={() => handleToggleActive(milestone)}
                          disabled={saving}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
                            milestone.is_active
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          title={milestone.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {milestone.is_active && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>

                        {/* Order Number */}
                        <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                          {index + 1}
                        </span>

                        {/* Milestone Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${milestone.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                              {milestone.display_name}
                            </span>
                            
                            {isGlobal ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                Global
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                Custom
                              </span>
                            )}

                            {!milestone.is_active && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                Inactive
                              </span>
                            )}
                            
                            {milestone.pair_position && milestone.is_active && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                milestone.pair_position === 'start' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {milestone.pair_position === 'start' ? 'Start' : 'End'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {milestone.pair_with_id && milestone.is_active && (
                              <p className="text-xs text-slate-500">
                                Paired with: <span className="font-medium">{getPairedName(milestone.pair_with_id)}</span>
                              </p>
                            )}
                            {usageCount > 0 && (
                              <p className="text-xs text-slate-400">
                                Used in {usageCount} case{usageCount !== 1 ? 's' : ''}
                              </p>
                            )}
                            {/* Phase 2: Show validation range */}
                            {milestone.is_active && (milestone.min_minutes !== null || milestone.max_minutes !== null) && (
                              <p className="text-xs text-slate-400">
                                Valid: {milestone.min_minutes || 0}-{milestone.max_minutes || 90} min
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {milestone.is_active && (
                            <button
                              onClick={() => openPairModal(milestone)}
                              className={`p-2 rounded-lg transition-colors ${
                                milestone.pair_with_id 
                                  ? 'text-emerald-600 hover:bg-emerald-50' 
                                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                              }`}
                              title={milestone.pair_with_id ? 'Manage pairing' : 'Set up pairing'}
                            >
                              <Link2 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingMilestone(milestone)
                              setEditDisplayName(milestone.display_name)
                              setEditMinMinutes(milestone.min_minutes ?? 1)
                              setEditMaxMinutes(milestone.max_minutes ?? 90)
                              setShowEditModal(true)
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Archive button - only for custom milestones */}
                          {!isGlobal && (
                            <button
                              onClick={() => handleDelete(milestone)}
                              disabled={saving}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {visibleMilestones.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No milestones to display.</p>
                  </div>
                )}
              </div>

              {/* Recently Deleted Section */}
              {showDeleted && deletedMilestones.length > 0 && (
                <div className="mt-8">
 <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Archive className="w-4 h-4 text-amber-500" />
                    Archived Milestones
                  </h3>
                  <div className="space-y-2">
                    {deletedMilestones.map(milestone => {
                      const isGlobal = !!milestone.source_milestone_type_id
                      
                      return (
                      <div
                          key={milestone.id}
                          className="bg-amber-50 border border-amber-200 rounded-xl p-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700 line-through">
                                  {milestone.display_name}
                                </span>
                                {isGlobal ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    Global
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    Custom
                                  </span>
                                )}
                              </div>
                             <p className="text-xs text-amber-600 mt-0.5">
                                Archived {milestone.deleted_at ? formatDeletedDate(milestone.deleted_at) : ''}
                              </p>
                            </div>

                            <button
                              onClick={() => handleRestore(milestone)}
                              disabled={saving}
                              className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-medium text-slate-600 mb-2">Legend</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Global</span>
                    <span className="text-slate-500">System milestone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Custom</span>
                    <span className="text-slate-500">Facility milestone</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Start</span>
                    <span className="text-slate-500">First button in pair</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">End</span>
                    <span className="text-slate-500">Second button in pair</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SettingsLayout>
      </Container>

      {/* Add Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setNewName(''); setNewDisplayName('') }}
        title="Add Custom Milestone"
      >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., Array Placement"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name <span className="text-slate-400 font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newDisplayName ? generateName(newDisplayName) : 'e.g., array_placement'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowAddModal(false); setNewName(''); setNewDisplayName('') }} />
          <Modal.Action onClick={handleAdd} loading={saving} disabled={!newDisplayName.trim()}>
            Add Milestone
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal - PHASE 2: Added validation range inputs */}
      <Modal
        open={showEditModal && !!editingMilestone}
        onClose={() => { setShowEditModal(false); setEditingMilestone(null) }}
        title="Edit Milestone"
      >
            {editingMilestone && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              {editingMilestone.pair_with_id && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm font-medium text-emerald-900">Paired Milestone</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
                  </p>
                </div>
              )}

              {/* Info banner for global milestones */}
              {editingMilestone.source_milestone_type_id && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    This is a global milestone. You can edit the name and validation range, but it cannot be deleted or unlinked.
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Expected Duration Range
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  {editingMilestone.validation_type === 'duration' && editingMilestone.pair_with_id
                    ? `Time between ${editingMilestone.display_name} and ${getPairedName(editingMilestone.pair_with_id)}`
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
                      value={editMinMinutes}
                      onChange={(e) => setEditMinMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    />
                  </div>
                  <span className="text-slate-400 pt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Max (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={editMaxMinutes}
                      onChange={(e) => setEditMaxMinutes(Math.max(1, parseInt(e.target.value) || 90))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Milestones outside this range will be flagged for review in Data Quality.
                </p>
              </div>
            </>
            )}

        {/* Custom footer: Archive left, Cancel/Save right */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
              {editingMilestone && !editingMilestone.source_milestone_type_id ? (
                <Button variant="dangerGhost" onClick={() => handleDelete(editingMilestone)} disabled={saving}>
                  Archive
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <Modal.Cancel onClick={() => { setShowEditModal(false); setEditingMilestone(null) }} />
                <Modal.Action onClick={handleEdit} loading={saving} disabled={!editDisplayName.trim()}>
                  Save Changes
                </Modal.Action>
              </div>
            </div>
      </Modal>

{/* Pair/Unlink Modal */}
      <Modal
        open={showPairModal && !!pairingMilestone}
        onClose={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}
        title={pairingMilestone?.pair_with_id ? 'Manage Pairing' : 'Set Up Pairing'}
      >
          {pairingMilestone && (
          <>
            <p className="text-sm text-slate-600">
              {pairingMilestone.pair_with_id 
                ? `"${pairingMilestone.display_name}" is paired with "${getPairedName(pairingMilestone.pair_with_id)}".`
                : `Pair "${pairingMilestone.display_name}" with another milestone.`
              }
            </p>
            
            {pairingMilestone.pair_with_id && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Current Pairing</span>
                  {!pairingMilestone.source_milestone_type_id && (
                    <button
                      onClick={() => handleUnlink(pairingMilestone)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Unlink
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Start</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'start' 
                        ? pairingMilestone.display_name 
                        : pairingMilestone.pair_position === 'end'
                          ? getPairedName(pairingMilestone.pair_with_id)
                          : pairingMilestone.display_name
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">End</span>
                    <span className="text-sm text-slate-900">
                      {pairingMilestone.pair_position === 'end' 
                        ? pairingMilestone.display_name 
                        : pairingMilestone.pair_position === 'start'
                          ? getPairedName(pairingMilestone.pair_with_id)
                          : getPairedName(pairingMilestone.pair_with_id)
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}

            {pairingMilestone.source_milestone_type_id && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Global milestone pairings are managed by ORbit and cannot be changed.
                </p>
              </div>
            )}

            {!pairingMilestone.source_milestone_type_id && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {pairingMilestone.pair_with_id ? 'Change pairing to:' : 'Pair with:'}
                </label>
                <select
                  value={selectedPairId}
                  onChange={(e) => setSelectedPairId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a milestone...</option>
                  {getAvailableForPairing(pairingMilestone.id).map(m => (
                    <option key={m.id} value={m.id}>{m.display_name}</option>
                  ))}
                </select>
                
                {selectedPairId && selectedPairId !== pairingMilestone.pair_with_id && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">New pairing:</p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">{pairingMilestone.display_name}</span> → Start
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">{(milestones || []).find(m => m.id === selectedPairId)?.display_name}</span> → End
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
          )}

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}>
            {pairingMilestone?.source_milestone_type_id || pairingMilestone?.pair_with_id ? 'Close' : 'Cancel'}
          </Modal.Cancel>
          {pairingMilestone && !pairingMilestone.source_milestone_type_id && selectedPairId && selectedPairId !== pairingMilestone.pair_with_id && (
            <Modal.Action onClick={handleSetPair} loading={saving}>
              {pairingMilestone.pair_with_id ? 'Change Pairing' : 'Create Pairing'}
            </Modal.Action>
          )}
        </Modal.Footer>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        variant={confirmModal.confirmVariant === 'primary' ? 'info' : 'danger'}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmLabel}
        loading={saving}
      />
    </DashboardLayout>
  )
}