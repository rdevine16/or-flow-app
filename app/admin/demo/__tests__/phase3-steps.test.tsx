// app/admin/demo/__tests__/phase3-steps.test.tsx
// Phase 3 test coverage: RoomScheduleStep, OutlierConfigStep, isOutlierConfigStepValid

import { describe, it, expect } from 'vitest'
import {
  isOutlierConfigStepValid,
  createDefaultOutlierProfile,
  type SurgeonProfile,
  type OutlierSetting,
  type DayOfWeek,
} from '../types'

// ============================================================================
// UNIT TESTS: isOutlierConfigStepValid
// ============================================================================

describe('isOutlierConfigStepValid', () => {
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

  it('returns valid=true with enabledCount=0 when no outliers are enabled', () => {
    const result = isOutlierConfigStepValid({ 'surgeon-1': mockProfile })
    expect(result.valid).toBe(true)
    expect(result.enabledCount).toBe(0)
  })

  it('returns valid=true with enabledCount=1 when one outlier is enabled', () => {
    const profileWithOneOutlier = {
      ...mockProfile,
      outliers: {
        ...createDefaultOutlierProfile(),
        lateStarts: { enabled: true, frequency: 30, magnitude: 2 },
      },
    }
    const result = isOutlierConfigStepValid({ 'surgeon-1': profileWithOneOutlier })
    expect(result.valid).toBe(true)
    expect(result.enabledCount).toBe(1)
  })

  it('counts all enabled outliers across all surgeons', () => {
    const profileWithThreeOutliers = {
      ...mockProfile,
      surgeonId: 'surgeon-1',
      outliers: {
        ...createDefaultOutlierProfile(),
        lateStarts: { enabled: true, frequency: 30, magnitude: 2 },
        longTurnovers: { enabled: true, frequency: 20, magnitude: 1 },
        fastCases: { enabled: true, frequency: 40, magnitude: 3 },
      },
    }
    const profileWithTwoOutliers = {
      ...mockProfile,
      surgeonId: 'surgeon-2',
      outliers: {
        ...createDefaultOutlierProfile(),
        extendedPhases: { enabled: true, frequency: 50, magnitude: 2 },
        callbackDelays: { enabled: true, frequency: 10, magnitude: 1 },
      },
    }
    const result = isOutlierConfigStepValid({
      'surgeon-1': profileWithThreeOutliers,
      'surgeon-2': profileWithTwoOutliers,
    })
    expect(result.valid).toBe(true)
    expect(result.enabledCount).toBe(5) // 3 + 2
  })

  it('always returns valid=true even with no surgeons', () => {
    const result = isOutlierConfigStepValid({})
    expect(result.valid).toBe(true)
    expect(result.enabledCount).toBe(0)
  })

  it('ignores disabled outliers in count', () => {
    const profileWithMixed = {
      ...mockProfile,
      outliers: {
        ...createDefaultOutlierProfile(),
        lateStarts: { enabled: true, frequency: 30, magnitude: 2 },
        longTurnovers: { enabled: false, frequency: 50, magnitude: 3 }, // Disabled — shouldn't count
        fastCases: { enabled: true, frequency: 40, magnitude: 1 },
      },
    }
    const result = isOutlierConfigStepValid({ 'surgeon-1': profileWithMixed })
    expect(result.valid).toBe(true)
    expect(result.enabledCount).toBe(2) // Only lateStarts and fastCases
  })
})

// ============================================================================
// UNIT TESTS: Room Toggle Logic (from RoomScheduleStep)
// ============================================================================

