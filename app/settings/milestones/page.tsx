// app/settings/milestones/page.tsx
'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { milestoneTypeAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { inferPhaseGroup } from '@/lib/utils/inferPhaseGroup'
import { MilestoneFormModal } from '@/components/settings/milestones/MilestoneFormModal'
import { ArchivedMilestonesSection } from '@/components/settings/milestones/ArchivedMilestonesSection'
import { PhaseLibrary } from '@/components/settings/milestones/PhaseLibrary'
import { Skeleton } from '@/components/ui/Skeleton'
import { TemplateBuilder } from '@/components/settings/milestones/TemplateBuilder'
import { useTemplateBuilder } from '@/hooks/useTemplateBuilder'
import { ProcedureTemplateAssignment } from '@/components/settings/milestones/ProcedureTemplateAssignment'
import { SurgeonOverridePanel } from '@/components/settings/milestones/SurgeonOverridePanel'
import {
  Plus,
  Link2,
  Link2Off,
  Pencil,
  Archive,
  Lock,
  Layers,
  Puzzle,
  Users,
  LayoutTemplate,
  ListChecks,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

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
  min_minutes: number | null
  max_minutes: number | null
  validation_type: 'duration' | 'sequence_gap' | null
  phase_group: string | null
}

// ─── Tab Config ──────────────────────────────────────────

type TabKey = 'milestones' | 'phases' | 'templates' | 'procedures' | 'surgeons'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'milestones', label: 'Milestones', icon: ListChecks },
  { key: 'phases', label: 'Phases', icon: Layers },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'procedures', label: 'Procedures', icon: Puzzle },
  { key: 'surgeons', label: 'Surgeons', icon: Users },
]

function isValidTab(value: string | null): value is TabKey {
  return !!value && TABS.some(t => t.key === value)
}

// ─── Page Shell (Suspense wrapper for useSearchParams) ───

export default function MilestonesSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MilestonesSettingsContent />
    </Suspense>
  )
}

function PageSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-48 mb-4" />
      <div className="flex gap-1 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  )
}

// ─── Main Content ────────────────────────────────────────

function MilestonesSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab: TabKey = useMemo(() => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : 'milestones'
  }, [searchParams])

  const setActiveTab = useCallback((tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'milestones') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [router, pathname, searchParams])

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-900">Milestones</h1>
      </div>
      <p className="text-slate-500 mb-4">
        Configure milestone definitions, phases, templates, and assignments.
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(tab => {
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
      {activeTab === 'milestones' && <MilestonesTab />}
      {activeTab === 'phases' && <PhaseLibrary />}
      {activeTab === 'templates' && <FacilityTemplateBuilderTab />}
      {activeTab === 'procedures' && <ProcedureTemplateAssignment />}
      {activeTab === 'surgeons' && <SurgeonOverridePanel />}
    </>
  )
}

// ─── Tab 3 wrapper: passes facility hook to TemplateBuilder ─

function FacilityTemplateBuilderTab() {
  const builder = useTemplateBuilder()
  return <TemplateBuilder builder={builder} />
}

// ─── Tab 1: Milestones ──────────────────────────────────

