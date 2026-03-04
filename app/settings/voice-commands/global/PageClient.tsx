'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Search, Mic, Milestone, Zap, Loader2, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { voiceCommandsDAL } from '@/lib/dal/voice-commands'
import type { VoiceCommandAlias } from '@/lib/dal/voice-commands'
import { AliasGroupSection } from '@/components/settings/voice-commands/AliasGroupSection'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// ============================================
// TYPES
// ============================================

interface MilestoneType {
  id: string
  name: string
  display_order: number
}

type ObjectiveTab = 'milestones' | 'actions'

interface UtilityAction {
  id: string
  name: string
  action_type: string
  label: string
}

interface ObjectiveItem {
  id: string
  name: string
  label: string
  kind: 'milestone' | 'action'
  milestoneTypeId: string | null
  actionType: string
}

// ============================================
// CONSTANTS
// ============================================

const MILESTONE_DISPLAY_NAMES: Record<string, string> = {
  patient_in: 'Patient In',
  anes_start: 'Anesthesia Start',
  anes_end: 'Anesthesia End',
  prep_drape_start: 'Prep & Drape Start',
  prep_drape_complete: 'Prep & Drape Complete',
  incision: 'Incision',
  closing: 'Closing',
  closing_complete: 'Closing Complete',
  patient_out: 'Patient Out',
  room_cleaned: 'Room Cleaned',
}

const UTILITY_ACTIONS: UtilityAction[] = [
  { id: 'action-next_patient', name: 'next_patient', action_type: 'next_patient', label: 'Next Patient' },
  { id: 'action-surgeon_left', name: 'surgeon_left', action_type: 'surgeon_left', label: 'Surgeon Left' },
  { id: 'action-undo_last', name: 'undo_last', action_type: 'undo_last', label: 'Undo Last' },
  { id: 'action-confirm_pending', name: 'confirm_pending', action_type: 'confirm_pending', label: 'Confirm Pending' },
  { id: 'action-cancel_pending', name: 'cancel_pending', action_type: 'cancel_pending', label: 'Cancel Pending' },
]

// ============================================
// COMPONENT
// ============================================

