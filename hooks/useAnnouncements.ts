// hooks/useAnnouncements.ts
// React hooks for the global announcements system.
// Provides two hooks:
//   - useAnnouncements: admin history list with CRUD + filters
//   - useActiveAnnouncements: active banners for global display

import { useState, useCallback } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { announcementsDAL } from '@/lib/dal'
import { createClient } from '@/lib/supabase'
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
} from '@/types/announcements'

// ============================================
// useAnnouncements — Admin history list
// ============================================

interface UseAnnouncementsOptions {
  facilityId: string | null | undefined
  filters?: AnnouncementFilterParams
}

export function useAnnouncements({ facilityId, filters }: UseAnnouncementsOptions) {
  const [localFilters, setLocalFilters] = useState<AnnouncementFilterParams>(
    filters ?? {}
  )

  const {
    data: announcements,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<Announcement[]>(
    async (supabase) => {
      if (!facilityId) return []
      const { data, error } = await announcementsDAL.listAnnouncements(
        supabase,
        facilityId,
        localFilters
      )
      if (error) throw error
      return data
    },
    {
      deps: [
        facilityId,
        localFilters.status,
        localFilters.priority,
        localFilters.category,
        localFilters.search,
      ],
      enabled: !!facilityId,
      initialData: [],
    }
  )

  const createAnnouncement = useCallback(
    async (
      userId: string,
      input: CreateAnnouncementInput
    ): Promise<{ success: boolean; data?: Announcement; error?: string }> => {
      if (!facilityId) return { success: false, error: 'No facility' }

      const supabase = createClient()
      const { data, error } = await announcementsDAL.createAnnouncement(
        supabase,
        facilityId,
        userId,
        input
      )

      if (error) {
        return { success: false, error: error.message }
      }

      await refetch()
      return { success: true, data: data ?? undefined }
    },
    [facilityId, refetch]
  )

  const updateAnnouncement = useCallback(
    async (
      announcementId: string,
      input: UpdateAnnouncementInput
    ): Promise<{ success: boolean; error?: string }> => {
      if (!facilityId) return { success: false, error: 'No facility' }

      const supabase = createClient()
      const { error } = await announcementsDAL.updateAnnouncement(
        supabase,
        facilityId,
        announcementId,
        input
      )

      if (error) {
        return { success: false, error: error.message }
      }

      await refetch()
      return { success: true }
    },
    [facilityId, refetch]
  )

  const deactivateAnnouncement = useCallback(
    async (
      announcementId: string,
      userId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!facilityId) return { success: false, error: 'No facility' }

      const supabase = createClient()
      const { error } = await announcementsDAL.deactivateAnnouncement(
        supabase,
        facilityId,
        announcementId,
        userId
      )

      if (error) {
        return { success: false, error: error.message }
      }

      await refetch()
      return { success: true }
    },
    [facilityId, refetch]
  )

  const deleteAnnouncement = useCallback(
    async (announcementId: string): Promise<{ success: boolean; error?: string }> => {
      if (!facilityId) return { success: false, error: 'No facility' }

      const supabase = createClient()
      const { success, error } = await announcementsDAL.deleteAnnouncement(
        supabase,
        facilityId,
        announcementId
      )

      if (!success) {
        return { success: false, error: error?.message ?? 'Delete failed' }
      }

      await refetch()
      return { success: true }
    },
    [facilityId, refetch]
  )

  const setFilters = useCallback(
    (newFilters: Partial<AnnouncementFilterParams>) => {
      setLocalFilters((prev) => ({ ...prev, ...newFilters }))
    },
    []
  )

  const clearFilters = useCallback(() => {
    setLocalFilters({})
  }, [])

  return {
    announcements: announcements ?? [],
    loading,
    error,
    refetch,
    filters: localFilters,
    setFilters,
    clearFilters,
    createAnnouncement,
    updateAnnouncement,
    deactivateAnnouncement,
    deleteAnnouncement,
  }
}

// ============================================
// useActiveAnnouncements — Global banner
// ============================================

interface UseActiveAnnouncementsOptions {
  facilityId: string | null | undefined
  userId: string | null | undefined
}

export function useActiveAnnouncements({
  facilityId,
  userId,
}: UseActiveAnnouncementsOptions) {
  const {
    data: announcements,
    loading,
    error,
    refetch,
  } = useSupabaseQuery<Announcement[]>(
    async (supabase) => {
      if (!facilityId || !userId) return []
      const { data, error } = await announcementsDAL.getActiveAnnouncements(
        supabase,
        facilityId,
        userId
      )
      if (error) throw error
      return data
    },
    {
      deps: [facilityId, userId],
      enabled: !!facilityId && !!userId,
      initialData: [],
    }
  )

  const dismissAnnouncement = useCallback(
    async (announcementId: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: 'No user' }

      const supabase = createClient()
      const { success, error } = await announcementsDAL.dismissAnnouncement(
        supabase,
        announcementId,
        userId
      )

      if (!success) {
        return { success: false, error: error?.message ?? 'Dismiss failed' }
      }

      await refetch()
      return { success: true }
    },
    [userId, refetch]
  )

  return {
    announcements: announcements ?? [],
    loading,
    error,
    refetch,
    dismissAnnouncement,
  }
}
