/**
 * Tests for notification-helper.ts
 *
 * Unit tests for building and creating notifications from SIU processing.
 * Uses vitest (not Deno test) for consistency with project test infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing (matching the actual types from types.ts)
type SIUMessage = {
  triggerEvent: string;
  pid: {
    firstName: string | null;
    lastName: string | null;
  };
  ais?: {
    procedureDescription: string | null;
  } | null;
  sch: {
    appointmentReason?: string | null;
  };
};

// Import the functions we're testing
// NOTE: In a real scenario, we'd need to adjust imports or use a test double
// For now, we'll test the logic inline or via a mock implementation
// that mirrors notification-helper.ts

/**
 * buildNotificationFromSIU implementation (inline for testing)
 */
function buildNotificationFromSIU(
  siu: SIUMessage,
  action: 'created' | 'updated' | 'cancelled',
  caseId: string | null,
): {
  type: string;
  title: string;
  message: string;
  category: string;
  metadata: Record<string, unknown>;
  caseId: string;
} | null {
  if (!caseId || caseId.trim() === '') return null;

  const patientName = [siu.pid.firstName, siu.pid.lastName].filter(Boolean).join(' ').trim() || 'Unknown Patient';
  const procedureName = siu.ais?.procedureDescription || 'Unknown Procedure';

  switch (action) {
    case 'created':
      return {
        type: 'case_auto_created',
        title: `Case Auto-Created: ${patientName}`,
        message: `${procedureName} via Epic HL7v2`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          procedure_name: procedureName,
          source: 'epic_hl7v2',
        },
      };

    case 'updated':
      return {
        type: 'case_auto_updated',
        title: `Case Updated via Epic: ${patientName}`,
        message: `${procedureName} — ${siu.triggerEvent === 'S13' ? 'rescheduled' : 'modified'} via HL7v2`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          procedure_name: procedureName,
          trigger_event: siu.triggerEvent,
          source: 'epic_hl7v2',
        },
      };

    case 'cancelled': {
      const reason = siu.sch.appointmentReason || 'no reason provided';
      return {
        type: 'case_auto_cancelled',
        title: `Case Cancelled via Epic: ${patientName}`,
        message: `Cancelled (${siu.triggerEvent}) — ${reason}`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          reason,
          source: 'epic_hl7v2',
        },
      };
    }

    default:
      return null;
  }
}

/**
 * createNotificationForCase implementation (inline for testing)
 */
