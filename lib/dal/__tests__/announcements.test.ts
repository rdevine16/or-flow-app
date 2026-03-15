/**
 * Unit tests for announcements DAL
 * Tests all CRUD operations, filtering, sorting, and ORbit domain patterns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { announcementsDAL } from '../announcements'
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from '@/types/announcements'

// Mock logger to avoid console noise
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}))

// Mock notifications DAL to test non-blocking notification creation
vi.mock('../notifications', () => ({
  notificationsDAL: {
    createNotification: vi.fn().mockResolvedValue({ success: true }),
  },
}))

describe('announcementsDAL', () => {
  let mockSupabase: any

  beforeEach(() => {
    // Reset mock before each test
    mockSupabase = createMockSupabase()
  })

  // ============================================
  // listAnnouncements
  // ============================================

  describe('listAnnouncements', () => {
    it('returns all active announcements for facility', async () => {
      const mockData = [
        { id: '1', title: 'Announcement 1', facility_id: 'fac-1', is_active: true, status: 'active' },
        { id: '2', title: 'Announcement 2', facility_id: 'fac-1', is_active: true, status: 'scheduled' },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockData,
            error: null,
            count: 2,
          }),
        }),
      })

      const result = await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1')

      expect(result.data).toEqual(mockData)
      expect(result.count).toBe(2)
      expect(result.error).toBeNull()
    })

    it('filters by status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: '1', status: 'active' }],
            error: null,
            count: 1,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1', { status: 'active' })

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['status', 'active'])
    })

    it('filters by priority', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: '1', priority: 'critical' }],
            error: null,
            count: 1,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1', { priority: 'critical' })

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['priority', 'critical'])
    })

    it('filters by category', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: '1', category: 'safety_alert' }],
            error: null,
            count: 1,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1', { category: 'safety_alert' })

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['category', 'safety_alert'])
    })

    it('filters by search term (ilike on title)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: '1', title: 'Maintenance Notice' }],
            error: null,
            count: 1,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1', { search: 'Maintenance' })

      const ilikeCalls = mockSupabase.from().select().ilike.mock.calls
      expect(ilikeCalls).toContainEqual(['title', '%Maintenance%'])
    })

    it('combines all 4 filters correctly (ORbit Domain: Filter Composition)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1', {
        status: 'active',
        priority: 'critical',
        category: 'safety_alert',
        search: 'Emergency',
      })

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      const ilikeCalls = mockSupabase.from().select().ilike.mock.calls

      expect(eqCalls).toContainEqual(['facility_id', 'fac-1'])
      expect(eqCalls).toContainEqual(['is_active', true])
      expect(eqCalls).toContainEqual(['status', 'active'])
      expect(eqCalls).toContainEqual(['priority', 'critical'])
      expect(eqCalls).toContainEqual(['category', 'safety_alert'])
      expect(ilikeCalls).toContainEqual(['title', '%Emergency%'])
    })

    it('always filters by facility_id (ORbit Domain: Facility Scoping)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1')

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['facility_id', 'fac-1'])
    })

    it('always filters is_active = true (ORbit Domain: Soft Deletes)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
            count: 0,
          }),
        }),
      })

      await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1')

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['is_active', true])
    })

    it('returns empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
            count: 0,
          }),
        }),
      })

      const result = await announcementsDAL.listAnnouncements(mockSupabase, 'fac-1')

      expect(result.data).toEqual([])
      expect(result.error).toEqual({ message: 'Database error' })
      expect(result.count).toBe(0)
    })
  })

  // ============================================
  // getActiveAnnouncements
  // ============================================

  describe('getActiveAnnouncements', () => {
    it('fetches only active announcements', async () => {
      // First call: fetch announcements
      // Second call: fetch dismissals
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: '1', status: 'active', priority: 'normal', created_at: '2026-03-15T10:00:00Z' },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        })

      const result = await announcementsDAL.getActiveAnnouncements(mockSupabase, 'fac-1', 'user-1')

      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('active')
    })

    it('filters out dismissed announcements', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'ann-1', priority: 'normal', created_at: '2026-03-15T10:00:00Z' },
                { id: 'ann-2', priority: 'normal', created_at: '2026-03-15T11:00:00Z' },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ announcement_id: 'ann-1' }],
                error: null,
              }),
            }),
          }),
        })

      const result = await announcementsDAL.getActiveAnnouncements(mockSupabase, 'fac-1', 'user-1')

      // Should only return ann-2 (ann-1 was dismissed)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('ann-2')
    })

    it('sorts by priority (critical > warning > normal) then by created_at DESC', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                { id: '1', priority: 'normal', created_at: '2026-03-15T14:00:00Z' },
                { id: '2', priority: 'critical', created_at: '2026-03-15T10:00:00Z' },
                { id: '3', priority: 'warning', created_at: '2026-03-15T12:00:00Z' },
                { id: '4', priority: 'critical', created_at: '2026-03-15T09:00:00Z' },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        })

      const result = await announcementsDAL.getActiveAnnouncements(mockSupabase, 'fac-1', 'user-1')

      // Expected order: id=2 (critical, newer), id=4 (critical, older), id=3 (warning), id=1 (normal)
      expect(result.data.map((a) => a.id)).toEqual(['2', '4', '3', '1'])
    })

    it('returns empty array when no active announcements', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const result = await announcementsDAL.getActiveAnnouncements(mockSupabase, 'fac-1', 'user-1')

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('returns empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const result = await announcementsDAL.getActiveAnnouncements(mockSupabase, 'fac-1', 'user-1')

      expect(result.data).toEqual([])
      expect(result.error).toEqual({ message: 'Database error' })
    })
  })

  // ============================================
  // createAnnouncement
  // ============================================

  describe('createAnnouncement', () => {
    it('creates announcement with status=active when no scheduled_for', async () => {
      const input: CreateAnnouncementInput = {
        title: 'Test Announcement',
        body: 'Test body',
        audience: 'both',
        priority: 'normal',
        category: 'general',
        duration_days: 3,
        scheduled_for: null,
      }

      const mockCreated = { id: 'ann-1', ...input, status: 'active' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockCreated,
              error: null,
            }),
          }),
        }),
      })

      const result = await announcementsDAL.createAnnouncement(mockSupabase, 'fac-1', 'user-1', input)

      expect(result.data?.status).toBe('active')
      expect(result.error).toBeNull()
    })

    it('creates announcement with status=scheduled when scheduled_for provided', async () => {
      const input: CreateAnnouncementInput = {
        title: 'Scheduled Announcement',
        audience: 'staff',
        priority: 'warning',
        category: 'maintenance',
        duration_days: 2,
        scheduled_for: '2026-03-20T09:00:00Z',
      }

      const mockCreated = { id: 'ann-2', ...input, status: 'scheduled' }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockCreated,
              error: null,
            }),
          }),
        }),
      })

      const result = await announcementsDAL.createAnnouncement(mockSupabase, 'fac-1', 'user-1', input)

      expect(result.data?.status).toBe('scheduled')
      expect(result.error).toBeNull()
    })

    it('computes expires_at from starts_at + duration_days', async () => {
      const startsAt = '2026-03-15T12:00:00Z'
      const durationDays = 5

      const input: CreateAnnouncementInput = {
        title: 'Test',
        audience: 'both',
        priority: 'normal',
        category: 'general',
        duration_days: durationDays,
        scheduled_for: startsAt,
      }

      let capturedInsertPayload: any

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((payload) => {
          capturedInsertPayload = payload
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ann-3', ...payload },
                error: null,
              }),
            }),
          }
        }),
      })

      await announcementsDAL.createAnnouncement(mockSupabase, 'fac-1', 'user-1', input)

      expect(capturedInsertPayload.starts_at).toBe(startsAt)

      const expectedExpires = new Date('2026-03-15T12:00:00Z')
      expectedExpires.setDate(expectedExpires.getDate() + 5)
      expect(capturedInsertPayload.expires_at).toBe(expectedExpires.toISOString())
    })

    it('returns error when insert fails', async () => {
      const input: CreateAnnouncementInput = {
        title: 'Test',
        audience: 'both',
        priority: 'normal',
        category: 'general',
        duration_days: 1,
      }

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      })

      const result = await announcementsDAL.createAnnouncement(mockSupabase, 'fac-1', 'user-1', input)

      expect(result.data).toBeNull()
      expect(result.error).toEqual({ message: 'Insert failed' })
    })
  })

  // ============================================
  // updateAnnouncement
  // ============================================

  describe('updateAnnouncement', () => {
    it('updates title, body, audience, priority, category', async () => {
      const input: UpdateAnnouncementInput = {
        title: 'Updated Title',
        body: 'Updated body',
        audience: 'surgeons',
        priority: 'critical',
        category: 'safety_alert',
      }

      let capturedUpdatePayload: any

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedUpdatePayload = payload
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ann-1', ...payload },
                error: null,
              }),
            }),
          }
        }),
      })

      await announcementsDAL.updateAnnouncement(mockSupabase, 'fac-1', 'ann-1', input)

      expect(capturedUpdatePayload.title).toBe('Updated Title')
      expect(capturedUpdatePayload.audience).toBe('surgeons')
      expect(capturedUpdatePayload.priority).toBe('critical')
    })

    it('recomputes expires_at when duration_days changes', async () => {
      const input: UpdateAnnouncementInput = {
        duration_days: 7,
      }

      // First query: fetch current starts_at
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { starts_at: '2026-03-15T10:00:00Z' },
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockImplementation((payload) => {
            const expectedExpires = new Date('2026-03-15T10:00:00Z')
            expectedExpires.setDate(expectedExpires.getDate() + 7)
            expect(payload.expires_at).toBe(expectedExpires.toISOString())

            return {
              eq: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'ann-1', ...payload },
                  error: null,
                }),
              }),
            }
          }),
        })

      await announcementsDAL.updateAnnouncement(mockSupabase, 'fac-1', 'ann-1', input)
    })

    it('changes scheduled_for and updates status accordingly', async () => {
      const input: UpdateAnnouncementInput = {
        scheduled_for: '2026-03-25T09:00:00Z',
      }

      let capturedUpdatePayload: any

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedUpdatePayload = payload
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ann-1', ...payload },
                error: null,
              }),
            }),
          }
        }),
      })

      await announcementsDAL.updateAnnouncement(mockSupabase, 'fac-1', 'ann-1', input)

      expect(capturedUpdatePayload.starts_at).toBe('2026-03-25T09:00:00Z')
      expect(capturedUpdatePayload.status).toBe('scheduled')
    })

    it('returns error when update fails', async () => {
      const input: UpdateAnnouncementInput = { title: 'Fail' }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Update failed' },
            }),
          }),
        }),
      })

      const result = await announcementsDAL.updateAnnouncement(mockSupabase, 'fac-1', 'ann-1', input)

      expect(result.data).toBeNull()
      expect(result.error).toEqual({ message: 'Update failed' })
    })
  })

  // ============================================
  // deactivateAnnouncement
  // ============================================

  describe('deactivateAnnouncement', () => {
    it('sets status=deactivated and records deactivated_by/deactivated_at', async () => {
      let capturedUpdatePayload: any

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedUpdatePayload = payload
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ann-1', ...payload },
                error: null,
              }),
            }),
          }
        }),
      })

      await announcementsDAL.deactivateAnnouncement(mockSupabase, 'fac-1', 'ann-1', 'user-1')

      expect(capturedUpdatePayload.status).toBe('deactivated')
      expect(capturedUpdatePayload.deactivated_by).toBe('user-1')
      expect(capturedUpdatePayload.deactivated_at).toBeDefined()
    })

    it('returns error when deactivation fails', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Deactivation failed' },
            }),
          }),
        }),
      })

      const result = await announcementsDAL.deactivateAnnouncement(
        mockSupabase,
        'fac-1',
        'ann-1',
        'user-1'
      )

      expect(result.data).toBeNull()
      expect(result.error).toEqual({ message: 'Deactivation failed' })
    })
  })

  // ============================================
  // deleteAnnouncement
  // ============================================

  describe('deleteAnnouncement', () => {
    it('soft deletes by setting is_active=false (ORbit Domain: Soft Deletes)', async () => {
      let capturedUpdatePayload: any

      const chainableMock = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ error: null }),
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          capturedUpdatePayload = payload
          return chainableMock
        }),
      })

      await announcementsDAL.deleteAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      expect(capturedUpdatePayload.is_active).toBe(false)
    })

    it('returns success when delete succeeds', async () => {
      const chainableMock = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ error: null }),
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(chainableMock),
      })

      const result = await announcementsDAL.deleteAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      expect(result.success).toBe(true)
      expect(result.error).toBeNull()
    })

    it('returns error when delete fails', async () => {
      const chainableMock = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ error: { message: 'Delete failed' } }),
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue(chainableMock),
      })

      const result = await announcementsDAL.deleteAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Delete failed')
    })
  })

  // ============================================
  // dismissAnnouncement
  // ============================================

  describe('dismissAnnouncement', () => {
    it('inserts dismissal record with upsert', async () => {
      let capturedUpsertPayload: any
      let capturedOnConflict: any

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockImplementation((payload, options) => {
          capturedUpsertPayload = payload
          capturedOnConflict = options?.onConflict
          return Promise.resolve({ error: null })
        }),
      })

      await announcementsDAL.dismissAnnouncement(mockSupabase, 'ann-1', 'user-1')

      expect(capturedUpsertPayload.announcement_id).toBe('ann-1')
      expect(capturedUpsertPayload.user_id).toBe('user-1')
      expect(capturedOnConflict).toBe('announcement_id,user_id')
    })

    it('handles duplicate dismissals gracefully (upsert)', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      const result1 = await announcementsDAL.dismissAnnouncement(mockSupabase, 'ann-1', 'user-1')
      const result2 = await announcementsDAL.dismissAnnouncement(mockSupabase, 'ann-1', 'user-1')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('returns error when dismissal fails', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          error: { message: 'Dismissal failed' },
        }),
      })

      const result = await announcementsDAL.dismissAnnouncement(mockSupabase, 'ann-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Dismissal failed')
    })
  })

  // ============================================
  // getAnnouncement
  // ============================================

  describe('getAnnouncement', () => {
    it('fetches single announcement by ID', async () => {
      const mockAnnouncement = {
        id: 'ann-1',
        title: 'Test Announcement',
        facility_id: 'fac-1',
        is_active: true,
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockAnnouncement,
            error: null,
          }),
        }),
      })

      const result = await announcementsDAL.getAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      expect(result.data).toEqual(mockAnnouncement)
      expect(result.error).toBeNull()
    })

    it('filters by facility_id and is_active (ORbit Domain: Facility Scoping + Soft Deletes)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      })

      await announcementsDAL.getAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      const eqCalls = mockSupabase.from().select().eq.mock.calls
      expect(eqCalls).toContainEqual(['id', 'ann-1'])
      expect(eqCalls).toContainEqual(['facility_id', 'fac-1'])
      expect(eqCalls).toContainEqual(['is_active', true])
    })

    it('returns error when fetch fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Fetch failed' },
          }),
        }),
      })

      const result = await announcementsDAL.getAnnouncement(mockSupabase, 'fac-1', 'ann-1')

      expect(result.data).toBeNull()
      expect(result.error).toEqual({ message: 'Fetch failed' })
    })
  })
})

// ============================================
// MOCK HELPERS
// ============================================

function createMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }
}
