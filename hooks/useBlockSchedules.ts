// hooks/useBlockSchedules.ts

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { blockScheduleAudit } from '@/lib/audit-logger'
import {
  BlockSchedule,
  ExpandedBlock,
  CreateBlockInput,
  UpdateBlockInput,
  DAY_OF_WEEK_LABELS,
  RECURRENCE_LABELS,
} from '@/types/block-scheduling'

interface UseBlockSchedulesOptions {
  facilityId: string | null
}

interface SurgeonInfo {
  id: string
  first_name: string
  last_name: string
}

export function useBlockSchedules({ facilityId }: UseBlockSchedulesOptions) {
const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<ExpandedBlock[]>([])

  // Fetch blocks for a date range (uses RPC function)
  const fetchBlocksForRange = useCallback(
    async (startDate: string, endDate: string) => {
      if (!facilityId) return []

      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase.rpc(
          'get_blocks_for_date_range',
          {
            p_facility_id: facilityId,
            p_start_date: startDate,
            p_end_date: endDate,
          }
        )

        if (fetchError) throw fetchError

        setBlocks(data || [])
        return data || []
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch blocks'
        setError(message)
        console.error('Error fetching blocks:', err)
        return []
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // Fetch raw block schedules (for editing)
  const fetchBlockSchedules = useCallback(async () => {
    if (!facilityId) return []

    try {
      const { data, error: fetchError } = await supabase
        .from('block_schedules')
        .select(`
          *,
          surgeon:users!block_schedules_surgeon_id_fkey(id, first_name, last_name)
        `)
        .eq('facility_id', facilityId)
        .is('deleted_at', null)
        .order('day_of_week')
        .order('start_time')

      if (fetchError) throw fetchError
      return data || []
    } catch (err) {
      console.error('Error fetching block schedules:', err)
      return []
    }
  }, [facilityId, supabase])

  // Create a new block
  const createBlock = useCallback(
    async (input: CreateBlockInput, surgeon: SurgeonInfo): Promise<BlockSchedule | null> => {
      if (!facilityId) return null

      setLoading(true)
      setError(null)

      try {
        const { data, error: insertError } = await supabase
          .from('block_schedules')
          .insert({
            facility_id: facilityId,
            ...input,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Audit log
        const surgeonName = `Dr. ${surgeon.last_name}`
        const dayName = DAY_OF_WEEK_LABELS[input.day_of_week]
        await blockScheduleAudit.created(
          supabase,
          data.id,
          surgeonName,
          dayName,
          input.start_time,
          input.end_time,
          RECURRENCE_LABELS[input.recurrence_type],
          facilityId
        )

        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create block'
        setError(message)
        console.error('Error creating block:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // Update a block
  const updateBlock = useCallback(
    async (
      blockId: string,
      input: UpdateBlockInput,
      surgeon: SurgeonInfo,
      oldValues: Partial<BlockSchedule>
    ): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: updateError } = await supabase
          .from('block_schedules')
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq('id', blockId)

        if (updateError) throw updateError

        // Build audit values
        const surgeonName = `Dr. ${surgeon.last_name}`
        const auditOld: Record<string, string | null | undefined> = {}
        const auditNew: Record<string, string | null | undefined> = {}

        if (input.day_of_week !== undefined && input.day_of_week !== oldValues.day_of_week) {
          auditOld.day_of_week = DAY_OF_WEEK_LABELS[oldValues.day_of_week!]
          auditNew.day_of_week = DAY_OF_WEEK_LABELS[input.day_of_week]
        }
        if (input.start_time !== undefined && input.start_time !== oldValues.start_time) {
          auditOld.start_time = oldValues.start_time
          auditNew.start_time = input.start_time
        }
        if (input.end_time !== undefined && input.end_time !== oldValues.end_time) {
          auditOld.end_time = oldValues.end_time
          auditNew.end_time = input.end_time
        }
        if (input.recurrence_type !== undefined && input.recurrence_type !== oldValues.recurrence_type) {
          auditOld.recurrence = RECURRENCE_LABELS[oldValues.recurrence_type!]
          auditNew.recurrence = RECURRENCE_LABELS[input.recurrence_type]
        }
        if (input.effective_end !== undefined && input.effective_end !== oldValues.effective_end) {
          auditOld.effective_end = oldValues.effective_end
          auditNew.effective_end = input.effective_end
        }

        await blockScheduleAudit.updated(
          supabase,
          blockId,
          surgeonName,
          auditOld,
          auditNew,
          facilityId
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update block'
        setError(message)
        console.error('Error updating block:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // Soft delete a block
  const deleteBlock = useCallback(
    async (blockId: string, surgeon: SurgeonInfo, dayOfWeek: number): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: deleteError } = await supabase
          .from('block_schedules')
          .update({
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', blockId)

        if (deleteError) throw deleteError

        const surgeonName = `Dr. ${surgeon.last_name}`
        const dayName = DAY_OF_WEEK_LABELS[dayOfWeek]
        await blockScheduleAudit.deleted(supabase, blockId, surgeonName, dayName, facilityId)

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete block'
        setError(message)
        console.error('Error deleting block:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // Restore a soft-deleted block
  const restoreBlock = useCallback(
    async (blockId: string, surgeon: SurgeonInfo, dayOfWeek: number): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        const { error: restoreError } = await supabase
          .from('block_schedules')
          .update({
            deleted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', blockId)

        if (restoreError) throw restoreError

        const surgeonName = `Dr. ${surgeon.last_name}`
        const dayName = DAY_OF_WEEK_LABELS[dayOfWeek]
        await blockScheduleAudit.restored(supabase, blockId, surgeonName, dayName, facilityId)

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restore block'
        setError(message)
        console.error('Error restoring block:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  // Add an exception date to a recurring block (skip single occurrence)
  const addExceptionDate = useCallback(
    async (blockId: string, exceptionDate: string, surgeon: SurgeonInfo): Promise<boolean> => {
      if (!facilityId) return false

      setLoading(true)
      setError(null)

      try {
        // First fetch current exception dates
        const { data: currentBlock, error: fetchError } = await supabase
          .from('block_schedules')
          .select('exception_dates')
          .eq('id', blockId)
          .single()

        if (fetchError) throw fetchError

        // Add new date to exceptions array
        const currentExceptions = currentBlock?.exception_dates || []
        const updatedExceptions = [...currentExceptions, exceptionDate]

        // Update the block
        const { error: updateError } = await supabase
          .from('block_schedules')
          .update({
            exception_dates: updatedExceptions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', blockId)

        if (updateError) throw updateError

        // Audit log
        const surgeonName = `Dr. ${surgeon.last_name}`
        await blockScheduleAudit.updated(
          supabase,
          blockId,
          surgeonName,
          { exception_dates: currentExceptions.join(', ') || 'none' },
          { exception_dates: updatedExceptions.join(', ') },
          facilityId
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add exception date'
        setError(message)
        console.error('Error adding exception date:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, supabase]
  )

  return {
    blocks,
    loading,
    error,
    fetchBlocksForRange,
    fetchBlockSchedules,
    createBlock,
    updateBlock,
    deleteBlock,
    addExceptionDate,
    restoreBlock,
  }
}