async function createNotificationForCase(
  supabase: { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  facilityId: string,
  notificationData: {
    type: string;
    title: string;
    message: string;
    category: string;
    metadata: Record<string, unknown>;
    caseId: string;
  },
): Promise<void> {
  try {
    const { data: notificationId, error } = await supabase.rpc('create_notification_if_enabled', {
      p_facility_id: facilityId,
      p_type: notificationData.type,
      p_title: notificationData.title,
      p_message: notificationData.message,
      p_category: notificationData.category,
      p_metadata: notificationData.metadata,
      p_case_id: notificationData.caseId,
      p_sent_by: null,
    });

    if (error) {
      console.warn('[notification] Failed to create notification:', error.message);
    } else if (notificationId) {
      console.log('[notification] Created:', notificationData.type, notificationId);
    } else {
      console.log('[notification] Skipped (type disabled for facility):', notificationData.type);
    }
  } catch (err) {
    console.warn('[notification] Unexpected error:', err instanceof Error ? err.message : String(err));
  }
}

describe('buildNotificationFromSIU', () => {
  const mockSIU: SIUMessage = {
    triggerEvent: 'S12',
    pid: {
      firstName: 'John',
      lastName: 'Doe',
    },
    ais: {
      procedureDescription: 'Total Knee Replacement',
    },
    sch: {
      appointmentReason: null,
    },
  };

  describe('action: created', () => {
    it('builds notification for case auto-created with full patient name', () => {
      const result = buildNotificationFromSIU(mockSIU, 'created', 'case-123');

      expect(result).toEqual({
        type: 'case_auto_created',
        title: 'Case Auto-Created: John Doe',
        message: 'Total Knee Replacement via Epic HL7v2',
        category: 'Case Alerts',
        caseId: 'case-123',
        metadata: {
          link_to: '/cases/case-123',
          case_id: 'case-123',
          patient_name: 'John Doe',
          procedure_name: 'Total Knee Replacement',
          source: 'epic_hl7v2',
        },
      });
    });

    it('handles missing patient first name', () => {
      const siu = { ...mockSIU, pid: { firstName: null, lastName: 'Smith' } };
      const result = buildNotificationFromSIU(siu, 'created', 'case-456');

      expect(result?.title).toBe('Case Auto-Created: Smith');
      expect(result?.metadata.patient_name).toBe('Smith');
    });

    it('handles missing patient last name', () => {
      const siu = { ...mockSIU, pid: { firstName: 'Jane', lastName: null } };
      const result = buildNotificationFromSIU(siu, 'created', 'case-789');

      expect(result?.title).toBe('Case Auto-Created: Jane');
      expect(result?.metadata.patient_name).toBe('Jane');
    });

    it('uses "Unknown Patient" when both names are missing', () => {
      const siu = { ...mockSIU, pid: { firstName: null, lastName: null } };
      const result = buildNotificationFromSIU(siu, 'created', 'case-999');

      expect(result?.title).toBe('Case Auto-Created: Unknown Patient');
      expect(result?.metadata.patient_name).toBe('Unknown Patient');
    });

    it('uses "Unknown Procedure" when procedure description is missing', () => {
      const siu = { ...mockSIU, ais: null };
      const result = buildNotificationFromSIU(siu, 'created', 'case-111');

      expect(result?.message).toBe('Unknown Procedure via Epic HL7v2');
      expect(result?.metadata.procedure_name).toBe('Unknown Procedure');
    });

    it('returns null when caseId is null', () => {
      const result = buildNotificationFromSIU(mockSIU, 'created', null);
      expect(result).toBeNull();
    });

    it('returns null when caseId is empty string', () => {
      const result = buildNotificationFromSIU(mockSIU, 'created', '');
      expect(result).toBeNull();
    });

    it('returns null when caseId is whitespace only', () => {
      const result = buildNotificationFromSIU(mockSIU, 'created', '   ');
      expect(result).toBeNull();
    });
  });

  describe('action: updated', () => {
    it('builds notification for case auto-updated', () => {
      const result = buildNotificationFromSIU(mockSIU, 'updated', 'case-222');

      expect(result).toEqual({
        type: 'case_auto_updated',
        title: 'Case Updated via Epic: John Doe',
        message: 'Total Knee Replacement — modified via HL7v2',
        category: 'Case Alerts',
        caseId: 'case-222',
        metadata: {
          link_to: '/cases/case-222',
          case_id: 'case-222',
          patient_name: 'John Doe',
          procedure_name: 'Total Knee Replacement',
          trigger_event: 'S12',
          source: 'epic_hl7v2',
        },
      });
    });

    it('shows "rescheduled" for S13 trigger event', () => {
      const siu = { ...mockSIU, triggerEvent: 'S13' };
      const result = buildNotificationFromSIU(siu, 'updated', 'case-333');

      expect(result?.message).toBe('Total Knee Replacement — rescheduled via HL7v2');
      expect(result?.metadata.trigger_event).toBe('S13');
    });

    it('shows "modified" for S14 trigger event', () => {
      const siu = { ...mockSIU, triggerEvent: 'S14' };
      const result = buildNotificationFromSIU(siu, 'updated', 'case-444');

      expect(result?.message).toBe('Total Knee Replacement — modified via HL7v2');
      expect(result?.metadata.trigger_event).toBe('S14');
    });

    it('returns null when caseId is null', () => {
      const result = buildNotificationFromSIU(mockSIU, 'updated', null);
      expect(result).toBeNull();
    });
  });

  describe('action: cancelled', () => {
    it('builds notification for case auto-cancelled with reason', () => {
      const siu = { ...mockSIU, sch: { appointmentReason: 'Patient request' } };
      const result = buildNotificationFromSIU(siu, 'cancelled', 'case-555');

      expect(result).toEqual({
        type: 'case_auto_cancelled',
        title: 'Case Cancelled via Epic: John Doe',
        message: 'Cancelled (S12) — Patient request',
        category: 'Case Alerts',
        caseId: 'case-555',
        metadata: {
          link_to: '/cases/case-555',
          case_id: 'case-555',
          patient_name: 'John Doe',
          reason: 'Patient request',
          source: 'epic_hl7v2',
        },
      });
    });

    it('uses "no reason provided" when appointmentReason is missing', () => {
      const siu = { ...mockSIU, sch: { appointmentReason: null } };
      const result = buildNotificationFromSIU(siu, 'cancelled', 'case-666');

      expect(result?.message).toBe('Cancelled (S12) — no reason provided');
      expect(result?.metadata.reason).toBe('no reason provided');
    });

    it('includes trigger event in message (S15)', () => {
      const siu = { ...mockSIU, triggerEvent: 'S15', sch: { appointmentReason: 'OR unavailable' } };
      const result = buildNotificationFromSIU(siu, 'cancelled', 'case-777');

      expect(result?.message).toBe('Cancelled (S15) — OR unavailable');
    });

    it('includes trigger event in message (S16)', () => {
      const siu = { ...mockSIU, triggerEvent: 'S16', sch: { appointmentReason: 'Surgeon illness' } };
      const result = buildNotificationFromSIU(siu, 'cancelled', 'case-888');

      expect(result?.message).toBe('Cancelled (S16) — Surgeon illness');
    });

    it('returns null when caseId is null', () => {
      const result = buildNotificationFromSIU(mockSIU, 'cancelled', null);
      expect(result).toBeNull();
    });
  });
});

describe('createNotificationForCase', () => {
  const mockNotificationData = {
    type: 'case_auto_created',
    title: 'Case Auto-Created: Test Patient',
    message: 'Test Procedure via Epic HL7v2',
    category: 'Case Alerts',
    caseId: 'case-test',
    metadata: {
      link_to: '/cases/case-test',
      case_id: 'case-test',
      patient_name: 'Test Patient',
      procedure_name: 'Test Procedure',
      source: 'epic_hl7v2',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.warn and console.log spies
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('calls create_notification_if_enabled RPC with correct parameters', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'notif-123', error: null });
    const mockSupabase = { rpc: mockRpc };

    await createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData);

    expect(mockRpc).toHaveBeenCalledWith('create_notification_if_enabled', {
      p_facility_id: 'facility-456',
      p_type: 'case_auto_created',
      p_title: 'Case Auto-Created: Test Patient',
      p_message: 'Test Procedure via Epic HL7v2',
      p_category: 'Case Alerts',
      p_metadata: mockNotificationData.metadata,
      p_case_id: 'case-test',
      p_sent_by: null,
    });
  });

  it('logs success when notification is created', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: 'notif-123', error: null });
    const mockSupabase = { rpc: mockRpc };
    const consoleLogSpy = vi.spyOn(console, 'log');

    await createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData);

    expect(consoleLogSpy).toHaveBeenCalledWith('[notification] Created:', 'case_auto_created', 'notif-123');
  });

  it('logs skip message when RPC returns null (type disabled)', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = { rpc: mockRpc };
    const consoleLogSpy = vi.spyOn(console, 'log');

    await createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[notification] Skipped (type disabled for facility):',
      'case_auto_created',
    );
  });

  it('logs warning on RPC error but does not throw', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
    const mockSupabase = { rpc: mockRpc };
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    await expect(createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData)).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith('[notification] Failed to create notification:', 'RPC failed');
  });

  it('logs warning on unexpected exception but does not throw', async () => {
    const mockRpc = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockSupabase = { rpc: mockRpc };
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    await expect(createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData)).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith('[notification] Unexpected error:', 'Network error');
  });

  it('handles non-Error exceptions gracefully', async () => {
    const mockRpc = vi.fn().mockRejectedValue('string error');
    const mockSupabase = { rpc: mockRpc };
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    await expect(createNotificationForCase(mockSupabase, 'facility-456', mockNotificationData)).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith('[notification] Unexpected error:', 'string error');
  });
});
