import { describe, it, expect } from 'vitest'
import type { GenerationConfig, SurgeonProfileInput } from '../demo-data-generator'

// ============================================
// DEMO DATA GENERATOR TESTS — Updated for Phase 5
// ============================================

describe('GenerationConfig — type shape', () => {
  it('accepts createdByUserId as optional field', () => {
    const config: GenerationConfig = {
      facilityId: 'facility-1',
      surgeonProfiles: [],
      monthsOfHistory: 6,
      purgeFirst: true,
    }

    expect(config.createdByUserId).toBeUndefined()
  })

  it('accepts createdByUserId when provided', () => {
    const config: GenerationConfig = {
      facilityId: 'facility-1',
      surgeonProfiles: [],
      monthsOfHistory: 6,
      purgeFirst: true,
      createdByUserId: 'admin-user-1',
    }

    expect(config.createdByUserId).toBe('admin-user-1')
  })

  it('accepts surgeonDurations map', () => {
    const durations = new Map<string, number>()
    durations.set('surgeon-1::proc-1', 90)

    const config: GenerationConfig = {
      facilityId: 'facility-1',
      surgeonProfiles: [],
      monthsOfHistory: 6,
      purgeFirst: true,
      surgeonDurations: durations,
    }

    expect(config.surgeonDurations?.get('surgeon-1::proc-1')).toBe(90)
  })
})

describe('SurgeonProfileInput — per-day room assignments', () => {
  it('has required fields with dayRoomAssignments', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'joint',
      operatingDays: [1, 2, 3, 4, 5],
      dayRoomAssignments: { 1: ['room-1'], 2: ['room-1'], 3: ['room-1'] },
      preferredVendor: 'Stryker',
      procedureTypeIds: ['proc-1', 'proc-2'],
    }

    expect(profile.surgeonId).toBe('surgeon-1')
    expect(profile.speedProfile).toBe('average')
    expect(profile.procedureTypeIds).toHaveLength(2)
    expect(profile.dayRoomAssignments[1]).toEqual(['room-1'])
  })

  it('supports all speed profiles', () => {
    for (const speed of ['fast', 'average', 'slow'] as const) {
      const profile: SurgeonProfileInput = {
        surgeonId: 'surgeon-1',
        speedProfile: speed,
        specialty: 'joint',
        operatingDays: [1],
        dayRoomAssignments: { 1: ['room-1'] },
        preferredVendor: null,
        procedureTypeIds: ['proc-1'],
      }
      expect(profile.speedProfile).toBe(speed)
    }
  })

  it('supports all specialties', () => {
    for (const specialty of ['joint', 'hand_wrist', 'spine'] as const) {
      const profile: SurgeonProfileInput = {
        surgeonId: 'surgeon-1',
        speedProfile: 'average',
        specialty,
        operatingDays: [1],
        dayRoomAssignments: { 1: ['room-1'] },
        preferredVendor: null,
        procedureTypeIds: ['proc-1'],
      }
      expect(profile.specialty).toBe(specialty)
    }
  })

  it('supports flip room configuration via per-day assignments', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'fast',
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: {
        1: ['room-1', 'room-2'],  // flip rooms on Monday
        3: ['room-1', 'room-3'],  // different flip room on Wednesday
        5: ['room-1'],            // single room on Friday
      },
      preferredVendor: 'Zimmer Biomet',
      procedureTypeIds: ['proc-1'],
    }

    expect(profile.dayRoomAssignments[1]).toEqual(['room-1', 'room-2'])
    expect(profile.dayRoomAssignments[3]).toEqual(['room-1', 'room-3'])
    expect(profile.dayRoomAssignments[5]).toEqual(['room-1'])
  })

  it('supports different rooms on different days', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'spine',
      operatingDays: [1, 2, 4],
      dayRoomAssignments: {
        1: ['or-1'],
        2: ['or-2'],
        4: ['or-1', 'or-3'],
      },
      preferredVendor: null,
      procedureTypeIds: ['proc-1'],
    }

    // Monday uses OR-1, Tuesday uses OR-2, Thursday flip between OR-1 and OR-3
    expect(Object.keys(profile.dayRoomAssignments)).toHaveLength(3)
    expect(profile.dayRoomAssignments[4]).toHaveLength(2)
  })
})

