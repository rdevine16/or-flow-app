// app/settings/integrations/epic/mappings/PageClient.tsx
// Entity mapping manager — Surgeons | Rooms | Procedures tabs
// Maps Epic FHIR resources to ORbit entities with manual dropdown mapping
// Phase 5: Added Auto-Match button, suggested matches with confidence %, Accept/Reject UX

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  LayoutGrid,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  Check,
  X,
} from 'lucide-react'
import { useCurrentUser, useSurgeons, useRooms, useProcedureTypes } from '@/hooks'
import type { EpicEntityMapping, EpicMappingType } from '@/lib/epic/types'

// =====================================================
// TYPES
// =====================================================

type FilterTab = 'all' | 'mapped' | 'unmapped'

interface ConnectionInfo {
  id: string
  status: string
}

interface AutoMatchResult {
  epicResourceId: string
  epicDisplayName: string
  orbitEntityId: string
  orbitEntityName: string
  confidence: number
  action: 'auto_applied' | 'suggested' | 'skipped'
}

interface AutoMatchSummary {
  mappingType: EpicMappingType
  autoApplied: number
  suggested: number
  skipped: number
  results: AutoMatchResult[]
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function MappingStatusIcon({ mapped, suggested }: { mapped: boolean; suggested?: boolean }) {
  if (mapped) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  }
  if (suggested) {
    return <AlertCircle className="w-4 h-4 text-amber-500" />
  }
  return <XCircle className="w-4 h-4 text-red-400" />
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'text-slate-600 hover:bg-slate-50 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
        active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {count}
      </span>
    </button>
  )
}

function FilterTabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label} ({count})
    </button>
  )
}

// =====================================================
// MAPPING ROW
// =====================================================

function MappingRow({
  mapping,
  orbitEntities,
  onMap,
  saving,
  suggestion,
  onAccept,
  onReject,
}: {
  mapping: EpicEntityMapping
  orbitEntities: Array<{ id: string; label: string }>
  onMap: (mappingId: string, epicResourceId: string, orbitEntityId: string | null) => void
  saving: string | null
  suggestion?: AutoMatchResult
  onAccept?: (suggestion: AutoMatchResult) => void
  onReject?: (epicResourceId: string) => void
}) {
  const isSaving = saving === mapping.id
  const hasSuggestion = suggestion && suggestion.action === 'suggested'

  return (
    <tr className={`border-b border-slate-100 last:border-b-0 ${hasSuggestion ? 'bg-amber-50/50' : ''}`}>
      {/* Status */}
      <td className="px-4 py-3 w-10">
        <MappingStatusIcon mapped={!!mapping.orbit_entity_id} suggested={!!hasSuggestion} />
      </td>

      {/* Epic Entity */}
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {mapping.epic_display_name || mapping.epic_resource_id}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {mapping.epic_resource_type}/{mapping.epic_resource_id}
          </p>
        </div>
      </td>

      {/* Arrow */}
      <td className="px-2 py-3 w-10 text-center">
        <ArrowRight className="w-4 h-4 text-slate-300 mx-auto" />
      </td>

      {/* ORbit Entity Dropdown or Suggestion */}
      <td className="px-4 py-3">
        {hasSuggestion && !mapping.orbit_entity_id ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">
                {suggestion.orbitEntityName}
              </p>
              <p className="text-xs text-amber-600">
                {Math.round(suggestion.confidence * 100)}% match — suggested
              </p>
            </div>
            <button
              onClick={() => onAccept?.(suggestion)}
              disabled={isSaving}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-50"
              title="Accept match"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReject?.(mapping.epic_resource_id)}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
              title="Reject suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <select
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50"
              value={mapping.orbit_entity_id || ''}
              disabled={isSaving}
              onChange={(e) => {
                const value = e.target.value || null
                onMap(mapping.id, mapping.epic_resource_id, value)
              }}
            >
              <option value="">-- Select --</option>
              {orbitEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.label}
                </option>
              ))}
            </select>
            {isSaving && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
        )}
      </td>

      {/* Match info */}
      <td className="px-4 py-3 text-right">
        {mapping.match_method === 'auto' && mapping.match_confidence !== null && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
            Auto {Math.round(mapping.match_confidence * 100)}%
          </span>
        )}
        {mapping.match_method === 'manual' && mapping.orbit_entity_id && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
            Manual
          </span>
        )}
      </td>
    </tr>
  )
}

// =====================================================
// AUTO-MATCH BANNER
// =====================================================

