/**
 * Notification Helper — Build and create notifications from SIU processing results.
 *
 * Called after successful case creation/update/cancellation in import-service.ts.
 * Uses the `create_notification_if_enabled()` DB function which checks
 * facility_notification_settings before inserting.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SIUMessage, EhrIntegrationType } from './types.ts';
import { EHR_SYSTEM_DISPLAY_NAMES } from './types.ts';

interface NotificationData {
  type: string;
  title: string;
  message: string;
  category: string;
  metadata: Record<string, unknown>;
  caseId: string;
}

/**
 * Build notification data from a successfully processed SIU message.
 * Returns null if notification should not be created (e.g. no case ID).
 */
export function buildNotificationFromSIU(
  siu: SIUMessage,
  action: 'created' | 'updated' | 'cancelled',
  caseId: string | null,
  integrationType: EhrIntegrationType = 'epic_hl7v2',
): NotificationData | null {
  if (!caseId || caseId.trim() === '') return null;

  const patientName = [siu.pid.firstName, siu.pid.lastName].filter(Boolean).join(' ').trim() || 'Unknown Patient';
  const procedureName = siu.ais?.procedureDescription || 'Unknown Procedure';
  const displayName = EHR_SYSTEM_DISPLAY_NAMES[integrationType] || integrationType;

  switch (action) {
    case 'created':
      return {
        type: 'case_auto_created',
        title: `Case Auto-Created: ${patientName}`,
        message: `${procedureName} via ${displayName} HL7v2`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          procedure_name: procedureName,
          source: integrationType,
        },
      };

    case 'updated':
      return {
        type: 'case_auto_updated',
        title: `Case Updated via ${displayName}: ${patientName}`,
        message: `${procedureName} — ${siu.triggerEvent === 'S13' ? 'rescheduled' : 'modified'} via HL7v2`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          procedure_name: procedureName,
          trigger_event: siu.triggerEvent,
          source: integrationType,
        },
      };

    case 'cancelled': {
      const reason = siu.sch.appointmentReason || 'no reason provided';
      return {
        type: 'case_auto_cancelled',
        title: `Case Cancelled via ${displayName}: ${patientName}`,
        message: `Cancelled (${siu.triggerEvent}) — ${reason}`,
        category: 'Case Alerts',
        caseId,
        metadata: {
          link_to: `/cases/${caseId}`,
          case_id: caseId,
          patient_name: patientName,
          reason,
          source: integrationType,
        },
      };
    }

    default:
      return null;
  }
}

/**
 * Create a notification via the `create_notification_if_enabled()` RPC.
 * Logs but does not throw on failure — notifications are non-critical
 * and should never block case processing.
 */
export async function createNotificationForCase(
  supabase: SupabaseClient,
  facilityId: string,
  notificationData: NotificationData,
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
