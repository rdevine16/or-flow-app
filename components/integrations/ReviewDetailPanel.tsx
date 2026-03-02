/**
 * ReviewDetailPanel
 *
 * 3-column entity mapping layout for reviewing pending HL7v2 imports.
 * Shows: Epic data (left) → arrow (center) → ORbit mapping (right)
 * for ALL entities — matched AND unmatched — in a single table.
 *
 * Entity states:
 * - Unmatched: review_notes.unmatched_<entity> → EntitySelector dropdown
 * - Auto-matched: mapping found in ehr_entity_mappings → ORbit name + "Change" button
 * - Case override: review_notes.matched_<entity> → ORbit name + blue badge + "Change"
 * - No mapping: no unmatched entry + no mapping → EntitySelector dropdown
 */

'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  User,
  Scissors,
  MapPin,
  UserCircle,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react'
import HL7MessageViewer from '@/components/integrations/HL7MessageViewer'
import type {
  EhrIntegrationLog,
  EhrEntityType,
  EhrEntityMapping,
  ReviewNotes,
  EntitySuggestion,
} from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

export interface CreateEntityData {
  entityType: EhrEntityType
  name: string
  npi?: string
  specialty?: string
  cptCode?: string
}

export interface ReviewDetailPanelProps {
  entry: EhrIntegrationLog
  allSurgeons: Array<{ id: string; label: string }>
  allProcedures: Array<{ id: string; label: string }>
  allRooms: Array<{ id: string; label: string }>
  entityMappings: EhrEntityMapping[]
  onResolveEntity: (
    entry: EhrIntegrationLog,
    entityType: EhrEntityType,
    externalId: string,
    externalName: string,
    orbitId: string,
    orbitName: string,
  ) => Promise<void>
  onRemapCaseOnly: (
    entry: EhrIntegrationLog,
    entityType: EhrEntityType,
    orbitId: string,
    orbitName: string,
  ) => Promise<void>
  onCreateEntity: (formData: CreateEntityData) => Promise<string | null>
  onPhiAccess: (logEntryId: string, messageType: string) => void
}

// =====================================================
// PARSED DATA SHAPE (from buildParsedData in case-import-service)
// =====================================================

interface ParsedSurgeon {
  id: string
  npi: string
  name: string
}

interface ParsedProcedure {
  cptCode: string
  name: string
}

interface ParsedRoom {
  code: string
  name: string
}

interface ParsedPatient {
  mrn: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: string
}

// =====================================================
// ENTITY ROW CONFIG
// =====================================================

