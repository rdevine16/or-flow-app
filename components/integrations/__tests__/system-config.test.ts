/**
 * system-config.test.ts — Unit tests for system-config module
 *
 * Tests that getSystemConfig returns correct configuration for each EHR type
 * and properly falls back to Epic config for unknown types.
 */

import { describe, it, expect } from 'vitest'
import { getSystemConfig } from '@/components/integrations/system-config'
import type { EhrIntegrationType } from '@/lib/integrations/shared/integration-types'

describe('getSystemConfig', () => {
  describe('known integration types', () => {
    it('returns Epic config for epic_hl7v2', () => {
      const config = getSystemConfig('epic_hl7v2')
      expect(config.integrationType).toBe('epic_hl7v2')
      expect(config.displayName).toBe('Epic')
      expect(config.pageTitle).toBe('Epic HL7v2 Integration')
      expect(config.incomingColumnLabel).toBe('Epic (Incoming)')
      expect(config.sourceName).toBe('epic')
      expect(config.curlMshPlaceholder).toBe('EPIC|FACILITY')
    })

    it('returns Cerner config for cerner_hl7v2', () => {
      const config = getSystemConfig('cerner_hl7v2')
      expect(config.integrationType).toBe('cerner_hl7v2')
      expect(config.displayName).toBe('Oracle Cerner')
      expect(config.pageTitle).toBe('Oracle Cerner HL7v2 Integration')
      expect(config.incomingColumnLabel).toBe('Cerner (Incoming)')
      expect(config.sourceName).toBe('cerner')
      expect(config.curlMshPlaceholder).toBe('CERNER|FACILITY')
    })

    it('returns MEDITECH config for meditech_hl7v2', () => {
      const config = getSystemConfig('meditech_hl7v2')
      expect(config.integrationType).toBe('meditech_hl7v2')
      expect(config.displayName).toBe('MEDITECH')
      expect(config.pageTitle).toBe('MEDITECH HL7v2 Integration')
      expect(config.incomingColumnLabel).toBe('MEDITECH (Incoming)')
      expect(config.sourceName).toBe('meditech')
      expect(config.curlMshPlaceholder).toBe('MEDITECH|FACILITY')
    })
  })

  describe('fallback behavior', () => {
    it('falls back to Epic config for unknown integration type', () => {
      const unknownType = 'unknown_ehr' as EhrIntegrationType
      const config = getSystemConfig(unknownType)
      expect(config.integrationType).toBe('epic_hl7v2')
      expect(config.displayName).toBe('Epic')
    })

    it('falls back to Epic config for empty string', () => {
      const config = getSystemConfig('' as EhrIntegrationType)
      expect(config.integrationType).toBe('epic_hl7v2')
    })
  })

  describe('config structure consistency', () => {
    it('all configs have required fields', () => {
      const types: EhrIntegrationType[] = ['epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2']
      types.forEach(type => {
        const config = getSystemConfig(type)
        expect(config.integrationType).toBeDefined()
        expect(config.displayName).toBeDefined()
        expect(config.pageTitle).toBeDefined()
        expect(config.pageSubtitle).toBeDefined()
        expect(config.integrationDisplayName).toBeDefined()
        expect(config.curlMshPlaceholder).toBeDefined()
        expect(config.setupDescription).toBeDefined()
        expect(config.incomingColumnLabel).toBeDefined()
        expect(config.sourceName).toBeDefined()
      })
    })

    it('all configs have unique source names', () => {
      const types: EhrIntegrationType[] = ['epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2']
      const sourceNames = types.map(type => getSystemConfig(type).sourceName)
      const uniqueSourceNames = new Set(sourceNames)
      expect(uniqueSourceNames.size).toBe(sourceNames.length)
    })

    it('all configs have unique incoming column labels', () => {
      const types: EhrIntegrationType[] = ['epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2']
      const labels = types.map(type => getSystemConfig(type).incomingColumnLabel)
      const uniqueLabels = new Set(labels)
      expect(uniqueLabels.size).toBe(labels.length)
    })

    it('incoming column label includes relevant system identifier', () => {
      const epicConfig = getSystemConfig('epic_hl7v2')
      expect(epicConfig.incomingColumnLabel.toLowerCase()).toContain('epic')

      const cernerConfig = getSystemConfig('cerner_hl7v2')
      expect(cernerConfig.incomingColumnLabel.toLowerCase()).toContain('cerner')

      const meditechConfig = getSystemConfig('meditech_hl7v2')
      expect(meditechConfig.incomingColumnLabel.toLowerCase()).toContain('meditech')
    })
  })
})
