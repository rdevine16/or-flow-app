// hooks/useSurgeonColors.ts
'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

// Default color palette - assigned to surgeons in order
const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
]

interface UseSurgeonColorsOptions {
  facilityId: string | null
}

export function useSurgeonColors({ facilityId }: UseSurgeonColorsOptions) {
  const supabase = createClient()
  const [colors, setColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Fetch colors from database (or localStorage as fallback)
  const fetchColors = useCallback(async (surgeonIds: string[]) => {
    if (!facilityId || surgeonIds.length === 0) return

    setLoading(true)
    try {
      // Try to fetch from surgeon_colors table
      const { data, error } = await supabase
        .from('surgeon_colors')
        .select('surgeon_id, color')
        .eq('facility_id', facilityId)
        .in('surgeon_id', surgeonIds)

      if (!error && data) {
        const colorMap: Record<string, string> = {}
        data.forEach(row => {
          colorMap[row.surgeon_id] = row.color
        })
        
        // Assign default colors to surgeons without a color
        surgeonIds.forEach((id, index) => {
          if (!colorMap[id]) {
            colorMap[id] = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
          }
        })
        
        setColors(colorMap)
      } else {
        // Table doesn't exist or error - use localStorage fallback
        const stored = localStorage.getItem(`surgeon-colors-${facilityId}`)
        if (stored) {
          setColors(JSON.parse(stored))
        } else {
          // Assign default colors
          const colorMap: Record<string, string> = {}
          surgeonIds.forEach((id, index) => {
            colorMap[id] = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
          })
          setColors(colorMap)
        }
      }
    } catch (err) {
      console.error('Error fetching surgeon colors:', err)
      // Fallback to localStorage
      const stored = localStorage.getItem(`surgeon-colors-${facilityId}`)
      if (stored) {
        setColors(JSON.parse(stored))
      }
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase])

  // Set a surgeon's color
  const setColor = useCallback(async (surgeonId: string, color: string) => {
    if (!facilityId) return

    // Update local state immediately
    setColors(prev => {
      const updated = { ...prev, [surgeonId]: color }
      // Also save to localStorage as backup
      localStorage.setItem(`surgeon-colors-${facilityId}`, JSON.stringify(updated))
      return updated
    })

    // Try to save to database
    try {
      const { error } = await supabase
        .from('surgeon_colors')
        .upsert({
          facility_id: facilityId,
          surgeon_id: surgeonId,
          color: color,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'facility_id,surgeon_id'
        })

      if (error) {
        // Table might not exist - that's ok, localStorage is the backup
        console.log('Could not save color to database, using localStorage')
      }
    } catch (err) {
      console.error('Error saving surgeon color:', err)
    }
  }, [facilityId, supabase])

  // Get the color map (for passing to components)
  const getColorMap = useCallback(() => {
    return colors
  }, [colors])

  return {
    colors,
    loading,
    fetchColors,
    setColor,
    getColorMap,
  }
}