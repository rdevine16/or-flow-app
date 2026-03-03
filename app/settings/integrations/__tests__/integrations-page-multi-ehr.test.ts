/**
 * integrations-page-multi-ehr.test.ts — Logic tests for multi-EHR landing page
 *
 * Tests the integration map building, active HL7v2 detection, card action logic,
 * and switch enforcement behavior — all as pure functions extracted from
 * PageClient.tsx's rendering logic.
 */

import { describe, it, expect } from 'vitest'
import {
  HL7V2_INTEGRATION_TYPES,
  EHR_SYSTEM_DISPLAY_NAMES,
} from '@/lib/integrations/shared/integration-types'
import type { EhrIntegration, EhrIntegrationType } from '@/lib/integrations/shared/integration-types'

// ============================================
// HELPERS (mirror PageClient logic)
// ============================================

function buildIntegrationMap(
  integrations: EhrIntegration[]
): Partial<Record<EhrIntegrationType, EhrIntegration>> {
  const map: Partial<Record<EhrIntegrationType, EhrIntegration>> = {}
  for (const integration of integrations) {
    map[integration.integration_type] = integration
  }
  return map
}

function findActiveHl7v2(
  integrations: EhrIntegration[]
): EhrIntegration | null {
  return integrations.find((i) => i.is_active) ?? null
}

type CardAction = 'manage' | 'setup' | 'switch'

function getCardAction(
  cardType: EhrIntegrationType,
  integration: EhrIntegration | null | undefined,
  activeHl7v2: EhrIntegration | null
): CardAction {
  const isActive = !!integration?.is_active
  const hasOtherActive = !!activeHl7v2 && activeHl7v2.integration_type !== cardType
  if (hasOtherActive) return 'switch'
  if (isActive) return 'manage'
  return 'setup'
}

// ============================================
// TEST FIXTURES
// ============================================

