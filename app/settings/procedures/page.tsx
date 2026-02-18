// app/settings/procedures/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { useUser } from '@/lib/UserContext'
import { useSupabaseQuery, useCurrentUser } from '@/hooks/useSupabaseQuery'
import { useSurgeons } from '@/hooks/useLookups'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Plus, Search, Archive, Clock, User } from 'lucide-react'
import { ProcedureDetailPanel } from '@/components/settings/procedures/ProcedureDetailPanel'
import type { ProcedureType } from '@/components/settings/procedures/ProcedureDetailPanel'
import type { SurgeonOverride } from '@/components/settings/procedures/SurgeonOverrideList'

// =====================================================
// TYPES
// =====================================================

type FilterTab = 'all' | 'has_duration' | 'has_overrides'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'has_duration', label: 'Has Duration' },
  { key: 'has_overrides', label: 'Has Overrides' },
]

// =====================================================
// PROCEDURE SELECT QUERY
// =====================================================

const PROCEDURE_SELECT = `
  id, name, body_region_id, technique_id, procedure_category_id,
  implant_category, expected_duration_minutes, is_active, deleted_at, deleted_by,
  body_regions (id, name, display_name),
  procedure_techniques (id, name, display_name),
  procedure_categories (id, name, display_name, body_region_id)
`

// =====================================================
// COMPONENT
// =====================================================

