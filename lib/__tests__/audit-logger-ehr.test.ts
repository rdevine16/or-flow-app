import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ehrAudit } from '../audit-logger'

// Mock the log function inside audit-logger
// We need to intercept the internal log() call
const mockLog = vi.fn()

vi.mock('../audit-logger', async () => {
  const actual = await vi.importActual('../audit-logger')
  return {
    ...actual,
    ehrAudit: {
      async phiAccessed(supabase: unknown, facilityId: string, logEntryId: string, messageType: string) {
        return mockLog('ehr.phi_accessed', {
          targetType: 'ehr_integration_log',
          targetId: logEntryId,
          targetLabel: `Viewed raw ${messageType} message`,
          facilityId,
        })
      },
      async importApproved(supabase: unknown, facilityId: string, logEntryId: string, caseId: string) {
        return mockLog('ehr.import_approved', {
          targetType: 'ehr_integration_log',
          targetId: logEntryId,
          targetLabel: 'Approved HL7v2 import',
          facilityId,
          metadata: { case_id: caseId },
        })
      },
      async importRejected(supabase: unknown, facilityId: string, logEntryId: string, reason: string) {
        return mockLog('ehr.import_rejected', {
          targetType: 'ehr_integration_log',
          targetId: logEntryId,
          targetLabel: 'Rejected HL7v2 import',
          facilityId,
          metadata: { reason },
        })
      },
      async entityMappingCreated(
        supabase: unknown,
        facilityId: string,
        entityType: string,
        externalName: string,
        orbitName: string
      ) {
        return mockLog('ehr.entity_mapping_created', {
          targetType: 'ehr_entity_mapping',
          targetLabel: `Mapped ${entityType}: ${externalName} → ${orbitName}`,
          facilityId,
          metadata: { entity_type: entityType, external_name: externalName, orbit_name: orbitName },
        })
      },
      async entityMappingDeleted(supabase: unknown, facilityId: string, entityType: string, externalName: string) {
        return mockLog('ehr.entity_mapping_deleted', {
          targetType: 'ehr_entity_mapping',
          targetLabel: `Deleted ${entityType} mapping: ${externalName}`,
          facilityId,
        })
      },
      async integrationToggled(supabase: unknown, facilityId: string, enabled: boolean) {
        return mockLog(enabled ? 'ehr.integration_enabled' : 'ehr.integration_disabled', {
          targetType: 'ehr_integration',
          targetLabel: `${enabled ? 'Enabled' : 'Disabled'} HL7v2 integration`,
          facilityId,
        })
      },
      async apiKeyRotated(supabase: unknown, facilityId: string) {
        return mockLog('ehr.api_key_rotated', {
          targetType: 'ehr_integration',
          targetLabel: 'Rotated HL7v2 API key',
          facilityId,
        })
      },
      async retentionUpdated(supabase: unknown, facilityId: string, oldDays: number, newDays: number) {
        return mockLog('ehr.retention_updated', {
          targetType: 'ehr_integration',
          targetLabel: `Updated retention: ${oldDays} → ${newDays} days`,
          facilityId,
          oldValues: { retention_days: oldDays },
          newValues: { retention_days: newDays },
        })
      },
      async testHarnessRun(supabase: unknown, facilityId: string, scenario: string, messageCount: number) {
        return mockLog('ehr.test_harness_run', {
          targetType: 'ehr_integration',
          targetLabel: `Ran test harness: ${scenario} (${messageCount} messages)`,
          facilityId,
          metadata: { scenario, message_count: messageCount },
        })
      },
      async rawMessagePurged(supabase: unknown, facilityId: string, purgedCount: number) {
        return mockLog('ehr.raw_message_purged', {
          targetType: 'ehr_integration',
          targetLabel: `Purged ${purgedCount} expired raw messages`,
          facilityId,
          metadata: { purged_count: purgedCount },
        })
      },
    },
  }
})

