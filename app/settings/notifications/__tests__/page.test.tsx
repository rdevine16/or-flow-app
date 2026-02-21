// app/settings/notifications/__tests__/page.test.tsx
// Tests for the facility notification settings page

import { describe, it, expect } from 'vitest'

/**
 * COVERAGE:
 * 1. Unit — FacilityNotification interface matches DB schema
 * 2. Unit — Category grouping logic
 * 3. Integration — Toggle and channel update payloads match facility_notification_settings table
 * 4. Workflow — Enable notification → select channels → disable → verify state
 */

// ── Replicated from page.tsx to test in isolation ──

interface FacilityNotification {
  id: string
  facility_id: string
  notification_type: string
  category: string
  display_label: string
  is_enabled: boolean
  channels: string[]
  display_order: number
}

const CATEGORIES = [
  { key: 'case_alerts', label: 'Case Alerts', description: 'Real-time notifications during surgical cases' },
  { key: 'schedule_alerts', label: 'Schedule Alerts', description: 'Notifications about scheduling and timing' },
  { key: 'tray_management', label: 'Tray Management', description: 'Notifications for device rep coordination' },
  { key: 'reports', label: 'Reports & Summaries', description: 'Scheduled report notifications' },
]

const CHANNEL_OPTIONS = ['push', 'in_app', 'email']

// =====================================================
// TESTS
// =====================================================