describe('Room toggle logic (max 2 rooms per day)', () => {
  /**
   * Simulates the handleRoomToggle logic from RoomScheduleStep.tsx lines 41-68
   * Returns the new rooms array for a given day after toggling a room.
   */
  function simulateRoomToggle(currentRooms: string[], roomId: string): string[] {
    if (currentRooms.includes(roomId)) {
      // Remove this room
      return currentRooms.filter((id) => id !== roomId)
    } else if (currentRooms.length >= 2) {
      // Already at max — replace the second room
      return [currentRooms[0], roomId]
    } else {
      // Add the room
      return [...currentRooms, roomId]
    }
  }

  it('adds a room when current is empty', () => {
    const result = simulateRoomToggle([], 'room-1')
    expect(result).toEqual(['room-1'])
  })

  it('adds a second room when current has one', () => {
    const result = simulateRoomToggle(['room-1'], 'room-2')
    expect(result).toEqual(['room-1', 'room-2'])
  })

  it('removes a room when it is already selected', () => {
    const result = simulateRoomToggle(['room-1', 'room-2'], 'room-2')
    expect(result).toEqual(['room-1'])
  })

  it('replaces the second room when max (2) is reached and a new room is clicked', () => {
    const result = simulateRoomToggle(['room-1', 'room-2'], 'room-3')
    expect(result).toEqual(['room-1', 'room-3'])
  })

  it('keeps the first room and replaces the second room when at max', () => {
    const result = simulateRoomToggle(['room-A', 'room-B'], 'room-C')
    expect(result).toEqual(['room-A', 'room-C'])
  })

  it('removes the only room when toggling it off', () => {
    const result = simulateRoomToggle(['room-1'], 'room-1')
    expect(result).toEqual([])
  })

  it('removes the first room when toggling it off (two rooms present)', () => {
    const result = simulateRoomToggle(['room-1', 'room-2'], 'room-1')
    expect(result).toEqual(['room-2'])
  })
})

// ============================================================================
// UNIT TESTS: Outlier State Management (from OutlierConfigStep)
// ============================================================================

describe('Outlier state management', () => {
  /**
   * Simulates the handleOutlierChange logic from OutlierConfigStep.tsx lines 72-86
   * Returns the updated outliers object after applying a partial update to one outlier type.
   */
  function simulateOutlierChange(
    currentOutliers: Record<string, OutlierSetting>,
    outlierType: string,
    updates: Partial<OutlierSetting>,
  ): Record<string, OutlierSetting> {
    return {
      ...currentOutliers,
      [outlierType]: {
        ...currentOutliers[outlierType],
        ...updates,
      },
    }
  }

  it('toggles enabled from false to true', () => {
    const current = createDefaultOutlierProfile()
    const updated = simulateOutlierChange(current, 'lateStarts', { enabled: true })
    expect(updated.lateStarts.enabled).toBe(true)
    expect(updated.lateStarts.frequency).toBe(30) // Unchanged
    expect(updated.lateStarts.magnitude).toBe(2) // Unchanged
  })

  it('toggles enabled from true to false', () => {
    const current = createDefaultOutlierProfile()
    current.lateStarts.enabled = true
    const updated = simulateOutlierChange(current, 'lateStarts', { enabled: false })
    expect(updated.lateStarts.enabled).toBe(false)
  })

  it('updates frequency slider value', () => {
    const current = createDefaultOutlierProfile()
    current.longTurnovers.enabled = true
    const updated = simulateOutlierChange(current, 'longTurnovers', { frequency: 50 })
    expect(updated.longTurnovers.frequency).toBe(50)
    expect(updated.longTurnovers.enabled).toBe(true) // Unchanged
    expect(updated.longTurnovers.magnitude).toBe(2) // Unchanged
  })

  it('updates magnitude slider value', () => {
    const current = createDefaultOutlierProfile()
    current.extendedPhases.enabled = true
    const updated = simulateOutlierChange(current, 'extendedPhases', { magnitude: 3 })
    expect(updated.extendedPhases.magnitude).toBe(3)
    expect(updated.extendedPhases.enabled).toBe(true) // Unchanged
    expect(updated.extendedPhases.frequency).toBe(30) // Unchanged
  })

  it('updates multiple properties at once', () => {
    const current = createDefaultOutlierProfile()
    const updated = simulateOutlierChange(current, 'callbackDelays', {
      enabled: true,
      frequency: 60,
      magnitude: 1,
    })
    expect(updated.callbackDelays.enabled).toBe(true)
    expect(updated.callbackDelays.frequency).toBe(60)
    expect(updated.callbackDelays.magnitude).toBe(1)
  })

  it('does not affect other outlier types', () => {
    const current = createDefaultOutlierProfile()
    current.lateStarts.enabled = true
    current.fastCases.enabled = true
    const updated = simulateOutlierChange(current, 'lateStarts', { frequency: 75 })

    expect(updated.lateStarts.frequency).toBe(75)
    expect(updated.fastCases.enabled).toBe(true) // Unchanged
    expect(updated.fastCases.frequency).toBe(30) // Unchanged
  })

  it('preserves original outlier settings when updating a different one', () => {
    const current = createDefaultOutlierProfile()
    current.longTurnovers = { enabled: true, frequency: 40, magnitude: 2 }
    const updated = simulateOutlierChange(current, 'extendedPhases', { enabled: true })

    expect(updated.longTurnovers).toEqual({ enabled: true, frequency: 40, magnitude: 2 })
    expect(updated.extendedPhases.enabled).toBe(true)
    expect(updated.extendedPhases.frequency).toBe(30) // Default
    expect(updated.extendedPhases.magnitude).toBe(2) // Default
  })
})

