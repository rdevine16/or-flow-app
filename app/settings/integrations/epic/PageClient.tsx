// app/settings/integrations/epic/PageClient.tsx
// Epic HL7v2 Integration hub — Overview | Review Queue | Mappings | Logs
// Replaces FHIR connection UI with HL7v2 integration management

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardCheck,
  Link2,
  ScrollText,
  Activity,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Power,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Users,
  LayoutGrid,
  ClipboardList,
  Clock,
  Save,
} from 'lucide-react'
import { useCurrentUser, useSurgeons, useRooms, useProcedureTypes } from '@/hooks'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useIntegrationRealtime } from '@/hooks/useIntegrationRealtime'
import { usePhiAudit } from '@/hooks/usePhiAudit'
import { ehrDAL } from '@/lib/dal/ehr'
import { ehrAudit } from '@/lib/audit-logger'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import SetupInstructionsCard from '@/components/integrations/SetupInstructionsCard'
import HL7MessageViewer from '@/components/integrations/HL7MessageViewer'
import { computeHasUnresolved } from '@/components/integrations/ReviewDetailPanel'
import ImportReviewDrawer from '@/components/integrations/ImportReviewDrawer'
import type { CreateEntityData } from '@/components/integrations/ReviewDetailPanel'
import type {
  EhrIntegration,
  EhrIntegrationLog,
  EhrProcessingStatus,
  EhrEntityType,
  EhrEntityMapping,
  ReviewNotes,
} from '@/lib/integrations/shared/integration-types'
import { logger } from '@/lib/logger'

const log = logger('epic-integration-page')

// =====================================================
// TYPES
// =====================================================

type TabId = 'overview' | 'review' | 'mappings' | 'logs'

interface IntegrationStats {
  totalProcessed: number
  pendingReview: number
  errors: number
  messagesToday: number
}

// =====================================================
// TAB CONFIG
// =====================================================

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'review', label: 'Review Queue', icon: ClipboardCheck },
  { id: 'mappings', label: 'Mappings', icon: Link2 },
  { id: 'logs', label: 'Logs', icon: ScrollText },
]

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const PAGE_SIZE = 25