const entityConfig = {
  surgeon: {
    icon: User,
    label: 'Surgeon',
    unmatchedColor: 'text-red-600 bg-red-50 border-red-200',
    matchedColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  procedure: {
    icon: Scissors,
    label: 'Procedure',
    unmatchedColor: 'text-orange-600 bg-orange-50 border-orange-200',
    matchedColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  room: {
    icon: MapPin,
    label: 'Room',
    unmatchedColor: 'text-amber-600 bg-amber-50 border-amber-200',
    matchedColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  patient: {
    icon: UserCircle,
    label: 'Patient',
    unmatchedColor: 'text-slate-600 bg-slate-50 border-slate-200',
    matchedColor: 'text-slate-600 bg-slate-50 border-slate-200',
  },
} as const

// =====================================================
// ENTITY MATCH STATE
// =====================================================

export type EntityMatchState =
  | 'unmatched'       // review_notes.unmatched_<entity> exists
  | 'auto_matched'    // mapping found in ehr_entity_mappings
  | 'case_override'   // review_notes.matched_<entity> exists
  | 'no_mapping'      // no unmatched + no mapping found

// =====================================================
// EXPORTED HELPERS (used by ImportReviewDrawer + list rows)
// =====================================================

/** Determine match state for a single entity given review notes + mapping lookup */
export function getEntityMatchState(
  entityType: 'surgeon' | 'procedure' | 'room',
  reviewNotes: ReviewNotes | null,
  mapping: EhrEntityMapping | undefined,
): EntityMatchState {
  const matchedKey = `matched_${entityType}` as keyof ReviewNotes
  if (reviewNotes?.[matchedKey]) return 'case_override'
  if (reviewNotes?.[`unmatched_${entityType}` as keyof ReviewNotes]) return 'unmatched'
  if (mapping?.orbit_entity_id) return 'auto_matched'
  return 'no_mapping'
}

/** Find the entity mapping for a given entity from the list of all mappings */
export function findEntityMapping(
  entityType: 'surgeon' | 'procedure' | 'room',
  identifiers: string[],
  entityMappings: EhrEntityMapping[],
): EhrEntityMapping | undefined {
  for (const id of identifiers) {
    if (!id) continue
    const mapping = entityMappings.find(
      m => m.entity_type === entityType && m.external_identifier === id,
    )
    if (mapping) return mapping
  }
  return undefined
}

/** Check if an entry has unresolved entities that block approval */
export function computeHasUnresolved(
  entry: EhrIntegrationLog,
  entityMappings: EhrEntityMapping[],
): boolean {
  const parsed = entry.parsed_data as Record<string, unknown> | null
  const reviewNotes = entry.review_notes as ReviewNotes | null

  const epicSurgeon = parsed?.surgeon as { npi?: string; name?: string } | null
  const epicProcedure = parsed?.procedure as { cptCode?: string; name?: string } | null
  const epicRoom = parsed?.room as { code?: string; name?: string } | null

  const surgeonMapping = epicSurgeon
    ? findEntityMapping('surgeon', [epicSurgeon.npi || '', epicSurgeon.name || ''], entityMappings)
    : undefined
  const procedureMapping = epicProcedure
    ? findEntityMapping('procedure', [epicProcedure.cptCode || '', epicProcedure.name || ''], entityMappings)
    : undefined
  const roomMapping = epicRoom
    ? findEntityMapping('room', [epicRoom.code || '', epicRoom.name || ''], entityMappings)
    : undefined

  const surgeonState = getEntityMatchState('surgeon', reviewNotes, surgeonMapping)
  const procedureState = getEntityMatchState('procedure', reviewNotes, procedureMapping)

  return surgeonState === 'unmatched' || surgeonState === 'no_mapping'
    || procedureState === 'unmatched' || procedureState === 'no_mapping'
    || !!reviewNotes?.demographics_mismatch
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function ReviewDetailPanel({
  entry,
  allSurgeons,
  allProcedures,
  allRooms,
  entityMappings,
  onResolveEntity,
  onRemapCaseOnly,
  onCreateEntity,
  onPhiAccess,
}: ReviewDetailPanelProps) {
  const [hl7Expanded, setHl7Expanded] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const parsed = entry.parsed_data as Record<string, unknown> | null
  const reviewNotes = entry.review_notes as ReviewNotes | null

  // Extract parsed entity data
  const epicSurgeon = parsed?.surgeon as ParsedSurgeon | null
  const epicProcedure = parsed?.procedure as ParsedProcedure | null
  const epicRoom = parsed?.room as ParsedRoom | null
  const epicPatient = parsed?.patient as ParsedPatient | null

  // Build mapping lookup: Map<"entityType:externalIdentifier", EhrEntityMapping>
  const mappingLookup = useMemo(() => {
    const map = new Map<string, EhrEntityMapping>()
    for (const m of entityMappings) {
      map.set(`${m.entity_type}:${m.external_identifier}`, m)
    }
    return map
  }, [entityMappings])

  // Lookup mapping for each entity
  const surgeonMapping = epicSurgeon
    ? mappingLookup.get(`surgeon:${epicSurgeon.npi}`) || mappingLookup.get(`surgeon:${epicSurgeon.name}`)
    : undefined
  const procedureMapping = epicProcedure
    ? mappingLookup.get(`procedure:${epicProcedure.cptCode}`) || mappingLookup.get(`procedure:${epicProcedure.name}`)
    : undefined
  const roomMapping = epicRoom
    ? mappingLookup.get(`room:${epicRoom.code}`) || mappingLookup.get(`room:${epicRoom.name}`)
    : undefined

  // Determine match state for each entity (uses exported helper)
  const surgeonState = getEntityMatchState('surgeon', reviewNotes, surgeonMapping)
  const procedureState = getEntityMatchState('procedure', reviewNotes, procedureMapping)
  const roomState = getEntityMatchState('room', reviewNotes, roomMapping)

  // Header data
  const patientName = epicPatient
    ? `${epicPatient.lastName}, ${epicPatient.firstName}`
    : 'Unknown Patient'
  // Parse date/time directly from string to avoid UTC misinterpretation
  const scheduledDate = (() => {
    const raw = parsed?.scheduledStart as string | undefined
    if (!raw) return 'Unknown'
    const [datePart, timePart] = raw.split('T')
    if (!datePart) return 'Unknown'
    const [y, m, d] = datePart.split('-').map(Number)
    let result = `${m}/${d}/${y}`
    if (timePart) {
      const [hStr, minStr] = timePart.split(':')
      const h = parseInt(hStr, 10)
      const min = minStr || '00'
      const ampm = h >= 12 ? 'pm' : 'am'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      result += ` ${h12}:${min}${ampm}`
    }
    return result
  })()
  const caseId = (parsed?.externalCaseId as string) || 'N/A'

  // Map handler (global mapping — upserts ehr_entity_mappings)
  const handleMap = async (
    entityType: EhrEntityType,
    externalId: string,
    externalName: string,
    orbitId: string,
    orbitName: string,
  ) => {
    setResolving(entityType)
    try {
      await onResolveEntity(entry, entityType, externalId, externalName, orbitId, orbitName)
    } finally {
      setResolving(null)
    }
  }

  // Case-only remap handler
  const handleRemapCaseOnly = async (
    entityType: EhrEntityType,
    orbitId: string,
    orbitName: string,
  ) => {
    setResolving(entityType)
    try {
      await onRemapCaseOnly(entry, entityType, orbitId, orbitName)
    } finally {
      setResolving(null)
    }
  }

  // Create + map handler
  const handleCreateAndMap = async (
    entityType: EhrEntityType,
    externalId: string,
    externalName: string,
    formData: CreateEntityData,
  ) => {
    setResolving(entityType)
    try {
      const newId = await onCreateEntity(formData)
      if (newId) {
        await onResolveEntity(entry, entityType, externalId, externalName, newId, formData.name)
      }
    } finally {
      setResolving(null)
    }
  }

  const handleHl7Expand = () => {
    setHl7Expanded(true)
    onPhiAccess(entry.id, entry.message_type)
  }

  // Get the display name for an auto-matched or case-overridden entity
  const getOrbitDisplayName = (
    entityType: 'surgeon' | 'procedure' | 'room',
    state: EntityMatchState,
    mapping: EhrEntityMapping | undefined,
  ): string => {
    if (state === 'case_override') {
      const override = reviewNotes?.[`matched_${entityType}` as keyof ReviewNotes] as
        { orbit_entity_id: string; orbit_display_name: string } | undefined
      return override?.orbit_display_name || 'Unknown'
    }
    if (state === 'auto_matched' && mapping) {
      return mapping.orbit_display_name || 'Unknown'
    }
    return ''
  }

  return (
    <div className="border-t border-slate-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{patientName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">{entry.message_type}</span>
              <span className="text-xs text-slate-300">|</span>
              <span className="text-xs text-slate-500">Case: {caseId}</span>
              <span className="text-xs text-slate-300">|</span>
              <span className="text-xs text-slate-500">{scheduledDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Entity Mapping Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_40px_1fr] bg-slate-50 border-b border-slate-200 px-4 py-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Epic (Incoming)</span>
          <span />
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ORbit (Maps To)</span>
        </div>

        {/* Surgeon Row */}
        <EntityMappingRow
          entityType="surgeon"
          epicName={epicSurgeon?.name || 'Unknown'}
          epicIdentifier={epicSurgeon?.npi}
          epicIdentifierLabel="NPI"
          matchState={surgeonState}
          orbitDisplayName={getOrbitDisplayName('surgeon', surgeonState, surgeonMapping)}
          suggestions={reviewNotes?.unmatched_surgeon?.suggestions || []}
          allEntities={allSurgeons}
          resolving={resolving === 'surgeon'}
          onMap={(orbitId, orbitName) =>
            handleMap(
              'surgeon',
              epicSurgeon?.npi || epicSurgeon?.name || '',
              epicSurgeon?.name || '',
              orbitId,
              orbitName,
            )
          }
          onRemapCaseOnly={(orbitId, orbitName) =>
            handleRemapCaseOnly('surgeon', orbitId, orbitName)
          }
          onRemapAllFuture={(orbitId, orbitName) =>
            handleMap(
              'surgeon',
              epicSurgeon?.npi || epicSurgeon?.name || '',
              epicSurgeon?.name || '',
              orbitId,
              orbitName,
            )
          }
          onCreateAndMap={(formData) =>
            handleCreateAndMap(
              'surgeon',
              epicSurgeon?.npi || epicSurgeon?.name || '',
              epicSurgeon?.name || '',
              formData,
            )
          }
          defaultCreateData={{
            entityType: 'surgeon',
            name: epicSurgeon?.name || '',
            npi: epicSurgeon?.npi,
          }}
        />

        {/* Procedure Row */}
        <EntityMappingRow
          entityType="procedure"
          epicName={epicProcedure?.name || 'Unknown'}
          epicIdentifier={epicProcedure?.cptCode}
          epicIdentifierLabel="CPT"
          matchState={procedureState}
          orbitDisplayName={getOrbitDisplayName('procedure', procedureState, procedureMapping)}
          suggestions={reviewNotes?.unmatched_procedure?.suggestions || []}
          allEntities={allProcedures}
          resolving={resolving === 'procedure'}
          onMap={(orbitId, orbitName) =>
            handleMap(
              'procedure',
              epicProcedure?.cptCode || epicProcedure?.name || '',
              epicProcedure?.name || '',
              orbitId,
              orbitName,
            )
          }
          onRemapCaseOnly={(orbitId, orbitName) =>
            handleRemapCaseOnly('procedure', orbitId, orbitName)
          }
          onRemapAllFuture={(orbitId, orbitName) =>
            handleMap(
              'procedure',
              epicProcedure?.cptCode || epicProcedure?.name || '',
              epicProcedure?.name || '',
              orbitId,
              orbitName,
            )
          }
          onCreateAndMap={(formData) =>
            handleCreateAndMap(
              'procedure',
              epicProcedure?.cptCode || epicProcedure?.name || '',
              epicProcedure?.name || '',
              formData,
            )
          }
          defaultCreateData={{
            entityType: 'procedure',
            name: epicProcedure?.name || '',
            cptCode: epicProcedure?.cptCode,
          }}
        />

        {/* Room Row */}
        <EntityMappingRow
          entityType="room"
          epicName={epicRoom?.name || epicRoom?.code || 'Unknown'}
          epicIdentifier={epicRoom?.code && epicRoom?.name ? epicRoom.code : undefined}
          epicIdentifierLabel="Code"
          matchState={roomState}
          orbitDisplayName={getOrbitDisplayName('room', roomState, roomMapping)}
          suggestions={reviewNotes?.unmatched_room?.suggestions || []}
          allEntities={allRooms}
          resolving={resolving === 'room'}
          onMap={(orbitId, orbitName) =>
            handleMap(
              'room',
              epicRoom?.code || epicRoom?.name || '',
              epicRoom?.name || epicRoom?.code || '',
              orbitId,
              orbitName,
            )
          }
          onRemapCaseOnly={(orbitId, orbitName) =>
            handleRemapCaseOnly('room', orbitId, orbitName)
          }
          onRemapAllFuture={(orbitId, orbitName) =>
            handleMap(
              'room',
              epicRoom?.code || epicRoom?.name || '',
              epicRoom?.name || epicRoom?.code || '',
              orbitId,
              orbitName,
            )
          }
          onCreateAndMap={(formData) =>
            handleCreateAndMap(
              'room',
              epicRoom?.code || epicRoom?.name || '',
              epicRoom?.name || epicRoom?.code || '',
              formData,
            )
          }
          defaultCreateData={{
            entityType: 'room',
            name: epicRoom?.name || epicRoom?.code || '',
          }}
        />

        {/* Patient Row (info only — ORbit doesn't manage patients) */}
        <div className="grid grid-cols-[1fr_40px_1fr] items-center px-4 py-3 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${entityConfig.patient.matchedColor}`}>
              <UserCircle className="w-3 h-3" />
              Patient
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {epicPatient ? `${epicPatient.lastName}, ${epicPatient.firstName}` : 'Unknown'}
              </p>
              {epicPatient?.mrn && (
                <p className="text-xs text-slate-400">MRN: {epicPatient.mrn}</p>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-700">
              {epicPatient ? `${epicPatient.firstName} ${epicPatient.lastName}` : 'Unknown'}
            </span>
            <span className="text-xs text-slate-400">Matched by MRN on import</span>
          </div>
        </div>
      </div>

      {/* Demographics Mismatch */}
      {reviewNotes?.demographics_mismatch && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-800">Demographics Mismatch</p>
            <p className="text-xs text-purple-600">
              {reviewNotes.demographics_mismatch.field}: expected &quot;{reviewNotes.demographics_mismatch.expected}&quot;,
              received &quot;{reviewNotes.demographics_mismatch.received}&quot;
            </p>
          </div>
        </div>
      )}

      {/* Collapsible HL7 Message Viewer */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => {
            if (!hl7Expanded) handleHl7Expand()
            else setHl7Expanded(false)
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          {hl7Expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">View Full HL7 Message</span>
        </button>
        {hl7Expanded && (
          <HL7MessageViewer
            rawMessage={entry.raw_message}
            parsedData={entry.parsed_data}
          />
        )}
      </div>

    </div>
  )
}

// =====================================================
// ENTITY MAPPING ROW
// =====================================================

interface EntityMappingRowProps {
  entityType: EhrEntityType
  epicName: string
  epicIdentifier?: string
  epicIdentifierLabel?: string
  matchState: EntityMatchState
  orbitDisplayName: string
  suggestions: EntitySuggestion[]
  allEntities: Array<{ id: string; label: string }>
  resolving: boolean
  onMap: (orbitEntityId: string, orbitDisplayName: string) => Promise<void>
  onRemapCaseOnly: (orbitId: string, orbitName: string) => Promise<void>
  onRemapAllFuture: (orbitId: string, orbitName: string) => Promise<void>
  onCreateAndMap: (formData: CreateEntityData) => Promise<void>
  defaultCreateData: CreateEntityData
}

function EntityMappingRow({
  entityType,
  epicName,
  epicIdentifier,
  epicIdentifierLabel,
  matchState,
  orbitDisplayName,
  suggestions,
  allEntities,
  resolving,
  onMap,
  onRemapCaseOnly,
  onRemapAllFuture,
  onCreateAndMap,
  defaultCreateData,
}: EntityMappingRowProps) {
  const config = entityConfig[entityType]
  const Icon = config.icon
  const [showRemapSelector, setShowRemapSelector] = useState(false)

  const isUnresolved = matchState === 'unmatched' || matchState === 'no_mapping'

  return (
    <div className="grid grid-cols-[1fr_40px_1fr] items-start px-4 py-3 border-t border-slate-100">
      {/* Left: Epic data */}
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ${
            isUnresolved ? config.unmatchedColor : config.matchedColor
          }`}
        >
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        <div>
          <p className="text-sm font-medium text-slate-900">{epicName}</p>
          {epicIdentifier && (
            <p className="text-xs text-slate-400">
              {epicIdentifierLabel}: {epicIdentifier}
            </p>
          )}
          {matchState === 'unmatched' && (
            <p className="text-xs text-red-500 mt-0.5">Needs mapping</p>
          )}
          {matchState === 'no_mapping' && (
            <p className="text-xs text-amber-500 mt-0.5">No mapping found</p>
          )}
        </div>
      </div>

      {/* Center: Arrow */}
      <div className="flex justify-center pt-1">
        <ArrowRight className="w-4 h-4 text-slate-300" />
      </div>

      {/* Right: ORbit mapping */}
      <div>
        {/* UNMATCHED or NO_MAPPING: show entity selector */}
        {isUnresolved && !showRemapSelector && (
          <EntitySelector
            entityType={entityType}
            suggestions={suggestions}
            allEntities={allEntities}
            resolving={resolving}
            onSelect={onMap}
            onCreateAndMap={onCreateAndMap}
            defaultCreateData={defaultCreateData}
          />
        )}

        {/* AUTO-MATCHED: show ORbit name + green badge + Change */}
        {matchState === 'auto_matched' && !showRemapSelector && (
          <div className="flex items-center gap-2 py-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-700">{orbitDisplayName}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                Auto-matched
              </span>
              <button
                onClick={() => setShowRemapSelector(true)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Change
              </button>
            </div>
          </div>
        )}

        {/* CASE_OVERRIDE: show ORbit name + blue badge + Change */}
        {matchState === 'case_override' && !showRemapSelector && (
          <div className="flex items-center gap-2 py-1">
            <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-700">{orbitDisplayName}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded">
                Case override
              </span>
              <button
                onClick={() => setShowRemapSelector(true)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Change
              </button>
            </div>
          </div>
        )}

        {/* REMAP SELECTOR: shown when user clicks "Change" */}
        {showRemapSelector && (
          <RemapSelector
            entityType={entityType}
            allEntities={allEntities}
            resolving={resolving}
            onSelectCaseOnly={async (id, name) => {
              await onRemapCaseOnly(id, name)
              setShowRemapSelector(false)
            }}
            onSelectAllFuture={async (id, name) => {
              await onRemapAllFuture(id, name)
              setShowRemapSelector(false)
            }}
            onCancel={() => setShowRemapSelector(false)}
          />
        )}
      </div>
    </div>
  )
}

// =====================================================
// REMAP SELECTOR (choose entity + scope: this case or all future)
// =====================================================

interface RemapSelectorProps {
  entityType: EhrEntityType
  allEntities: Array<{ id: string; label: string }>
  resolving: boolean
  onSelectCaseOnly: (entityId: string, displayName: string) => Promise<void>
  onSelectAllFuture: (entityId: string, displayName: string) => Promise<void>
  onCancel: () => void
}

function RemapSelector({
  entityType,
  allEntities,
  resolving,
  onSelectCaseOnly,
  onSelectAllFuture,
  onCancel,
}: RemapSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; label: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredEntities = searchQuery.trim()
    ? allEntities.filter(e => e.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : allEntities

  if (resolving) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-slate-500">Updating mapping...</span>
      </div>
    )
  }

  // Step 2: After selecting an entity, show scope choice
  if (selectedEntity) {
    return (
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-xs text-slate-500">
          Map to <span className="font-medium text-slate-700">{selectedEntity.label}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectCaseOnly(selectedEntity.id, selectedEntity.label)}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            This case only
          </button>
          <button
            onClick={() => onSelectAllFuture(selectedEntity.id, selectedEntity.label)}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
          >
            All future matches
          </button>
          <button
            onClick={() => setSelectedEntity(null)}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  // Step 1: Entity search/selection
  return (
    <div ref={dropdownRef} className="border border-blue-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/50 border-b border-blue-100">
        <span className="text-xs font-medium text-blue-700">Change {entityConfig[entityType].label.toLowerCase()}</span>
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${entityConfig[entityType].label.toLowerCase()}s...`}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filteredEntities.map(e => (
          <button
            key={e.id}
            onClick={() => setSelectedEntity(e)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
          >
            <span>{e.label}</span>
            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">Select</span>
          </button>
        ))}
        {filteredEntities.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">
            No matches found
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================
// ENTITY SELECTOR (combobox dropdown for unmatched entities)
// =====================================================

interface EntitySelectorProps {
  entityType: EhrEntityType
  suggestions: EntitySuggestion[]
  allEntities: Array<{ id: string; label: string }>
  resolving: boolean
  onSelect: (entityId: string, displayName: string) => Promise<void>
  onCreateAndMap: (formData: CreateEntityData) => Promise<void>
  defaultCreateData: CreateEntityData
}

function EntitySelector({
  entityType,
  suggestions,
  allEntities,
  resolving,
  onSelect,
  onCreateAndMap,
  defaultCreateData,
}: EntitySelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<CreateEntityData>(defaultCreateData)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreateForm(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Build filtered list — suggestions first, then all entities
  const suggestionIds = new Set(suggestions.map(s => s.orbit_entity_id))
  const filteredEntities = searchQuery.trim()
    ? allEntities.filter(e => e.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : allEntities
  const nonSuggestionEntities = filteredEntities.filter(e => !suggestionIds.has(e.id))

  if (resolving) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-sm text-slate-500">Mapping...</span>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(!open)
          setShowCreateForm(false)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-left border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-slate-50 transition-colors"
      >
        <span className="text-slate-500">
          Select {entityConfig[entityType].label.toLowerCase()}...
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {showCreateForm ? (
            <CreateEntityForm
              entityType={entityType}
              form={createForm}
              setForm={setCreateForm}
              onSubmit={async () => {
                await onCreateAndMap(createForm)
                setOpen(false)
                setShowCreateForm(false)
              }}
              onCancel={() => setShowCreateForm(false)}
              resolving={resolving}
            />
          ) : (
            <>
              {/* Search input */}
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${entityConfig[entityType].label.toLowerCase()}s...`}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto">
                {/* Suggestions section */}
                {suggestions.length > 0 && !searchQuery.trim() && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider bg-blue-50/50">
                      Suggestions
                    </div>
                    {suggestions.map(s => (
                      <button
                        key={s.orbit_entity_id}
                        onClick={async () => {
                          await onSelect(s.orbit_entity_id, s.orbit_display_name)
                          setOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.orbit_display_name}</p>
                          <p className="text-xs text-slate-400">
                            {Math.round(s.confidence * 100)}% match — {s.match_reason}
                          </p>
                        </div>
                        <span className="text-xs text-blue-600 font-medium flex-shrink-0 ml-2">Map</span>
                      </button>
                    ))}
                  </>
                )}

                {/* All entities section */}
                {nonSuggestionEntities.length > 0 && (
                  <>
                    {suggestions.length > 0 && !searchQuery.trim() && (
                      <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        All {entityConfig[entityType].label}s
                      </div>
                    )}
                    {nonSuggestionEntities.map(e => (
                      <button
                        key={e.id}
                        onClick={async () => {
                          await onSelect(e.id, e.label)
                          setOpen(false)
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span>{e.label}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">Select</span>
                      </button>
                    ))}
                  </>
                )}

                {/* No results */}
                {filteredEntities.length === 0 && suggestions.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No matches found
                  </div>
                )}
              </div>

              {/* Create new option */}
              <div className="border-t border-slate-200 p-2">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New {entityConfig[entityType].label}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// =====================================================
// CREATE ENTITY FORM (inline in dropdown)
// =====================================================

interface CreateEntityFormProps {
  entityType: EhrEntityType
  form: CreateEntityData
  setForm: (f: CreateEntityData) => void
  onSubmit: () => Promise<void>
  onCancel: () => void
  resolving: boolean
}

function CreateEntityForm({
  entityType,
  form,
  setForm,
  onSubmit,
  onCancel,
  resolving,
}: CreateEntityFormProps) {
  return (
    <div className="p-3 space-y-2.5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Create New {entityConfig[entityType].label}
      </p>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
          autoFocus
        />
      </div>

      {entityType === 'surgeon' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">NPI</label>
            <input
              type="text"
              value={form.npi || ''}
              onChange={e => setForm({ ...form, npi: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Specialty</label>
            <input
              type="text"
              value={form.specialty || ''}
              onChange={e => setForm({ ...form, specialty: e.target.value })}
              placeholder="e.g., Orthopedics"
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
            />
          </div>
        </>
      )}

      {entityType === 'procedure' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">CPT Code</label>
          <input
            type="text"
            value={form.cptCode || ''}
            onChange={e => setForm({ ...form, cptCode: e.target.value })}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSubmit}
          disabled={resolving || !form.name.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Create & Map
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
