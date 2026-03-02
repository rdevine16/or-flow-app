/**
 * usePhiAudit
 *
 * Hook that logs PHI access events when a user expands a raw HL7v2 message
 * in the Logs tab or Review Queue. Records to both:
 * 1. ehr_phi_access_log table (dedicated PHI tracking)
 * 2. audit_log table (via ehrAudit for unified audit trail)
 */

import { useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ehrDAL } from '@/lib/dal/ehr'
import { ehrAudit } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

const log = logger('phi-audit')

interface UsePhiAuditOptions {
  userId: string | undefined
  userEmail?: string
  facilityId: string | undefined
}

/**
 * Returns a callback to log PHI access. Deduplicates rapid expansions
 * of the same log entry (only logs once per entry per session).
 */
export function usePhiAudit({ userId, userEmail, facilityId }: UsePhiAuditOptions) {
  const supabaseRef = useRef(createClient())
  // Track which entries have already been logged this session to avoid duplicate writes
  const loggedRef = useRef<Set<string>>(new Set())

  const logAccess = useCallback(
    async (logEntryId: string, messageType: string) => {
      if (!userId || !facilityId) return
      if (loggedRef.current.has(logEntryId)) return

      // Mark as logged immediately (optimistic — prevents duplicate calls)
      loggedRef.current.add(logEntryId)

      try {
        // Write to dedicated PHI access log table
        const { error: phiError } = await ehrDAL.logPhiAccess(supabaseRef.current, {
          userId,
          userEmail,
          facilityId,
          logEntryId,
          accessType: 'view_raw_message',
        })

        if (phiError) {
          log.warn('Failed to write PHI access log', { logEntryId, error: phiError.message })
        }

        // Also record in unified audit trail
        await ehrAudit.phiAccessed(supabaseRef.current, facilityId, logEntryId, messageType)
      } catch (err) {
        log.error('PHI audit logging failed', { logEntryId, error: String(err) })
      }
    },
    [userId, userEmail, facilityId],
  )

  return { logAccess }
}
