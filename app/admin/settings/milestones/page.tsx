// app/admin/settings/milestones/page.tsx
// Admin Milestones — 4-tab layout for global milestone, phase, template, and procedure type management.
// Tab shell + Tab 1 (Milestones) + Tab 2 (Phases) built in Phase 5a.
// Tab 3 (Templates) + Tab 4 (Procedure Types) placeholder for Phase 5b.
'use client'

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { useUser } from '@/lib/UserContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { AdminPhaseLibrary } from '@/components/settings/milestones/AdminPhaseLibrary'
import { inferPhaseGroup } from '@/lib/utils/inferPhaseGroup'
import {
  Archive,
  Check,
  Clock,
  Info,
  Layers,
  LayoutTemplate,
  Link,
  ListChecks,
  Pencil,
  Plus,
  Puzzle,
} from 'lucide-react'

// ─── Tab Config ──────────────────────────────────────────

type AdminTabKey = 'milestones' | 'phases' | 'templates' | 'procedures'

const ADMIN_TABS: { key: AdminTabKey; label: string; icon: React.ElementType }[] = [
  { key: 'milestones', label: 'Milestones', icon: ListChecks },
  { key: 'phases', label: 'Phases', icon: Layers },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'procedures', label: 'Procedure Types', icon: Puzzle },
]

function isValidTab(value: string | null): value is AdminTabKey {
  return !!value && ADMIN_TABS.some(t => t.key === value)
}

// ─── Page Shell ──────────────────────────────────────────

export default function AdminMilestonesSettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminMilestonesContent />
    </Suspense>
  )
}

function AdminPageSkeleton() {
  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96 mb-6" />
          <div className="flex gap-1 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-32 rounded-md" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </Container>
    </DashboardLayout>
  )
}

// ─── Main Content ────────────────────────────────────────

function AdminMilestonesContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  const activeTab: AdminTabKey = useMemo(() => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : 'milestones'
  }, [searchParams])

  const setActiveTab = useCallback((tab: AdminTabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'milestones') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [router, pathname, searchParams])

  if (userLoading) {
    return <AdminPageSkeleton />
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-semibold text-slate-900">Global Milestones</h1>
          </div>
          <p className="text-slate-500 mb-4">
            Configure global milestone definitions, phases, templates, and procedure type assignments.
          </p>

          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-slate-200">
            {ADMIN_TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'milestones' && <AdminMilestonesTab />}
          {activeTab === 'phases' && <AdminPhaseLibrary />}
          {activeTab === 'templates' && <TemplatesPlaceholder />}
          {activeTab === 'procedures' && <ProcedureTypesPlaceholder />}
        </div>
      </Container>
    </DashboardLayout>
  )
}

// ─── Tab 3 & 4 Placeholders ─────────────────────────────

function TemplatesPlaceholder() {
  return (
    <div className="text-center py-16 border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
      <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <h3 className="text-sm font-medium text-slate-600 mb-1">Template Builder</h3>
      <p className="text-sm text-slate-400">
        Global milestone template CRUD. Coming in Phase 5b.
      </p>
    </div>
  )
}

function ProcedureTypesPlaceholder() {
  return (
    <div className="text-center py-16 border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
      <Puzzle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <h3 className="text-sm font-medium text-slate-600 mb-1">Procedure Type Templates</h3>
      <p className="text-sm text-slate-400">
        Assign templates to global procedure types. Coming in Phase 5b.
      </p>
    </div>
  )
}

// ─── Tab 1: Admin Milestones ─────────────────────────────
// Ported from existing admin milestones page. Uses `milestone_types` table.

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  is_active: boolean
  deleted_at: string | null
  deleted_by: string | null
}