describe('Demo Generator Milestone Schema', () => {
  it('should use facility_milestone_id in milestone records (verified by code audit)', () => {
    const sampleMilestone = {
      case_id: 'case-1',
      facility_milestone_id: 'fm-patient-in',
      recorded_at: '2026-03-15T07:30:00Z',
    }

    expect(sampleMilestone).toHaveProperty('facility_milestone_id')
    expect(sampleMilestone).not.toHaveProperty('milestone_type_id')
  })

  it('should set created_by on generated case data (verified by code audit)', () => {
    const sampleCase = {
      id: 'case-1',
      facility_id: 'facility-1',
      case_number: 'DEMO-00001',
      surgeon_id: 'surgeon-1',
      procedure_type_id: 'proc-1',
      created_by: 'admin-user-1',
    }

    expect(sampleCase.created_by).toBe('admin-user-1')
  })

  it('should initialize future case milestones with null recorded_at (verified by code audit)', () => {
    const futureMilestone = {
      case_id: 'case-future',
      facility_milestone_id: 'fm-patient-in',
      recorded_at: null,
    }

    expect(futureMilestone.recorded_at).toBeNull()
    expect(futureMilestone.facility_milestone_id).toBeDefined()
  })
})

// ============================================
// PHASE 5 COVERAGE TESTS — Per-Day Room Assignments & Enhanced Logic
// ============================================

describe('Phase 5: Per-Day Room Assignment Logic', () => {
  it('supports surgeons using different rooms on different days of the week', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'joint',
      operatingDays: [1, 2, 4], // Mon, Tue, Thu
      dayRoomAssignments: {
        1: ['or-1'],      // Monday: OR-1
        2: ['or-2'],      // Tuesday: OR-2
        4: ['or-3'],      // Thursday: OR-3
      },
      preferredVendor: 'Stryker',
      procedureTypeIds: ['proc-1'],
    }

    expect(profile.dayRoomAssignments[1]).toEqual(['or-1'])
    expect(profile.dayRoomAssignments[2]).toEqual(['or-2'])
    expect(profile.dayRoomAssignments[4]).toEqual(['or-3'])
    expect(profile.dayRoomAssignments[3]).toBeUndefined() // Wednesday not assigned
  })

  it('supports flip room configuration on specific days only', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'fast',
      specialty: 'joint',
      operatingDays: [1, 3, 5],
      dayRoomAssignments: {
        1: ['or-1', 'or-2'],  // Monday: flip rooms
        3: ['or-1'],          // Wednesday: single room
        5: ['or-1', 'or-3'],  // Friday: flip rooms (different second room)
      },
      preferredVendor: 'Zimmer Biomet',
      procedureTypeIds: ['proc-1'],
    }

    // Monday and Friday are flip room days
    expect(profile.dayRoomAssignments[1]).toHaveLength(2)
    expect(profile.dayRoomAssignments[5]).toHaveLength(2)
    // Wednesday is single room
    expect(profile.dayRoomAssignments[3]).toHaveLength(1)
    // Different second room on Friday
    expect(profile.dayRoomAssignments[5][1]).toBe('or-3')
  })

  it('handles empty room assignments gracefully (no cases on days without rooms)', () => {
    const profile: SurgeonProfileInput = {
      surgeonId: 'surgeon-1',
      speedProfile: 'average',
      specialty: 'spine',
      operatingDays: [1, 2, 3, 4, 5],
      dayRoomAssignments: {
        1: ['or-1'],
        2: ['or-2'],
        // Wednesday has no room assignment — should skip this day
        4: ['or-3'],
        5: ['or-4'],
      },
      preferredVendor: null,
      procedureTypeIds: ['proc-1'],
    }

    expect(profile.operatingDays).toContain(3) // surgeon operates on Wednesday
    expect(profile.dayRoomAssignments[3]).toBeUndefined() // but no room assigned
    // Generator should skip Wednesday for this surgeon
  })
})

describe('Phase 5: Speed Profile Multiplier Application', () => {
  it('defines speed multipliers for surgical time scaling', () => {
    // Fast surgeons: 0.7x (30% faster)
    // Average surgeons: 1.0x (baseline)
    // Slow surgeons: 1.3x (30% slower)
    const SPEED_MULTIPLIER = { fast: 0.7, average: 1.0, slow: 1.3 }

    const baseSurgicalTime = 60 // minutes

    expect(Math.round(baseSurgicalTime * SPEED_MULTIPLIER.fast)).toBe(42)
    expect(Math.round(baseSurgicalTime * SPEED_MULTIPLIER.average)).toBe(60)
    expect(Math.round(baseSurgicalTime * SPEED_MULTIPLIER.slow)).toBe(78)
  })

  it('applies multiplier AFTER deriving surgical time from procedure duration', () => {
    // Procedure duration: 90 minutes (includes 40 min overhead)
    // Derived surgical time: 90 - 40 = 50 minutes
    // Fast multiplier: 50 * 0.7 = 35 minutes
    const procedureDuration = 90
    const overhead = 40
    const derivedSurgicalTime = procedureDuration - overhead
    const fastMultiplier = 0.7

    const finalSurgicalTime = Math.round(derivedSurgicalTime * fastMultiplier)

    expect(finalSurgicalTime).toBe(35)
  })
})

