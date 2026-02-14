import { describe, it, expect } from 'vitest'
import {
  CASE_STATUS_CONFIG,
  resolveDisplayStatus,
  getCaseStatusConfig,
} from '../caseStatusConfig'

describe('CASE_STATUS_CONFIG', () => {
  it('includes all base statuses', () => {
    expect(CASE_STATUS_CONFIG.scheduled).toBeDefined()
    expect(CASE_STATUS_CONFIG.in_progress).toBeDefined()
    expect(CASE_STATUS_CONFIG.completed).toBeDefined()
    expect(CASE_STATUS_CONFIG.cancelled).toBeDefined()
  })

  it('includes compound display states', () => {
    expect(CASE_STATUS_CONFIG.needs_validation).toBeDefined()
    expect(CASE_STATUS_CONFIG.on_hold).toBeDefined()
  })

  it('each config has label and colorKey', () => {
    for (const [, config] of Object.entries(CASE_STATUS_CONFIG)) {
      expect(config.label).toBeTruthy()
      expect(config.colorKey).toBeTruthy()
    }
  })

  it('needs_validation uses orange color key', () => {
    expect(CASE_STATUS_CONFIG.needs_validation.colorKey).toBe('needs_validation')
    expect(CASE_STATUS_CONFIG.needs_validation.label).toBe('Needs Validation')
  })
})

describe('resolveDisplayStatus', () => {
  it('returns needs_validation for completed + !dataValidated', () => {
    expect(resolveDisplayStatus('completed', false)).toBe('needs_validation')
  })

  it('returns completed for completed + dataValidated', () => {
    expect(resolveDisplayStatus('completed', true)).toBe('completed')
  })

  it('returns status as-is for non-completed statuses', () => {
    expect(resolveDisplayStatus('scheduled', false)).toBe('scheduled')
    expect(resolveDisplayStatus('in_progress', false)).toBe('in_progress')
    expect(resolveDisplayStatus('cancelled', false)).toBe('cancelled')
  })

  it('defaults to scheduled for null/undefined status', () => {
    expect(resolveDisplayStatus(null, false)).toBe('scheduled')
    expect(resolveDisplayStatus(undefined, true)).toBe('scheduled')
  })

  it('is case-insensitive', () => {
    expect(resolveDisplayStatus('Completed', false)).toBe('needs_validation')
    expect(resolveDisplayStatus('SCHEDULED', true)).toBe('scheduled')
  })
})

describe('getCaseStatusConfig', () => {
  it('returns config for known status', () => {
    const config = getCaseStatusConfig('scheduled')
    expect(config.label).toBe('Scheduled')
    expect(config.colorKey).toBe('scheduled')
  })

  it('returns scheduled fallback for unknown status', () => {
    const config = getCaseStatusConfig('nonexistent')
    expect(config.label).toBe('Scheduled')
  })

  it('returns needs_validation config', () => {
    const config = getCaseStatusConfig('needs_validation')
    expect(config.label).toBe('Needs Validation')
    expect(config.colorKey).toBe('needs_validation')
  })
})