export default function GlobalVoiceCommandsPageClient() {
  const router = useRouter()
  const { isGlobalAdmin, loading: userLoading } = useUser()
  const { showToast } = useToast()

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  // UI state
  const [activeTab, setActiveTab] = useState<ObjectiveTab>('milestones')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Fetch milestone types
  const { data: milestoneTypes, loading: milestonesLoading, error: milestonesError } = useSupabaseQuery<MilestoneType[]>(
    async (sb) => {
      const { data, error } = await sb
        .from('milestone_types')
        .select('id, name, display_order')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      return data || []
    },
    { deps: [], enabled: !userLoading && isGlobalAdmin }
  )

  // Fetch all global template aliases (facility_id IS NULL)
  const {
    data: allAliases,
    loading: aliasesLoading,
    error: aliasesError,
    refetch: refetchAliases,
  } = useSupabaseQuery<VoiceCommandAlias[]>(
    async (sb) => {
      const { data, error } = await voiceCommandsDAL.listGlobal(sb)
      if (error) throw error
      return data
    },
    { deps: [], enabled: !userLoading && isGlobalAdmin }
  )

  // Build unified objective items
  const milestoneItems: ObjectiveItem[] = useMemo(() => {
    if (!milestoneTypes) return []
    return milestoneTypes.map((mt) => ({
      id: mt.id,
      name: mt.name,
      label: MILESTONE_DISPLAY_NAMES[mt.name] || mt.name,
      kind: 'milestone' as const,
      milestoneTypeId: mt.id,
      actionType: 'record',
    }))
  }, [milestoneTypes])

  const actionItems: ObjectiveItem[] = useMemo(() => {
    return UTILITY_ACTIONS.map((ua) => ({
      id: ua.id,
      name: ua.name,
      label: ua.label,
      kind: 'action' as const,
      milestoneTypeId: null,
      actionType: ua.action_type,
    }))
  }, [])

  // Filter items by active tab and search
  const visibleItems = useMemo(() => {
    const items = activeTab === 'milestones' ? milestoneItems : actionItems
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [activeTab, milestoneItems, actionItems, searchQuery])

  // Selected item object
  const selectedItem = useMemo(() => {
    if (!selectedId) return null
    return [...milestoneItems, ...actionItems].find((i) => i.id === selectedId) || null
  }, [selectedId, milestoneItems, actionItems])

  // Group aliases for the selected item by action_type
  const aliasGroups = useMemo(() => {
    if (!selectedItem || !allAliases) return []

    if (selectedItem.kind === 'milestone') {
      const recordAliases = allAliases.filter(
        (a) => a.milestone_type_id === selectedItem.milestoneTypeId && a.action_type === 'record'
      )
      const cancelAliases = allAliases.filter(
        (a) => a.milestone_type_id === selectedItem.milestoneTypeId && a.action_type === 'cancel'
      )
      return [
        { actionType: 'record', aliases: recordAliases },
        { actionType: 'cancel', aliases: cancelAliases },
      ]
    } else {
      const filtered = allAliases.filter(
        (a) => a.action_type === selectedItem.actionType && a.milestone_type_id === null
      )
      return [{ actionType: selectedItem.actionType, aliases: filtered }]
    }
  }, [selectedItem, allAliases])

  // Delete handler
  const handleDelete = useCallback(async (aliasId: string) => {
    const supabase = createClient()
    const { error } = await voiceCommandsDAL.deleteAlias(supabase, aliasId)
    if (error) {
      showToast({ type: 'error', title: 'Failed to delete alias', message: error.message })
      return
    }
    showToast({ type: 'success', title: 'Alias deleted' })
    await refetchAliases()
  }, [showToast, refetchAliases])

  // Loading / auth gate
  const loading = userLoading || milestonesLoading
  if (loading) return <PageLoader />
  if (!isGlobalAdmin) return null
  if (milestonesError) return <ErrorBanner message={milestonesError} />

  const milestoneCount = milestoneItems.length
  const actionCount = actionItems.length

  return (
    <div>
      {/* Header banner */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
        <Globe className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-blue-800">Global Voice Templates</p>
          <p className="text-[11px] text-blue-600 mt-0.5">
            Default voice commands applied to new facilities. Changes here do not affect existing facility aliases.
          </p>
        </div>
      </div>

      <div
        className="flex border border-slate-200 rounded-xl overflow-hidden bg-white"
        style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}
      >
        {/* ==================== LEFT PANEL ==================== */}
        <div className="w-[280px] min-w-[280px] border-r border-slate-200 bg-white flex flex-col">
          {/* Search */}
          <div className="p-2.5 pb-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-slate-400" />
              <input
                type="text"
                placeholder="Search commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-2.5 pb-1.5">
            <button
              onClick={() => { setActiveTab('milestones'); setSelectedId(null) }}
              className={`px-[7px] py-[3px] text-[11px] rounded-[3px] transition-colors ${
                activeTab === 'milestones'
                  ? 'font-semibold text-slate-800 bg-slate-100'
                  : 'font-normal text-slate-500 bg-transparent hover:bg-slate-50'
              }`}
            >
              Milestones <span className="text-slate-400">({milestoneCount})</span>
            </button>
            <button
              onClick={() => { setActiveTab('actions'); setSelectedId(null) }}
              className={`px-[7px] py-[3px] text-[11px] rounded-[3px] transition-colors ${
                activeTab === 'actions'
                  ? 'font-semibold text-slate-800 bg-slate-100'
                  : 'font-normal text-slate-500 bg-transparent hover:bg-slate-50'
              }`}
            >
              Actions <span className="text-slate-400">({actionCount})</span>
            </button>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
            {visibleItems.length === 0 ? (
              <div className="px-2.5 py-6 text-center">
                <p className="text-xs text-slate-400">No matching commands</p>
              </div>
            ) : (
              visibleItems.map((item) => {
                const isSelected = selectedId === item.id
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors mb-0.5 ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'border border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.kind === 'milestone' ? (
                        <Milestone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {item.label}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ==================== RIGHT PANEL ==================== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          {selectedItem ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    {selectedItem.label}
                  </h2>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500">
                    {selectedItem.kind === 'milestone' ? 'Milestone' : 'Action'}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600 border border-blue-200">
                    Global Template
                  </span>
                </div>
              </div>

              {/* Alias detail */}
              {aliasesLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                </div>
              ) : aliasesError ? (
                <div className="p-4">
                  <ErrorBanner message={aliasesError} />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  {aliasGroups.map((group) => (
                    <AliasGroupSection
                      key={group.actionType}
                      actionType={group.actionType}
                      aliases={group.aliases}
                      milestoneTypeId={selectedItem.milestoneTypeId}
                      facilityId={null}
                      onDelete={handleDelete}
                      onAdded={refetchAliases}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Mic className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a command to view templates</p>
              <p className="text-xs text-slate-400 mt-1">
                Choose a milestone or action to manage its default voice aliases.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