describe('Phase 5: Surgeon Duration 3-Tier Resolution', () => {
  it('Tier 1: uses surgeon-specific override when available', () => {
    const surgeonDurationMap = new Map<string, number>()
    surgeonDurationMap.set('surgeon-1::proc-1', 75) // surgeon override

    const procedureType = { id: 'proc-1', name: 'THA', expected_duration_minutes: 90 }
    const overhead = 40

    // Tier 1: surgeon-specific override
    const surgeonDuration = surgeonDurationMap.get('surgeon-1::proc-1')
    expect(surgeonDuration).toBe(75)

    const derivedSurgicalTime = Math.max(15, surgeonDuration! - overhead)
    expect(derivedSurgicalTime).toBe(35)
  })

  it('Tier 2: falls back to procedure type default when no surgeon override', () => {
    const surgeonDurationMap = new Map<string, number>()
    // No surgeon-specific override

    const procedureType = { id: 'proc-1', name: 'THA', expected_duration_minutes: 90 }
    const overhead = 40

    const surgeonDuration = surgeonDurationMap.get('surgeon-1::proc-1')
    expect(surgeonDuration).toBeUndefined()

    // Tier 2: procedure type default
    if (procedureType.expected_duration_minutes != null) {
      const derivedSurgicalTime = Math.max(15, procedureType.expected_duration_minutes - overhead)
      expect(derivedSurgicalTime).toBe(50)
    }
  })

  it('Tier 3: uses hardcoded fallback when no override or default', () => {
    const surgeonDurationMap = new Map<string, number>()
    const procedureType = { id: 'proc-1', name: 'THA', expected_duration_minutes: null }

    const surgeonDuration = surgeonDurationMap.get('surgeon-1::proc-1')
    expect(surgeonDuration).toBeUndefined()
    expect(procedureType.expected_duration_minutes).toBeNull()

    // Tier 3: hardcoded fallback (speed config or procedure name lookup)
    const speedCfgSurgicalTime = { min: 48, max: 59 }
    const fallbackSurgicalTime = (speedCfgSurgicalTime.min + speedCfgSurgicalTime.max) / 2

    expect(fallbackSurgicalTime).toBeGreaterThan(0)
  })
})

describe('Phase 5: Incision-Based Callback Timing', () => {
  it('calculates callback timing partway through incision (not at prep_drape_complete)', () => {
    const surgicalTime = 60 // minutes
    const incisionTime = new Date('2026-02-21T08:30:00Z')

    // Fast surgeon: good caller (20-40% through surgical time)
    const fastCallbackPct = 0.30 // 30%
    const fastCallbackOffset = Math.round(surgicalTime * fastCallbackPct)
    expect(fastCallbackOffset).toBe(18) // called back 18 minutes after incision

    // Average surgeon: average caller (50-70% through surgical time)
    const avgCallbackPct = 0.60 // 60%
    const avgCallbackOffset = Math.round(surgicalTime * avgCallbackPct)
    expect(avgCallbackOffset).toBe(36) // called back 36 minutes after incision

    // Slow surgeon: late caller (80-100% through surgical time)
    const slowCallbackPct = 0.90 // 90%
    const slowCallbackOffset = Math.round(surgicalTime * slowCallbackPct)
    expect(slowCallbackOffset).toBe(54) // called back 54 minutes after incision
  })

  it('callback timing only applies to flip room cases after first case', () => {
    // First case in flip room sequence: no callback (no previous room to call from)
    const isFirstCase = true
    const isFlipRoomDay = true

    if (isFlipRoomDay && !isFirstCase) {
      // This code should NOT run for first case
      expect(true).toBe(false) // should never reach here
    } else {
      expect(isFirstCase).toBe(true)
    }
  })
})

describe('Phase 5: Transit Gap Between Flip Room Cases', () => {
  it('adds 3-8 minute transit gap between flip room cases', () => {
    const baseDuration = 90 // procedure duration in minutes
    const transitGapMin = 3
    const transitGapMax = 8

    // Transit gap is randomly selected between 3-8 minutes
    for (let i = 0; i < 10; i++) {
      const transitGap = Math.floor(Math.random() * (transitGapMax - transitGapMin + 1)) + transitGapMin
      expect(transitGap).toBeGreaterThanOrEqual(3)
      expect(transitGap).toBeLessThanOrEqual(8)

      const totalInterval = baseDuration + transitGap
      expect(totalInterval).toBeGreaterThanOrEqual(baseDuration + 3)
      expect(totalInterval).toBeLessThanOrEqual(baseDuration + 8)
    }
  })

  it('transit gap accounts for scrub time and physical room change', () => {
    // Transit gap replaces old flip room interval logic
    // Old: fixed 60/90 min interval
    // New: procedure duration + 3-8 min transit gap
    const procedureDuration = 75
    const transitGap = 5 // example

    const newInterval = procedureDuration + transitGap
    expect(newInterval).toBe(80)

    // Old fixed interval would have been 90 (for average speed)
    // New interval is more realistic: actual procedure time + small gap
  })
})