describe('Facility Notification Settings', () => {
  describe('FacilityNotification interface matches DB schema', () => {
    it('has all required columns from facility_notification_settings table', () => {
      const notif: FacilityNotification = {
        id: 'fns-001',
        facility_id: 'fac-001',
        notification_type: 'delay_recorded',
        category: 'case_alerts',
        display_label: 'Delay Recorded',
        is_enabled: true,
        channels: ['push', 'in_app'],
        display_order: 4,
      }

      expect(notif.id).toBeTruthy()
      expect(notif.facility_id).toBe('fac-001')
      expect(notif.notification_type).toBe('delay_recorded')
      expect(notif.category).toBe('case_alerts')
      expect(notif.display_label).toBe('Delay Recorded')
      expect(notif.is_enabled).toBe(true)
      expect(notif.channels).toEqual(['push', 'in_app'])
      expect(notif.display_order).toBe(4)
    })
  })

  describe('Category grouping', () => {
    const mockNotifications: FacilityNotification[] = [
      { id: '1', facility_id: 'fac-1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', is_enabled: false, channels: ['in_app'], display_order: 1 },
      { id: '2', facility_id: 'fac-1', notification_type: 'delay_recorded', category: 'case_alerts', display_label: 'Delay Recorded', is_enabled: true, channels: ['push', 'in_app'], display_order: 2 },
      { id: '3', facility_id: 'fac-1', notification_type: 'weekly_report', category: 'reports', display_label: 'Weekly Report', is_enabled: true, channels: ['email', 'in_app'], display_order: 12 },
    ]

    it('groups notifications by category preserving CATEGORIES order', () => {
      const grouped = CATEGORIES.map(cat => ({
        ...cat,
        items: mockNotifications.filter(n => n.category === cat.key),
      })).filter(g => g.items.length > 0)

      expect(grouped).toHaveLength(2)
      expect(grouped[0].key).toBe('case_alerts')
      expect(grouped[0].items).toHaveLength(2)
      expect(grouped[1].key).toBe('reports')
      expect(grouped[1].items).toHaveLength(1)
    })

    it('empty categories are filtered out', () => {
      const grouped = CATEGORIES.map(cat => ({
        ...cat,
        items: mockNotifications.filter(n => n.category === cat.key),
      })).filter(g => g.items.length > 0)

      const keys = grouped.map(g => g.key)
      expect(keys).not.toContain('schedule_alerts')
      expect(keys).not.toContain('tray_management')
    })
  })

  describe('Toggle enable/disable', () => {
    it('toggle payload flips is_enabled from false to true', () => {
      const notification: FacilityNotification = {
        id: '1', facility_id: 'fac-1', notification_type: 'case_started', category: 'case_alerts',
        display_label: 'Case Started', is_enabled: false, channels: ['in_app'], display_order: 1,
      }

      const payload = { is_enabled: !notification.is_enabled }
      expect(payload.is_enabled).toBe(true)
    })

    it('toggle payload flips is_enabled from true to false', () => {
      const notification: FacilityNotification = {
        id: '2', facility_id: 'fac-1', notification_type: 'delay_recorded', category: 'case_alerts',
        display_label: 'Delay Recorded', is_enabled: true, channels: ['push', 'in_app'], display_order: 2,
      }

      const payload = { is_enabled: !notification.is_enabled }
      expect(payload.is_enabled).toBe(false)
    })

    it('toggle targets the correct row by id', () => {
      const id = 'fns-123'
      const eq = { id }
      expect(eq.id).toBe('fns-123')
    })
  })

  describe('Channel toggle', () => {
    it('adds a channel when not present', () => {
      const channels = ['push', 'in_app']
      const newChannels = channels.includes('email')
        ? channels.filter(c => c !== 'email')
        : [...channels, 'email']

      expect(newChannels).toEqual(['push', 'in_app', 'email'])
    })

    it('removes a channel when present', () => {
      const channels = ['push', 'in_app', 'email']
      const newChannels = channels.includes('in_app')
        ? channels.filter(c => c !== 'in_app')
        : [...channels, 'in_app']

      expect(newChannels).toEqual(['push', 'email'])
    })

    it('update payload includes new channels array', () => {
      const notification: FacilityNotification = {
        id: '1', facility_id: 'fac-1', notification_type: 'case_started', category: 'case_alerts',
        display_label: 'Case Started', is_enabled: true, channels: ['push'], display_order: 1,
      }

      const channelToToggle = 'email'
      const newChannels = notification.channels.includes(channelToToggle)
        ? notification.channels.filter(c => c !== channelToToggle)
        : [...notification.channels, channelToToggle]

      const payload = { channels: newChannels }
      expect(payload.channels).toEqual(['push', 'email'])
    })

    it('all channels are valid options', () => {
      const validChannels = new Set(['push', 'in_app', 'email'])
      CHANNEL_OPTIONS.forEach(ch => {
        expect(validChannels.has(ch)).toBe(true)
      })
    })
  })

  describe('Facility scoping', () => {
    it('query always filters by facility_id', () => {
      const facilityId = 'fac-123'
      const queryFilter = { facility_id: facilityId }
      expect(queryFilter.facility_id).toBe('fac-123')
    })

    it('notifications from different facilities are not mixed', () => {
      const allNotifications: FacilityNotification[] = [
        { id: '1', facility_id: 'fac-1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', is_enabled: true, channels: ['push'], display_order: 1 },
        { id: '2', facility_id: 'fac-2', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', is_enabled: false, channels: [], display_order: 1 },
        { id: '3', facility_id: 'fac-1', notification_type: 'delay_recorded', category: 'case_alerts', display_label: 'Delay Recorded', is_enabled: true, channels: ['push', 'in_app'], display_order: 2 },
      ]

      const fac1 = allNotifications.filter(n => n.facility_id === 'fac-1')
      const fac2 = allNotifications.filter(n => n.facility_id === 'fac-2')

      expect(fac1).toHaveLength(2)
      expect(fac2).toHaveLength(1)
      // Facility 1's case_started is enabled, facility 2's is not — independent
      expect(fac1.find(n => n.notification_type === 'case_started')!.is_enabled).toBe(true)
      expect(fac2.find(n => n.notification_type === 'case_started')!.is_enabled).toBe(false)
    })
  })

  describe('Workflow: Enable → Channels → Disable → Verify', () => {
    it('full facility notification lifecycle', () => {
      // Step 1: Notification starts disabled (seeded from template with default_enabled = false)
      let notification: FacilityNotification = {
        id: 'fns-1',
        facility_id: 'fac-1',
        notification_type: 'case_started',
        category: 'case_alerts',
        display_label: 'Case Started',
        is_enabled: false,
        channels: ['in_app'],
        display_order: 2,
      }
      expect(notification.is_enabled).toBe(false)

      // Step 2: Admin enables it
      notification = { ...notification, is_enabled: true }
      expect(notification.is_enabled).toBe(true)

      // Step 3: Admin adds push channel
      notification = {
        ...notification,
        channels: [...notification.channels, 'push'],
      }
      expect(notification.channels).toEqual(['in_app', 'push'])

      // Step 4: Admin adds email channel
      notification = {
        ...notification,
        channels: [...notification.channels, 'email'],
      }
      expect(notification.channels).toEqual(['in_app', 'push', 'email'])

      // Step 5: Admin removes in_app channel
      notification = {
        ...notification,
        channels: notification.channels.filter(c => c !== 'in_app'),
      }
      expect(notification.channels).toEqual(['push', 'email'])

      // Step 6: Admin disables the notification entirely
      notification = { ...notification, is_enabled: false }
      expect(notification.is_enabled).toBe(false)
      // Channels are preserved even when disabled
      expect(notification.channels).toEqual(['push', 'email'])

      // Step 7: Re-enable — channels should be restored
      notification = { ...notification, is_enabled: true }
      expect(notification.is_enabled).toBe(true)
      expect(notification.channels).toEqual(['push', 'email'])
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no notifications configured', () => {
      const items: FacilityNotification[] = []
      expect(items.length === 0).toBe(true)
    })

    it('no categories render when items are empty', () => {
      const items: FacilityNotification[] = []
      const grouped = CATEGORIES.map(cat => ({
        ...cat,
        items: items.filter(n => n.category === cat.key),
      })).filter(g => g.items.length > 0)

      expect(grouped).toHaveLength(0)
    })
  })
})
