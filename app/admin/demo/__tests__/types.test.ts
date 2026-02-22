// app/admin/demo/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import {
  isFacilityStepValid,
  isSurgeonProfilesStepValid,
  isRoomScheduleStepValid,
  estimateTotalCases,
  createDefaultOutlierProfile,
  DEFAULT_WIZARD_STATE,
  type DemoWizardState,
  type SurgeonProfile,
  OUTLIER_DEFS,
} from '../types'

describe('types.ts — Validation helpers', () => {
  describe('isFacilityStepValid', () => {
    it('returns false when facilityId is null', () => {
      const state: DemoWizardState = { ...DEFAULT_WIZARD_STATE, facilityId: null }
      expect(isFacilityStepValid(state)).toBe(false)
    })

    it('returns true when facilityId is set', () => {
      const state: DemoWizardState = { ...DEFAULT_WIZARD_STATE, facilityId: 'facility-123' }
      expect(isFacilityStepValid(state)).toBe(true)
    })
  })

  describe('isSurgeonProfilesStepValid', () => {
    const mockProfile: SurgeonProfile = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: { 1: ['room-1'], 3: ['room-2'], 5: ['room-1'] },
      procedureTypeIds: ['proc-1', 'proc-2'],
      preferredVendor: 'Stryker',
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
    }

    it('returns invalid with error when profiles is empty', () => {
      const result = isSurgeonProfilesStepValid({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('No surgeons configured')
    })

    it('returns valid when all profiles have operating days and procedures', () => {
      const result = isSurgeonProfilesStepValid({
        'surgeon-1': mockProfile,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns invalid when a profile has no operating days', () => {
      const result = isSurgeonProfilesStepValid({
        'surgeon-1': { ...mockProfile, operatingDays: [] },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('no operating days'))).toBe(true)
    })

    it('returns invalid when a profile has no procedures', () => {
      const result = isSurgeonProfilesStepValid({
        'surgeon-1': { ...mockProfile, procedureTypeIds: [] },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('no procedures'))).toBe(true)
    })

    it('accumulates multiple errors across profiles', () => {
      const result = isSurgeonProfilesStepValid({
        'surgeon-1': { ...mockProfile, operatingDays: [] },
        'surgeon-2': { ...mockProfile, procedureTypeIds: [] },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(2)
    })
  })

  describe('isRoomScheduleStepValid', () => {
    const mockProfile: SurgeonProfile = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: { 1: ['room-1'], 3: ['room-2'], 5: ['room-1'] },
      procedureTypeIds: ['proc-1'],
      preferredVendor: null,
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
    }

    it('returns valid when all operating days have room assignments', () => {
      const result = isRoomScheduleStepValid({ 'surgeon-1': mockProfile })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('returns invalid when an operating day has no room assignment', () => {
      const result = isRoomScheduleStepValid({
        'surgeon-1': { ...mockProfile, dayRoomAssignments: { 1: ['room-1'], 3: ['room-2'] } },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('day 5'))).toBe(true)
    })

    it('returns invalid when a room assignment is empty array', () => {
      const result = isRoomScheduleStepValid({
        'surgeon-1': { ...mockProfile, dayRoomAssignments: { 1: ['room-1'], 3: [], 5: ['room-1'] } },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('day 3'))).toBe(true)
    })

    it('validates across multiple surgeons', () => {
      const result = isRoomScheduleStepValid({
        'surgeon-1': mockProfile,
        'surgeon-2': {
          ...mockProfile,
          surgeonId: 'surgeon-2',
          operatingDays: [2, 4],
          dayRoomAssignments: { 2: ['room-3'] }, // missing day 4
        },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('day 4'))).toBe(true)
    })
  })

  describe('estimateTotalCases', () => {
    const mockProfile: SurgeonProfile = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'joint',
      operatingDays: [1, 2, 3, 4, 5], // 5 days per week
      dayRoomAssignments: {},
      procedureTypeIds: ['proc-1'],
      preferredVendor: null,
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
    }

    it('returns 0 when profiles is empty', () => {
      expect(estimateTotalCases({}, 6)).toBe(0)
    })

    it('estimates based on speed profile: average = 5 cases/day', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'average', operatingDays: [1, 2, 3, 4, 5] } },
        1,
      )
      // 5 days/week * 22 working days/month = 22 days/month * 5 cases/day * 2 months (1+1) = 220
      expect(result).toBe(220)
    })

    it('estimates based on speed profile: fast = 7 cases/day', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'fast', operatingDays: [1, 2, 3, 4, 5] } },
        1,
      )
      // 5 days/week * 22 working days/month = 22 days/month * 7 cases/day * 2 months = 308
      expect(result).toBe(308)
    })

    it('estimates based on speed profile: slow = 3.5 cases/day', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'slow', operatingDays: [1, 2, 3, 4, 5] } },
        1,
      )
      // 5 days/week * 22 working days/month = 22 days/month * 3.5 cases/day * 2 months = 154
      expect(result).toBe(154)
    })

    it('scales with number of operating days per week', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'average', operatingDays: [1, 3] } }, // 2 days per week
        1,
      )
      // 2 days/week * 22 working days/month * 0.4 = 8.8 days/month * 5 cases/day * 2 months = 88
      expect(result).toBe(88)
    })

    it('scales with months of history', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'average', operatingDays: [1, 2, 3, 4, 5] } },
        6,
      )
      // 22 days/month * 5 cases/day * 7 months (6+1) = 770
      expect(result).toBe(770)
    })

    it('aggregates across multiple surgeons', () => {
      const result = estimateTotalCases(
        {
          'surgeon-1': { ...mockProfile, speedProfile: 'fast', operatingDays: [1, 2, 3, 4, 5] },
          'surgeon-2': { ...mockProfile, speedProfile: 'slow', operatingDays: [1, 2, 3, 4, 5] },
        },
        1,
      )
      // Fast: 22 * 7 * 2 = 308
      // Slow: 22 * 3.5 * 2 = 154
      // Total = 462
      expect(result).toBe(462)
    })
  })

  describe('createDefaultOutlierProfile', () => {
    it('returns a profile with all outlier types disabled', () => {
      const profile = createDefaultOutlierProfile()
      for (const def of OUTLIER_DEFS) {
        expect(profile[def.type].enabled).toBe(false)
      }
    })

    it('sets default frequency to 30%', () => {
      const profile = createDefaultOutlierProfile()
      for (const def of OUTLIER_DEFS) {
        expect(profile[def.type].frequency).toBe(30)
      }
    })

    it('sets default magnitude to 2 (medium)', () => {
      const profile = createDefaultOutlierProfile()
      for (const def of OUTLIER_DEFS) {
        expect(profile[def.type].magnitude).toBe(2)
      }
    })

    it('creates independent copies (no shared references)', () => {
      const profile1 = createDefaultOutlierProfile()
      const profile2 = createDefaultOutlierProfile()

      profile1.lateStarts.enabled = true
      expect(profile2.lateStarts.enabled).toBe(false)

      profile1.fastCases.frequency = 50
      expect(profile2.fastCases.frequency).toBe(30)
    })
  })
})