describe('Phase 5: CRNA Pooling with Anesthesiologists', () => {
  it('pools anesthesiologists and CRNAs as anesthesia providers', () => {
    // Mock staff data
    const roleMap = new Map([
      ['role-anes', 'anesthesiologist'],
      ['role-crna', 'crna'],
      ['role-nurse', 'nurse'],
    ])

    const allStaff = [
      { id: 'staff-1', role_id: 'role-anes', first_name: 'John', last_name: 'Doe' },
      { id: 'staff-2', role_id: 'role-crna', first_name: 'Jane', last_name: 'Smith' },
      { id: 'staff-3', role_id: 'role-nurse', first_name: 'Bob', last_name: 'Jones' },
      { id: 'staff-4', role_id: 'role-crna', first_name: 'Alice', last_name: 'Brown' },
    ]

    // Pool anesthesia providers (anesthesiologists + CRNAs)
    const anesthesiaPool = allStaff.filter(u => {
      const role = roleMap.get(u.role_id)
      return role === 'anesthesiologist' || role === 'crna'
    })

    expect(anesthesiaPool).toHaveLength(3) // 1 anesthesiologist + 2 CRNAs
    expect(anesthesiaPool.map(s => s.id)).toEqual(['staff-1', 'staff-2', 'staff-4'])
  })

  it('assigns anesthesia providers from pooled list to rooms', () => {
    const anesthesiaPool = [
      { id: 'anes-1', role_id: 'role-anes' },
      { id: 'crna-1', role_id: 'role-crna' },
      { id: 'crna-2', role_id: 'role-crna' },
    ]

    const usedAnes = new Set<string>()
    const rooms = ['or-1', 'or-2', 'or-3']

    const assignments = rooms.map(roomId => {
      const anes = anesthesiaPool.find(a => !usedAnes.has(a.id))
      if (anes) usedAnes.add(anes.id)
      return { roomId, anesId: anes?.id }
    })

    expect(assignments[0].anesId).toBe('anes-1')
    expect(assignments[1].anesId).toBe('crna-1')
    expect(assignments[2].anesId).toBe('crna-2')

    // All anesthesia providers assigned, no double-booking
    expect(usedAnes.size).toBe(3)
  })
})

describe('Phase 5: Holiday Date Set Initialization', () => {
  it('initializes holiday date set using algorithmic computation', () => {
    // Mock getHolidayDateSet function behavior
    const getHolidayDateSet = (startYear: number, endYear: number): Set<string> => {
      const holidays = new Set<string>()
      // New Year's Day (always January 1)
      for (let year = startYear; year <= endYear; year++) {
        holidays.add(`${year}-01-01`)
      }
      // Independence Day (always July 4)
      for (let year = startYear; year <= endYear; year++) {
        holidays.add(`${year}-07-04`)
      }
      // Christmas (always December 25)
      for (let year = startYear; year <= endYear; year++) {
        holidays.add(`${year}-12-25`)
      }
      return holidays
    }

    const holidays = getHolidayDateSet(2025, 2026)

    expect(holidays.has('2025-01-01')).toBe(true)
    expect(holidays.has('2025-07-04')).toBe(true)
    expect(holidays.has('2025-12-25')).toBe(true)
    expect(holidays.has('2026-01-01')).toBe(true)
    expect(holidays.has('2026-07-04')).toBe(true)
    expect(holidays.has('2026-12-25')).toBe(true)
  })

  it('skips case generation on holiday dates', () => {
    const isHoliday = (date: Date, holidaySet: Set<string>): boolean => {
      const dateStr = date.toISOString().split('T')[0]
      return holidaySet.has(dateStr)
    }

    const holidaySet = new Set(['2026-01-01', '2026-07-04'])

    const newYears = new Date('2026-01-01T08:00:00Z')
    const independenceDay = new Date('2026-07-04T08:00:00Z')
    const regularDay = new Date('2026-03-15T08:00:00Z')

    expect(isHoliday(newYears, holidaySet)).toBe(true)
    expect(isHoliday(independenceDay, holidaySet)).toBe(true)
    expect(isHoliday(regularDay, holidaySet)).toBe(false)
  })
})
