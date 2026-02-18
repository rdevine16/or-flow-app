// components/dashboard/__tests__/ScheduleAdherenceTimeline.test.tsx
// Unit + integration tests for ScheduleAdherenceTimeline.
//
// Covers:
//  - Loading skeleton renders
//  - Empty state renders (no rooms, null data)
//  - Summary badges: on-time count, late count with drift, upcoming count
//  - Late badge only shown when lateCount > 0
//  - Correct header text
//  - Domain: status color helpers (getBarFill / getBarOpacity logic)
//  - Domain: formatHour and formatTimeDetailed helpers

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleAdherenceTimeline } from '../ScheduleAdherenceTimeline'
import type { ScheduleTimelineData, TimelineCaseStatus } from '@/lib/hooks/useScheduleTimeline'

// ============================================
// ResizeObserver mock (jsdom does not implement it)
// ============================================

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// ============================================
// Factories
// ============================================

function makeSummary(
  overrides: Partial<ScheduleTimelineData['summary']> = {},
): ScheduleTimelineData['summary'] {
  return {
    onTimeCount: 0,
    lateCount: 0,
    avgDriftMinutes: 0,
    upcomingCount: 0,
    completedCount: 0,
    totalCount: 0,
    ...overrides,
  }
}

function makeRoom(
  overrides: Partial<ScheduleTimelineData['rooms'][number]> = {},
): ScheduleTimelineData['rooms'][number] {
  return {
    roomId: 'room-1',
    roomName: 'OR 1',
    displayOrder: 1,
    cases: [],
    ...overrides,
  }
}

function makeCase(
  overrides: Partial<ScheduleTimelineData['rooms'][number]['cases'][number]> = {},
): ScheduleTimelineData['rooms'][number]['cases'][number] {
  return {
    caseId: 'case-1',
    caseNumber: 'C-001',
    procedureName: 'Total Hip Replacement',
    surgeonName: 'Dr. Smith',
    scheduledStart: 8,
    scheduledEnd: 9.5,
    actualStart: null,
    actualEnd: null,
    status: 'upcoming',
    durationMinutes: 90,
    ...overrides,
  }
}

function makeTimelineData(
  overrides: Partial<ScheduleTimelineData> = {},
): ScheduleTimelineData {
  return {
    rooms: [makeRoom({ cases: [makeCase()] })],
    summary: makeSummary({ onTimeCount: 1, totalCount: 1 }),
    axisStartHour: 7,
    axisEndHour: 17,
    ...overrides,
  }
}

// ============================================
// Loading state
// ============================================

