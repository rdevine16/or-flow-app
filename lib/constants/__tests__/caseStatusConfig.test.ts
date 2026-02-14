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
    expect(CASE_STATUS_CONFIG.on_hold).toBeDefined()
  })

  it('does not include compound display states', () => {
    expect(CASE_STATUS_CONFIG.needs_validation).toBeUndefined()
  })

  it('each config has label and colorKey', () => {
    for (const [, config] of Object.entries(CASE_STATUS_CONFIG)) {
      expect(config.label).toBeTruthy()
      expect(config.colorKey).toBeTruthy()
    }
  })
})

describe('resolveDisplayStatus', () => {
  it('returns completed for completed status (regardless of validation)', () => {
    expect(resolveDisplayStatus('completed')).toBe('completed')
  })

  it('returns status as-is for all statuses', () => {
    expect(resolveDisplayStatus('scheduled')).toBe('scheduled')
    expect(resolveDisplayStatus('in_progress')).toBe('in_progress')
    expect(resolveDisplayStatus('completed')).toBe('completed')
    expect(resolveDisplayStatus('cancelled')).toBe('cancelled')
    expect(resolveDisplayStatus('on_hold')).toBe('on_hold')
  })

  it('defaults to scheduled for null/undefined status', () => {
    expect(resolveDisplayStatus(null)).toBe('scheduled')
    expect(resolveDisplayStatus(undefined)).toBe('scheduled')
  })

  it('is case-insensitive', () => {
    expect(resolveDisplayStatus('Completed')).toBe('completed')
    expect(resolveDisplayStatus('SCHEDULED')).toBe('scheduled')
    expect(resolveDisplayStatus('In_Progress')).toBe('in_progress')
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

  it('returns completed config for completed status', () => {
    const config = getCaseStatusConfig('completed')
    expect(config.label).toBe('Completed')
    expect(config.colorKey).toBe('completed')
  })
})
