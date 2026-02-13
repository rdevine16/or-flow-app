// hooks/useSurgeonColors.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { surgeonPalette } from '@/lib/design-tokens'

const log = logger('useSurgeonColors')

// Canonical palette from design-tokens.ts
const DEFAULT_COLORS = surgeonPalette.hex

interface UseSurgeonColorsOptions {
  facilityId: string | null
}

// Read saved colors from localStorage
function getStoredColors(facilityId: string): Record<string, string> {
  try {
    const stored = localStorage.getItem(`surgeon-colors-${facilityId}`)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function useSurgeonColors({ facilityId }: UseSurgeonColorsOptions) {
  // Stabilize the supabase client so useCallback deps don't change every render
  const supabaseRef = useRef(createClient())
  const [colors, setColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Fetch colors from database, merging with localStorage as fallback
  const fetchColors = useCallback(async (surgeonIds: string[]) => {
    if (!facilityId || surgeonIds.length === 0) return

    setLoading(true)
    try {
      // Start with localStorage colors (always available, always up-to-date)
      const storedColors = getStoredColors(facilityId)

      // Try to fetch from surgeon_colors table
      const { data, error } = await supabaseRef.current
        .from('surgeon_colors')
        .select('surgeon_id, color')
        .eq('facility_id', facilityId)
        .in('surgeon_id', surgeonIds)

      // Build the final color map:
      // Priority: Supabase DB > localStorage > default palette
      const colorMap: Record<string, string> = {}

      // Layer 1: Start with defaults
      surgeonIds.forEach((id, index) => {
        colorMap[id] = DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      })

      // Layer 2: Override with localStorage (survives even if DB has no table)
      Object.entries(storedColors).forEach(([id, color]) => {
        if (surgeonIds.includes(id)) {
          colorMap[id] = color
        }
      })

      // Layer 3: Override with DB values (source of truth when available)
      if (!error && data && data.length > 0) {
        data.forEach(row => {
          colorMap[row.surgeon_id] = row.color
        })
      }

      setColors(colorMap)
    } catch (err) {
      log.error('Error fetching surgeon colors:', err)
      // Pure localStorage fallback
      const storedColors = getStoredColors(facilityId)
      const colorMap: Record<string, string> = {}
      surgeonIds.forEach((id, index) => {
        colorMap[id] = storedColors[id] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      })
      setColors(colorMap)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  // Set a surgeon's color
  const setColor = useCallback(async (surgeonId: string, color: string) => {
    if (!facilityId) return

    // Update local state immediately (optimistic)
    setColors(prev => {
      const updated = { ...prev, [surgeonId]: color }
      // Always save to localStorage — this is the reliable persistence layer
      localStorage.setItem(`surgeon-colors-${facilityId}`, JSON.stringify(updated))
      return updated
    })

    // Try to save to database (best-effort)
    try {
      const { error } = await supabaseRef.current
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
        log.info('Could not save color to database, using localStorage')
      }
    } catch (err) {
      log.error('Error saving surgeon color:', err)
    }
  }, [facilityId])

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