function AutoMatchBanner({
  summary,
  onDismiss,
}: {
  summary: AutoMatchSummary
  onDismiss: () => void
}) {
  return (
    <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <span className="text-sm text-blue-800">
          <span className="font-medium">{summary.autoApplied} auto-applied</span>
          {summary.suggested > 0 && (
            <>, <span className="font-medium">{summary.suggested} suggestions</span> to review</>
          )}
          {summary.skipped > 0 && (
            <>, {summary.skipped} skipped</>
          )}
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
      >
        Dismiss
      </button>
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EntityMappingsPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const facilityId = currentUser?.facilityId

  // ORbit entity lookup hooks
  const { data: surgeons } = useSurgeons(facilityId)
  const { data: rooms } = useRooms(facilityId)
  const { data: procedures } = useProcedureTypes(facilityId)

  // State
  const [activeTab, setActiveTab] = useState<EpicMappingType>('surgeon')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [mappings, setMappings] = useState<EpicEntityMapping[]>([])
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Auto-match state
  const [autoMatching, setAutoMatching] = useState(false)
  const [autoMatchResults, setAutoMatchResults] = useState<AutoMatchSummary[]>([])
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set())

  // Fetch connection + mappings
  const fetchData = useCallback(async () => {
    if (!facilityId) return

    setLoading(true)
    try {
      // Get connection info
      const statusRes = await fetch(`/api/epic/status?facility_id=${facilityId}`)
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.connection) {
          setConnectionInfo({ id: statusData.connection.id, status: statusData.connection.status })
        }
      }

      // Get all mappings
      const mappingsRes = await fetch(`/api/epic/mappings?facility_id=${facilityId}`)
      if (mappingsRes.ok) {
        const mappingsData = await mappingsRes.json()
        setMappings(mappingsData.data || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle mapping change
  const handleMap = async (mappingId: string, epicResourceId: string, orbitEntityId: string | null) => {
    if (!facilityId || !connectionInfo) return

    const existingMapping = mappings.find(m => m.id === mappingId)
    if (!existingMapping) return

    setSaving(mappingId)

    try {
      const res = await fetch('/api/epic/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          connection_id: connectionInfo.id,
          mapping_type: existingMapping.mapping_type,
          epic_resource_type: existingMapping.epic_resource_type,
          epic_resource_id: epicResourceId,
          epic_display_name: existingMapping.epic_display_name,
          orbit_entity_id: orbitEntityId,
        }),
      })

      if (res.ok) {
        const { data: updated } = await res.json()
        setMappings(prev =>
          prev.map(m => m.id === mappingId ? updated : m)
        )
      }
    } catch {
      // Error handling via UI state
    } finally {
      setSaving(null)
    }
  }

  // Handle auto-match
  const handleAutoMatch = async () => {
    if (!facilityId) return

    setAutoMatching(true)
    setAutoMatchResults([])
    setDismissedBanners(new Set())

    try {
      const res = await fetch('/api/epic/mappings/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          mapping_type: activeTab,
        }),
      })

      if (res.ok) {
        const { data } = await res.json()
        setAutoMatchResults(data || [])

        // Refetch mappings to reflect auto-applied changes
        const mappingsRes = await fetch(`/api/epic/mappings?facility_id=${facilityId}`)
        if (mappingsRes.ok) {
          const mappingsData = await mappingsRes.json()
          setMappings(mappingsData.data || [])
        }
      }
    } catch {
      // Silently fail
    } finally {
      setAutoMatching(false)
    }
  }

  // Accept a suggestion
  const handleAcceptSuggestion = async (suggestion: AutoMatchResult) => {
    if (!facilityId || !connectionInfo) return

    const mapping = mappings.find(
      m => m.epic_resource_id === suggestion.epicResourceId && m.mapping_type === activeTab
    )
    if (!mapping) return

    setSaving(mapping.id)

    try {
      const res = await fetch('/api/epic/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_id: facilityId,
          connection_id: connectionInfo.id,
          mapping_type: activeTab,
          epic_resource_type: mapping.epic_resource_type,
          epic_resource_id: mapping.epic_resource_id,
          epic_display_name: mapping.epic_display_name,
          orbit_entity_id: suggestion.orbitEntityId,
        }),
      })

      if (res.ok) {
        const { data: updated } = await res.json()
        setMappings(prev =>
          prev.map(m => m.id === mapping.id ? updated : m)
        )
        // Remove from suggestions
        setAutoMatchResults(prev =>
          prev.map(s => ({
            ...s,
            results: s.results.filter(r => r.epicResourceId !== suggestion.epicResourceId),
            suggested: s.results.filter(r => r.epicResourceId !== suggestion.epicResourceId && r.action === 'suggested').length,
          }))
        )
      }
    } catch {
      // Error handling
    } finally {
      setSaving(null)
    }
  }

  // Reject a suggestion
  const handleRejectSuggestion = (epicResourceId: string) => {
    setAutoMatchResults(prev =>
      prev.map(s => ({
        ...s,
        results: s.results.filter(r => r.epicResourceId !== epicResourceId),
        suggested: s.results.filter(r => r.epicResourceId !== epicResourceId && r.action === 'suggested').length,
      }))
    )
  }

  // Get suggestions for the current tab
  const currentSuggestions = autoMatchResults
    .filter(s => s.mappingType === activeTab)
    .flatMap(s => s.results.filter(r => r.action === 'suggested'))

  const suggestionsMap = new Map(
    currentSuggestions.map(s => [s.epicResourceId, s])
  )

  // Filter mappings by active tab
  const tabMappings = mappings.filter(m => m.mapping_type === activeTab)
  const filteredMappings = tabMappings.filter(m => {
    if (filterTab === 'mapped') return !!m.orbit_entity_id
    if (filterTab === 'unmapped') return !m.orbit_entity_id
    return true
  })

  // Count stats
  const counts = {
    surgeon: mappings.filter(m => m.mapping_type === 'surgeon').length,
    room: mappings.filter(m => m.mapping_type === 'room').length,
    procedure: mappings.filter(m => m.mapping_type === 'procedure').length,
  }

  const mappedCount = tabMappings.filter(m => !!m.orbit_entity_id).length
  const unmappedCount = tabMappings.filter(m => !m.orbit_entity_id).length

  // Get the right ORbit entities for the active tab
  const orbitEntities: Array<{ id: string; label: string }> = (() => {
    switch (activeTab) {
      case 'surgeon':
        return (surgeons || []).map(s => ({ id: s.id, label: `${s.last_name}, ${s.first_name}` }))
      case 'room':
        return (rooms || []).map(r => ({ id: r.id, label: r.name }))
      case 'procedure':
        return (procedures || []).map(p => ({ id: p.id, label: p.name }))
    }
  })()

  // Get auto-match banner for current tab
  const currentBanner = autoMatchResults.find(s => s.mappingType === activeTab)
  const showBanner = currentBanner && !dismissedBanners.has(activeTab)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/settings/integrations/epic')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Entity Mappings</h1>
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!connectionInfo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings/integrations/epic')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Entity Mappings</h1>
            <p className="text-slate-500 text-sm">Map Epic entities to ORbit</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No Epic connection found. Connect to Epic first to manage mappings.</p>
          <button
            onClick={() => router.push('/settings/integrations/epic')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Go to Epic Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings/integrations/epic')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Entity Mappings</h1>
            <p className="text-slate-500 text-sm">Map Epic surgeons, rooms, and procedures to ORbit entities</p>
          </div>
        </div>

        {/* Auto-Match Button */}
        <button
          onClick={handleAutoMatch}
          disabled={autoMatching || unmappedCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {autoMatching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {autoMatching ? 'Matching...' : 'Auto-Match'}
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex items-center gap-2">
        <TabButton
          active={activeTab === 'surgeon'}
          onClick={() => { setActiveTab('surgeon'); setFilterTab('all') }}
          icon={Users}
          label="Surgeons"
          count={counts.surgeon}
        />
        <TabButton
          active={activeTab === 'room'}
          onClick={() => { setActiveTab('room'); setFilterTab('all') }}
          icon={LayoutGrid}
          label="Rooms"
          count={counts.room}
        />
        <TabButton
          active={activeTab === 'procedure'}
          onClick={() => { setActiveTab('procedure'); setFilterTab('all') }}
          icon={ClipboardList}
          label="Procedures"
          count={counts.procedure}
        />
      </div>

      {/* Mapping Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Filter tabs + stats */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <FilterTabButton active={filterTab === 'all'} onClick={() => setFilterTab('all')} label="All" count={tabMappings.length} />
            <FilterTabButton active={filterTab === 'mapped'} onClick={() => setFilterTab('mapped')} label="Mapped" count={mappedCount} />
            <FilterTabButton active={filterTab === 'unmapped'} onClick={() => setFilterTab('unmapped')} label="Unmapped" count={unmappedCount} />
          </div>
          <p className="text-xs text-slate-400">
            {mappedCount}/{tabMappings.length} mapped
          </p>
        </div>

        {/* Auto-Match Result Banner */}
        {showBanner && currentBanner && (
          <AutoMatchBanner
            summary={currentBanner}
            onDismiss={() => setDismissedBanners(prev => new Set([...prev, activeTab]))}
          />
        )}

        {/* Auto-matching loading overlay */}
        {autoMatching && (
          <div className="px-4 py-6">
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="w-4 h-4 bg-slate-200 rounded-full" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                  <div className="w-4 h-4 bg-slate-200 rounded" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                  <div className="w-16 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-slate-500 mt-3">Running fuzzy name matching...</p>
          </div>
        )}

        {/* Table */}
        {!autoMatching && filteredMappings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">
              {tabMappings.length === 0
                ? `No ${activeTab} entities found from Epic. Import cases first to populate entity mappings.`
                : `No ${filterTab} ${activeTab} mappings.`}
            </p>
          </div>
        ) : !autoMatching ? (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Epic Entity
                </th>
                <th className="px-2 py-2.5 w-10" />
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ORbit Entity
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  Match
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((mapping) => (
                <MappingRow
                  key={mapping.id}
                  mapping={mapping}
                  orbitEntities={orbitEntities}
                  onMap={handleMap}
                  saving={saving}
                  suggestion={suggestionsMap.get(mapping.epic_resource_id)}
                  onAccept={handleAcceptSuggestion}
                  onReject={handleRejectSuggestion}
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}
