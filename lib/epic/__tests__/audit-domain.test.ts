import { describe, it, expect } from 'vitest'
import { auditActionLabels } from '@/lib/audit-logger'
import type { AuditAction } from '@/lib/audit-logger'

/**
 * Verifies that all Epic audit action types have corresponding human-readable labels.
 * This prevents UI rendering gaps in the audit log display.
 */

const EPIC_ACTIONS: AuditAction[] = [
  'epic.connected',
  'epic.disconnected',
  'epic.token_expired',
  'epic.cases_imported',
  'epic.case_import_failed',
  'epic.mapping_created',
  'epic.mapping_updated',
  'epic.mapping_deleted',
  'epic.auto_match_run',
  'epic.field_mapping_updated',
  'epic.field_mapping_reset',
]

describe('epicAudit action labels', () => {
  it('should have labels defined for all Epic audit actions', () => {
    for (const action of EPIC_ACTIONS) {
      expect(auditActionLabels[action]).toBeDefined()
      expect(typeof auditActionLabels[action]).toBe('string')
      expect(auditActionLabels[action].length).toBeGreaterThan(0)
    }
  })

  it('should have meaningful labels (not just action keys)', () => {
    for (const action of EPIC_ACTIONS) {
      const label = auditActionLabels[action]
      // Labels should not contain dots or underscores (they should be human-readable)
      expect(label).not.toContain('.')
      expect(label).not.toContain('_')
    }
  })

  it('should define exactly 11 Epic audit actions', () => {
    const epicActions = Object.keys(auditActionLabels).filter(k => k.startsWith('epic.'))
    expect(epicActions).toHaveLength(11)
  })
})
