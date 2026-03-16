// app/settings/integrations/meditech/PageClient.tsx
// MEDITECH HL7v2 Integration hub — Overview | Review Queue | Mappings | Logs
// Uses shared integration components with MEDITECH-specific config

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardCheck,
  Link2,
  ScrollText,
} from 'lucide-react'
import { useCurrentUser, useSurgeons, useRooms, useProcedureTypes } from '@/hooks'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useIntegrationRealtime } from '@/hooks/useIntegrationRealtime'
import { usePhiAudit } from '@/hooks/usePhiAudit'
import { useUser } from '@/lib/UserContext'
import AccessDenied from '@/components/ui/AccessDenied'
import { ehrDAL } from '@/lib/dal/ehr'
import { ehrAudit } from '@/lib/audit-logger'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { getSystemConfig } from '@/components/integrations/system-config'
import IntegrationOverviewTab from '@/components/integrations/IntegrationOverviewTab'
import IntegrationReviewQueueTab from '@/components/integrations/IntegrationReviewQueueTab'
import IntegrationMappingsTab from '@/components/integrations/IntegrationMappingsTab'
import IntegrationLogsTab from '@/components/integrations/IntegrationLogsTab'
import type { CreateEntityData } from '@/components/integrations/ReviewDetailPanel'
import type {
  EhrIntegration,
  EhrIntegrationLog,
  EhrProcessingStatus,
  EhrEntityType,
  ReviewNotes,
} from '@/lib/integrations/shared/integration-types'
import { logger } from '@/lib/logger'

const log = logger('meditech-integration-page')

const systemConfig = getSystemConfig('meditech_hl7v2')

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
// MAIN COMPONENT
// =====================================================