function AdminMilestonesTab() {
  const supabase = createClient()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<MilestoneType | null>(null)
  const [pairingMilestone, setPairingMilestone] = useState<MilestoneType | null>(null)

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
  const [showArchived, setShowArchived] = useState(false)

  const { data: queryData, loading, error, refetch: refetchData } = useSupabaseQuery<{
    milestones: MilestoneType[]
    archivedCount: number
  }>(
    async (sb) => {
      let query = sb
        .from('milestone_types')
        .select('id, name, display_name, display_order, pair_with_id, pair_position, is_active, deleted_at, deleted_by')

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      query = query.order('display_order')
      const { data, error } = await query
      if (error) throw error

      const { count } = await sb
        .from('milestone_types')
        .select('id', { count: 'exact', head: true })
        .not('deleted_at', 'is', null)

      return {
        milestones: data?.map(m => ({ ...m, is_active: m.is_active ?? true })) || [],
        archivedCount: count || 0,
      }
    },
    { deps: [showArchived] }
  )

  const milestones = queryData?.milestones || []
  const archivedCount = queryData?.archivedCount || 0

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // Generate internal name from display name
  const generateName = (displayName: string): string => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  const handleAdd = async () => {
    if (!newDisplayName.trim()) return

    setSaving(true)
    const name = newName.trim() || generateName(newDisplayName)
    const maxOrder = milestones.length > 0
      ? Math.max(...milestones.map(m => m.display_order))
      : 0

    const { data, error } = await supabase
      .from('milestone_types')
      .insert({
        name,
        display_name: newDisplayName.trim(),
        display_order: maxOrder + 1,
        is_active: true,
      })
      .select()
      .single()

    if (!error && data) {
      await milestoneTypeAudit.created(supabase, newDisplayName.trim(), data.id)
      await propagateToFacilities(data)

      refetchData()
      setNewName('')
      setNewDisplayName('')
      setShowAddModal(false)
    }
    setSaving(false)
  }

  const propagateToFacilities = async (milestone: MilestoneType) => {
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id')

    if (facilities) {
      const insertions = facilities.map(f => ({
        facility_id: f.id,
        name: milestone.name,
        display_name: milestone.display_name,
        display_order: milestone.display_order,
        source_milestone_type_id: milestone.id,
        is_active: true,
        phase_group: inferPhaseGroup(milestone.name),
      }))

      await supabase
        .from('facility_milestones')
        .insert(insertions)
    }
  }

  const handleEdit = async () => {
    if (!editingMilestone || !editDisplayName.trim()) return

    setSaving(true)
    const oldDisplayName = editingMilestone.display_name

    const { error } = await supabase
      .from('milestone_types')
      .update({ display_name: editDisplayName.trim() })
      .eq('id', editingMilestone.id)

    if (!error) {
      if (oldDisplayName !== editDisplayName.trim()) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, editDisplayName.trim())
      }

      await supabase
        .from('facility_milestones')
        .update({ display_name: editDisplayName.trim() })
        .eq('source_milestone_type_id', editingMilestone.id)

      refetchData()
      setShowEditModal(false)
      setEditingMilestone(null)
    }
    setSaving(false)
  }

  const handleToggleActive = async (milestone: MilestoneType) => {
    const newIsActive = !milestone.is_active

    setConfirmModal({
      isOpen: true,
      title: `${newIsActive ? 'Activate' : 'Deactivate'} Milestone`,
      message: (
        <p>
          {newIsActive
            ? `Activate "${milestone.display_name}"? It will be included when new facilities are created.`
            : `Deactivate "${milestone.display_name}"? It will be hidden from new facilities. Existing facilities are not affected.`
          }
        </p>
      ),
      confirmLabel: newIsActive ? 'Activate' : 'Deactivate',
      confirmVariant: newIsActive ? 'primary' : 'danger',
      onConfirm: async () => {
        setSaving(true)

        const { error } = await supabase
          .from('milestone_types')
          .update({ is_active: newIsActive })
          .eq('id', milestone.id)

        if (!error) {
          refetchData()
        }

        setSaving(false)
        closeConfirmModal()
      },
    })
  }

  const getPairedName = (pairedId: string | null) => {
    if (!pairedId) return null
    return milestones.find(m => m.id === pairedId)?.display_name || null
  }

  const getAvailableForPairing = (excludeId: string) => {
    return milestones.filter(m =>
      m.id !== excludeId &&
      !m.pair_with_id &&
      m.is_active
    )
  }

  const openPairModal = (milestone: MilestoneType) => {
    setPairingMilestone(milestone)
    setSelectedPairId(milestone.pair_with_id || '')
    setShowPairModal(true)
  }

  const handleSetPair = async () => {
    if (!pairingMilestone || !selectedPairId) return

    setSaving(true)
    const partner = milestones.find(m => m.id === selectedPairId)

    // Clear any existing pairing for this milestone first
    if (pairingMilestone.pair_with_id) {
      await supabase
        .from('milestone_types')
        .update({ pair_with_id: null, pair_position: null })
        .eq('id', pairingMilestone.pair_with_id)
    }

    // Set new pairing
    await supabase
      .from('milestone_types')
      .update({ pair_with_id: selectedPairId, pair_position: 'start' })
      .eq('id', pairingMilestone.id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: pairingMilestone.id, pair_position: 'end' })
      .eq('id', selectedPairId)

    await milestoneTypeAudit.linked(
      supabase,
      pairingMilestone.display_name,
      partner?.display_name || 'Unknown'
    )

    refetchData()

    setShowPairModal(false)
    setPairingMilestone(null)
    setSelectedPairId('')
    setSaving(false)
  }

  const handleUnlink = async (milestone: MilestoneType) => {
    if (!milestone.pair_with_id) return

    setSaving(true)
    const partnerName = getPairedName(milestone.pair_with_id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: null, pair_position: null })
      .eq('id', milestone.id)

    await supabase
      .from('milestone_types')
      .update({ pair_with_id: null, pair_position: null })
      .eq('id', milestone.pair_with_id)

    await milestoneTypeAudit.unlinked(supabase, milestone.display_name, partnerName || 'Unknown')

    refetchData()

    setShowPairModal(false)
    setPairingMilestone(null)
    setSaving(false)
  }

  // Archive a milestone (soft delete)
  const handleArchive = async (milestone: MilestoneType) => {
    if (!currentUserId) return

    // If paired, need to unlink first
    if (milestone.pair_with_id) {
      const partner = milestones.find(m => m.id === milestone.pair_with_id)

      setConfirmModal({
        isOpen: true,
        title: 'Archive Paired Milestone',
        message: (
          <div>
            <p>This milestone is paired with <strong>&quot;{partner?.display_name}&quot;</strong>.</p>
            <p className="mt-2">Archiving will remove the pairing. The partner milestone will remain active.</p>
          </div>
        ),
        confirmLabel: 'Archive',
        confirmVariant: 'danger',
        onConfirm: async () => {
          setSaving(true)

          // Unlink partner first
          await supabase
            .from('milestone_types')
            .update({ pair_with_id: null, pair_position: null })
            .eq('id', milestone.pair_with_id)

          // Archive this milestone
          const { error } = await supabase
            .from('milestone_types')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              pair_with_id: null,
              pair_position: null
            })
            .eq('id', milestone.id)

          if (!error) {
            await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
            refetchData()
            showToast({ type: 'success', title: `"${milestone.display_name}" moved to archive` })
          }

          closeConfirmModal()
          setSaving(false)
        },
      })
      return
    }

    // Not paired - simple archive
    setConfirmModal({
      isOpen: true,
      title: 'Archive Milestone',
      message: (
        <p>Archive <strong>&quot;{milestone.display_name}&quot;</strong>? It will be hidden from new facilities. You can restore it later.</p>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)

        const { error } = await supabase
          .from('milestone_types')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentUserId
          })
          .eq('id', milestone.id)

        if (!error) {
          await milestoneTypeAudit.deleted(supabase, milestone.display_name, milestone.id)
          refetchData()
          showToast({ type: 'success', title: `"${milestone.display_name}" moved to archive` })
        }

        closeConfirmModal()
        setSaving(false)
      },
    })
  }

  // Restore an archived milestone
  const handleRestore = async (milestone: MilestoneType) => {
    setSaving(true)

    const { error } = await supabase
      .from('milestone_types')
      .update({
        deleted_at: null,
        deleted_by: null
      })
      .eq('id', milestone.id)

    if (!error) {
      await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)
      refetchData()
      showToast({ type: 'success', title: `"${milestone.display_name}" restored successfully` })
    } else {
      showToast({ type: 'error', title: 'Failed to restore milestone' })
    }

    setSaving(false)
  }

  // Filter based on showInactive
  const visibleMilestones = showInactive
    ? milestones
    : milestones.filter(m => m.is_active)

  const inactiveCount = milestones.filter(m => !m.is_active).length
  const activeCount = milestones.filter(m => m.is_active).length

  return (
    <>
      <ErrorBanner message={error} />

      {/* Info banner */}
      <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Global milestones are seeded to new facilities on creation. Changes here don&apos;t affect existing facilities.
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">
            {activeCount} active milestone{activeCount !== 1 ? 's' : ''}
          </span>
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600">
                Show inactive ({inactiveCount})
              </span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Archive Toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              showArchived
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? 'View Active' : `Archive (${archivedCount})`}
          </button>

          {/* Add Milestone */}
          {!showArchived && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleMilestones.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No milestones found</p>
            {!showInactive && inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive(true)}
                className="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Show {inactiveCount} inactive
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Display Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Internal Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pairing</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleMilestones.map((milestone, index) => (
                <tr
                  key={milestone.id}
                  className={`group hover:bg-slate-50 transition-colors ${!milestone.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Order */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400 font-medium">{index + 1}</span>
                  </td>

                  {/* Status Toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(milestone)}
                      disabled={saving}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                        milestone.is_active
                          ? 'border-green-500 bg-green-500'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                      title={milestone.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {milestone.is_active && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </td>

                  {/* Display Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{milestone.display_name}</span>
                      {milestone.pair_position === 'start' && milestone.is_active && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-600">
                          Start
                        </span>
                      )}
                      {milestone.pair_position === 'end' && milestone.is_active && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          End
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Internal Name */}
                  <td className="px-4 py-3">
                    <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {milestone.name}
                    </code>
                  </td>

                  {/* Pairing */}
                  <td className="px-4 py-3">
                    {milestone.pair_with_id && milestone.is_active ? (
                      <span className="text-sm text-blue-600">
                        &rarr; {getPairedName(milestone.pair_with_id)}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-300">&mdash;</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {showArchived ? (
                        <button
                          onClick={() => handleRestore(milestone)}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          {milestone.is_active && (
                            <button
                              onClick={() => openPairModal(milestone)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                milestone.pair_with_id
                                  ? 'text-blue-600 hover:bg-blue-50'
                                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                              }`}
                              title={milestone.pair_with_id ? 'Manage pairing' : 'Set up pairing'}
                            >
                              <Link className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingMilestone(milestone)
                              setEditDisplayName(milestone.display_name)
                              setShowEditModal(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(milestone)}
                            disabled={saving}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">About milestone pairing</p>
            <p>
              Paired milestones create Start/End buttons in the mobile app for tracking durations
              (e.g., Anesthesia Start &rarr; Anesthesia End). Click the link icon to manage pairings.
            </p>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setNewName(''); setNewDisplayName('') }}
        title="Add Milestone"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Display Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="e.g., Patient In Room"
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
            placeholder={newDisplayName ? generateName(newDisplayName) : 'e.g., patient_in'}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Used for code references. Lowercase, underscores only.</p>
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowAddModal(false); setNewName(''); setNewDisplayName('') }} />
          <Modal.Action onClick={handleAdd} loading={saving} disabled={!newDisplayName.trim()}>
            Add Milestone
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal && !!editingMilestone}
        onClose={() => { setShowEditModal(false); setEditingMilestone(null) }}
        title="Edit Milestone"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Internal Name <span className="text-slate-400 font-normal">(read-only)</span>
          </label>
          <input
            type="text"
            value={editingMilestone?.name ?? ''}
            disabled
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Display Name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={editDisplayName}
            onChange={(e) => setEditDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>

        {editingMilestone?.pair_with_id && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">Paired Milestone</p>
            <p className="text-sm text-blue-700 mt-1">
              {editingMilestone.pair_position === 'start' ? 'Start' : 'End'} of pair with: <span className="font-medium">{getPairedName(editingMilestone.pair_with_id)}</span>
            </p>
          </div>
        )}

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowEditModal(false); setEditingMilestone(null) }} />
          <Modal.Action onClick={handleEdit} loading={saving} disabled={!editDisplayName.trim()}>
            Save Changes
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      {/* Pair/Unlink Modal */}
      <Modal
        open={showPairModal && !!pairingMilestone}
        onClose={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}
        title={pairingMilestone?.pair_with_id ? 'Manage Pairing' : 'Set Up Pairing'}
      >
        <p className="text-sm text-slate-600">
          {pairingMilestone?.pair_with_id
            ? `"${pairingMilestone.display_name}" is paired with "${getPairedName(pairingMilestone.pair_with_id)}".`
            : `Pair "${pairingMilestone?.display_name}" with another milestone to create a Start/End pair.`
          }
        </p>

        {pairingMilestone?.pair_with_id && (
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">Current Pairing</span>
              <button
                onClick={() => pairingMilestone && handleUnlink(pairingMilestone)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Unlink
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-600">Start</span>
                <span className="text-sm text-slate-900">
                  {pairingMilestone.pair_position === 'start' ? pairingMilestone.display_name : getPairedName(pairingMilestone.pair_with_id)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">End</span>
                <span className="text-sm text-slate-900">
                  {pairingMilestone.pair_position === 'end' ? pairingMilestone.display_name : getPairedName(pairingMilestone.pair_with_id)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {pairingMilestone?.pair_with_id ? 'Change pairing to:' : 'Pair with:'}
          </label>
          <select
            value={selectedPairId}
            onChange={(e) => setSelectedPairId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a milestone...</option>
            {pairingMilestone && getAvailableForPairing(pairingMilestone.id).map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>

          {selectedPairId && pairingMilestone && selectedPairId !== pairingMilestone.pair_with_id && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">New pairing:</p>
              <p className="text-sm text-blue-700">
                <span className="font-medium">{pairingMilestone.display_name}</span> &rarr; Start
              </p>
              <p className="text-sm text-blue-700">
                <span className="font-medium">{milestones.find(m => m.id === selectedPairId)?.display_name}</span> &rarr; End
              </p>
            </div>
          )}
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={() => { setShowPairModal(false); setPairingMilestone(null); setSelectedPairId('') }}>
            {pairingMilestone?.pair_with_id ? 'Close' : 'Cancel'}
          </Modal.Cancel>
          {selectedPairId && pairingMilestone && selectedPairId !== pairingMilestone.pair_with_id && (
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
    </>
  )
}