describe('ScheduleAdherenceTimeline: loading state', () => {
  it('renders animate-pulse skeleton when loading=true', () => {
    const { container } = render(<ScheduleAdherenceTimeline data={null} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('does not render schedule header text while loading', () => {
    render(<ScheduleAdherenceTimeline data={null} loading />)
    expect(screen.queryByText('Schedule Adherence')).toBeNull()
  })
})

// ============================================
// Empty states
// ============================================

describe('ScheduleAdherenceTimeline: empty states', () => {
  it('shows "No cases scheduled today" when data is null', () => {
    render(<ScheduleAdherenceTimeline data={null} loading={false} />)
    expect(screen.getByText('No cases scheduled today')).toBeTruthy()
  })

  it('shows "No cases scheduled today" when rooms array is empty', () => {
    const empty = makeTimelineData({ rooms: [], summary: makeSummary() })
    render(<ScheduleAdherenceTimeline data={empty} loading={false} />)
    expect(screen.getByText('No cases scheduled today')).toBeTruthy()
  })

  it('renders the "Schedule Adherence" header even in empty state', () => {
    render(<ScheduleAdherenceTimeline data={null} loading={false} />)
    expect(screen.getByText('Schedule Adherence')).toBeTruthy()
  })
})

// ============================================
// Summary badges
// ============================================

describe('ScheduleAdherenceTimeline: summary badges', () => {
  it('shows on-time count badge', () => {
    const data = makeTimelineData({
      summary: makeSummary({ onTimeCount: 3, totalCount: 5 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText(/3 on time/)).toBeTruthy()
  })

  it('shows upcoming count badge', () => {
    const data = makeTimelineData({
      summary: makeSummary({ upcomingCount: 4, totalCount: 4 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText(/4 upcoming/)).toBeTruthy()
  })

  it('hides late count badge when lateCount is 0', () => {
    const data = makeTimelineData({
      summary: makeSummary({ lateCount: 0, onTimeCount: 2, totalCount: 2 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    // The legend always shows "Late" as a static label, but the summary badge
    // "N late" should not appear when lateCount is 0. The badge text contains
    // a number followed by " late" — test for that pattern.
    expect(screen.queryByText(/\d+ late/)).toBeNull()
  })

  it('shows late count badge when lateCount > 0', () => {
    const data = makeTimelineData({
      summary: makeSummary({ lateCount: 2, avgDriftMinutes: 12, totalCount: 5 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText(/2 late/)).toBeTruthy()
  })

  it('includes avg drift in late badge when avgDriftMinutes > 0', () => {
    const data = makeTimelineData({
      summary: makeSummary({ lateCount: 1, avgDriftMinutes: 8, totalCount: 3 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    // The badge renders "1 late · avg drift 8 min"
    expect(screen.getByText(/avg drift 8 min/)).toBeTruthy()
  })

  it('does not show drift text when avgDriftMinutes is 0', () => {
    const data = makeTimelineData({
      summary: makeSummary({ lateCount: 1, avgDriftMinutes: 0, totalCount: 3 }),
    })
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.queryByText(/avg drift/)).toBeNull()
  })
})

// ============================================
// Header and structure
// ============================================

describe('ScheduleAdherenceTimeline: header and structure', () => {
  it('renders "Schedule Adherence" heading with data present', () => {
    const data = makeTimelineData()
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText('Schedule Adherence')).toBeTruthy()
  })

  it('renders "Scheduled vs actual case times by room" subtitle', () => {
    const data = makeTimelineData()
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText(/Scheduled vs actual case times by room/)).toBeTruthy()
  })

  it('renders legend labels: Scheduled, On-time, Late, Upcoming, Now', () => {
    const data = makeTimelineData()
    render(<ScheduleAdherenceTimeline data={data} />)
    expect(screen.getByText('Scheduled')).toBeTruthy()
    expect(screen.getByText('On-time')).toBeTruthy()
    expect(screen.getByText('Late')).toBeTruthy()
    expect(screen.getByText('Upcoming')).toBeTruthy()
    expect(screen.getByText('Now')).toBeTruthy()
  })
})

// ============================================
// Color helpers (pure logic, tested inline)
// ============================================

describe('getBarFill logic: status to fill color mapping', () => {
  // Replicate logic from ScheduleAdherenceTimeline.tsx
  function getBarFill(status: TimelineCaseStatus, isGhost: boolean): string {
    if (isGhost) return '#e2e8f0'
    switch (status) {
      case 'completed':
      case 'in_progress':
        return '#10b981'
      case 'late':
        return '#f43f5e'
      case 'upcoming':
        return '#94a3b8'
    }
  }

  it('ghost bar always returns slate-200 regardless of status', () => {
    expect(getBarFill('completed', true)).toBe('#e2e8f0')
    expect(getBarFill('late', true)).toBe('#e2e8f0')
    expect(getBarFill('upcoming', true)).toBe('#e2e8f0')
  })

  it('completed → emerald-500', () => {
    expect(getBarFill('completed', false)).toBe('#10b981')
  })

  it('in_progress → emerald-500 (same as completed)', () => {
    expect(getBarFill('in_progress', false)).toBe('#10b981')
  })

  it('late → rose-500', () => {
    expect(getBarFill('late', false)).toBe('#f43f5e')
  })

  it('upcoming → slate-400', () => {
    expect(getBarFill('upcoming', false)).toBe('#94a3b8')
  })
})

describe('getBarOpacity logic: status to opacity mapping', () => {
  function getBarOpacity(status: TimelineCaseStatus, isGhost: boolean): number {
    if (isGhost) return 0.5
    if (status === 'upcoming') return 0.4
    return 0.75
  }

  it('ghost → 0.5 opacity', () => {
    expect(getBarOpacity('upcoming', true)).toBe(0.5)
    expect(getBarOpacity('completed', true)).toBe(0.5)
  })

  it('upcoming non-ghost → 0.4 (dimmer — not yet happened)', () => {
    expect(getBarOpacity('upcoming', false)).toBe(0.4)
  })

  it('completed → 0.75', () => {
    expect(getBarOpacity('completed', false)).toBe(0.75)
  })

  it('in_progress → 0.75', () => {
    expect(getBarOpacity('in_progress', false)).toBe(0.75)
  })

  it('late → 0.75', () => {
    expect(getBarOpacity('late', false)).toBe(0.75)
  })
})

// ============================================
// formatHour (replicated pure helper)
// ============================================

describe('formatHour: hour number to AM/PM label', () => {
  function formatHour(hour: number): string {
    const h = Math.floor(hour)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 || 12
    return `${displayH}${ampm}`
  }

  it('7 → "7AM"', () => expect(formatHour(7)).toBe('7AM'))
  it('12 → "12PM"', () => expect(formatHour(12)).toBe('12PM'))
  it('13 → "1PM"', () => expect(formatHour(13)).toBe('1PM'))
  it('0 → "12AM" (midnight)', () => expect(formatHour(0)).toBe('12AM'))
  it('17 → "5PM"', () => expect(formatHour(17)).toBe('5PM'))
})

// ============================================
// formatTimeDetailed (replicated pure helper)
// ============================================

describe('formatTimeDetailed: hours-from-midnight to time string', () => {
  function formatTimeDetailed(hours: number): string {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 || 12
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  it('8.0 → "8:00 AM"', () => expect(formatTimeDetailed(8)).toBe('8:00 AM'))
  it('8.5 → "8:30 AM"', () => expect(formatTimeDetailed(8.5)).toBe('8:30 AM'))
  it('13.75 → "1:45 PM"', () => expect(formatTimeDetailed(13.75)).toBe('1:45 PM'))
  it('12.0 → "12:00 PM"', () => expect(formatTimeDetailed(12)).toBe('12:00 PM'))
  it('0.0 → "12:00 AM"', () => expect(formatTimeDetailed(0)).toBe('12:00 AM'))
})

// ============================================
// Integration: rooms with cases render without crashing
// ============================================

describe('ScheduleAdherenceTimeline: integration with case data', () => {
  it('renders without error with a single completed case', () => {
    const data = makeTimelineData({
      rooms: [
        makeRoom({
          cases: [
            makeCase({
              status: 'completed',
              actualStart: 8.1,
              actualEnd: 9.6,
            }),
          ],
        }),
      ],
      summary: makeSummary({ completedCount: 1, onTimeCount: 1, totalCount: 1 }),
    })
    expect(() => render(<ScheduleAdherenceTimeline data={data} />)).not.toThrow()
  })

  it('renders without error with a late in-progress case', () => {
    const data = makeTimelineData({
      rooms: [
        makeRoom({
          cases: [
            makeCase({
              status: 'late',
              actualStart: 8.25,
              actualEnd: null,
            }),
          ],
        }),
      ],
      summary: makeSummary({ lateCount: 1, avgDriftMinutes: 15, totalCount: 1 }),
    })
    expect(() => render(<ScheduleAdherenceTimeline data={data} />)).not.toThrow()
  })

  it('renders a case with null durationMinutes (no ghost bar) without error', () => {
    const data = makeTimelineData({
      rooms: [
        makeRoom({
          cases: [
            makeCase({ durationMinutes: null, scheduledEnd: null }),
          ],
        }),
      ],
    })
    expect(() => render(<ScheduleAdherenceTimeline data={data} />)).not.toThrow()
  })

  it('renders multiple rooms with multiple cases', () => {
    const data = makeTimelineData({
      rooms: [
        makeRoom({
          roomId: 'room-1',
          roomName: 'OR 1',
          cases: [
            makeCase({ caseId: 'c1', status: 'completed' }),
            makeCase({ caseId: 'c2', status: 'upcoming' }),
          ],
        }),
        makeRoom({
          roomId: 'room-2',
          roomName: 'OR 2',
          cases: [
            makeCase({ caseId: 'c3', status: 'late' }),
          ],
        }),
      ],
      summary: makeSummary({ completedCount: 1, upcomingCount: 1, lateCount: 1, totalCount: 3 }),
    })
    expect(() => render(<ScheduleAdherenceTimeline data={data} />)).not.toThrow()
    // lateCount=1 — the late badge should appear
    expect(screen.getByText(/1 late/)).toBeTruthy()
    // upcomingCount=1 — the upcoming badge should appear
    // (badge renders count + " upcoming" as a single text node inside a <span>)
    expect(screen.getByText(/1 upcoming/)).toBeTruthy()
  })
})