// =====================================================
// HELPERS
// =====================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: EhrProcessingStatus }) {
  const config: Record<EhrProcessingStatus, { color: string; label: string }> = {
    received: { color: 'bg-blue-100 text-blue-700', label: 'Received' },
    pending_review: { color: 'bg-amber-100 text-amber-700', label: 'Pending Review' },
    processed: { color: 'bg-emerald-100 text-emerald-700', label: 'Processed' },
    error: { color: 'bg-red-100 text-red-700', label: 'Error' },
    ignored: { color: 'bg-slate-100 text-slate-600', label: 'Ignored' },
  }
  const c = config[status]
  return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${c.color}`}>{c.label}</span>
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EpicHL7v2IntegrationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { data: currentUser } = useCurrentUser()
  const facilityId = currentUser?.facilityId
  const userId = currentUser?.userId

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Integration data
  const {
    data: integration,
    loading: integrationLoading,
    setData: setIntegration,
  } = useSupabaseQuery<EhrIntegration | null>(
    async (supabase) => {
      const { data } = await ehrDAL.getIntegrationByFacility(supabase, facilityId!, 'epic_hl7v2')
      return data
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Stats
  const {
    data: stats,
    refetch: refetchStats,
  } = useSupabaseQuery<IntegrationStats>(
    async (supabase) => {
      const { data } = await ehrDAL.getIntegrationStats(supabase, facilityId!)
      return data!
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Review queue
  const {
    data: pendingReviews,
    loading: reviewsLoading,
    setData: setPendingReviews,
  } = useSupabaseQuery<EhrIntegrationLog[]>(
    async (supabase) => {
      const { data } = await ehrDAL.listPendingReviews(supabase, facilityId!, { limit: 50 })
      return data
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Log entries
  const [logStatusFilter, setLogStatusFilter] = useState<EhrProcessingStatus | ''>('')
  const [logPage, setLogPage] = useState(0)

  const {
    data: logEntries,
    loading: logsLoading,
    refetch: refetchLogs,
    setData: setLogEntries,
  } = useSupabaseQuery<EhrIntegrationLog[]>(
    async (supabase) => {
      const { data } = await ehrDAL.listLogEntries(supabase, facilityId!, {
        status: logStatusFilter || undefined,
        limit: PAGE_SIZE,
        offset: logPage * PAGE_SIZE,
      })
      return data
    },
    { deps: [facilityId, logStatusFilter, logPage], enabled: !!facilityId }
  )

  // Entity mappings (filtered by tab — for MappingsTab display)
  const [mappingTab, setMappingTab] = useState<EhrEntityType>('surgeon')
  const {
    data: entityMappings,
    loading: mappingsLoading,
    refetch: refetchMappings,
  } = useSupabaseQuery(
    async (supabase) => {
      if (!integration) return []
      const { data } = await ehrDAL.listEntityMappings(supabase, integration.id, mappingTab)
      return data
    },
    { deps: [integration?.id, mappingTab], enabled: !!integration }
  )

  // All entity mappings (unfiltered — for ReviewQueueTab auto-match lookup)
  const {
    data: allMappings,
    refetch: refetchAllMappings,
  } = useSupabaseQuery(
    async (supabase) => {
      if (!integration) return []
      const { data } = await ehrDAL.listEntityMappings(supabase, integration.id)
      return data
    },
    { deps: [integration?.id], enabled: !!integration }
  )

  // Lookup data
  const { data: surgeons } = useSurgeons(facilityId)
  const { data: rooms } = useRooms(facilityId)
  const { data: procedures } = useProcedureTypes(facilityId)

  // Realtime
  const handleRealtimeInsert = useCallback((entry: EhrIntegrationLog) => {
    setLogEntries(prev => prev ? [entry, ...prev].slice(0, PAGE_SIZE) : [entry])
    if (entry.processing_status === 'pending_review') {
      setPendingReviews(prev => prev ? [entry, ...prev] : [entry])
    }
    refetchStats()
  }, [setLogEntries, setPendingReviews, refetchStats])

  useIntegrationRealtime({
    facilityId,
    onInsert: handleRealtimeInsert,
    enabled: !!facilityId,
  })

  // Entity lookups for ReviewDetailPanel
  const surgeonEntities = useMemo(
    () => (surgeons || []).map(s => ({ id: s.id, label: `${s.last_name}, ${s.first_name}` })),
    [surgeons]
  )
  const roomEntities = useMemo(
    () => (rooms || []).map(r => ({ id: r.id, label: r.name })),
    [rooms]
  )
  const procedureEntities = useMemo(
    () => (procedures || []).map(p => ({ id: p.id, label: p.name })),
    [procedures]
  )

  const getEntitiesForType = useCallback((type: EhrEntityType) => {
    switch (type) {
      case 'surgeon': return surgeonEntities
      case 'room': return roomEntities
      case 'procedure': return procedureEntities
    }
  }, [surgeonEntities, roomEntities, procedureEntities])

  // PHI access tracking (HIPAA)
  const { logAccess: logPhiAccess } = usePhiAudit({
    userId,
    facilityId,
  })

  // =====================================================
  // ACTION HANDLERS
  // =====================================================

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleSetup = async () => {
    if (!facilityId) return
    setActionLoading('setup')
    try {
      const supabase = createClient()
      const apiKey = crypto.randomUUID()
      const endpointUrl = `${SUPABASE_PROJECT_URL}/functions/v1/hl7v2-listener`

      const { data, error } = await ehrDAL.upsertIntegration(supabase, {
        facility_id: facilityId,
        integration_type: 'epic_hl7v2',
        display_name: 'Epic HL7v2',
        config: {
          api_key: apiKey,
          endpoint_url: endpointUrl,
          auth_type: 'api_key',
          rate_limit_per_minute: 100,
          retention_days: 90,
        },
        is_active: true,
      })

      if (error) {
        log.error('Failed to set up integration', { error: error.message })
        return
      }
      setIntegration(data)
      refetchStats()
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = async () => {
    if (!integration) return
    setActionLoading('toggle')
    try {
      const supabase = createClient()
      const newActive = !integration.is_active
      const { data, error } = await ehrDAL.upsertIntegration(supabase, {
        facility_id: integration.facility_id,
        integration_type: 'epic_hl7v2',
        is_active: newActive,
      })
      if (!error && data) {
        setIntegration(data)
        await ehrAudit.integrationToggled(supabase, integration.facility_id, newActive)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleRotateKey = async () => {
    if (!integration) return
    if (!confirm('Rotate API key? The old key will be immediately invalid.')) return

    setActionLoading('rotate')
    try {
      const supabase = createClient()
      const newKey = crypto.randomUUID()
      const updatedConfig = { ...integration.config, api_key: newKey }

      const { data, error } = await ehrDAL.upsertIntegration(supabase, {
        facility_id: integration.facility_id,
        integration_type: 'epic_hl7v2',
        config: updatedConfig,
      })
      if (!error && data) {
        setIntegration(data)
        await ehrAudit.apiKeyRotated(supabase, integration.facility_id)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveImport = async (logEntry: EhrIntegrationLog) => {
    if (!userId || !integration || !facilityId) {
      showToast({ type: 'error', title: 'Cannot approve', message: 'Missing user or integration context' })
      return
    }
    setActionLoading(`approve-${logEntry.id}`)
    try {
      const supabase = createClient()

      // 1. Re-fetch the log entry for the latest review_notes
      const { data: freshEntry, error: fetchError } = await ehrDAL.getLogEntry(supabase, logEntry.id)
      if (fetchError || !freshEntry) {
        showToast({ type: 'error', title: 'Approval failed', message: fetchError?.message || 'Log entry not found' })
        return
      }

      const parsed = freshEntry.parsed_data as Record<string, unknown> | null
      const reviewNotes = freshEntry.review_notes as ReviewNotes | null

      if (!parsed) {
        showToast({ type: 'error', title: 'Approval failed', message: 'No parsed data available' })
        return
      }

      // 2. Resolve entity IDs from case overrides → global mappings
      const epicSurgeon = parsed.surgeon as { npi?: string; name?: string } | null
      const epicProcedure = parsed.procedure as { cptCode?: string; name?: string } | null
      const epicRoom = parsed.room as { code?: string; name?: string } | null
      const epicPatient = parsed.patient as { mrn: string; firstName: string; lastName: string; dateOfBirth?: string; gender?: string } | null

      // Fetch fresh entity mappings for this integration
      const { data: currentMappings } = await ehrDAL.listEntityMappings(supabase, integration.id)
      const mappings = currentMappings || []

      const resolveEntityId = (
        entityType: 'surgeon' | 'procedure' | 'room',
        identifiers: string[],
      ): string | null => {
        // Case override takes priority
        const overrideKey = `matched_${entityType}` as keyof ReviewNotes
        const override = reviewNotes?.[overrideKey] as { orbit_entity_id: string } | undefined
        if (override?.orbit_entity_id) return override.orbit_entity_id

        // Then check global entity mappings
        for (const id of identifiers) {
          if (!id) continue
          const mapping = mappings.find(m => m.entity_type === entityType && m.external_identifier === id)
          if (mapping?.orbit_entity_id) return mapping.orbit_entity_id
        }
        return null
      }

      const surgeonId = resolveEntityId('surgeon', [epicSurgeon?.npi, epicSurgeon?.name].filter(Boolean) as string[])
      const procedureId = resolveEntityId('procedure', [epicProcedure?.cptCode, epicProcedure?.name].filter(Boolean) as string[])
      const roomId = resolveEntityId('room', [epicRoom?.code, epicRoom?.name].filter(Boolean) as string[])

      if (!surgeonId || !procedureId) {
        showToast({ type: 'error', title: 'Cannot approve', message: 'Surgeon and procedure must be resolved before approving' })
        return
      }

      // 3. Match/create patient
      let patientId: string | null = null
      if (epicPatient?.mrn) {
        const { matchOrCreatePatient } = await import('@/lib/integrations/epic/patient-matcher')
        const patientResult = await matchOrCreatePatient(supabase, facilityId, {
          mrn: epicPatient.mrn,
          firstName: epicPatient.firstName,
          lastName: epicPatient.lastName,
          dateOfBirth: epicPatient.dateOfBirth || null,
          gender: epicPatient.gender || '',
          externalPatientId: epicPatient.mrn,
        })
        patientId = patientResult.patientId
      }

      // 4. Check for existing case (in case of re-approval after prior partial processing)
      const externalCaseId = parsed.externalCaseId as string | undefined
      let caseId: string | null = null

      if (externalCaseId) {
        const { data: existingCase } = await supabase
          .from('cases')
          .select('id')
          .eq('facility_id', facilityId)
          .eq('external_case_id', externalCaseId)
          .eq('external_system', 'epic_hl7v2')
          .maybeSingle()

        if (existingCase) {
          // Update existing case with resolved entities
          await supabase.from('cases').update({
            surgeon_id: surgeonId,
            procedure_type_id: procedureId,
            or_room_id: roomId,
            patient_id: patientId,
          }).eq('id', existingCase.id)
          caseId = existingCase.id
        }
      }

      // 5. Create case if none exists
      if (!caseId) {
        const { data: scheduledStatus } = await supabase
          .from('case_statuses')
          .select('id')
          .eq('name', 'scheduled')
          .maybeSingle()

        if (!scheduledStatus) {
          showToast({ type: 'error', title: 'Approval failed', message: 'Could not find "scheduled" status' })
          return
        }

        const scheduledStart = parsed.scheduledStart as string | undefined
        const scheduledDate = scheduledStart ? scheduledStart.substring(0, 10) : null
        const startTime = scheduledStart && scheduledStart.length > 10 ? scheduledStart.substring(11, 19) : null
        const caseNumber = externalCaseId ? `HL7-${externalCaseId}` : `HL7-${Date.now()}`

        const { data: newCaseId, error: rpcError } = await supabase.rpc('create_case_with_milestones', {
          p_case_number: caseNumber,
          p_scheduled_date: scheduledDate,
          p_start_time: startTime,
          p_or_room_id: roomId,
          p_procedure_type_id: procedureId,
          p_status_id: scheduledStatus.id,
          p_surgeon_id: surgeonId,
          p_facility_id: facilityId,
          p_created_by: null,
          p_operative_side: null,
          p_payer_id: null,
          p_notes: null,
          p_rep_required_override: null,
          p_is_draft: false,
          p_staff_assignments: null,
          p_patient_id: patientId,
          p_source: 'epic',
        })

        if (rpcError || !newCaseId) {
          showToast({ type: 'error', title: 'Approval failed', message: rpcError?.message || 'Failed to create case' })
          return
        }

        caseId = newCaseId as string

        // Set external tracking columns
        if (externalCaseId) {
          await supabase.from('cases').update({
            external_case_id: externalCaseId,
            external_system: 'epic_hl7v2',
            import_source: 'hl7v2',
          }).eq('id', caseId)
        }
      }

      // 6. Mark log entry as processed
      await ehrDAL.approveImport(supabase, freshEntry.id, caseId, userId)
      await ehrAudit.importApproved(supabase, integration.facility_id, freshEntry.id, caseId)
      setPendingReviews(prev => prev ? prev.filter(r => r.id !== freshEntry.id) : [])
      refetchStats()
      refetchLogs()
      showToast({ type: 'success', title: 'Import approved', message: 'Case created successfully' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      log.error('Approve import failed', { logEntryId: logEntry.id, error: msg })
      showToast({ type: 'error', title: 'Approval failed', message: msg })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectImport = async (logEntry: EhrIntegrationLog) => {
    if (!userId || !facilityId) return
    const reason = prompt('Reason for rejection:')
    if (!reason) return

    setActionLoading(`reject-${logEntry.id}`)
    try {
      const supabase = createClient()
      await ehrDAL.rejectImport(supabase, logEntry.id, reason, userId)
      await ehrAudit.importRejected(supabase, facilityId, logEntry.id, reason)
      setPendingReviews(prev => prev ? prev.filter(r => r.id !== logEntry.id) : [])
      refetchStats()
      refetchLogs()
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolveEntity = async (
    logEntry: EhrIntegrationLog,
    entityType: EhrEntityType,
    externalIdentifier: string,
    externalDisplayName: string,
    orbitEntityId: string,
    orbitDisplayName: string,
  ) => {
    if (!integration) return
    setActionLoading(`resolve-${logEntry.id}-${entityType}`)
    try {
      const supabase = createClient()
      const { error } = await ehrDAL.resolveEntity(
        supabase, logEntry.id, integration.id, integration.facility_id,
        entityType, externalIdentifier, externalDisplayName,
        orbitEntityId, orbitDisplayName,
      )

      if (!error) {
        const { data: updated } = await ehrDAL.getLogEntry(supabase, logEntry.id)
        if (updated) {
          setPendingReviews(prev => prev ? prev.map(r => r.id === logEntry.id ? updated : r) : [])
        }
        await ehrAudit.entityMappingCreated(supabase, integration.facility_id, entityType, externalDisplayName, orbitDisplayName)
        refetchMappings()
        refetchAllMappings()
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemapCaseOnly = async (
    logEntry: EhrIntegrationLog,
    entityType: EhrEntityType,
    orbitEntityId: string,
    orbitDisplayName: string,
  ) => {
    setActionLoading(`resolve-${logEntry.id}-${entityType}`)
    try {
      const supabase = createClient()
      const { error } = await ehrDAL.resolveEntityCaseOnly(
        supabase, logEntry.id, entityType, orbitEntityId, orbitDisplayName,
      )

      if (!error) {
        const { data: updated } = await ehrDAL.getLogEntry(supabase, logEntry.id)
        if (updated) {
          setPendingReviews(prev => prev ? prev.map(r => r.id === logEntry.id ? updated : r) : [])
        }
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateEntity = async (formData: CreateEntityData): Promise<string | null> => {
    if (!facilityId) return null
    const supabase = createClient()

    switch (formData.entityType) {
      case 'surgeon': {
        const nameParts = formData.name.split(',').map(s => s.trim())
        const lastName = nameParts[0] || formData.name
        const firstName = nameParts[1] || ''
        const { data, error } = await supabase
          .from('users')
          .insert({ first_name: firstName, last_name: lastName, facility_id: facilityId, npi: formData.npi || null })
          .select('id')
          .single()
        if (error) { log.error('Failed to create surgeon', { error: error.message }); return null }
        return data.id
      }
      case 'procedure': {
        const { data, error } = await supabase
          .from('procedure_types')
          .insert({ name: formData.name, facility_id: facilityId, is_active: true })
          .select('id')
          .single()
        if (error) { log.error('Failed to create procedure', { error: error.message }); return null }
        return data.id
      }
      case 'room': {
        const { data, error } = await supabase
          .from('or_rooms')
          .insert({ name: formData.name, facility_id: facilityId, is_active: true })
          .select('id')
          .single()
        if (error) { log.error('Failed to create room', { error: error.message }); return null }
        return data.id
      }
    }
  }

  const handleUpdateRetention = async (days: number) => {
    if (!integration || !facilityId) return
    setActionLoading('retention')
    try {
      const supabase = createClient()
      const oldDays = integration.config?.retention_days ?? 90
      const { error } = await ehrDAL.updateRetentionDays(supabase, integration.id, days)
      if (!error) {
        setIntegration({ ...integration, config: { ...integration.config, retention_days: days } })
        await ehrAudit.retentionUpdated(supabase, facilityId, oldDays, days)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteMapping = async (mappingId: string) => {
    const supabase = createClient()
    // Get mapping details for audit before deleting
    const { data: mappings } = await ehrDAL.listEntityMappings(supabase, integration!.id)
    const mapping = mappings?.find(m => m.id === mappingId)
    await ehrDAL.deleteEntityMapping(supabase, mappingId)
    if (mapping && facilityId) {
      await ehrAudit.entityMappingDeleted(supabase, facilityId, mapping.entity_type, mapping.external_display_name || mapping.external_identifier)
    }
    refetchMappings()
  }

  // =====================================================
  // LOADING STATE
  // =====================================================

  if (integrationLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/settings/integrations')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Epic HL7v2 Integration</h1>
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  const endpointUrl = integration?.config?.endpoint_url || `${SUPABASE_PROJECT_URL}/functions/v1/hl7v2-listener`
  const pendingCount = stats?.pendingReview ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings/integrations')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900">Epic HL7v2 Integration</h1>
          <p className="text-slate-500 text-sm">Receive surgical scheduling data via HL7v2 SIU messages</p>
        </div>
        {integration && (
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${integration.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span className="text-sm text-slate-600">{integration.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'text-blue-700 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'review' && pendingCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <OverviewTab
          integration={integration}
          stats={stats}
          endpointUrl={endpointUrl}
          actionLoading={actionLoading}
          onSetup={handleSetup}
          onToggleActive={handleToggleActive}
          onRotateKey={handleRotateKey}
          onUpdateRetention={handleUpdateRetention}
          onNavigateTab={setActiveTab}
          onNavigateLogsWithFilter={(filter) => { setActiveTab('logs'); setLogStatusFilter(filter) }}
        />
      )}

      {/* TAB: REVIEW QUEUE */}
      {activeTab === 'review' && (
        <ReviewQueueTab
          pendingReviews={pendingReviews || []}
          loading={reviewsLoading}
          actionLoading={actionLoading}
          getEntitiesForType={getEntitiesForType}
          entityMappings={allMappings || []}
          onApprove={handleApproveImport}
          onReject={handleRejectImport}
          onResolveEntity={handleResolveEntity}
          onRemapCaseOnly={handleRemapCaseOnly}
          onCreateEntity={handleCreateEntity}
          onPhiAccess={logPhiAccess}
        />
      )}

      {/* TAB: MAPPINGS */}
      {activeTab === 'mappings' && (
        <MappingsTab
          integration={integration}
          mappingTab={mappingTab}
          setMappingTab={setMappingTab}
          entityMappings={entityMappings || []}
          loading={mappingsLoading}
          onDelete={handleDeleteMapping}
        />
      )}

      {/* TAB: LOGS */}
      {activeTab === 'logs' && (
        <LogsTab
          logEntries={logEntries || []}
          loading={logsLoading}
          statusFilter={logStatusFilter}
          setStatusFilter={(f) => { setLogStatusFilter(f); setLogPage(0) }}
          page={logPage}
          setPage={setLogPage}
          pageSize={PAGE_SIZE}
          onRefresh={refetchLogs}
          onPhiAccess={logPhiAccess}
        />
      )}
    </div>
  )
}

// =====================================================
// OVERVIEW TAB
// =====================================================

function OverviewTab({
  integration,
  stats,
  endpointUrl,
  actionLoading,
  onSetup,
  onToggleActive,
  onRotateKey,
  onUpdateRetention,
  onNavigateTab,
  onNavigateLogsWithFilter,
}: {
  integration: EhrIntegration | null
  stats: IntegrationStats | null
  endpointUrl: string
  actionLoading: string | null
  onSetup: () => Promise<void>
  onToggleActive: () => Promise<void>
  onRotateKey: () => Promise<void>
  onUpdateRetention: (days: number) => Promise<void>
  onNavigateTab: (tab: TabId) => void
  onNavigateLogsWithFilter: (filter: EhrProcessingStatus) => void
}) {
  if (!integration) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Set Up HL7v2 Integration</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-6">
          Generate an API key to start receiving surgical scheduling messages from your Epic integration engine.
        </p>
        <button
          onClick={onSetup}
          disabled={actionLoading === 'setup'}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {actionLoading === 'setup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Initialize Integration
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SetupInstructionsCard endpointUrl={endpointUrl} apiKey={integration.config?.api_key} isActive={integration.is_active} />

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleActive}
          disabled={actionLoading === 'toggle'}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            integration.is_active
              ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {actionLoading === 'toggle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          {integration.is_active ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={onRotateKey}
          disabled={actionLoading === 'rotate'}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {actionLoading === 'rotate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Rotate API Key
        </button>
      </div>

      {/* Status Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-medium text-slate-900 mb-4">Connection Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 mb-0.5">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${integration.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <p className="font-medium text-slate-900">{integration.is_active ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Last Message</p>
            <p className="font-medium text-slate-900">{formatRelativeTime(integration.last_message_at)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Messages Today</p>
            <p className="font-medium text-slate-900">{stats?.messagesToday ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Last Error</p>
            <p className={`font-medium ${integration.last_error ? 'text-red-600' : 'text-slate-900'}`}>
              {integration.last_error || 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-slate-500">Total Imported</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{stats?.totalProcessed ?? 0}</p>
        </div>
        <button
          className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-amber-300 transition-colors"
          onClick={() => onNavigateTab('review')}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-500">Pending Review</span>
          </div>
          <p className="text-2xl font-semibold text-amber-600">{stats?.pendingReview ?? 0}</p>
        </button>
        <button
          className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-red-300 transition-colors"
          onClick={() => onNavigateLogsWithFilter('error')}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-slate-500">Errors</span>
          </div>
          <p className="text-2xl font-semibold text-red-600">{stats?.errors ?? 0}</p>
        </button>
      </div>

      {/* Retention Policy Card */}
      <RetentionPolicyCard
        retentionDays={integration.config?.retention_days ?? 90}
        actionLoading={actionLoading}
        onUpdate={onUpdateRetention}
      />
    </div>
  )
}

// =====================================================
// RETENTION POLICY CARD
// =====================================================

const RETENTION_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days (default)' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
]

function RetentionPolicyCard({
  retentionDays,
  actionLoading,
  onUpdate,
}: {
  retentionDays: number
  actionLoading: string | null
  onUpdate: (days: number) => Promise<void>
}) {
  const [selectedDays, setSelectedDays] = useState(retentionDays)

  const hasChanged = selectedDays !== retentionDays

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-slate-500" />
        <h3 className="font-medium text-slate-900">Raw Message Retention</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Raw HL7v2 messages contain PHI. They are automatically purged after the retention period.
        Parsed data and audit logs are preserved indefinitely.
      </p>
      <div className="flex items-center gap-3">
        <select
          value={selectedDays}
          onChange={(e) => setSelectedDays(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {RETENTION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {hasChanged && (
          <button
            onClick={() => onUpdate(selectedDays)}
            disabled={actionLoading === 'retention'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'retention' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        )}
      </div>
    </div>
  )
}

// =====================================================
// REVIEW QUEUE TAB
// =====================================================

function ReviewQueueTab({
  pendingReviews,
  loading,
  actionLoading,
  getEntitiesForType,
  entityMappings,
  onApprove,
  onReject,
  onResolveEntity,
  onRemapCaseOnly,
  onCreateEntity,
  onPhiAccess,
}: {
  pendingReviews: EhrIntegrationLog[]
  loading: boolean
  actionLoading: string | null
  getEntitiesForType: (type: EhrEntityType) => Array<{ id: string; label: string }>
  entityMappings: EhrEntityMapping[]
  onApprove: (entry: EhrIntegrationLog) => Promise<void>
  onReject: (entry: EhrIntegrationLog) => Promise<void>
  onResolveEntity: (
    entry: EhrIntegrationLog, entityType: EhrEntityType,
    extId: string, extName: string, orbitId: string, orbitName: string,
  ) => Promise<void>
  onRemapCaseOnly: (
    entry: EhrIntegrationLog, entityType: EhrEntityType,
    orbitId: string, orbitName: string,
  ) => Promise<void>
  onCreateEntity: (formData: CreateEntityData) => Promise<string | null>
  onPhiAccess: (logEntryId: string, messageType: string) => void
}) {
  const [selectedEntry, setSelectedEntry] = useState<EhrIntegrationLog | null>(null)

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg" />
        ))}
      </div>
    )
  }

  if (pendingReviews.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-slate-500">No pending reviews. All imports are up to date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {pendingReviews.length} import{pendingReviews.length !== 1 ? 's' : ''} pending review
      </p>

      {/* Scannable list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {pendingReviews.map(entry => (
          <ReviewQueueRow
            key={entry.id}
            entry={entry}
            entityMappings={entityMappings}
            isSelected={selectedEntry?.id === entry.id}
            onClick={() => setSelectedEntry(entry)}
          />
        ))}
      </div>

      {/* Slide-over drawer */}
      <ImportReviewDrawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
        allSurgeons={getEntitiesForType('surgeon')}
        allProcedures={getEntitiesForType('procedure')}
        allRooms={getEntitiesForType('room')}
        entityMappings={entityMappings}
        onResolveEntity={onResolveEntity}
        onRemapCaseOnly={onRemapCaseOnly}
        onCreateEntity={onCreateEntity}
        onApprove={async (e) => {
          await onApprove(e)
          setSelectedEntry(null)
        }}
        onReject={async (e) => {
          await onReject(e)
          setSelectedEntry(null)
        }}
        onPhiAccess={onPhiAccess}
        actionLoading={actionLoading}
      />
    </div>
  )
}

// =====================================================
// REVIEW QUEUE ROW (scannable list format)
// =====================================================

function ReviewQueueRow({
  entry,
  entityMappings,
  isSelected,
  onClick,
}: {
  entry: EhrIntegrationLog
  entityMappings: EhrEntityMapping[]
  isSelected: boolean
  onClick: () => void
}) {
  const parsed = entry.parsed_data as Record<string, unknown> | null
  const hasUnresolved = computeHasUnresolved(entry, entityMappings)

  // Extract display fields
  const patient = parsed?.patient as { firstName?: string; lastName?: string } | null
  const procedure = parsed?.procedure as { name?: string } | null
  const surgeon = parsed?.surgeon as { name?: string } | null

  // Format date/time: M/D/YYYY h:mmam
  let dateTimeStr = ''
  const scheduledStart = parsed?.scheduledStart as string | undefined
  if (scheduledStart) {
    const d = new Date(scheduledStart)
    const dateStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
    dateTimeStr = `${dateStr} ${timeStr}`
  }

  // Procedure name (short)
  const procedureName = procedure?.name || 'Unknown Procedure'

  // Surgeon last name
  let surgeonDisplay = ''
  if (surgeon?.name) {
    // Names might be "LAST, FIRST" or "First Last" — extract last name
    const parts = surgeon.name.split(',')
    if (parts.length > 1) {
      surgeonDisplay = `Dr ${parts[0].trim()}`
    } else {
      const words = surgeon.name.trim().split(/\s+/)
      surgeonDisplay = `Dr ${words[words.length - 1]}`
    }
  }

  // Patient display: FirstName LastName
  const patientDisplay = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'
    : 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
      }`}
    >
      {/* Status icon */}
      {hasUnresolved ? (
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      )}

      {/* Row content */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-900">
          <span className="font-medium">New Case:</span>
          {dateTimeStr && <> {dateTimeStr}</>}
          {procedureName && <> {procedureName}</>}
          {surgeonDisplay && <> {surgeonDisplay}</>}
          {patientDisplay && <> <span className="text-slate-400">-</span> {patientDisplay}</>}
        </span>
      </div>

      {/* Time ago */}
      <span className="text-xs text-slate-400 flex-shrink-0">
        {formatRelativeTime(entry.created_at)}
      </span>
    </button>
  )
}

