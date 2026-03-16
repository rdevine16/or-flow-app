// app/settings/integrations/epic/mappings/PageClient.tsx
// HL7v2 Entity mapping manager — Surgeons | Rooms | Procedures sub-tabs
// Data from ehr_entity_mappings table (replaces FHIR epic_entity_mappings)

'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { useCurrentUser } from '@/hooks'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrDAL } from '@/lib/dal/ehr'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import AccessDenied from '@/components/ui/AccessDenied'
import type {
  EhrIntegration,
  EhrEntityMapping,
  EhrEntityType,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

type FilterTab = 'all' | 'mapped' | 'unmapped'

// =====================================================
// SUB-COMPONENTS
// =====================================================

function MappingStatusIcon({ mapped }: { mapped: boolean }) {
  if (mapped) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  return <XCircle className="w-4 h-4 text-red-400" />
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  )
}

function FilterTabButton({
  active, onClick, label, count,
}: {
  active: boolean; onClick: () => void; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label} ({count})
    </button>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EntityMappingsPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const { can, loading: permLoading } = useUser()
  const facilityId = currentUser?.facilityId

  const [activeTab, setActiveTab] = useState<EhrEntityType>('surgeon')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Get integration
  const { data: integration, loading: integrationLoading } = useSupabaseQuery<EhrIntegration | null>(
    async (supabase) => {
      const { data } = await ehrDAL.getIntegrationByFacility(supabase, facilityId!, 'epic_hl7v2')
      return data
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Get all mappings for the integration
  const {
    data: allMappings,
    loading: mappingsLoading,
    refetch: refetchMappings,
  } = useSupabaseQuery<EhrEntityMapping[]>(
    async (supabase) => {
      if (!integration) return []
      const { data } = await ehrDAL.listEntityMappings(supabase, integration.id)
      return data
    },
    { deps: [integration?.id], enabled: !!integration }
  )

  const mappings = allMappings || []
  const loading = integrationLoading || mappingsLoading

  // Delete a mapping
  const handleDelete = async (mappingId: string) => {
    setDeleting(mappingId)
    try {
      const supabase = createClient()
      await ehrDAL.deleteEntityMapping(supabase, mappingId)
      refetchMappings()
    } finally {
      setDeleting(null)
    }
  }

  // Filter mappings
  const tabMappings = mappings.filter(m => m.entity_type === activeTab)
  const filteredMappings = tabMappings.filter(m => {
    if (filterTab === 'mapped') return !!m.orbit_entity_id
    if (filterTab === 'unmapped') return !m.orbit_entity_id
    return true
  })

  const counts = {
    surgeon: mappings.filter(m => m.entity_type === 'surgeon').length,
    room: mappings.filter(m => m.entity_type === 'room').length,
    procedure: mappings.filter(m => m.entity_type === 'procedure').length,
  }

  const mappedCount = tabMappings.filter(m => !!m.orbit_entity_id).length
  const unmappedCount = tabMappings.filter(m => !m.orbit_entity_id).length

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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!can('integrations.view')) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Entity Mappings</h1>
        <p className="text-slate-500 mb-6">Map HL7v2 entities to ORbit</p>
        <AccessDenied />
      </>
    )
  }

  if (!integration) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/settings/integrations/epic')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Entity Mappings</h1>
            <p className="text-slate-500 text-sm">Map HL7v2 entities to ORbit</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No HL7v2 integration found. Set up the integration first to manage mappings.</p>
          <button
            onClick={() => router.push('/settings/integrations/epic')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Go to Integration Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings/integrations/epic')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Entity Mappings</h1>
          <p className="text-slate-500 text-sm">HL7v2 entity mappings (Epic &rarr; ORbit)</p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex items-center gap-2">
        <TabButton active={activeTab === 'surgeon'} onClick={() => { setActiveTab('surgeon'); setFilterTab('all') }} icon={Users} label="Surgeons" count={counts.surgeon} />
        <TabButton active={activeTab === 'room'} onClick={() => { setActiveTab('room'); setFilterTab('all') }} icon={LayoutGrid} label="Rooms" count={counts.room} />
        <TabButton active={activeTab === 'procedure'} onClick={() => { setActiveTab('procedure'); setFilterTab('all') }} icon={ClipboardList} label="Procedures" count={counts.procedure} />
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
          <p className="text-xs text-slate-400">{mappedCount}/{tabMappings.length} mapped</p>
        </div>

        {/* Table */}
        {filteredMappings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">
              {tabMappings.length === 0
                ? `No ${activeTab} mappings yet. Mappings are created when HL7v2 messages are processed or entities are resolved in the review queue.`
                : `No ${filterTab} ${activeTab} mappings.`}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">External Entity</th>
                <th className="px-2 py-2.5 w-10" />
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ORbit Entity</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Match</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {filteredMappings.map((mapping) => (
                <tr key={mapping.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 w-10">
                    <MappingStatusIcon mapped={!!mapping.orbit_entity_id} />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{mapping.external_display_name || mapping.external_identifier}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{mapping.external_identifier}</p>
                    </div>
                  </td>
                  <td className="px-2 py-3 w-10 text-center">
                    <ArrowRight className="w-4 h-4 text-slate-300 mx-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900">{mapping.orbit_display_name || '\u2014'}</p>
                    {mapping.orbit_entity_id && (
                      <p className="text-xs text-slate-400 mt-0.5">{mapping.orbit_entity_id.substring(0, 8)}...</p>
                    )}
                  </td>
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
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(mapping.id)}
                      disabled={deleting === mapping.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      title="Remove mapping"
                    >
                      {deleting === mapping.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
