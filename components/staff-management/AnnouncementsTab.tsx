// components/staff-management/AnnouncementsTab.tsx
// Tab content for Staff Management → Announcements.
// Shows a "Create Announcement" button, summary stats, and the history table.
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAnnouncements } from '@/hooks/useAnnouncements'
import { useUser } from '@/lib/UserContext'
import { Button } from '@/components/ui/Button'
import { CreateAnnouncementDialog } from '@/components/staff-management/CreateAnnouncementDialog'
import { AnnouncementHistoryTable } from '@/components/staff-management/AnnouncementHistoryTable'
import { Plus, Megaphone, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import type { Announcement } from '@/types/announcements'

// ============================================
// TYPES
// ============================================

interface AnnouncementsTabProps {
  facilityId: string
}

// ============================================
// COMPONENT
// ============================================

export function AnnouncementsTab({ facilityId }: AnnouncementsTabProps) {
  const { userData } = useUser()
  const userId = userData.userId ?? ''

  const {
    announcements,
    loading,
    filters,
    setFilters,
    clearFilters,
    createAnnouncement,
    updateAnnouncement,
    deactivateAnnouncement,
    deleteAnnouncement,
  } = useAnnouncements({ facilityId })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  // Stats from loaded data
  const stats = useMemo(() => {
    const active = announcements.filter((a) => a.status === 'active').length
    const scheduled = announcements.filter((a) => a.status === 'scheduled').length
    const expired = announcements.filter((a) => a.status === 'expired' || a.status === 'deactivated').length
    return { active, scheduled, expired }
  }, [announcements])

  // Dialog handlers
  const handleOpenCreate = useCallback(() => {
    setEditingAnnouncement(null)
    setDialogOpen(true)
  }, [])

  const handleEdit = useCallback((announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setDialogOpen(true)
  }, [])

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false)
    setEditingAnnouncement(null)
  }, [])

  const handleSave = useCallback(
    async (input: Parameters<typeof createAnnouncement>[1]) => {
      return createAnnouncement(userId, input)
    },
    [createAnnouncement, userId]
  )

  const handleUpdate = useCallback(
    async (id: string, input: Parameters<typeof updateAnnouncement>[1]) => {
      return updateAnnouncement(id, input)
    },
    [updateAnnouncement]
  )

  const handleDeactivate = useCallback(
    async (announcement: Announcement) => {
      await deactivateAnnouncement(announcement.id, userId)
    },
    [deactivateAnnouncement, userId]
  )

  const handleDelete = useCallback(
    async (announcement: Announcement) => {
      await deleteAnnouncement(announcement.id)
    },
    [deleteAnnouncement]
  )

  return (
    <div className="space-y-6">
      {/* Header + Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage facility-wide announcements
          </p>
        </div>
        <Button variant="primary" size="md" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Create Announcement
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{stats.active}</p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{stats.scheduled}</p>
            <p className="text-xs text-slate-500">Scheduled</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{stats.expired}</p>
            <p className="text-xs text-slate-500">Expired / Deactivated</p>
          </div>
        </div>
      </div>

      {/* History table */}
      <AnnouncementHistoryTable
        announcements={announcements}
        loading={loading}
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={clearFilters}
        onEdit={handleEdit}
        onDeactivate={handleDeactivate}
        onDelete={handleDelete}
      />

      {/* Create/Edit dialog */}
      <CreateAnnouncementDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSave={handleSave}
        onUpdate={handleUpdate}
        editing={editingAnnouncement}
      />
    </div>
  )
}