export default function MeditechHL7v2IntegrationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { data: currentUser } = useCurrentUser()
  const { can, loading: permLoading } = useUser()
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
      const { data } = await ehrDAL.getIntegrationByFacility(supabase, facilityId!, systemConfig.integrationType)
      return data
    },
    { deps: [facilityId], enabled: !!facilityId }
  )

  // Stats — scoped to this integration
  const {
    data: stats,
    refetch: refetchStats,
  } = useSupabaseQuery<IntegrationStats>(
    async (supabase) => {
      const { data } = await ehrDAL.getIntegrationStats(supabase, facilityId!, integration!.id)
      return data!
    },
    { deps: [facilityId, integration?.id], enabled: !!facilityId && !!integration }
  )

  // Review queue — scoped to this integration
  const {
    data: pendingReviews,
    loading: reviewsLoading,
    setData: setPendingReviews,
  } = useSupabaseQuery<EhrIntegrationLog[]>(
    async (supabase) => {
      const { data } = await ehrDAL.listPendingReviews(supabase, facilityId!, { integrationId: integration!.id, limit: 50 })
      return data
    },
    { deps: [facilityId, integration?.id], enabled: !!facilityId && !!integration }
  )

  // Log entries — scoped to this integration
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
        integrationId: integration!.id,
        status: logStatusFilter || undefined,
        limit: PAGE_SIZE,
        offset: logPage * PAGE_SIZE,
      })
      return data
    },
    { deps: [facilityId, integration?.id, logStatusFilter, logPage], enabled: !!facilityId && !!integration }
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
    integrationId: integration?.id,
    onInsert: handleRealtimeInsert,
    enabled: !!facilityId && !!integration,
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
        integration_type: systemConfig.integrationType,
        display_name: systemConfig.integrationDisplayName,
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
        integration_type: systemConfig.integrationType,
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
        integration_type: systemConfig.integrationType,
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

  // Core approval logic — returns { success, error } without showing toasts.
  // Used by both individual approve (with toasts) and batch approve (with summary toast).
  const executeApproveImport = async (logEntry: EhrIntegrationLog): Promise<{ success: boolean; error?: string }> => {
    if (!userId || !integration || !facilityId) {
      return { success: false, error: 'Missing user or integration context' }
    }

    const supabase = createClient()

    // 1. Re-fetch the log entry for the latest review_notes
    const { data: freshEntry, error: fetchError } = await ehrDAL.getLogEntry(supabase, logEntry.id)
    if (fetchError || !freshEntry) {
      return { success: false, error: fetchError?.message || 'Log entry not found' }
    }

    const parsed = freshEntry.parsed_data as Record<string, unknown> | null
    const reviewNotes = freshEntry.review_notes as ReviewNotes | null

    if (!parsed) {
      return { success: false, error: 'No parsed data available' }
    }

    // 2. Resolve entity IDs from case overrides → global mappings
    const ehrSurgeon = parsed.surgeon as { npi?: string; name?: string } | null
    const ehrProcedure = parsed.procedure as { cptCode?: string; name?: string } | null
    const ehrRoom = parsed.room as { code?: string; name?: string } | null
    const ehrPatient = parsed.patient as { mrn: string; firstName: string; lastName: string; dateOfBirth?: string; gender?: string } | null

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

    const surgeonId = resolveEntityId('surgeon', [ehrSurgeon?.npi, ehrSurgeon?.name].filter(Boolean) as string[])
    const procedureId = resolveEntityId('procedure', [ehrProcedure?.cptCode, ehrProcedure?.name].filter(Boolean) as string[])
    const roomId = resolveEntityId('room', [ehrRoom?.code, ehrRoom?.name].filter(Boolean) as string[])

    if (!surgeonId || !procedureId) {
      return { success: false, error: 'Surgeon and procedure must be resolved before approving' }
    }

    // 3. Match/create patient
    let patientId: string | null = null
    if (ehrPatient?.mrn) {
      const { matchOrCreatePatient } = await import('@/lib/integrations/ehr/patient-matcher')
      const patientResult = await matchOrCreatePatient(supabase, facilityId, {
        mrn: ehrPatient.mrn,
        firstName: ehrPatient.firstName,
        lastName: ehrPatient.lastName,
        dateOfBirth: ehrPatient.dateOfBirth || null,
        gender: ehrPatient.gender || '',
        externalPatientId: ehrPatient.mrn,
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
        .eq('external_system', systemConfig.integrationType)
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
        return { success: false, error: 'Could not find "scheduled" status' }
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
        p_source: systemConfig.sourceName,
      })

      if (rpcError || !newCaseId) {
        return { success: false, error: rpcError?.message || 'Failed to create case' }
      }

      caseId = newCaseId as string

      // Set external tracking columns
      if (externalCaseId) {
        await supabase.from('cases').update({
          external_case_id: externalCaseId,
          external_system: systemConfig.integrationType,
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

    return { success: true }
  }

  const handleApproveImport = async (logEntry: EhrIntegrationLog) => {
    setActionLoading(`approve-${logEntry.id}`)
    try {
      const result = await executeApproveImport(logEntry)
      if (result.success) {
        showToast({ type: 'success', title: 'Import approved', message: 'Case created successfully' })
      } else {
        showToast({ type: 'error', title: 'Approval failed', message: result.error || 'Unknown error' })
      }
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

  const [approveAllLoading, setApproveAllLoading] = useState(false)

  const handleApproveAll = async (approvableEntries: EhrIntegrationLog[]) => {
    if (approvableEntries.length === 0) return
    setApproveAllLoading(true)
    let successCount = 0
    let failCount = 0

    for (const entry of approvableEntries) {
      try {
        const result = await executeApproveImport(entry)
        if (result.success) {
          successCount++
        } else {
          failCount++
          log.error('Batch approve: entry failed', { logEntryId: entry.id, error: result.error })
        }
      } catch (err) {
        failCount++
        log.error('Batch approve: entry threw', { logEntryId: entry.id, error: err instanceof Error ? err.message : 'Unknown' })
      }
    }

    setApproveAllLoading(false)

    if (failCount === 0) {
      showToast({ type: 'success', title: 'Batch approval complete', message: `Approved ${successCount} import${successCount !== 1 ? 's' : ''}` })
    } else {
      showToast({
        type: 'warning',
        title: 'Batch approval partial',
        message: `Approved ${successCount}, failed ${failCount}`,
      })
    }
  }

  const handleDeleteMapping = async (mappingId: string) => {
    const supabase = createClient()
    // Get mapping details for audit before deleting
    const { data: mappingsList } = await ehrDAL.listEntityMappings(supabase, integration!.id)
    const mapping = mappingsList?.find(m => m.id === mappingId)
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
            <h1 className="text-2xl font-semibold text-slate-900">{systemConfig.pageTitle}</h1>
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

  if (!can('integrations.view')) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">{systemConfig.pageTitle}</h1>
        <p className="text-slate-500 mb-6">{systemConfig.pageSubtitle}</p>
        <AccessDenied />
      </>
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
          <h1 className="text-2xl font-semibold text-slate-900">{systemConfig.pageTitle}</h1>
          <p className="text-slate-500 text-sm">{systemConfig.pageSubtitle}</p>
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
        <IntegrationOverviewTab
          systemConfig={systemConfig}
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
        <IntegrationReviewQueueTab
          pendingReviews={pendingReviews || []}
          loading={reviewsLoading}
          actionLoading={actionLoading}
          approveAllLoading={approveAllLoading}
          getEntitiesForType={getEntitiesForType}
          entityMappings={allMappings || []}
          incomingColumnLabel={systemConfig.incomingColumnLabel}
          onApprove={handleApproveImport}
          onApproveAll={handleApproveAll}
          onReject={handleRejectImport}
          onResolveEntity={handleResolveEntity}
          onRemapCaseOnly={handleRemapCaseOnly}
          onCreateEntity={handleCreateEntity}
          onPhiAccess={logPhiAccess}
        />
      )}

      {/* TAB: MAPPINGS */}
      {activeTab === 'mappings' && (
        <IntegrationMappingsTab
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
        <IntegrationLogsTab
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