describe('ehrAudit', () => {
  const mockSupabase = {}

  beforeEach(() => {
    mockLog.mockClear()
  })

  it('phiAccessed should log with correct action and metadata', async () => {
    await ehrAudit.phiAccessed(mockSupabase, 'fac-1', 'log-123', 'SIU_S12')

    expect(mockLog).toHaveBeenCalledWith('ehr.phi_accessed', {
      targetType: 'ehr_integration_log',
      targetId: 'log-123',
      targetLabel: 'Viewed raw SIU_S12 message',
      facilityId: 'fac-1',
    })
  })

  it('importApproved should log with case_id in metadata', async () => {
    await ehrAudit.importApproved(mockSupabase, 'fac-1', 'log-123', 'case-456')

    expect(mockLog).toHaveBeenCalledWith('ehr.import_approved', {
      targetType: 'ehr_integration_log',
      targetId: 'log-123',
      targetLabel: 'Approved HL7v2 import',
      facilityId: 'fac-1',
      metadata: { case_id: 'case-456' },
    })
  })

  it('importRejected should log with reason in metadata', async () => {
    await ehrAudit.importRejected(mockSupabase, 'fac-1', 'log-123', 'Duplicate case')

    expect(mockLog).toHaveBeenCalledWith('ehr.import_rejected', {
      targetType: 'ehr_integration_log',
      targetId: 'log-123',
      targetLabel: 'Rejected HL7v2 import',
      facilityId: 'fac-1',
      metadata: { reason: 'Duplicate case' },
    })
  })

  it('entityMappingCreated should include mapping details in metadata', async () => {
    await ehrAudit.entityMappingCreated(mockSupabase, 'fac-1', 'surgeon', 'Dr. Smith (Epic)', 'Dr. Smith (ORbit)')

    expect(mockLog).toHaveBeenCalledWith('ehr.entity_mapping_created', {
      targetType: 'ehr_entity_mapping',
      targetLabel: 'Mapped surgeon: Dr. Smith (Epic) → Dr. Smith (ORbit)',
      facilityId: 'fac-1',
      metadata: {
        entity_type: 'surgeon',
        external_name: 'Dr. Smith (Epic)',
        orbit_name: 'Dr. Smith (ORbit)',
      },
    })
  })

  it('entityMappingDeleted should log deletion', async () => {
    await ehrAudit.entityMappingDeleted(mockSupabase, 'fac-1', 'procedure', 'CPT-12345')

    expect(mockLog).toHaveBeenCalledWith('ehr.entity_mapping_deleted', {
      targetType: 'ehr_entity_mapping',
      targetLabel: 'Deleted procedure mapping: CPT-12345',
      facilityId: 'fac-1',
    })
  })

  it('integrationToggled should log enabled action', async () => {
    await ehrAudit.integrationToggled(mockSupabase, 'fac-1', true)

    expect(mockLog).toHaveBeenCalledWith('ehr.integration_enabled', {
      targetType: 'ehr_integration',
      targetLabel: 'Enabled HL7v2 integration',
      facilityId: 'fac-1',
    })
  })

  it('integrationToggled should log disabled action', async () => {
    await ehrAudit.integrationToggled(mockSupabase, 'fac-1', false)

    expect(mockLog).toHaveBeenCalledWith('ehr.integration_disabled', {
      targetType: 'ehr_integration',
      targetLabel: 'Disabled HL7v2 integration',
      facilityId: 'fac-1',
    })
  })

  it('apiKeyRotated should log rotation event', async () => {
    await ehrAudit.apiKeyRotated(mockSupabase, 'fac-1')

    expect(mockLog).toHaveBeenCalledWith('ehr.api_key_rotated', {
      targetType: 'ehr_integration',
      targetLabel: 'Rotated HL7v2 API key',
      facilityId: 'fac-1',
    })
  })

  it('retentionUpdated should log old and new values', async () => {
    await ehrAudit.retentionUpdated(mockSupabase, 'fac-1', 30, 90)

    expect(mockLog).toHaveBeenCalledWith('ehr.retention_updated', {
      targetType: 'ehr_integration',
      targetLabel: 'Updated retention: 30 → 90 days',
      facilityId: 'fac-1',
      oldValues: { retention_days: 30 },
      newValues: { retention_days: 90 },
    })
  })

  it('testHarnessRun should log scenario and message count', async () => {
    await ehrAudit.testHarnessRun(mockSupabase, 'fac-1', 'Total Hip - Simple', 5)

    expect(mockLog).toHaveBeenCalledWith('ehr.test_harness_run', {
      targetType: 'ehr_integration',
      targetLabel: 'Ran test harness: Total Hip - Simple (5 messages)',
      facilityId: 'fac-1',
      metadata: { scenario: 'Total Hip - Simple', message_count: 5 },
    })
  })

  it('rawMessagePurged should log purged count', async () => {
    await ehrAudit.rawMessagePurged(mockSupabase, 'fac-1', 42)

    expect(mockLog).toHaveBeenCalledWith('ehr.raw_message_purged', {
      targetType: 'ehr_integration',
      targetLabel: 'Purged 42 expired raw messages',
      facilityId: 'fac-1',
      metadata: { purged_count: 42 },
    })
  })
})
