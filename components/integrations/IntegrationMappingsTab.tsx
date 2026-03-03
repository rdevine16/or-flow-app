/**
 * IntegrationMappingsTab — shared Mappings tab for all HL7v2 integration pages.
 *
 * Shows entity mappings (surgeon/room/procedure) in a filterable table with delete actions.
 */

'use client'

import React, { useState } from 'react'
import {
  AlertCircle,
  XCircle,
  Loader2,
  Users,
  LayoutGrid,
  ClipboardList,
} from 'lucide-react'
import type { EhrIntegration, EhrEntityType } from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

export interface IntegrationMappingsTabProps {
  integration: EhrIntegration | null
  mappingTab: EhrEntityType
  setMappingTab: (tab: EhrEntityType) => void
  entityMappings: Array<{
    id: string; entity_type: string; external_identifier: string
    external_display_name: string | null; orbit_entity_id: string | null
    orbit_display_name: string | null; match_method: string; match_confidence: number | null
  }>
  loading: boolean
  onDelete: (mappingId: string) => Promise<void>
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function IntegrationMappingsTab({
  integration,
  mappingTab,
  setMappingTab,
  entityMappings,
  loading,
  onDelete,
}: IntegrationMappingsTabProps) {
  const [deleting, setDeleting] = useState<string | null>(null)

  if (!integration) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Set up the integration first to manage entity mappings.</p>
      </div>
    )
  }

  const tabConfig: Array<{ type: EhrEntityType; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { type: 'surgeon', icon: Users, label: 'Surgeons' },
    { type: 'room', icon: LayoutGrid, label: 'Rooms' },
    { type: 'procedure', icon: ClipboardList, label: 'Procedures' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {tabConfig.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => setMappingTab(type)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mappingTab === type
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : entityMappings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">No {mappingTab} mappings yet. Mappings are created when messages are processed or entities are resolved.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">External</th>
                <th className="px-2 py-2.5 w-10" />
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ORbit Entity</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Match</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {entityMappings.map(mapping => (
                <tr key={mapping.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{mapping.external_display_name || mapping.external_identifier}</p>
                    <p className="text-xs text-slate-400">{mapping.external_identifier}</p>
                  </td>
                  <td className="px-2 py-3 text-center"><span className="text-slate-300">&rarr;</span></td>
                  <td className="px-4 py-3"><p className="text-sm text-slate-900">{mapping.orbit_display_name || '\u2014'}</p></td>
                  <td className="px-4 py-3">
                    {mapping.match_method === 'auto' && mapping.match_confidence !== null && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
                        Auto {Math.round(mapping.match_confidence * 100)}%
                      </span>
                    )}
                    {mapping.match_method === 'manual' && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => { setDeleting(mapping.id); await onDelete(mapping.id); setDeleting(null) }}
                      disabled={deleting === mapping.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      title="Remove mapping"
                    >
                      {deleting === mapping.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
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