// =====================================================
// MAPPINGS TAB
// =====================================================

function MappingsTab({
  integration,
  mappingTab,
  setMappingTab,
  entityMappings,
  loading,
  onDelete,
}: {
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
}) {
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

// =====================================================
// LOGS TAB
// =====================================================

function LogsTab({
  logEntries,
  loading,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  pageSize,
  onRefresh,
  onPhiAccess,
}: {
  logEntries: EhrIntegrationLog[]
  loading: boolean
  statusFilter: EhrProcessingStatus | ''
  setStatusFilter: (f: EhrProcessingStatus | '') => void
  page: number
  setPage: (p: number) => void
  pageSize: number
  onRefresh: () => void
  onPhiAccess: (logEntryId: string, messageType: string) => void
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filterOptions: Array<{ value: EhrProcessingStatus | ''; label: string }> = [
    { value: '', label: 'All' },
    { value: 'processed', label: 'Processed' },
    { value: 'pending_review', label: 'Pending' },
    { value: 'error', label: 'Errors' },
    { value: 'ignored', label: 'Ignored' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === opt.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-lg" />)}
          </div>
        ) : logEntries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400">
              {statusFilter ? `No ${statusFilter.replace('_', ' ')} messages found.` : 'No messages received yet.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 w-8" />
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">External ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map(entry => {
                  const isExpanded = expandedRow === entry.id
                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          entry.processing_status === 'error' ? 'bg-red-50/50' : ''
                        }`}
                        onClick={() => {
                          const expanding = !isExpanded
                          setExpandedRow(expanding ? entry.id : null)
                          if (expanding && entry.raw_message) {
                            onPhiAccess(entry.id, entry.message_type)
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">{entry.message_type}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{entry.external_case_id || '\u2014'}</td>
                        <td className="px-4 py-3"><StatusBadge status={entry.processing_status} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                          {entry.error_message || (entry.case_id ? `Case: ${entry.case_id.substring(0, 8)}...` : '\u2014')}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-slate-50/50 border-b border-slate-200">
                            <HL7MessageViewer rawMessage={entry.raw_message} parsedData={entry.parsed_data} />
                            {entry.error_message && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-700">{entry.error_message}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logEntries.length < pageSize}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
