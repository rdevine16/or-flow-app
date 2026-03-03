/**
 * useIntegrationRealtime
 *
 * Subscribes to Supabase Realtime for ehr_integration_log INSERTs.
 * New log entries appear live — used by Logs tab and Review Queue.
 */

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { EhrIntegrationLog } from '@/lib/integrations/shared/integration-types'

interface UseIntegrationRealtimeOptions {
  facilityId: string | undefined
  /** Only receive entries for this specific integration */
  integrationId?: string
  /** Only subscribe to entries with these statuses */
  statusFilter?: string[]
  /** Called when a new log entry is inserted */
  onInsert?: (entry: EhrIntegrationLog) => void
  /** Whether the subscription is enabled (default: true) */
  enabled?: boolean
}

export function useIntegrationRealtime({
  facilityId,
  integrationId,
  statusFilter,
  onInsert,
  enabled = true,
}: UseIntegrationRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())
  const [connected, setConnected] = useState(false)

  // Store callbacks in refs to avoid re-subscribing on every render
  const onInsertRef = useRef(onInsert)
  onInsertRef.current = onInsert
  const statusFilterRef = useRef(statusFilter)
  statusFilterRef.current = statusFilter
  const integrationIdRef = useRef(integrationId)
  integrationIdRef.current = integrationId

  useEffect(() => {
    if (!enabled || !facilityId) {
      if (channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current)
        channelRef.current = null
      }
      setConnected(false)
      return
    }

    const channel = supabaseRef.current
      .channel(`ehr-log-${facilityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ehr_integration_log',
          filter: `facility_id=eq.${facilityId}`,
        },
        (payload) => {
          const newEntry = payload.new as EhrIntegrationLog
          // Filter by integration ID if specified (only show entries for this system)
          if (integrationIdRef.current && newEntry.integration_id !== integrationIdRef.current) {
            return
          }
          const filter = statusFilterRef.current
          if (filter && !filter.includes(newEntry.processing_status)) {
            return
          }
          onInsertRef.current?.(newEntry)
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabaseRef.current.removeChannel(channel)
      channelRef.current = null
    }
  }, [facilityId, enabled])

  return { connected }
}