// ============================================================================
// INTEGRATION TESTS: Bad Days Slider
// ============================================================================

describe('Bad days per month slider', () => {
  /**
   * Simulates updating badDaysPerMonth on a profile.
   */
  function simulateBadDaysUpdate(profile: SurgeonProfile, newValue: number): SurgeonProfile {
    return {
      ...profile,
      badDaysPerMonth: newValue,
    }
  }

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

  it('defaults to 0 bad days per month', () => {
    expect(mockProfile.badDaysPerMonth).toBe(0)
  })

  it('updates badDaysPerMonth to 1', () => {
    const updated = simulateBadDaysUpdate(mockProfile, 1)
    expect(updated.badDaysPerMonth).toBe(1)
  })

  it('updates badDaysPerMonth to maximum (3)', () => {
    const updated = simulateBadDaysUpdate(mockProfile, 3)
    expect(updated.badDaysPerMonth).toBe(3)
  })

  it('preserves other profile properties when updating bad days', () => {
    const updated = simulateBadDaysUpdate(mockProfile, 2)
    expect(updated.surgeonId).toBe('surgeon-1')
    expect(updated.speedProfile).toBe('average')
    expect(updated.operatingDays).toEqual([1, 3, 5])
    expect(updated.outliers).toEqual(mockProfile.outliers)
  })
})

// ============================================================================
// INTEGRATION TESTS: Day Room Assignments with Max 2 Constraint
// ============================================================================

describe('DayRoomAssignments with max 2 rooms per day', () => {
  const mockProfile: SurgeonProfile = {
    surgeonId: 'surgeon-1',
    speedProfile: 'average',
    specialty: 'joint',
    operatingDays: [1, 2, 3],
    dayRoomAssignments: {},
    procedureTypeIds: ['proc-1'],
    preferredVendor: null,
    closingWorkflow: null,
    closingHandoffMinutes: null,
    outliers: createDefaultOutlierProfile(),
    badDaysPerMonth: 0,
  }

  /**
   * Simulates the full room toggle flow on a profile, returning the updated profile.
   */
  function simulateRoomToggleOnProfile(
    profile: SurgeonProfile,
    day: DayOfWeek,
    roomId: string,
  ): SurgeonProfile {
    const currentRooms = profile.dayRoomAssignments[day] || []
    let newRooms: string[]

    if (currentRooms.includes(roomId)) {
      newRooms = currentRooms.filter((id) => id !== roomId)
    } else if (currentRooms.length >= 2) {
      newRooms = [currentRooms[0], roomId]
    } else {
      newRooms = [...currentRooms, roomId]
    }

    return {
      ...profile,
      dayRoomAssignments: {
        ...profile.dayRoomAssignments,
        [day]: newRooms,
      },
    }
  }

  it('adds first room to a day', () => {
    const updated = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    expect(updated.dayRoomAssignments[1]).toEqual(['room-1'])
  })

  it('adds second room to a day', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-2')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1', 'room-2'])
  })

  it('replaces second room when max is reached', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-2')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-3')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1', 'room-3'])
  })

  it('removes a room when toggled off', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-2')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-1')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-2'])
  })

  it('assigns different rooms to different days independently', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 2, 'room-2')
    profile = simulateRoomToggleOnProfile(profile, 3, 'room-3')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1'])
    expect(profile.dayRoomAssignments[2]).toEqual(['room-2'])
    expect(profile.dayRoomAssignments[3]).toEqual(['room-3'])
  })

  it('allows the same room on multiple days', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 2, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 3, 'room-1')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1'])
    expect(profile.dayRoomAssignments[2]).toEqual(['room-1'])
    expect(profile.dayRoomAssignments[3]).toEqual(['room-1'])
  })

  it('allows flipping between two rooms on the same day', () => {
    let profile = simulateRoomToggleOnProfile(mockProfile, 1, 'room-1')
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-2')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1', 'room-2'])

    // Toggle off room-1
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-1')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-2'])

    // Add room-3
    profile = simulateRoomToggleOnProfile(profile, 1, 'room-3')
    expect(profile.dayRoomAssignments[1]).toEqual(['room-2', 'room-3'])
  })
})
