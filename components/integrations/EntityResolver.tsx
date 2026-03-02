/**
 * EntityResolver
 *
 * Generic inline entity creation/mapping component used in the Review Queue.
 * Handles surgeons, procedures, and rooms — shows suggestions, search, and "Create New" form.
 */

'use client'

import { useState } from 'react'
import {
  Check,
  Plus,
  Search,
  User,
  Scissors,
  MapPin,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react'
import type { EntitySuggestion, EhrEntityType } from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

interface EntityResolverProps {
  entityType: EhrEntityType
  unmatchedName: string
  unmatchedIdentifier?: string // NPI for surgeon, CPT for procedure
  suggestions: EntitySuggestion[]
  existingEntities: Array<{ id: string; label: string }>
  onMap: (orbitEntityId: string, orbitDisplayName: string) => Promise<void>
  onCreate: (formData: CreateEntityData) => Promise<string | null> // returns new entity ID
  resolved?: boolean
}

export interface CreateEntityData {
  entityType: EhrEntityType
  name: string
  npi?: string
  specialty?: string
  cptCode?: string
}

// =====================================================
// HELPERS
// =====================================================

const entityConfig = {
  surgeon: { icon: User, label: 'Surgeon', color: 'red', badgeColor: 'bg-red-100 text-red-700 border-red-200' },
  procedure: { icon: Scissors, label: 'Procedure', color: 'orange', badgeColor: 'bg-orange-100 text-orange-700 border-orange-200' },
  room: { icon: MapPin, label: 'Room', color: 'yellow', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const

// =====================================================
// COMPONENT
// =====================================================

export default function EntityResolver({
  entityType,
  unmatchedName,
  unmatchedIdentifier,
  suggestions,
  existingEntities,
  onMap,
  onCreate,
  resolved,
}: EntityResolverProps) {
  const [mode, setMode] = useState<'suggestions' | 'search' | 'create'>('suggestions')
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [createForm, setCreateForm] = useState<CreateEntityData>({
    entityType,
    name: unmatchedName,
    npi: entityType === 'surgeon' ? unmatchedIdentifier : undefined,
    cptCode: entityType === 'procedure' ? unmatchedIdentifier : undefined,
  })

  const config = entityConfig[entityType]
  const Icon = config.icon

  if (resolved) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
        <Check className="w-4 h-4 text-emerald-600" />
        <span className="text-sm text-emerald-700 font-medium">{config.label} resolved</span>
      </div>
    )
  }

  const handleMap = async (entityId: string, displayName: string) => {
    setSaving(true)
    try {
      await onMap(entityId, displayName)
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const newId = await onCreate(createForm)
      if (newId) {
        await onMap(newId, createForm.name)
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredEntities = searchQuery.trim()
    ? existingEntities.filter(e => e.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : existingEntities.slice(0, 10)

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.badgeColor}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          <span className="text-sm text-slate-700 font-medium">{unmatchedName}</span>
          {unmatchedIdentifier && (
            <span className="text-xs text-slate-400">({unmatchedIdentifier})</span>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100">
        <button
          onClick={() => setMode('suggestions')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            mode === 'suggestions' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3 h-3 inline mr-1" />
          Suggestions ({suggestions.length})
        </button>
        <button
          onClick={() => setMode('search')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            mode === 'search' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Search className="w-3 h-3 inline mr-1" />
          Search
        </button>
        <button
          onClick={() => setMode('create')}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            mode === 'create' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Plus className="w-3 h-3 inline mr-1" />
          Create New
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Suggestions */}
        {mode === 'suggestions' && (
          <div className="space-y-1.5">
            {suggestions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No automatic suggestions available. Search or create new.</p>
            ) : (
              suggestions.map(s => (
                <div key={s.orbit_entity_id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.orbit_display_name}</p>
                    <p className="text-xs text-slate-500">
                      {Math.round(s.confidence * 100)}% match — {s.match_reason}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMap(s.orbit_entity_id, s.orbit_display_name)}
                    disabled={saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Map
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search existing */}
        {mode === 'search' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${config.label.toLowerCase()}s...`}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredEntities.map(e => (
                <button
                  key={e.id}
                  onClick={() => handleMap(e.id, e.label)}
                  disabled={saving}
                  className="w-full flex items-center justify-between p-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span>{e.label}</span>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-slate-300" />}
                </button>
              ))}
              {filteredEntities.length === 0 && (
                <p className="text-xs text-slate-400 py-2 text-center">No matches found</p>
              )}
            </div>
          </div>
        )}

        {/* Create new */}
        {mode === 'create' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
              />
            </div>

            {entityType === 'surgeon' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">NPI</label>
                  <input
                    type="text"
                    value={createForm.npi || ''}
                    onChange={e => setCreateForm(prev => ({ ...prev, npi: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Specialty</label>
                  <input
                    type="text"
                    value={createForm.specialty || ''}
                    onChange={e => setCreateForm(prev => ({ ...prev, specialty: e.target.value }))}
                    placeholder="e.g., Orthopedics"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
              </>
            )}

            {entityType === 'procedure' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CPT Code</label>
                <input
                  type="text"
                  value={createForm.cptCode || ''}
                  onChange={e => setCreateForm(prev => ({ ...prev, cptCode: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={saving || !createForm.name.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Create & Map
              </button>
              <button
                onClick={() => setMode('suggestions')}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-3 h-3 inline mr-1" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