function MilestonesTab() {
  const supabase = createClient()
  const { effectiveFacilityId, loading: userLoading } = useUser()
  const { showToast } = useToast()
  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  const { data: milestones, loading, error, setData: setMilestones } = useSupabaseQuery<FacilityMilestone[]>(
    async (sb) => {
      const { data, error: fetchError } = await sb
        .from('facility_milestones')
        .select('id, facility_id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id, is_active, deleted_at, deleted_by, min_minutes, max_minutes, validation_type, phase_group')
        .eq('facility_id', effectiveFacilityId!)
        .order('display_order')
      if (fetchError) throw fetchError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingMilestone, setEditingMilestone] = useState<FacilityMilestone | null>(null)

  // Pair linking mode
  const [pairLinkingId, setPairLinkingId] = useState<string | null>(null)

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

  // Usage counts for milestones
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})

  const fetchUsageCounts = useCallback(async () => {
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
      // Non-critical
    }
  }, [supabase])

  useEffect(() => {
    if (effectiveFacilityId && milestones) {
      fetchUsageCounts()
    }
  }, [effectiveFacilityId, milestones, fetchUsageCounts])

  // Filtered milestone lists
  const activeMilestones = useMemo(
    () => (milestones || []).filter(m => !m.deleted_at && m.is_active),
    [milestones]
  )

  const deletedMilestones = useMemo(
    () => (milestones || []).filter(m => m.deleted_at),
    [milestones]
  )

  // Search filtering
  const filteredMilestones = useMemo(() => {
    if (!search.trim()) return activeMilestones
    const q = search.toLowerCase()
    return activeMilestones.filter(m =>
      m.display_name.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q)
    )
  }, [activeMilestones, search])

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  // ── Mutation handlers ────────────────────────────────────

  const handleFormSubmit = async (data: {
    displayName: string
    internalName: string
    phaseGroup: string
    minMinutes: number
    maxMinutes: number
    pairWithId: string
    pairRole: 'start' | 'end'
  }) => {
    if (formMode === 'add') {
      await handleAdd(data)
    } else {
      await handleEdit(data)
    }
  }

  const handleAdd = async (data: {
    displayName: string
    internalName: string
    phaseGroup: string
    pairWithId?: string
    pairRole?: 'start' | 'end'
  }) => {
    if (!data.displayName || !effectiveFacilityId) return

    setSaving(true)
    try {
      const maxOrder = (milestones || []).length > 0
        ? Math.max(...(milestones || []).map(m => m.display_order))
        : 0

      const resolvedPhaseGroup = data.phaseGroup || inferPhaseGroup(data.internalName) || null

      const { data: insertedData, error: insertError } = await supabase
        .from('facility_milestones')
        .insert({
          facility_id: effectiveFacilityId,
          name: data.internalName,
          display_name: data.displayName,
          display_order: maxOrder + 1,
          source_milestone_type_id: null,
          is_active: true,
          min_minutes: 1,
          max_minutes: 90,
          validation_type: 'sequence_gap',
          phase_group: resolvedPhaseGroup,
        })
        .select()
        .single()

      if (insertError) throw insertError

      await milestoneTypeAudit.created(supabase, data.displayName, insertedData.id)

      const newMilestone = { ...insertedData, deleted_at: null } as FacilityMilestone
      setMilestones([...(milestones || []), newMilestone])

      setShowFormModal(false)
      showToast({ type: 'success', title: `"${data.displayName}" created` })
    } catch {
      showToast({ type: 'error', title: 'Failed to create milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data: {
    displayName: string
    phaseGroup: string
    minMinutes: number
    maxMinutes: number
  }) => {
    if (!editingMilestone || !data.displayName) return

    setSaving(true)
    try {
      const oldDisplayName = editingMilestone.display_name
      const resolvedPhaseGroup = data.phaseGroup || null

      const { error: updateError } = await supabase
        .from('facility_milestones')
        .update({
          display_name: data.displayName,
          min_minutes: data.minMinutes,
          max_minutes: data.maxMinutes,
          phase_group: resolvedPhaseGroup,
        })
        .eq('id', editingMilestone.id)

      if (updateError) throw updateError

      if (oldDisplayName !== data.displayName) {
        await milestoneTypeAudit.updated(supabase, editingMilestone.id, oldDisplayName, data.displayName)
      }

      setMilestones(
        (milestones || []).map(m => m.id === editingMilestone.id
          ? { ...m, display_name: data.displayName, min_minutes: data.minMinutes, max_minutes: data.maxMinutes, phase_group: resolvedPhaseGroup }
          : m
        )
      )
      setShowFormModal(false)
      setEditingMilestone(null)
    } catch {
      showToast({ type: 'error', title: 'Failed to update milestone' })
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (milestone: FacilityMilestone) => {
    const usageCount = usageCounts[milestone.id] || 0
    const partner = milestone.pair_with_id
      ? (milestones || []).find(m => m.id === milestone.pair_with_id)
      : null

    setConfirmModal({
      isOpen: true,
      title: 'Archive Milestone',
      message: (
        <div>
          <p>Archive <strong>&ldquo;{milestone.display_name}&rdquo;</strong>?</p>
          {usageCount > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-sm">
                This milestone has been used in <strong>{usageCount} case{usageCount !== 1 ? 's' : ''}</strong>.
                Historical data will be preserved.
              </p>
            </div>
          )}
          {partner && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 text-sm">
                This milestone is paired with <strong>&ldquo;{partner.display_name}&rdquo;</strong>.
                The pairing will be removed but the partner milestone will remain.
              </p>
            </div>
          )}
          <p className="mt-3 text-slate-500 text-sm">
            You can restore this milestone from the archived section below.
          </p>
        </div>
      ),
      confirmLabel: 'Archive',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setSaving(true)
        try {
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

          const { error: archiveError } = await supabase
            .from('facility_milestones')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by: currentUserId,
              is_active: false,
              pair_with_id: null,
              pair_position: null,
            })
            .eq('id', milestone.id)

          if (archiveError) throw archiveError

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
          showToast({ type: 'success', title: `"${milestone.display_name}" archived` })
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to archive milestone' })
        }

        closeConfirmModal()
        setShowFormModal(false)
        setEditingMilestone(null)
        setSaving(false)
      },
    })
  }

  const handleRestore = async (milestone: { id: string; display_name: string }) => {
    setSaving(true)
    try {
      const { error: restoreError } = await supabase
        .from('facility_milestones')
        .update({
          deleted_at: null,
          deleted_by: null,
          is_active: true,
        })
        .eq('id', milestone.id)

      if (restoreError) throw restoreError

      await milestoneTypeAudit.restored(supabase, milestone.display_name, milestone.id)

      setMilestones((milestones || []).map(m =>
        m.id === milestone.id
          ? { ...m, deleted_at: null, deleted_by: null, is_active: true }
          : m
      ))
      showToast({ type: 'success', title: `"${milestone.display_name}" restored` })
    } catch {
      showToast({ type: 'error', title: 'Failed to restore milestone' })
    } finally {
      setSaving(false)
    }
  }

  // ── Pair linking (inline click-to-pair) ────────────────

  const startPairLinking = (milestoneId: string) => {
    setPairLinkingId(milestoneId)
  }

  const cancelPairLinking = () => {
    setPairLinkingId(null)
  }

  const completePairLinking = async (targetId: string) => {
    if (!pairLinkingId || pairLinkingId === targetId) return

    const startMs = (milestones || []).find(m => m.id === pairLinkingId)
    const endMs = (milestones || []).find(m => m.id === targetId)
    if (!startMs || !endMs) return

    setSaving(true)
    try {
      // Assign based on display_order: lower order = start
      const [startMilestone, endMilestone] = startMs.display_order <= endMs.display_order
        ? [startMs, endMs]
        : [endMs, startMs]

      const { error: err1 } = await supabase
        .from('facility_milestones')
        .update({ pair_with_id: endMilestone.id, pair_position: 'start', validation_type: 'duration' })
        .eq('id', startMilestone.id)
      if (err1) throw err1

      const { error: err2 } = await supabase
        .from('facility_milestones')
        .update({ pair_with_id: startMilestone.id, pair_position: 'end', validation_type: 'sequence_gap' })
        .eq('id', endMilestone.id)
      if (err2) throw err2

      await milestoneTypeAudit.linked(supabase, startMilestone.display_name, endMilestone.display_name)

      setMilestones((milestones || []).map(m => {
        if (m.id === startMilestone.id) {
          return { ...m, pair_with_id: endMilestone.id, pair_position: 'start' as const, validation_type: 'duration' as const }
        }
        if (m.id === endMilestone.id) {
          return { ...m, pair_with_id: startMilestone.id, pair_position: 'end' as const, validation_type: 'sequence_gap' as const }
        }
        return m
      }))

      showToast({ type: 'success', title: `Paired "${startMilestone.display_name}" with "${endMilestone.display_name}"` })
    } catch {
      showToast({ type: 'error', title: 'Failed to pair milestones' })
    } finally {
      setSaving(false)
      setPairLinkingId(null)
    }
  }

  const handleUnlink = async (milestone: FacilityMilestone) => {
    if (!milestone.pair_with_id) return

    const partner = (milestones || []).find(m => m.id === milestone.pair_with_id)

    setConfirmModal({
      isOpen: true,
      title: 'Unlink Milestones',
      message: (
        <div>
          <p>Remove the pairing between <strong>&ldquo;{milestone.display_name}&rdquo;</strong> and <strong>&ldquo;{partner?.display_name || 'Unknown'}&rdquo;</strong>?</p>
          <p className="mt-2 text-slate-500 text-sm">This only affects configuration. Historical data is not affected.</p>
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
              return { ...m, pair_with_id: null, pair_position: null, validation_type: 'sequence_gap' as const }
            }
            return m
          }))
          showToast({ type: 'success', title: 'Milestones unlinked' })
        } catch (err) {
          showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to unlink milestones' })
        }

        closeConfirmModal()
        setSaving(false)
      },
    })
  }

  // ── Helpers ──────────────────────────────────────────────

  const getPairedName = (pairWithId: string): string => {
    const paired = (milestones || []).find(m => m.id === pairWithId)
    return paired?.display_name || 'Unknown'
  }

  const openAddModal = () => {
    setFormMode('add')
    setEditingMilestone(null)
    setShowFormModal(true)
  }

  const openEditModal = (milestoneId: string) => {
    const milestone = (milestones || []).find(m => m.id === milestoneId)
    if (milestone) {
      setFormMode('edit')
      setEditingMilestone(milestone)
      setShowFormModal(true)
    }
  }

  const handleArchiveFromModal = () => {
    if (editingMilestone) handleArchive(editingMilestone)
  }

  // Pair-linking mode banner milestone info
  const linkingMilestone = pairLinkingId
    ? activeMilestones.find(m => m.id === pairLinkingId)
    : null

  return (
    <>
      <ErrorBanner message={error} />

      {/* Pair-linking mode banner */}
      {linkingMilestone && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-blue-700">
            <Link2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Click another milestone to pair with <strong>&ldquo;{linkingMilestone.display_name}&rdquo;</strong>
          </p>
          <button
            onClick={cancelPairLinking}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search milestones..."
          className="flex-1 max-w-sm"
        />
        <Button onClick={openAddModal} size="sm">
          <Plus className="w-4 h-4" />
          Add Milestone
        </Button>
      </div>

      {/* Milestone table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_140px_100px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <span>Name</span>
              <span>Pair</span>
              <span>Validation Range</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table rows */}
            {filteredMilestones.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                {search ? 'No milestones match your search.' : 'No milestones configured yet.'}
              </div>
            ) : (
              filteredMilestones.map(milestone => {
                const isGlobal = !!milestone.source_milestone_type_id
                const isPaired = !!milestone.pair_with_id
                const isLinkTarget = !!pairLinkingId && pairLinkingId !== milestone.id && !milestone.pair_with_id
                const isLinkingSource = pairLinkingId === milestone.id

                return (
                  <div
                    key={milestone.id}
                    onClick={isLinkTarget ? () => completePairLinking(milestone.id) : undefined}
                    className={`
                      grid grid-cols-[1fr_120px_140px_100px] gap-2 px-4 py-2.5 border-b border-slate-100 last:border-b-0 items-center
                      ${isLinkTarget ? 'cursor-pointer bg-blue-50/50 hover:bg-blue-100/50 ring-1 ring-inset ring-blue-200' : ''}
                      ${isLinkingSource ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}
                    `}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      {isGlobal && <span title="Global milestone"><Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /></span>}
                      <span className="text-sm font-medium text-slate-900 truncate">{milestone.display_name}</span>
                    </div>

                    {/* Pair badge */}
                    <div>
                      {isPaired ? (
                        <span className={`
                          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium
                          ${milestone.pair_position === 'start'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                          }
                        `}>
                          {milestone.pair_position === 'start' ? 'Start' : 'End'}
                          <span className="text-slate-400 font-normal truncate max-w-[60px]" title={getPairedName(milestone.pair_with_id!)}>
                            {getPairedName(milestone.pair_with_id!)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">&mdash;</span>
                      )}
                    </div>

                    {/* Validation range */}
                    <div className="text-xs text-slate-500">
                      {milestone.min_minutes != null && milestone.max_minutes != null
                        ? `${milestone.min_minutes}\u2013${milestone.max_minutes} min`
                        : <span className="text-slate-300">&mdash;</span>
                      }
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      {!pairLinkingId && (
                        <>
                          {isPaired ? (
                            <button
                              onClick={() => handleUnlink(milestone)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Unlink pair"
                            >
                              <Link2Off className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startPairLinking(milestone.id)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 rounded transition-colors"
                              title="Link with another milestone"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(milestone.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!isGlobal && (
                            <button
                              onClick={() => handleArchive(milestone)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Summary footer */}
          <div className="mt-3 px-3.5 py-2 bg-white rounded-md border border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>
              {activeMilestones.length} milestone{activeMilestones.length !== 1 ? 's' : ''}
              {search && filteredMilestones.length !== activeMilestones.length && (
                <> &middot; {filteredMilestones.length} shown</>
              )}
            </span>
          </div>
        </>
      )}

      {/* Archived milestones section */}
      <ArchivedMilestonesSection
        milestones={deletedMilestones}
        saving={saving}
        onRestore={handleRestore}
      />

      {/* Add/Edit Modal */}
      <MilestoneFormModal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setEditingMilestone(null) }}
        mode={formMode}
        milestone={editingMilestone as Parameters<typeof MilestoneFormModal>[0]['milestone']}
        pairedName={editingMilestone?.pair_with_id ? getPairedName(editingMilestone.pair_with_id) : null}
        saving={saving}
        onSubmit={handleFormSubmit}
        onArchive={handleArchiveFromModal}
      />

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
