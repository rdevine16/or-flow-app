// hooks/useSurgeonColors.ts

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { surgeonColorAudit } from '@/lib/audit-logger'
import { SurgeonColor, SURGEON_COLOR_PALETTE, getNextAvailableColor } from '@/types/block-scheduling'

interface UseSurgeonColorsOptions {
  facilityId: string | null
}

interface SurgeonInfo {
  id: string
  first_name: string
  last_name: string
}

export function useSurgeonColors({ facilityId }: UseSurgeonColorsOptions) {
const supabase = createClient()
const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [colors, setColors] = useState<SurgeonColor[]>([])

  // Fetch all surgeon colors for facility
  const fetchColors = useCallback(async () => {
    if (!facilityId) return []

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('surgeon_colors')
        .select('*')
        .eq('facility_id', facilityId)

      if (fetchError) throw fetchError

      setColors(data || [])
      return data || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch colors'
      setError(message)
      console.error('Error fetching surgeon colors:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  // Get color for a surgeon (returns existing or auto-assigns new)
  const getColorForSurgeon = useCallback(
    async (surgeon: SurgeonInfo): Promise<string> => {
      if (!facilityId) return SURGEON_COLOR_PALETTE[0]

      // Check if surgeon already has a color
      const existing = colors.find(c => c.surgeon_id === surgeon.id)
      if (existing) return existing.color

      // Auto-assign a new color
      const usedColors = colors.map(c => c.color)
      const newColor = getNextAvailableColor(usedColors)

      try {
        const { data, error: insertError } = await supabase
          .from('surgeon_colors')
          .insert({
            facility_id: facilityId,
            surgeon_id: surgeon.id,
            color: newColor,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Audit log
        const surgeonName = `Dr. ${surgeon.last_name}`
        await surgeonColorAudit.assigned(supabase, surgeon.id, surgeonName, newColor, facilityId)

        // Update local state
        setColors(prev => [...prev, data])

        return newColor
      } catch (err) {
        console.error('Error assigning surgeon color:', err)
        return newColor // Return the color even if save fails
      }
    },
    [facilityId, colors, supabase]
  )

  // Change a surgeon's color
  const changeColor = useCallback(
    async (surgeon: SurgeonInfo, newColor: string): Promise<boolean> => {
      if (!facilityId) return false

      const existing = colors.find(c => c.surgeon_id === surgeon.id)
      const oldColor = existing?.color || SURGEON_COLOR_PALETTE[0]

      setLoading(true)
      setError(null)

      try {
        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('surgeon_colors')
            .update({ color: newColor })
            .eq('id', existing.id)

          if (updateError) throw updateError
        } else {
          // Insert new
          const { data, error: insertError } = await supabase
            .from('surgeon_colors')
            .insert({
              facility_id: facilityId,
              surgeon_id: surgeon.id,
              color: newColor,
            })
            .select()
            .single()

          if (insertError) throw insertError

          setColors(prev => [...prev, data])
        }

        // Audit log
        const surgeonName = `Dr. ${surgeon.last_name}`
        if (existing) {
          await surgeonColorAudit.changed(
            supabase,
            surgeon.id,
            surgeonName,
            oldColor,
            newColor,
            facilityId
          )
        } else {
          await surgeonColorAudit.assigned(supabase, surgeon.id, surgeonName, newColor, facilityId)
        }

        // Update local state
        setColors(prev =>
          prev.map(c => (c.surgeon_id === surgeon.id ? { ...c, color: newColor } : c))
        )

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to change color'
        setError(message)
        console.error('Error changing surgeon color:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [facilityId, colors, supabase]
  )

  // Get color map (surgeonId -> color)
  const getColorMap = useCallback((): Record<string, string> => {
    const map: Record<string, string> = {}
    colors.forEach(c => {
      map[c.surgeon_id] = c.color
    })
    return map
  }, [colors])

  return {
    colors,
    loading,
    error,
    fetchColors,
    getColorForSurgeon,
    changeColor,
    getColorMap,
    colorPalette: SURGEON_COLOR_PALETTE,
  }
}