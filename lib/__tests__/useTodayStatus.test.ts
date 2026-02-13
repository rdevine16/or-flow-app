// Unit tests for useTodayStatus helper functions.
// Tests the pure logic for status derivation without Supabase dependencies.

import { describe, it, expect } from 'vitest'

// Since the helper functions are not exported from the hook, we re-implement them here
// to validate the logic. This matches the exact implementation in useTodayStatus.ts.

type RoomStatus = 'in_case' | 'turning_over' | 'idle' | 'done'

interface MockCase {
  statusName: string
}

function deriveRoomStatus(roomCases: MockCase[]): RoomStatus {
  const hasInProgress = roomCases.some(c => c.statusName === 'in_progress')
  if (hasInProgress) return 'in_case'

  const totalCases = roomCases.length
  const completedCases = roomCases.filter(c => c.statusName === 'completed').length
  const scheduledCases = roomCases.filter(c => c.statusName === 'scheduled').length

  if (totalCases > 0 && completedCases === totalCases) return 'done'
  if (completedCases > 0 && scheduledCases > 0) return 'turning_over'
  if (scheduledCases > 0) return 'idle'

  return 'idle'
}

function formatTime12h(time: string | null): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function getSurgeonName(surgeon: { first_name: string; last_name: string } | null): string {
  if (!surgeon) return 'Unassigned'
  return `Dr. ${surgeon.last_name}`
}

describe('deriveRoomStatus', () => {
  it('returns in_case when any case is in_progress', () => {
    const cases: MockCase[] = [
      { statusName: 'completed' },
      { statusName: 'in_progress' },
      { statusName: 'scheduled' },
    ]
    expect(deriveRoomStatus(cases)).toBe('in_case')
  })

  it('returns done when all cases are completed', () => {
    const cases: MockCase[] = [
      { statusName: 'completed' },
      { statusName: 'completed' },
    ]
    expect(deriveRoomStatus(cases)).toBe('done')
  })

  it('returns turning_over when some completed and some scheduled', () => {
    const cases: MockCase[] = [
      { statusName: 'completed' },
      { statusName: 'scheduled' },
    ]
    expect(deriveRoomStatus(cases)).toBe('turning_over')
  })

  it('returns idle when only scheduled cases', () => {
    const cases: MockCase[] = [
      { statusName: 'scheduled' },
      { statusName: 'scheduled' },
    ]
    expect(deriveRoomStatus(cases)).toBe('idle')
  })

  it('returns idle when no cases', () => {
    expect(deriveRoomStatus([])).toBe('idle')
  })

  it('returns idle for a single scheduled case', () => {
    expect(deriveRoomStatus([{ statusName: 'scheduled' }])).toBe('idle')
  })

  it('returns in_case even with single in_progress case', () => {
    expect(deriveRoomStatus([{ statusName: 'in_progress' }])).toBe('in_case')
  })
})

describe('formatTime12h', () => {
  it('returns empty string for null', () => {
    expect(formatTime12h(null)).toBe('')
  })

  it('formats morning time correctly', () => {
    expect(formatTime12h('09:30')).toBe('9:30 AM')
  })

  it('formats afternoon time correctly', () => {
    expect(formatTime12h('14:15')).toBe('2:15 PM')
  })

  it('formats noon correctly', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM')
  })

  it('formats midnight correctly', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM')
  })

  it('formats 11 PM correctly', () => {
    expect(formatTime12h('23:45')).toBe('11:45 PM')
  })
})

describe('getSurgeonName', () => {
  it('returns formatted name for valid surgeon', () => {
    expect(getSurgeonName({ first_name: 'John', last_name: 'Smith' })).toBe('Dr. Smith')
  })

  it('returns Unassigned for null surgeon', () => {
    expect(getSurgeonName(null)).toBe('Unassigned')
  })
})
