import { describe, it, expect } from 'vitest'
import { METRIC_REQUIREMENTS } from '@/lib/dataQuality'

// Known milestone slugs that actually exist in the facility_milestones system
const KNOWN_MILESTONE_SLUGS = [
  'patient_in',
  'patient_out',
  'incision',
  'closing',
  'closing_complete',
  'anes_start',
  'anes_end',
]

describe('METRIC_REQUIREMENTS', () => {
  it('does not contain room_turnover (cross-case metric, not a milestone metric)', () => {
    expect(METRIC_REQUIREMENTS).not.toHaveProperty('room_turnover')
  })

  it('every required milestone slug is a known milestone', () => {
    for (const [, config] of Object.entries(METRIC_REQUIREMENTS)) {
      for (const slug of config.requires) {
        expect(KNOWN_MILESTONE_SLUGS).toContain(slug)
      }
    }
  })

  it('every metric has a display name', () => {
    for (const config of Object.values(METRIC_REQUIREMENTS)) {
      expect(config.name).toBeTruthy()
      expect(typeof config.name).toBe('string')
    }
  })
})