function makeIntegration(
  type: EhrIntegrationType,
  overrides?: Partial<EhrIntegration>
): EhrIntegration {
  return {
    id: `int-${type}`,
    facility_id: 'fac-001',
    integration_type: type,
    display_name: EHR_SYSTEM_DISPLAY_NAMES[type],
    config: {},
    is_active: false,
    last_message_at: null,
    last_error: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================
// TESTS
// ============================================

describe('Integrations Page — Multi-EHR Logic', () => {
  describe('HL7V2_INTEGRATION_TYPES constant', () => {
    it('contains exactly 3 HL7v2 types', () => {
      expect(HL7V2_INTEGRATION_TYPES).toHaveLength(3)
    })

    it('includes epic, cerner, and meditech', () => {
      expect(HL7V2_INTEGRATION_TYPES).toContain('epic_hl7v2')
      expect(HL7V2_INTEGRATION_TYPES).toContain('cerner_hl7v2')
      expect(HL7V2_INTEGRATION_TYPES).toContain('meditech_hl7v2')
    })
  })

  describe('buildIntegrationMap', () => {
    it('returns empty map for empty array', () => {
      const map = buildIntegrationMap([])
      expect(Object.keys(map)).toHaveLength(0)
    })

    it('maps single integration by type', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      const map = buildIntegrationMap([epic])
      expect(map.epic_hl7v2).toBeDefined()
      expect(map.epic_hl7v2?.id).toBe('int-epic_hl7v2')
      expect(map.cerner_hl7v2).toBeUndefined()
    })

    it('maps multiple integrations', () => {
      const integrations = [
        makeIntegration('epic_hl7v2', { is_active: true }),
        makeIntegration('cerner_hl7v2'),
      ]
      const map = buildIntegrationMap(integrations)
      expect(map.epic_hl7v2).toBeDefined()
      expect(map.cerner_hl7v2).toBeDefined()
      expect(map.meditech_hl7v2).toBeUndefined()
    })
  })

  describe('findActiveHl7v2', () => {
    it('returns null for empty array', () => {
      expect(findActiveHl7v2([])).toBeNull()
    })

    it('returns null when no integration is active', () => {
      const integrations = [
        makeIntegration('epic_hl7v2'),
        makeIntegration('cerner_hl7v2'),
      ]
      expect(findActiveHl7v2(integrations)).toBeNull()
    })

    it('returns the active integration', () => {
      const integrations = [
        makeIntegration('epic_hl7v2', { is_active: true }),
        makeIntegration('cerner_hl7v2'),
      ]
      const active = findActiveHl7v2(integrations)
      expect(active?.integration_type).toBe('epic_hl7v2')
    })

    it('returns first active if multiple are active (edge case)', () => {
      const integrations = [
        makeIntegration('epic_hl7v2', { is_active: true }),
        makeIntegration('cerner_hl7v2', { is_active: true }),
      ]
      const active = findActiveHl7v2(integrations)
      expect(active?.integration_type).toBe('epic_hl7v2')
    })
  })

  describe('getCardAction', () => {
    it('returns "setup" when no integration exists and no active system', () => {
      expect(getCardAction('epic_hl7v2', null, null)).toBe('setup')
    })

    it('returns "setup" when integration exists but is not active, no active system', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: false })
      expect(getCardAction('epic_hl7v2', epic, null)).toBe('setup')
    })

    it('returns "manage" when this card is the active integration', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      expect(getCardAction('epic_hl7v2', epic, epic)).toBe('manage')
    })

    it('returns "switch" when a different system is active', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      expect(getCardAction('cerner_hl7v2', null, epic)).toBe('switch')
    })

    it('returns "switch" when clicking inactive card with different active system', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      const cerner = makeIntegration('cerner_hl7v2', { is_active: false })
      expect(getCardAction('cerner_hl7v2', cerner, epic)).toBe('switch')
    })

    it('returns "switch" for meditech when epic is active', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      expect(getCardAction('meditech_hl7v2', null, epic)).toBe('switch')
    })
  })

  describe('EHR_SYSTEM_DISPLAY_NAMES', () => {
    it('maps all HL7v2 types to readable names', () => {
      expect(EHR_SYSTEM_DISPLAY_NAMES.epic_hl7v2).toBe('Epic')
      expect(EHR_SYSTEM_DISPLAY_NAMES.cerner_hl7v2).toBe('Oracle Cerner')
      expect(EHR_SYSTEM_DISPLAY_NAMES.meditech_hl7v2).toBe('MEDITECH')
    })
  })

  describe('switch workflow scenarios', () => {
    it('scenario: Epic active, user clicks Cerner → should trigger switch', () => {
      const epic = makeIntegration('epic_hl7v2', { is_active: true })
      const integrations = [epic, makeIntegration('cerner_hl7v2')]
      const active = findActiveHl7v2(integrations)

      // Card action for Cerner should be "switch"
      expect(getCardAction('cerner_hl7v2', integrations[1], active)).toBe('switch')
      // Card action for Epic should be "manage"
      expect(getCardAction('epic_hl7v2', epic, active)).toBe('manage')
    })

    it('scenario: no active integration, user clicks Epic → should setup', () => {
      const integrations: EhrIntegration[] = []
      const active = findActiveHl7v2(integrations)

      expect(getCardAction('epic_hl7v2', undefined, active)).toBe('setup')
      expect(getCardAction('cerner_hl7v2', undefined, active)).toBe('setup')
      expect(getCardAction('meditech_hl7v2', undefined, active)).toBe('setup')
    })

    it('scenario: Cerner active, all 3 cards have correct actions', () => {
      const cerner = makeIntegration('cerner_hl7v2', { is_active: true })
      const epic = makeIntegration('epic_hl7v2')
      const meditech = makeIntegration('meditech_hl7v2')
      const integrations = [epic, cerner, meditech]
      const active = findActiveHl7v2(integrations)

      expect(getCardAction('epic_hl7v2', epic, active)).toBe('switch')
      expect(getCardAction('cerner_hl7v2', cerner, active)).toBe('manage')
      expect(getCardAction('meditech_hl7v2', meditech, active)).toBe('switch')
    })
  })
})
