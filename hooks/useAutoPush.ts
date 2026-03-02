'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import type { AutoPushAction } from '@/lib/hl7v2/test-harness/auto-push'
import type { EhrTestScheduleWithEntities } from '@/lib/integrations/shared/integration-types'
import type { SIUTriggerEvent } from '@/lib/hl7v2/types'
import { logger } from '@/lib/logger'

const log = logger('useAutoPush')

// -- Types -------------------------------------------------------------------

export interface AutoPushStatus {
  scheduleId: string
  state: 'pending' | 'success' | 'error'
  message?: string
}

interface AutoPushHookReturn {
  enabled: boolean
  setEnabled: (value: boolean) => void
  push: (
    scheduleId: string,
    action: AutoPushAction,
    scheduleData?: EhrTestScheduleWithEntities,
    triggerEventOverride?: SIUTriggerEvent,
  ) => Promise<boolean>
  getStatus: (scheduleId: string) => AutoPushStatus | undefined
  clearStatus: (scheduleId: string) => void
}

// -- LocalStorage key --------------------------------------------------------

function storageKey(facilityId: string): string {
  return `hl7v2-auto-push-${facilityId}`
}

// -- Hook --------------------------------------------------------------------

export function useAutoPush(facilityId: string): AutoPushHookReturn {
  const { showToast } = useToast()

  // Read initial enabled state from localStorage
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !facilityId) return false
    try {
      return localStorage.getItem(storageKey(facilityId)) === 'true'
    } catch {
      return false
    }
  })

  // Track per-row push statuses
  const [statuses, setStatuses] = useState<Map<string, AutoPushStatus>>(new Map())

  // Timer refs for auto-clearing statuses
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Sync enabled state when facilityId changes
  useEffect(() => {
    if (typeof window === 'undefined' || !facilityId) {
      setEnabledState(false)
      return
    }
    try {
      setEnabledState(localStorage.getItem(storageKey(facilityId)) === 'true')
    } catch {
      setEnabledState(false)
    }
  }, [facilityId])

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // Toggle enabled and persist to localStorage
  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value)
      if (typeof window !== 'undefined' && facilityId) {
        try {
          localStorage.setItem(storageKey(facilityId), String(value))
        } catch {
          // localStorage not available
        }
      }
    },
    [facilityId],
  )

  // Set status for a schedule entry with auto-clear after 5s
  const setStatusWithClear = useCallback(
    (scheduleId: string, status: AutoPushStatus) => {
      setStatuses((prev) => {
        const next = new Map(prev)
        next.set(scheduleId, status)
        return next
      })

      // Clear previous timer if any
      const existing = timersRef.current.get(scheduleId)
      if (existing) clearTimeout(existing)

      // Auto-clear after 5 seconds for success/error states
      if (status.state !== 'pending') {
        const timer = setTimeout(() => {
          setStatuses((prev) => {
            const next = new Map(prev)
            next.delete(scheduleId)
            return next
          })
          timersRef.current.delete(scheduleId)
        }, 5000)
        timersRef.current.set(scheduleId, timer)
      }
    },
    [],
  )

  // Execute push for a single schedule entry
  const push = useCallback(
    async (
      scheduleId: string,
      action: AutoPushAction,
      scheduleData?: EhrTestScheduleWithEntities,
      triggerEventOverride?: SIUTriggerEvent,
    ): Promise<boolean> => {
      if (!facilityId) return false

      // Set pending status
      setStatusWithClear(scheduleId, { scheduleId, state: 'pending' })

      try {
        const res = await fetch('/api/integrations/test-harness/auto-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId,
            facilityId,
            action,
            scheduleData,
            triggerEventOverride,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(err.error || `HTTP ${res.status}`)
        }

        const result = await res.json()

        if (result.skipped) {
          setStatusWithClear(scheduleId, {
            scheduleId,
            state: 'error',
            message: 'No integration configured',
          })
          showToast({
            type: 'warning',
            title: 'Auto-push skipped',
            message: 'No HL7v2 integration configured for this facility',
          })
          return false
        }

        if (result.success) {
          const triggerLabel = result.triggerEvent || action.toUpperCase()
          setStatusWithClear(scheduleId, {
            scheduleId,
            state: 'success',
            message: `${triggerLabel} sent`,
          })
          return true
        }

        // Failed
        setStatusWithClear(scheduleId, {
          scheduleId,
          state: 'error',
          message: result.errorMessage || 'Push failed',
        })
        return false
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Push failed'
        log.error('Auto-push failed', { scheduleId, action, error: message })
        setStatusWithClear(scheduleId, { scheduleId, state: 'error', message })
        return false
      }
    },
    [facilityId, setStatusWithClear, showToast],
  )

  const getStatus = useCallback(
    (scheduleId: string) => statuses.get(scheduleId),
    [statuses],
  )

  const clearStatus = useCallback(
    (scheduleId: string) => {
      setStatuses((prev) => {
        const next = new Map(prev)
        next.delete(scheduleId)
        return next
      })
    },
    [],
  )

  return { enabled, setEnabled, push, getStatus, clearStatus }
}
