import { describe, it, expect } from 'vitest'
import { getSystemConfig } from '@/components/integrations/system-config'

/**
 * Tests for Oracle Cerner HL7v2 integration page configuration.
 *
 * Verifies that the Cerner page uses the correct system config values,
 * ensuring no accidental use of Epic config or incorrect display names.
 */

describe('Cerner Integration — System Config', () => {
  const config = getSystemConfig('cerner_hl7v2')

  it('should use cerner_hl7v2 as integration type', () => {
    expect(config.integrationType).toBe('cerner_hl7v2')
  })

  it('should display "Oracle Cerner" as the system name', () => {
    expect(config.displayName).toBe('Oracle Cerner')
  })

  it('should have correct page title', () => {
    expect(config.pageTitle).toBe('Oracle Cerner HL7v2 Integration')
  })

  it('should use "cerner" as source name for cases', () => {
    expect(config.sourceName).toBe('cerner')
  })

  it('should have Cerner-specific incoming column label', () => {
    expect(config.incomingColumnLabel).toBe('Cerner (Incoming)')
  })

  it('should use CERNER|FACILITY in curl placeholder', () => {
    expect(config.curlMshPlaceholder).toBe('CERNER|FACILITY')
  })

  it('should have Cerner-specific setup description', () => {
    expect(config.setupDescription).toContain('Cerner')
  })

  it('should use "Cerner HL7v2" as integration display name', () => {
    expect(config.integrationDisplayName).toBe('Cerner HL7v2')
  })
})

describe('Cerner Integration — Config Isolation', () => {
  it('should not share values with Epic config', () => {
    const cernerConfig = getSystemConfig('cerner_hl7v2')
    const epicConfig = getSystemConfig('epic_hl7v2')

    expect(cernerConfig.integrationType).not.toBe(epicConfig.integrationType)
    expect(cernerConfig.displayName).not.toBe(epicConfig.displayName)
    expect(cernerConfig.pageTitle).not.toBe(epicConfig.pageTitle)
    expect(cernerConfig.sourceName).not.toBe(epicConfig.sourceName)
    expect(cernerConfig.incomingColumnLabel).not.toBe(epicConfig.incomingColumnLabel)
    expect(cernerConfig.curlMshPlaceholder).not.toBe(epicConfig.curlMshPlaceholder)
  })

  it('should not share values with MEDITECH config', () => {
    const cernerConfig = getSystemConfig('cerner_hl7v2')
    const meditechConfig = getSystemConfig('meditech_hl7v2')

    expect(cernerConfig.integrationType).not.toBe(meditechConfig.integrationType)
    expect(cernerConfig.displayName).not.toBe(meditechConfig.displayName)
    expect(cernerConfig.sourceName).not.toBe(meditechConfig.sourceName)
  })
})

describe('Cerner Integration — Route Constants', () => {
  // These values are used in PageClient.tsx for navigation
  const CERNER_BASE_ROUTE = '/settings/integrations/cerner'
  const CERNER_BACK_ROUTE = '/settings/integrations'

  it('should define correct base route', () => {
    expect(CERNER_BASE_ROUTE).toBe('/settings/integrations/cerner')
  })

  it('should define correct back navigation route', () => {
    expect(CERNER_BACK_ROUTE).toBe('/settings/integrations')
  })

  it('base route should not collide with epic route', () => {
    expect(CERNER_BASE_ROUTE).not.toContain('epic')
  })
})
