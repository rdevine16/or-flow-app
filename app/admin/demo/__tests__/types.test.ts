// app/admin/demo/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import {
  isFacilityStepValid,
  isSurgeonProfilesStepValid,
  isRoomScheduleStepValid,
  estimateTotalCases,
  createDefaultOutlierProfile,
  parseBlockSchedules,
  buildDurationMap,
  DEFAULT_WIZARD_STATE,
  type DemoWizardState,
  type SurgeonProfile,
  type BlockScheduleEntry,
  type SurgeonDurationEntry,
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
      speedMultiplierRange: { min: 90, max: 110 },
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: { 1: ['room-1'], 3: ['room-2'], 5: ['room-1'] },
      procedureTypeIds: ['proc-1', 'proc-2'],
      preferredVendor: 'Stryker',
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
      casesPerDay: { min: 4, max: 6 },
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
      speedMultiplierRange: { min: 90, max: 110 },
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: { 1: ['room-1'], 3: ['room-2'], 5: ['room-1'] },
      procedureTypeIds: ['proc-1'],
      preferredVendor: null,
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
      casesPerDay: { min: 4, max: 6 },
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
      speedMultiplierRange: { min: 90, max: 110 },
      specialty: 'joint',
      operatingDays: [1, 2, 3, 4, 5], // 5 days per week
      dayRoomAssignments: {},
      procedureTypeIds: ['proc-1'],
      preferredVendor: null,
      closingWorkflow: null,
      closingHandoffMinutes: null,
      outliers: createDefaultOutlierProfile(),
      badDaysPerMonth: 0,
      casesPerDay: { min: 4, max: 6 },
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

    it('estimates based on casesPerDay: fast = 6-8, avg 7 cases/day', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'fast', casesPerDay: { min: 6, max: 8 }, operatingDays: [1, 2, 3, 4, 5] } },
        1,
      )
      // 5 days/week * 22 working days/month = 22 days/month * 7 cases/day * 2 months = 308
      expect(result).toBe(308)
    })

    it('estimates based on casesPerDay: slow = 3-4, avg 3.5 cases/day', () => {
      const result = estimateTotalCases(
        { 'surgeon-1': { ...mockProfile, speedProfile: 'slow', casesPerDay: { min: 3, max: 4 }, operatingDays: [1, 2, 3, 4, 5] } },
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
          'surgeon-1': { ...mockProfile, speedProfile: 'fast', casesPerDay: { min: 6, max: 8 }, operatingDays: [1, 2, 3, 4, 5] },
          'surgeon-2': { ...mockProfile, speedProfile: 'slow', casesPerDay: { min: 3, max: 4 }, operatingDays: [1, 2, 3, 4, 5] },
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

    it('sets default rangeMin/rangeMax from OUTLIER_DEFS', () => {
      const profile = createDefaultOutlierProfile()
      for (const def of OUTLIER_DEFS) {
        expect(profile[def.type].rangeMin).toBe(def.defaultMin)
        expect(profile[def.type].rangeMax).toBe(def.defaultMax)
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

  describe('parseBlockSchedules', () => {
    const mockBlocks: BlockScheduleEntry[] = [
      { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:00:00', end_time: '15:00:00' },
      { surgeon_id: 'surgeon-1', day_of_week: 3, start_time: '07:30:00', end_time: '14:30:00' },
      { surgeon_id: 'surgeon-1', day_of_week: 5, start_time: '08:00:00', end_time: '16:00:00' },
      { surgeon_id: 'surgeon-2', day_of_week: 2, start_time: '09:00:00', end_time: '17:00:00' },
      { surgeon_id: 'surgeon-2', day_of_week: 4, start_time: '10:00:00', end_time: '18:00:00' },
    ]

    it('filters blocks by surgeon ID', () => {
      const result = parseBlockSchedules(mockBlocks, 'surgeon-1')
      expect(result.days).toEqual([1, 3, 5])
    })

    it('returns empty days array for surgeon with no blocks', () => {
      const result = parseBlockSchedules(mockBlocks, 'surgeon-99')
      expect(result.days).toEqual([])
      expect(result.scheduleLabel).toBe('')
    })

    it('filters out weekend days (0=Sun, 6=Sat)', () => {
      const blocksWithWeekends: BlockScheduleEntry[] = [
        { surgeon_id: 'surgeon-1', day_of_week: 0, start_time: '07:00:00', end_time: '15:00:00' },
        { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:00:00', end_time: '15:00:00' },
        { surgeon_id: 'surgeon-1', day_of_week: 6, start_time: '07:00:00', end_time: '15:00:00' },
      ]
      const result = parseBlockSchedules(blocksWithWeekends, 'surgeon-1')
      expect(result.days).toEqual([1]) // Only Monday
    })

    it('formats schedule label with day names and times', () => {
      const result = parseBlockSchedules(mockBlocks, 'surgeon-1')
      expect(result.scheduleLabel).toBe('Mon 07:00-15:00, Wed 07:30-14:30, Fri 08:00-16:00')
    })

    it('sorts days in ascending order', () => {
      const unsortedBlocks: BlockScheduleEntry[] = [
        { surgeon_id: 'surgeon-1', day_of_week: 5, start_time: '08:00:00', end_time: '16:00:00' },
        { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:00:00', end_time: '15:00:00' },
        { surgeon_id: 'surgeon-1', day_of_week: 3, start_time: '07:30:00', end_time: '14:30:00' },
      ]
      const result = parseBlockSchedules(unsortedBlocks, 'surgeon-1')
      expect(result.days).toEqual([1, 3, 5])
    })

    it('handles duplicate days by removing duplicates', () => {
      const duplicateBlocks: BlockScheduleEntry[] = [
        { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:00:00', end_time: '12:00:00' },
        { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '13:00:00', end_time: '17:00:00' },
      ]
      const result = parseBlockSchedules(duplicateBlocks, 'surgeon-1')
      expect(result.days).toEqual([1])
      expect(result.scheduleLabel).toBe('Mon 07:00-12:00')
    })

    it('truncates time strings to HH:MM format', () => {
      const blocksWithSeconds: BlockScheduleEntry[] = [
        { surgeon_id: 'surgeon-1', day_of_week: 1, start_time: '07:30:45', end_time: '15:45:30' },
      ]
      const result = parseBlockSchedules(blocksWithSeconds, 'surgeon-1')
      expect(result.scheduleLabel).toBe('Mon 07:30-15:45')
    })
  })

  describe('buildDurationMap', () => {
    const mockDurations: SurgeonDurationEntry[] = [
      { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-1', expected_duration_minutes: 45 },
      { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-2', expected_duration_minutes: 90 },
      { surgeon_id: 'surgeon-2', procedure_type_id: 'proc-1', expected_duration_minutes: 60 },
      { surgeon_id: 'surgeon-2', procedure_type_id: 'proc-3', expected_duration_minutes: 120 },
    ]

    it('builds map with composite keys "surgeonId::procedureTypeId"', () => {
      const map = buildDurationMap(mockDurations)
      expect(map.get('surgeon-1::proc-1')).toBe(45)
      expect(map.get('surgeon-1::proc-2')).toBe(90)
      expect(map.get('surgeon-2::proc-1')).toBe(60)
      expect(map.get('surgeon-2::proc-3')).toBe(120)
    })

    it('returns undefined for non-existent keys', () => {
      const map = buildDurationMap(mockDurations)
      expect(map.get('surgeon-1::proc-3')).toBeUndefined()
      expect(map.get('surgeon-99::proc-1')).toBeUndefined()
    })

    it('handles empty entries array', () => {
      const map = buildDurationMap([])
      expect(map.size).toBe(0)
    })

    it('handles duplicate keys by keeping the last entry', () => {
      const duplicates: SurgeonDurationEntry[] = [
        { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-1', expected_duration_minutes: 45 },
        { surgeon_id: 'surgeon-1', procedure_type_id: 'proc-1', expected_duration_minutes: 60 },
      ]
      const map = buildDurationMap(duplicates)
      expect(map.get('surgeon-1::proc-1')).toBe(60)
      expect(map.size).toBe(1)
    })

    it('preserves duration values accurately', () => {
      const map = buildDurationMap(mockDurations)
      expect(map.get('surgeon-2::proc-3')).toBe(120)
      expect(map.get('surgeon-1::proc-1')).not.toBe(60) // Different surgeon
    })
  })
})
