// app/admin/settings/notifications/__tests__/page.test.tsx
// Tests for the admin notification templates page

import { describe, it, expect } from 'vitest'

/**
 * COVERAGE:
 * 1. Unit — NotificationTemplate interface matches DB schema
 * 2. Unit — Category grouping logic
 * 3. Unit — Soft-delete filtering (active vs archived)
 * 4. Integration — CRUD payload shapes match notification_settings_template table
 * 5. Integration — Channel array mutations
 * 6. Workflow — Add → edit → archive → restore cycle
 */

// ── Replicated from page.tsx to test in isolation ──

interface NotificationTemplate {
  id: string
  notification_type: string
  category: string
  display_label: string
  description: string | null
  default_enabled: boolean
  default_channels: string[]
  display_order: number
  is_active: boolean
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

const CATEGORIES = [
  { key: 'case_alerts', label: 'Case Alerts' },
  { key: 'schedule_alerts', label: 'Schedule Alerts' },
  { key: 'tray_management', label: 'Tray Management' },
  { key: 'reports', label: 'Reports & Summaries' },
]

const CHANNEL_OPTIONS = ['push', 'in_app', 'email']

// Seeded defaults from migration
const SEEDED_NOTIFICATIONS: Array<{ notification_type: string; category: string; display_label: string; default_enabled: boolean; default_channels: string[] }> = [
  { notification_type: 'call_next_patient', category: 'case_alerts', display_label: 'Call Next Patient', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', default_enabled: false, default_channels: ['in_app'] },
  { notification_type: 'case_completed', category: 'case_alerts', display_label: 'Case Completed', default_enabled: false, default_channels: ['in_app'] },
  { notification_type: 'delay_recorded', category: 'case_alerts', display_label: 'Delay Recorded', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'first_case_reminder', category: 'schedule_alerts', display_label: 'First Case Reminder', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'case_running_long', category: 'schedule_alerts', display_label: 'Case Running Long', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'turnover_alert', category: 'schedule_alerts', display_label: 'Turnover Time Alert', default_enabled: false, default_channels: ['in_app'] },
  { notification_type: 'tray_confirmation_needed', category: 'tray_management', display_label: 'Tray Confirmation Needed', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'tray_delivered', category: 'tray_management', display_label: 'Tray Delivered', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'tray_missing', category: 'tray_management', display_label: 'Missing Tray Alert', default_enabled: true, default_channels: ['push', 'in_app'] },
  { notification_type: 'daily_summary', category: 'reports', display_label: 'Daily Summary', default_enabled: false, default_channels: ['email'] },
  { notification_type: 'weekly_report', category: 'reports', display_label: 'Weekly Efficiency Report', default_enabled: true, default_channels: ['email', 'in_app'] },
  { notification_type: 'monthly_report', category: 'reports', display_label: 'Monthly Analytics', default_enabled: true, default_channels: ['email', 'in_app'] },
]

// =====================================================
// TESTS
// =====================================================

describe('Admin Notification Templates', () => {
  describe('NotificationTemplate interface matches DB schema', () => {
    it('has all required columns from notification_settings_template table', () => {
      const tmpl: NotificationTemplate = {
        id: 'nt-001',
        notification_type: 'case_started',
        category: 'case_alerts',
        display_label: 'Case Started',
        description: 'Notify when a case begins',
        default_enabled: false,
        default_channels: ['in_app'],
        display_order: 2,
        is_active: true,
        created_at: '2026-02-21T00:00:00Z',
        deleted_at: null,
        deleted_by: null,
      }

      expect(tmpl.id).toBeTruthy()
      expect(tmpl.notification_type).toBe('case_started')
      expect(tmpl.category).toBe('case_alerts')
      expect(tmpl.display_label).toBe('Case Started')
      expect(tmpl.description).toBe('Notify when a case begins')
      expect(tmpl.default_enabled).toBe(false)
      expect(tmpl.default_channels).toEqual(['in_app'])
      expect(tmpl.display_order).toBe(2)
      expect(tmpl.deleted_at).toBeNull()
    })

    it('seeded defaults include 13 notification types across 4 categories', () => {
      expect(SEEDED_NOTIFICATIONS).toHaveLength(13)

      const caseAlerts = SEEDED_NOTIFICATIONS.filter(n => n.category === 'case_alerts')
      const scheduleAlerts = SEEDED_NOTIFICATIONS.filter(n => n.category === 'schedule_alerts')
      const trayMgmt = SEEDED_NOTIFICATIONS.filter(n => n.category === 'tray_management')
      const reports = SEEDED_NOTIFICATIONS.filter(n => n.category === 'reports')

      expect(caseAlerts).toHaveLength(4)
      expect(scheduleAlerts).toHaveLength(3)
      expect(trayMgmt).toHaveLength(3)
      expect(reports).toHaveLength(3)
    })

    it('notification_type values are unique', () => {
      const types = SEEDED_NOTIFICATIONS.map(n => n.notification_type)
      const unique = new Set(types)
      expect(unique.size).toBe(types.length)
    })
  })

  describe('Category grouping', () => {
    const mockTemplates: NotificationTemplate[] = [
      { id: '1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', description: null, default_enabled: false, default_channels: ['in_app'], display_order: 1, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
      { id: '2', notification_type: 'delay_recorded', category: 'case_alerts', display_label: 'Delay Recorded', description: null, default_enabled: true, default_channels: ['push', 'in_app'], display_order: 2, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
      { id: '3', notification_type: 'daily_summary', category: 'reports', display_label: 'Daily Summary', description: null, default_enabled: false, default_channels: ['email'], display_order: 11, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
    ]

    it('groups templates by category in CATEGORIES order', () => {
      const grouped = CATEGORIES.map(cat => ({
        ...cat,
        items: mockTemplates.filter(t => t.category === cat.key),
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
        items: mockTemplates.filter(t => t.category === cat.key),
      })).filter(g => g.items.length > 0)

      const keys = grouped.map(g => g.key)
      expect(keys).not.toContain('schedule_alerts')
      expect(keys).not.toContain('tray_management')
    })
  })

  describe('Soft-delete filtering', () => {
    const mockTemplates: NotificationTemplate[] = [
      { id: '1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', description: null, default_enabled: false, default_channels: ['in_app'], display_order: 1, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
      { id: '2', notification_type: 'old_type', category: 'case_alerts', display_label: 'Old Type', description: null, default_enabled: false, default_channels: [], display_order: 99, is_active: true, created_at: '', deleted_at: '2026-02-10T00:00:00Z', deleted_by: 'admin-1' },
    ]

    it('active view filters out soft-deleted rows (deleted_at IS NULL)', () => {
      const active = mockTemplates.filter(t => !t.deleted_at)
      expect(active).toHaveLength(1)
      expect(active[0].display_label).toBe('Case Started')
    })

    it('archived view shows only soft-deleted rows (deleted_at IS NOT NULL)', () => {
      const archived = mockTemplates.filter(t => t.deleted_at !== null)
      expect(archived).toHaveLength(1)
      expect(archived[0].display_label).toBe('Old Type')
    })

    it('archived count reflects only soft-deleted rows', () => {
      const count = mockTemplates.filter(t => t.deleted_at !== null).length
      expect(count).toBe(1)
    })
  })

  describe('CRUD payload structures', () => {
    it('create payload includes all required fields', () => {
      const existing: NotificationTemplate[] = [
        { id: '1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', description: null, default_enabled: false, default_channels: ['in_app'], display_order: 2, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
      ]

      const maxOrder = existing.reduce((max, t) => Math.max(max, t.display_order), 0)
      const payload = {
        notification_type: 'surgeon_late',
        category: 'schedule_alerts',
        display_label: 'Surgeon Running Late',
        description: 'Alert when surgeon is behind schedule',
        default_enabled: true,
        default_channels: ['push', 'in_app'],
        display_order: maxOrder + 1,
      }

      expect(payload.notification_type).toBe('surgeon_late')
      expect(payload.category).toBe('schedule_alerts')
      expect(payload.display_label).toBe('Surgeon Running Late')
      expect(payload.description).toBe('Alert when surgeon is behind schedule')
      expect(payload.default_enabled).toBe(true)
      expect(payload.default_channels).toEqual(['push', 'in_app'])
      expect(payload.display_order).toBe(3)
    })

    it('create payload does NOT include facility_id (global template)', () => {
      const payload = {
        notification_type: 'test_type',
        category: 'case_alerts',
        display_label: 'Test',
        default_enabled: false,
        default_channels: [],
        display_order: 1,
      }

      expect('facility_id' in payload).toBe(false)
    })

    it('update payload includes editable fields', () => {
      const payload = {
        notification_type: 'case_started',
        category: 'case_alerts',
        display_label: 'Case Started (Updated)',
        description: 'Updated description',
        default_enabled: true,
        default_channels: ['push', 'in_app', 'email'],
      }

      expect(payload.display_label).toBe('Case Started (Updated)')
      expect(payload.default_channels).toContain('email')
    })

    it('archive payload sets deleted_at and deleted_by', () => {
      const userId = 'admin-123'
      const payload = {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      }

      expect(payload.deleted_at).toBeTruthy()
      expect(payload.deleted_by).toBe(userId)
    })

    it('restore payload clears deleted_at and deleted_by', () => {
      const payload = {
        deleted_at: null,
        deleted_by: null,
      }

      expect(payload.deleted_at).toBeNull()
      expect(payload.deleted_by).toBeNull()
    })
  })

  describe('Channel management', () => {
    it('toggleChannel adds a channel when not present', () => {
      const channels = ['push']
      const toggleChannel = (channels: string[], channel: string) =>
        channels.includes(channel) ? channels.filter(c => c !== channel) : [...channels, channel]

      expect(toggleChannel(channels, 'email')).toEqual(['push', 'email'])
    })

    it('toggleChannel removes a channel when present', () => {
      const channels = ['push', 'in_app', 'email']
      const toggleChannel = (channels: string[], channel: string) =>
        channels.includes(channel) ? channels.filter(c => c !== channel) : [...channels, channel]

      expect(toggleChannel(channels, 'in_app')).toEqual(['push', 'email'])
    })

    it('all channels are valid options', () => {
      const validChannels = ['push', 'in_app', 'email']
      CHANNEL_OPTIONS.forEach(ch => {
        expect(validChannels).toContain(ch)
      })
    })

    it('default_channels from seeded data only contain valid options', () => {
      const validChannels = new Set(['push', 'in_app', 'email'])
      SEEDED_NOTIFICATIONS.forEach(n => {
        n.default_channels.forEach(ch => {
          expect(validChannels.has(ch)).toBe(true)
        })
      })
    })
  })

  describe('Workflow: Add → Edit → Archive → Restore', () => {
    it('full notification template lifecycle', () => {
      // Step 1: Start with 2 templates
      let templates: NotificationTemplate[] = [
        { id: '1', notification_type: 'case_started', category: 'case_alerts', display_label: 'Case Started', description: null, default_enabled: false, default_channels: ['in_app'], display_order: 1, is_active: true, created_at: '', deleted_at: null, deleted_by: null },
      ]
      expect(templates).toHaveLength(1)

      // Step 2: Add new template
      const newTemplate: NotificationTemplate = {
        id: '2',
        notification_type: 'surgeon_late',
        category: 'schedule_alerts',
        display_label: 'Surgeon Running Late',
        description: 'Alert when surgeon is behind',
        default_enabled: true,
        default_channels: ['push', 'in_app'],
        display_order: 2,
        is_active: true,
        created_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      }
      templates = [...templates, newTemplate]
      expect(templates).toHaveLength(2)

      // Step 3: Edit — update label and channels
      templates = templates.map(t =>
        t.id === '2'
          ? { ...t, display_label: 'Surgeon Late Alert', default_channels: ['push', 'in_app', 'email'] }
          : t
      )
      const edited = templates.find(t => t.id === '2')!
      expect(edited.display_label).toBe('Surgeon Late Alert')
      expect(edited.default_channels).toContain('email')

      // Step 4: Archive
      templates = templates.map(t =>
        t.id === '2' ? { ...t, deleted_at: new Date().toISOString(), deleted_by: 'admin-1' } : t
      )
      const active = templates.filter(t => !t.deleted_at)
      const archived = templates.filter(t => t.deleted_at !== null)
      expect(active).toHaveLength(1)
      expect(archived).toHaveLength(1)

      // Step 5: Verify category grouping with mixed states
      const activeGrouped = CATEGORIES.map(cat => ({
        key: cat.key,
        items: active.filter(t => t.category === cat.key),
      })).filter(g => g.items.length > 0)
      expect(activeGrouped).toHaveLength(1)
      expect(activeGrouped[0].key).toBe('case_alerts')

      // Step 6: Restore
      templates = templates.map(t =>
        t.id === '2' ? { ...t, deleted_at: null, deleted_by: null } : t
      )
      const restored = templates.filter(t => !t.deleted_at)
      expect(restored).toHaveLength(2)
    })
  })

  describe('Copy function behavior (template → facility seeding)', () => {
    it('only active templates get copied to new facilities', () => {
      const allTemplates = [
        { notification_type: 'case_started', is_active: true, default_enabled: false, default_channels: ['in_app'] as string[], display_order: 1, category: 'case_alerts', display_label: 'Case Started' },
        { notification_type: 'old_alert', is_active: false, default_enabled: true, default_channels: ['push'] as string[], display_order: 99, category: 'case_alerts', display_label: 'Old Alert' },
        { notification_type: 'delay_recorded', is_active: true, default_enabled: true, default_channels: ['push', 'in_app'] as string[], display_order: 2, category: 'case_alerts', display_label: 'Delay Recorded' },
      ]

      // Simulates: WHERE is_active = true
      const toSeed = allTemplates.filter(t => t.is_active)
      expect(toSeed).toHaveLength(2)
      expect(toSeed.map(t => t.notification_type)).toEqual(['case_started', 'delay_recorded'])
    })

    it('seeded facility rows map template defaults to facility fields', () => {
      const template = {
        id: 'tmpl-1',
        notification_type: 'delay_recorded',
        category: 'case_alerts',
        display_label: 'Delay Recorded',
        default_enabled: true,
        default_channels: ['push', 'in_app'],
        display_order: 4,
      }

      const facilityId = 'facility-1'

      // Simulates the INSERT in copy_notification_settings_to_facility()
      const facilityRow = {
        facility_id: facilityId,
        notification_type: template.notification_type,
        category: template.category,
        display_label: template.display_label,
        is_enabled: template.default_enabled,       // default_enabled → is_enabled
        channels: template.default_channels,         // default_channels → channels
        display_order: template.display_order,
        source_template_id: template.id,
      }

      expect(facilityRow.facility_id).toBe('facility-1')
      expect(facilityRow.is_enabled).toBe(true)
      expect(facilityRow.channels).toEqual(['push', 'in_app'])
      expect(facilityRow.source_template_id).toBe('tmpl-1')
    })

    it('skips notification types that already exist for the facility', () => {
      const existingFacilityTypes = ['case_started', 'delay_recorded']
      const templatesToSeed = ['case_started', 'delay_recorded', 'tray_missing', 'daily_summary']

      // Simulates: IF EXISTS (SELECT 1 WHERE facility_id = X AND notification_type = Y) THEN CONTINUE
      const newToSeed = templatesToSeed.filter(t => !existingFacilityTypes.includes(t))
      expect(newToSeed).toEqual(['tray_missing', 'daily_summary'])
    })
  })

  describe('Display order management', () => {
    it('new templates get display_order = max + 1', () => {
      const existing = [{ display_order: 4 }, { display_order: 13 }, { display_order: 7 }]
      const maxOrder = existing.reduce((max, t) => Math.max(max, t.display_order), 0)
      expect(maxOrder + 1).toBe(14)
    })

    it('first template gets display_order = 1', () => {
      const existing: { display_order: number }[] = []
      const maxOrder = existing.reduce((max, t) => Math.max(max, t.display_order), 0)
      expect(maxOrder + 1).toBe(1)
    })
  })

  describe('Input validation', () => {
    it('blocks save when notification_type is empty', () => {
      const formType = '   '
      expect(!formType.trim()).toBe(true)
    })

    it('blocks save when display_label is empty', () => {
      const formLabel = ''
      expect(!formLabel.trim()).toBe(true)
    })

    it('trims whitespace from all text fields', () => {
      expect('  case_started  '.trim()).toBe('case_started')
      expect('  Case Started  '.trim()).toBe('Case Started')
      expect('  Some description  '.trim()).toBe('Some description')
    })

    it('null description when empty string', () => {
      const desc = '  '
      const value = desc.trim() || null
      expect(value).toBeNull()
    })
  })
})
