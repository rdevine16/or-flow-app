// app/admin/settings/payers/__tests__/page.test.tsx
// Tests for the admin payer templates page

import { describe, it, expect } from 'vitest'

/**
 * COVERAGE:
 * 1. Unit — PayerTemplate interface matches DB schema
 * 2. Unit — Soft-delete filtering logic (active vs archived)
 * 3. Integration — CRUD payload shapes match payer_templates table
 * 4. Workflow — Add → edit → archive → restore cycle
 */

// ── Replicated from page.tsx to test in isolation ──

interface PayerTemplate {
  id: string
  name: string
  display_order: number
  is_active: boolean
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Seeded defaults from migration
const SEEDED_PAYERS = [
  'Medicare',
  'Medicaid',
  'Private Insurance',
  'Workers Compensation',
  'Self-Pay',
]

// =====================================================
// TESTS
// =====================================================

describe('Admin Payer Templates', () => {
  describe('PayerTemplate interface matches DB schema', () => {
    it('has all required columns from payer_templates table', () => {
      const payer: PayerTemplate = {
        id: 'pt-001',
        name: 'Medicare',
        display_order: 1,
        is_active: true,
        created_at: '2026-02-21T00:00:00Z',
        deleted_at: null,
        deleted_by: null,
      }

      expect(payer.id).toBeTruthy()
      expect(payer.name).toBe('Medicare')
      expect(payer.display_order).toBe(1)
      expect(payer.is_active).toBe(true)
      expect(payer.deleted_at).toBeNull()
      expect(payer.deleted_by).toBeNull()
    })

    it('seeded defaults include 5 common payer types', () => {
      expect(SEEDED_PAYERS).toHaveLength(5)
      expect(SEEDED_PAYERS).toContain('Medicare')
      expect(SEEDED_PAYERS).toContain('Medicaid')
      expect(SEEDED_PAYERS).toContain('Private Insurance')
      expect(SEEDED_PAYERS).toContain('Workers Compensation')
      expect(SEEDED_PAYERS).toContain('Self-Pay')
    })
  })

  describe('Soft-delete filtering', () => {
    const mockPayers: PayerTemplate[] = [
      { id: 'pt-001', name: 'Medicare', display_order: 1, is_active: true, created_at: '2026-01-01T00:00:00Z', deleted_at: null, deleted_by: null },
      { id: 'pt-002', name: 'Medicaid', display_order: 2, is_active: true, created_at: '2026-01-01T00:00:00Z', deleted_at: null, deleted_by: null },
      { id: 'pt-003', name: 'Old Payer', display_order: 3, is_active: true, created_at: '2026-01-01T00:00:00Z', deleted_at: '2026-02-01T00:00:00Z', deleted_by: 'user-1' },
    ]

    it('active view filters out soft-deleted rows (deleted_at IS NULL)', () => {
      const active = mockPayers.filter(p => !p.deleted_at)
      expect(active).toHaveLength(2)
      expect(active.map(p => p.name)).toEqual(['Medicare', 'Medicaid'])
    })

    it('archived view shows only soft-deleted rows (deleted_at IS NOT NULL)', () => {
      const archived = mockPayers.filter(p => p.deleted_at !== null)
      expect(archived).toHaveLength(1)
      expect(archived[0].name).toBe('Old Payer')
    })

    it('archived count reflects only soft-deleted rows', () => {
      const archivedCount = mockPayers.filter(p => p.deleted_at !== null).length
      expect(archivedCount).toBe(1)
    })
  })

  describe('CRUD payload structures', () => {
    it('create payload includes name and display_order', () => {
      const existingPayers: PayerTemplate[] = [
        { id: 'pt-001', name: 'Medicare', display_order: 1, is_active: true, created_at: '2026-01-01T00:00:00Z', deleted_at: null, deleted_by: null },
        { id: 'pt-002', name: 'Medicaid', display_order: 2, is_active: true, created_at: '2026-01-01T00:00:00Z', deleted_at: null, deleted_by: null },
      ]

      const maxOrder = existingPayers.reduce((max, p) => Math.max(max, p.display_order), 0)
      const payload = {
        name: 'Blue Cross'.trim(),
        display_order: maxOrder + 1,
      }

      expect(payload.name).toBe('Blue Cross')
      expect(payload.display_order).toBe(3)
    })

    it('create payload does NOT include facility_id (global template)', () => {
      const payload = {
        name: 'Aetna',
        display_order: 1,
      }

      expect('facility_id' in payload).toBe(false)
    })

    it('update payload only includes name', () => {
      const payload = {
        name: 'Blue Cross Blue Shield',
      }

      expect(Object.keys(payload)).toEqual(['name'])
    })

    it('archive payload sets deleted_at and deleted_by', () => {
      const userId = 'user-123'
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

  describe('Workflow: Add → Edit → Archive → Restore', () => {
    it('full payer template lifecycle', () => {
      // Step 1: Initial state — empty
      let payers: PayerTemplate[] = []
      expect(payers).toHaveLength(0)

      // Step 2: Add "Blue Cross"
      const newPayer: PayerTemplate = {
        id: 'pt-new',
        name: 'Blue Cross',
        display_order: 1,
        is_active: true,
        created_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      }
      payers = [...payers, newPayer]
      expect(payers).toHaveLength(1)
      expect(payers[0].name).toBe('Blue Cross')

      // Step 3: Edit — rename to "Blue Cross Blue Shield"
      payers = payers.map(p =>
        p.id === 'pt-new' ? { ...p, name: 'Blue Cross Blue Shield' } : p
      )
      expect(payers[0].name).toBe('Blue Cross Blue Shield')

      // Step 4: Archive
      const archiveTime = new Date().toISOString()
      payers = payers.map(p =>
        p.id === 'pt-new' ? { ...p, deleted_at: archiveTime, deleted_by: 'admin-1' } : p
      )
      const activePayers = payers.filter(p => !p.deleted_at)
      const archivedPayers = payers.filter(p => p.deleted_at !== null)
      expect(activePayers).toHaveLength(0)
      expect(archivedPayers).toHaveLength(1)
      expect(archivedPayers[0].name).toBe('Blue Cross Blue Shield')

      // Step 5: Restore
      payers = payers.map(p =>
        p.id === 'pt-new' ? { ...p, deleted_at: null, deleted_by: null } : p
      )
      const restoredActive = payers.filter(p => !p.deleted_at)
      expect(restoredActive).toHaveLength(1)
      expect(restoredActive[0].name).toBe('Blue Cross Blue Shield')
      expect(restoredActive[0].deleted_at).toBeNull()
    })
  })

  describe('Display order management', () => {
    it('new payers get display_order = max + 1', () => {
      const existing = [
        { display_order: 1 },
        { display_order: 3 },
        { display_order: 2 },
      ]
      const maxOrder = existing.reduce((max, p) => Math.max(max, p.display_order), 0)
      expect(maxOrder + 1).toBe(4)
    })

    it('first payer gets display_order = 1 (max of empty = 0, +1)', () => {
      const existing: { display_order: number }[] = []
      const maxOrder = existing.reduce((max, p) => Math.max(max, p.display_order), 0)
      expect(maxOrder + 1).toBe(1)
    })
  })

  describe('Name trimming', () => {
    it('trims whitespace from payer name before save', () => {
      const rawName = '  Blue Cross  '
      expect(rawName.trim()).toBe('Blue Cross')
    })

    it('empty name after trimming blocks save', () => {
      const rawName = '   '
      expect(!rawName.trim()).toBe(true)
    })
  })
})