export default function ProceduresSettingsPage() {
  const { effectiveFacilityId, loading: userLoading, can } = useUser()
  const canManage = can('settings.manage')

  const { data: currentUserData } = useCurrentUser()
  const currentUserId = currentUserData?.userId || null

  // =====================================================
  // UI STATE
  // =====================================================

  const [selectedProcId, setSelectedProcId] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'add'>('view')
  const [showArchived, setShowArchived] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

  // =====================================================
  // DATA FETCHING
  // =====================================================

  // Reference data (body regions, techniques, categories)
  const { data: refData } = useSupabaseQuery<{
    bodyRegions: { id: string; name: string; display_name: string }[]
    techniques: { id: string; name: string; display_name: string }[]
    procedureCategories: { id: string; name: string; display_name: string; body_region_id: string | null }[]
  }>(
    async (sb) => {
      const [regionsResult, techniquesResult, categoriesResult] = await Promise.all([
        sb.from('body_regions').select('id, name, display_name').order('display_name'),
        sb.from('procedure_techniques').select('id, name, display_name').order('display_name'),
        sb.from('procedure_categories').select('id, name, display_name, body_region_id').order('display_name'),
      ])
      return {
        bodyRegions: regionsResult.data || [],
        techniques: techniquesResult.data || [],
        procedureCategories: categoriesResult.data || [],
      }
    },
    { deps: [], enabled: true }
  )

  const bodyRegions = refData?.bodyRegions || []
  const techniques = refData?.techniques || []
  const procedureCategories = refData?.procedureCategories || []

  // Procedures + archived count
  const { data: procData, loading, error, setData: setProcData } = useSupabaseQuery<{
    procedures: ProcedureType[]
    archivedCount: number
  }>(
    async (sb) => {
      let procedureQuery = sb
        .from('procedure_types')
        .select(PROCEDURE_SELECT)
        .eq('facility_id', effectiveFacilityId!)

      if (showArchived) {
        procedureQuery = procedureQuery.not('deleted_at', 'is', null)
      } else {
        procedureQuery = procedureQuery.is('deleted_at', null)
      }
      procedureQuery = procedureQuery.order('name')

      const archivedCountQuery = sb
        .from('procedure_types')
        .select('id', { count: 'exact', head: true })
        .eq('facility_id', effectiveFacilityId!)
        .not('deleted_at', 'is', null)

      const [proceduresResult, archivedResult] = await Promise.all([procedureQuery, archivedCountQuery])
      if (proceduresResult.error) throw proceduresResult.error

      return {
        procedures: (proceduresResult.data as ProcedureType[]) || [],
        archivedCount: archivedResult.count || 0,
      }
    },
    { deps: [effectiveFacilityId, showArchived], enabled: !userLoading && !!effectiveFacilityId }
  )

  const procedures = procData?.procedures || []
  const archivedCount = procData?.archivedCount || 0

  // Surgeon overrides for all procedures in this facility
  const { data: allOverrides, setData: setAllOverrides } = useSupabaseQuery<SurgeonOverride[]>(
    async (sb) => {
      const { data, error: overrideError } = await sb
        .from('surgeon_procedure_duration')
        .select('id, surgeon_id, procedure_type_id, expected_duration_minutes')
        .eq('facility_id', effectiveFacilityId!)
        .is('deleted_at', null)

      if (overrideError) throw overrideError
      return data || []
    },
    { deps: [effectiveFacilityId], enabled: !userLoading && !!effectiveFacilityId }
  )

  const safeOverrides = allOverrides || []

  // Surgeons for override dropdown
  const { data: surgeons } = useSurgeons(effectiveFacilityId)
  const safeSurgeons = surgeons || []

  // =====================================================
  // DERIVED DATA
  // =====================================================

  // Count overrides per procedure for left panel badges
  const overrideCountMap = useMemo(() => {
    const map = new Map<string, number>()
    safeOverrides.forEach(o => {
      map.set(o.procedure_type_id, (map.get(o.procedure_type_id) || 0) + 1)
    })
    return map
  }, [safeOverrides])

  // Overrides for the selected procedure
  const selectedOverrides = useMemo(
    () => safeOverrides.filter(o => o.procedure_type_id === selectedProcId),
    [safeOverrides, selectedProcId]
  )

  // Selected procedure object
  const selectedProc = useMemo(
    () => procedures.find(p => p.id === selectedProcId) || null,
    [procedures, selectedProcId]
  )

  // Filter procedures by search + tab
  const filteredProcedures = useMemo(() => {
    let filtered = procedures

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q))
    }

    // Tab filter
    if (filterTab === 'has_duration') {
      filtered = filtered.filter(p => p.expected_duration_minutes != null)
    } else if (filterTab === 'has_overrides') {
      filtered = filtered.filter(p => (overrideCountMap.get(p.id) || 0) > 0)
    }

    return filtered
  }, [procedures, searchQuery, filterTab, overrideCountMap])

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: procedures.length,
    has_duration: procedures.filter(p => p.expected_duration_minutes != null).length,
    has_overrides: procedures.filter(p => (overrideCountMap.get(p.id) || 0) > 0).length,
  }), [procedures, overrideCountMap])

  // =====================================================
  // OPTIMISTIC UPDATE HELPERS
  // =====================================================

  const setProcedures = (updater: ProcedureType[] | ((prev: ProcedureType[]) => ProcedureType[])) => {
    setProcData(prev => {
      const currentProcs = prev?.procedures || []
      const newProcs = typeof updater === 'function' ? updater(currentProcs) : updater
      return { procedures: newProcs, archivedCount: prev?.archivedCount || 0 }
    })
  }

  const setArchivedCount = (updater: number | ((prev: number) => number)) => {
    setProcData(prev => {
      const currentCount = prev?.archivedCount || 0
      const newCount = typeof updater === 'function' ? updater(currentCount) : updater
      return { procedures: prev?.procedures || [], archivedCount: newCount }
    })
  }

  // =====================================================
  // DETAIL PANEL CALLBACKS
  // =====================================================

  const handleSaved = (procedure: ProcedureType, isNew: boolean) => {
    if (isNew) {
      setProcedures(prev =>
        [...prev, procedure].sort((a, b) => a.name.localeCompare(b.name))
      )
      setMode('view')
      setSelectedProcId(procedure.id)
    } else {
      setProcedures(prev =>
        prev.map(p => p.id === procedure.id ? procedure : p)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
  }

  const handleArchived = (procedureId: string) => {
    setProcedures(prev => prev.filter(p => p.id !== procedureId))
    setArchivedCount(prev => prev + 1)
    setSelectedProcId(null)
  }

  const handleRestored = (procedure: ProcedureType) => {
    setProcedures(prev => prev.filter(p => p.id !== procedure.id))
    setArchivedCount(prev => prev - 1)
    setSelectedProcId(null)
  }

  const handleOverrideAdded = (override: SurgeonOverride) => {
    setAllOverrides(prev => [...(prev || []), override])
  }

  const handleOverrideUpdated = (override: SurgeonOverride) => {
    setAllOverrides(prev => (prev || []).map(o => o.id === override.id ? override : o))
  }

  const handleOverrideRemoved = (overrideId: string) => {
    setAllOverrides(prev => (prev || []).filter(o => o.id !== overrideId))
  }

  const handleStartAdd = () => {
    setMode('add')
    setSelectedProcId(null)
  }

  const handleCancelAdd = () => {
    setMode('view')
  }

  const handleToggleArchived = () => {
    setShowArchived(!showArchived)
    setSelectedProcId(null)
    setMode('view')
    setSearchQuery('')
    setFilterTab('all')
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Procedure Types</h1>
      <p className="text-slate-500 mb-6">Manage the procedure types available at your facility.</p>

      <ErrorBanner message={error} />

      {loading || userLoading ? (
        <PageLoader message="Loading procedures..." />
      ) : !effectiveFacilityId ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">No facility selected</p>
        </div>
      ) : (
        <div
          className="flex border border-slate-200 rounded-xl overflow-hidden bg-white"
          style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}
        >
          {/* =====================================================
              LEFT PANEL — Procedure List
              ===================================================== */}
          <div className="w-[280px] min-w-[280px] border-r border-slate-200 bg-white flex flex-col">
            {/* Search */}
            <div className="p-2.5 pb-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-slate-400" />
                <input
                  type="text"
                  placeholder="Search procedures..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 rounded-[5px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            {!showArchived && (
              <div className="flex items-center gap-1 px-2.5 pb-1.5">
                {FILTER_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterTab(tab.key)}
                    className={`px-[7px] py-[3px] text-[11px] rounded-[3px] transition-colors ${
                      filterTab === tab.key
                        ? tab.key === 'has_overrides'
                          ? 'font-semibold text-purple-700 bg-purple-100'
                          : 'font-semibold text-slate-800 bg-slate-100'
                        : 'font-normal text-slate-500 bg-transparent hover:bg-slate-50'
                    }`}
                  >
                    {tab.label} <span className="text-slate-400">({tabCounts[tab.key]})</span>
                  </button>
                ))}
              </div>
            )}

            {/* Archive Toggle */}
            <div className="px-2.5 pb-1.5">
              <button
                onClick={handleToggleArchived}
                className={`inline-flex items-center gap-1 px-[7px] py-[3px] text-[11px] rounded-[3px] transition-colors ${
                  showArchived
                    ? 'font-semibold text-amber-700 bg-amber-100'
                    : 'font-normal text-slate-500 bg-transparent hover:bg-slate-50'
                }`}
              >
                <Archive className="w-3 h-3" />
                {showArchived ? 'Viewing Archived' : `Archive (${archivedCount})`}
              </button>
            </div>

            {/* Procedure List */}
            <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
              {filteredProcedures.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {searchQuery
                    ? 'No matching procedures'
                    : showArchived
                    ? 'No archived procedures'
                    : filterTab !== 'all'
                    ? `No procedures with ${filterTab === 'has_duration' ? 'duration' : 'overrides'}`
                    : 'No procedures defined'}
                </div>
              ) : (
                filteredProcedures.map(p => {
                  const overrideCount = overrideCountMap.get(p.id) || 0
                  const isSelected = selectedProcId === p.id && mode === 'view'
                  const hasDuration = p.expected_duration_minutes != null

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProcId(p.id)
                        setMode('view')
                      }}
                      className={`px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors mb-0.5 ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200'
                          : 'border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs truncate ${
                            isSelected ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                          } ${showArchived ? 'text-slate-500' : ''}`}>
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {overrideCount > 0
                              ? `${overrideCount} override${overrideCount !== 1 ? 's' : ''}`
                              : hasDuration
                              ? `${p.expected_duration_minutes} min`
                              : 'Default'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {hasDuration && (
                            <Clock className="w-[10px] h-[10px] text-blue-400" />
                          )}
                          {overrideCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              <User className="w-[10px] h-[10px] text-purple-500" />
                              <span className="text-[10px] text-purple-500 font-medium">
                                {overrideCount}
                              </span>
                            </div>
                          )}
                          {showArchived && (
                            <span className="w-[5px] h-[5px] rounded-full bg-amber-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add Button */}
            {canManage && !showArchived && (
              <div className="p-2.5 border-t border-slate-200">
                <button
                  onClick={handleStartAdd}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-[5px] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Procedure
                </button>
              </div>
            )}
          </div>

          {/* =====================================================
              RIGHT PANEL — Detail / Edit
              ===================================================== */}
          <ProcedureDetailPanel
            procedure={selectedProc}
            mode={mode}
            facilityId={effectiveFacilityId}
            canManage={canManage}
            bodyRegions={bodyRegions}
            techniques={techniques}
            procedureCategories={procedureCategories}
            surgeons={safeSurgeons}
            overrides={selectedOverrides}
            currentUserId={currentUserId}
            onSaved={handleSaved}
            onArchived={handleArchived}
            onRestored={handleRestored}
            onCancelAdd={handleCancelAdd}
            onOverrideAdded={handleOverrideAdded}
            onOverrideUpdated={handleOverrideUpdated}
            onOverrideRemoved={handleOverrideRemoved}
          />
        </div>
      )}
    </>
  )
}
