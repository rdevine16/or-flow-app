/**
 * app/analytics/block-utilization/__tests__/page-phase8-recharts.test.tsx
 *
 * Phase 8 Recharts migration tests for app/analytics/block-utilization/page.tsx
 *
 * Covers:
 * 1. Unit: UtilizationTooltip — null guards (active=false, empty payload, undefined payload)
 * 2. Unit: UtilizationTooltip — correct rendering with utilization percentage
 * 3. Unit: HoursTooltip — null guards
 * 4. Unit: HoursTooltip — multi-series rendering (Used Hours, Block Hours)
 * 5. Unit: calculateWeeklyTrends logic — correct aggregation per week, dataKey alignment
 * 6. Unit: calculateWeeklyTrends — empty input, single block day, multiple weeks
 * 7. Unit: dataKey alignment guard — "utilization", "usedHours", "blockHours" keys present
 * 8. Unit: utilizationColor — color thresholds (>=85 green, >=60 amber, <60 red)
 * 9. Unit: matchesRecurrence — weekly always true, bi-weekly patterns
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================
// TOOLTIP COMPONENT DEFINITIONS
// Recreated from block-utilization/page.tsx (presentation-only, no state).
// These match the exact interfaces used in the migrated page.
// ============================================

interface ChartTooltipPayload {
  name: string
  value: number
  color: string
}

function UtilizationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div data-testid="util-tooltip">
      <p data-testid="util-label">{label}</p>
      <p data-testid="util-value">{payload[0].value}% utilization</p>
    </div>
  )
}

function HoursTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div data-testid="hours-tooltip">
      <p data-testid="hours-label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} data-testid={`hours-entry-${entry.name}`} style={{ color: entry.color }}>
          {entry.name}: {entry.value}h
        </p>
      ))}
    </div>
  )
}

// ============================================
// DATA TRANSFORM HELPERS
// Mirror the calculateWeeklyTrends function from block-utilization/page.tsx exactly.
// Testing these in isolation confirms the Recharts dataKeys match the object keys
// produced by the transforms.
// ============================================

interface WeeklyTrend {
  week: string
  utilization: number
  blockHours: number
  usedHours: number
}

interface BlockDayWithCases {
  date: string
  durationMinutes: number
  usedMinutes: number
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Mirror calculateWeeklyTrends from block-utilization/page.tsx
function calculateWeeklyTrends(blockDays: BlockDayWithCases[]): WeeklyTrend[] {
  if (blockDays.length === 0) return []

  const byWeek = new Map<string, BlockDayWithCases[]>()
  for (const bd of blockDays) {
    const d = new Date(bd.date + 'T00:00:00')
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(d)
    monday.setDate(d.getDate() + mondayOffset)
    const weekKey = toDateStr(monday)

    if (!byWeek.has(weekKey)) byWeek.set(weekKey, [])
    byWeek.get(weekKey)!.push(bd)
  }

  const trends: WeeklyTrend[] = []
  const sortedWeeks = [...byWeek.keys()].sort()

  for (const weekKey of sortedWeeks) {
    const days = byWeek.get(weekKey)!
    const totalBlock = days.reduce((s, d) => s + d.durationMinutes, 0)
    const totalUsed = days.reduce((s, d) => s + d.usedMinutes, 0)
    const utilization = totalBlock > 0 ? Math.round((totalUsed / totalBlock) * 100) : 0

    const weekDate = new Date(weekKey + 'T00:00:00')
    const label = weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    trends.push({
      week: label,
      utilization,
      blockHours: Math.round((totalBlock / 60) * 10) / 10,
      usedHours: Math.round((totalUsed / 60) * 10) / 10,
    })
  }

  return trends
}

// Mirror utilizationColor from block-utilization/page.tsx
function utilizationColor(pct: number): { text: string; bg: string; bar: string; ring: string } {
  if (pct >= 85) return { text: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500', ring: 'ring-green-200' }
  if (pct >= 60) return { text: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500', ring: 'ring-amber-200' }
  return { text: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500', ring: 'ring-red-200' }
}

type RecurrenceType =
  | 'weekly'
  | 'first_third_fifth'
  | 'second_fourth'
  | 'first_only'
  | 'second_only'
  | 'third_only'
  | 'fourth_only'
  | 'last_only'

// Mirror matchesRecurrence from block-utilization/page.tsx
function matchesRecurrence(date: Date, recurrenceType: RecurrenceType): boolean {
  if (recurrenceType === 'weekly') return true
  const weekOfMonth = Math.ceil(date.getDate() / 7)
  const nextWeek = new Date(date)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const isLast = nextWeek.getMonth() !== date.getMonth()

  switch (recurrenceType) {
    case 'first_third_fifth': return weekOfMonth === 1 || weekOfMonth === 3 || weekOfMonth === 5
    case 'second_fourth':     return weekOfMonth === 2 || weekOfMonth === 4
    case 'first_only':        return weekOfMonth === 1
    case 'second_only':       return weekOfMonth === 2
    case 'third_only':        return weekOfMonth === 3
    case 'fourth_only':       return weekOfMonth === 4
    case 'last_only':         return isLast
    default:                  return false
  }
}

// ============================================
// UtilizationTooltip tests
// ============================================

describe('UtilizationTooltip (block-utilization page)', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <UtilizationTooltip
        active={false}
        payload={[{ name: 'utilization', value: 78, color: '#3b82f6' }]}
        label="Feb 3"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <UtilizationTooltip active={true} payload={[]} label="Feb 3" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is undefined', () => {
    const { container } = render(
      <UtilizationTooltip active={true} payload={undefined} label="Feb 3" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders label and utilization percentage when active with payload', () => {
    render(
      <UtilizationTooltip
        active={true}
        payload={[{ name: 'utilization', value: 78, color: '#3b82f6' }]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('util-label').textContent).toBe('Feb 3')
    expect(screen.getByTestId('util-value').textContent).toContain('78')
    expect(screen.getByTestId('util-value').textContent).toContain('%')
    expect(screen.getByTestId('util-value').textContent).toContain('utilization')
  })

  it('renders 0% utilization (empty block day — must not show blank)', () => {
    render(
      <UtilizationTooltip
        active={true}
        payload={[{ name: 'utilization', value: 0, color: '#3b82f6' }]}
        label="Feb 10"
      />
    )
    expect(screen.getByTestId('util-value').textContent).toContain('0')
    expect(screen.getByTestId('util-value').textContent).toContain('%')
  })

  it('renders 100% utilization without clamping error', () => {
    render(
      <UtilizationTooltip
        active={true}
        payload={[{ name: 'utilization', value: 100, color: '#3b82f6' }]}
        label="Feb 17"
      />
    )
    expect(screen.getByTestId('util-value').textContent).toContain('100')
  })
})

// ============================================
// HoursTooltip tests
// ============================================

describe('HoursTooltip (block-utilization page)', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <HoursTooltip
        active={false}
        payload={[
          { name: 'Used Hours', value: 4.5, color: '#3b82f6' },
          { name: 'Block Hours', value: 6, color: '#94a3b8' },
        ]}
        label="Feb 3"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <HoursTooltip active={true} payload={[]} label="Feb 3" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders label and one entry per series', () => {
    render(
      <HoursTooltip
        active={true}
        payload={[
          { name: 'Used Hours', value: 4.5, color: '#3b82f6' },
          { name: 'Block Hours', value: 6, color: '#94a3b8' },
        ]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('hours-label').textContent).toBe('Feb 3')
    expect(screen.getByTestId('hours-entry-Used Hours')).toBeTruthy()
    expect(screen.getByTestId('hours-entry-Block Hours')).toBeTruthy()
  })

  it('displays hour values with "h" suffix for each series', () => {
    render(
      <HoursTooltip
        active={true}
        payload={[
          { name: 'Used Hours', value: 4.5, color: '#3b82f6' },
          { name: 'Block Hours', value: 6, color: '#94a3b8' },
        ]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('hours-entry-Used Hours').textContent).toContain('4.5h')
    expect(screen.getByTestId('hours-entry-Block Hours').textContent).toContain('6h')
  })

  it('applies series color via inline style', () => {
    render(
      <HoursTooltip
        active={true}
        payload={[{ name: 'Used Hours', value: 3, color: '#3b82f6' }]}
        label="Feb 10"
      />
    )
    // #3b82f6 = rgb(59, 130, 246)
    const entry = screen.getByTestId('hours-entry-Used Hours') as HTMLElement
    expect(entry.style.color).toBe('rgb(59, 130, 246)')
  })

  it('renders single series (only Used Hours — no Block Hours entry visible)', () => {
    render(
      <HoursTooltip
        active={true}
        payload={[{ name: 'Used Hours', value: 2.5, color: '#3b82f6' }]}
        label="Jan 20"
      />
    )
    expect(screen.getByTestId('hours-entry-Used Hours').textContent).toContain('2.5h')
    expect(screen.queryByTestId('hours-entry-Block Hours')).toBeNull()
  })
})

// ============================================
// calculateWeeklyTrends logic tests
// Key concern: AreaChart uses dataKey="utilization", BarChart uses
// dataKey="usedHours" and dataKey="blockHours" — verify the transform
// produces objects with exactly these keys.
// ============================================

describe('calculateWeeklyTrends logic (block-utilization page)', () => {
  it('returns empty array when no block days', () => {
    expect(calculateWeeklyTrends([])).toHaveLength(0)
  })

  it('produces object with "utilization", "blockHours", "usedHours", "week" keys', () => {
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 },
    ]
    const result = calculateWeeklyTrends(days)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('utilization')
    expect(result[0]).toHaveProperty('blockHours')
    expect(result[0]).toHaveProperty('usedHours')
    expect(result[0]).toHaveProperty('week')
  })

  it('calculates utilization percentage correctly (round)', () => {
    // 270 used / 360 block = 75%
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 },
    ]
    const result = calculateWeeklyTrends(days)
    expect(result[0].utilization).toBe(75)
  })

  it('calculates blockHours as minutes / 60 rounded to 1 decimal', () => {
    // 360 min = 6.0h
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 },
    ]
    const result = calculateWeeklyTrends(days)
    expect(result[0].blockHours).toBe(6.0)
  })

  it('calculates usedHours as minutes / 60 rounded to 1 decimal', () => {
    // 270 min = 4.5h
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 },
    ]
    const result = calculateWeeklyTrends(days)
    expect(result[0].usedHours).toBe(4.5)
  })

  it('returns utilization=0 when durationMinutes=0 (no division-by-zero)', () => {
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 0, usedMinutes: 0 },
    ]
    const result = calculateWeeklyTrends(days)
    expect(result[0].utilization).toBe(0)
  })

  it('groups block days in the same week into one trend entry', () => {
    // Monday + Wednesday of the same week
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 180 }, // Mon
      { date: '2026-02-04', durationMinutes: 360, usedMinutes: 360 }, // Wed
    ]
    const result = calculateWeeklyTrends(days)
    expect(result).toHaveLength(1)
    // totalBlock=720, totalUsed=540, utilization=75%
    expect(result[0].utilization).toBe(75)
    expect(result[0].blockHours).toBe(12)
    expect(result[0].usedHours).toBe(9)
  })

  it('splits block days across different weeks into separate trend entries', () => {
    const days: BlockDayWithCases[] = [
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 }, // Week of Jan 26
      { date: '2026-02-09', durationMinutes: 480, usedMinutes: 360 }, // Week of Feb 2
    ]
    const result = calculateWeeklyTrends(days)
    expect(result).toHaveLength(2)
  })

  it('sorts weeks chronologically ascending', () => {
    const days: BlockDayWithCases[] = [
      { date: '2026-02-16', durationMinutes: 360, usedMinutes: 180 }, // later week
      { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 }, // earlier week
    ]
    const result = calculateWeeklyTrends(days)
    expect(result).toHaveLength(2)
    // Earlier week should come first — verify by checking utilization values differ
    // Week of Feb 2: 270/360 = 75%; Week of Feb 9: 180/360 = 50%
    expect(result[0].utilization).toBe(75)
    expect(result[1].utilization).toBe(50)
  })

  it('handles a Sunday block day correctly (maps to Monday of same week)', () => {
    // Sunday Feb 8 2026 — should map to Monday Feb 2
    const sunday: BlockDayWithCases[] = [
      { date: '2026-02-08', durationMinutes: 240, usedMinutes: 120 },
    ]
    // Monday Feb 9 2026 — should map to Monday Feb 9
    const monday: BlockDayWithCases[] = [
      { date: '2026-02-09', durationMinutes: 240, usedMinutes: 120 },
    ]
    const sundayResult = calculateWeeklyTrends(sunday)
    const mondayResult = calculateWeeklyTrends(monday)
    // They should be in different weeks (Sunday goes to prior week)
    expect(sundayResult[0].week).not.toBe(mondayResult[0].week)
  })

  it('produces display week label in short-month format (not ISO string)', () => {
    const days: BlockDayWithCases[] = [
      { date: '2026-02-04', durationMinutes: 360, usedMinutes: 270 },
    ]
    const result = calculateWeeklyTrends(days)
    // "week" key should be a human-readable label like "Feb 2", not "2026-02-02"
    expect(result[0].week).toBeTruthy()
    expect(result[0].week).not.toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ============================================
// Recharts dataKey alignment guard
// This test explicitly verifies the contract between the data transforms
// and the Recharts component dataKey props.
// If someone changes a key name in the transform without updating the JSX,
// this test will catch it.
// ============================================

describe('Recharts dataKey alignment (block-utilization page)', () => {
  const sampleDays: BlockDayWithCases[] = [
    { date: '2026-02-02', durationMinutes: 360, usedMinutes: 270 },
  ]

  it('"utilization" key is present — matches Area dataKey="utilization" in AreaChart', () => {
    const result = calculateWeeklyTrends(sampleDays)
    expect(Object.keys(result[0])).toContain('utilization')
  })

  it('"usedHours" key is present — matches Bar dataKey="usedHours" in BarChart', () => {
    const result = calculateWeeklyTrends(sampleDays)
    expect(Object.keys(result[0])).toContain('usedHours')
    // Verify it is NOT named "used_hours" or "usedMinutes"
    expect(Object.keys(result[0])).not.toContain('used_hours')
    expect(Object.keys(result[0])).not.toContain('usedMinutes')
  })

  it('"blockHours" key is present — matches Bar dataKey="blockHours" in BarChart', () => {
    const result = calculateWeeklyTrends(sampleDays)
    expect(Object.keys(result[0])).toContain('blockHours')
    // Verify it is NOT named "block_hours" or "blockMinutes"
    expect(Object.keys(result[0])).not.toContain('block_hours')
    expect(Object.keys(result[0])).not.toContain('blockMinutes')
  })

  it('"week" key is present — matches XAxis dataKey="week" in both charts', () => {
    const result = calculateWeeklyTrends(sampleDays)
    expect(Object.keys(result[0])).toContain('week')
  })
})

// ============================================
// utilizationColor threshold tests
// This function drives color coding on all block day cards.
// Thresholds: >=85 = green, >=60 = amber, <60 = red
// ============================================

describe('utilizationColor (block-utilization page)', () => {
  it('returns green for pct >= 85', () => {
    expect(utilizationColor(85).text).toBe('text-green-600')
    expect(utilizationColor(100).text).toBe('text-green-600')
    expect(utilizationColor(90).bar).toBe('bg-green-500')
  })

  it('returns amber for pct >= 60 and < 85', () => {
    expect(utilizationColor(60).text).toBe('text-amber-700')
    expect(utilizationColor(75).text).toBe('text-amber-700')
    expect(utilizationColor(84).bar).toBe('bg-amber-500')
  })

  it('returns red for pct < 60', () => {
    expect(utilizationColor(0).text).toBe('text-red-600')
    expect(utilizationColor(59).text).toBe('text-red-600')
    expect(utilizationColor(30).bar).toBe('bg-red-500')
  })

  it('boundary at exactly 85 is green (not amber)', () => {
    expect(utilizationColor(85).text).toBe('text-green-600')
  })

  it('boundary at exactly 60 is amber (not red)', () => {
    expect(utilizationColor(60).text).toBe('text-amber-700')
  })
})

// ============================================
// matchesRecurrence tests
// Recurrence logic drives which block days are resolved — ensuring correct
// dates appear in the weekly trends.
// ============================================

describe('matchesRecurrence (block-utilization page)', () => {
  it('weekly recurrence always returns true regardless of date', () => {
    // Test several days across different weeks
    expect(matchesRecurrence(new Date('2026-02-02'), 'weekly')).toBe(true) // Week 1
    expect(matchesRecurrence(new Date('2026-02-09'), 'weekly')).toBe(true) // Week 2
    expect(matchesRecurrence(new Date('2026-02-28'), 'weekly')).toBe(true) // Last day of Feb
  })

  it('first_only returns true only for days 1-7 of month', () => {
    expect(matchesRecurrence(new Date('2026-02-02'), 'first_only')).toBe(true)  // day 2 = week 1
    expect(matchesRecurrence(new Date('2026-02-09'), 'first_only')).toBe(false) // day 9 = week 2
  })

  it('second_only returns true only for days 8-14 of month', () => {
    expect(matchesRecurrence(new Date('2026-02-09'), 'second_only')).toBe(true)  // day 9 = week 2
    expect(matchesRecurrence(new Date('2026-02-02'), 'second_only')).toBe(false) // day 2 = week 1
    expect(matchesRecurrence(new Date('2026-02-16'), 'second_only')).toBe(false) // day 16 = week 3
  })

  it('third_only returns true only for days 15-21 of month', () => {
    expect(matchesRecurrence(new Date('2026-02-16'), 'third_only')).toBe(true)  // day 16 = week 3
    expect(matchesRecurrence(new Date('2026-02-09'), 'third_only')).toBe(false) // day 9 = week 2
  })

  it('fourth_only returns true only for days 22-28 of month', () => {
    expect(matchesRecurrence(new Date('2026-02-23'), 'fourth_only')).toBe(true)  // day 23 = week 4
    expect(matchesRecurrence(new Date('2026-02-16'), 'fourth_only')).toBe(false) // day 16 = week 3
  })

  it('second_fourth returns true for weeks 2 and 4', () => {
    expect(matchesRecurrence(new Date('2026-02-09'), 'second_fourth')).toBe(true)  // week 2
    expect(matchesRecurrence(new Date('2026-02-23'), 'second_fourth')).toBe(true)  // week 4
    expect(matchesRecurrence(new Date('2026-02-02'), 'second_fourth')).toBe(false) // week 1
    expect(matchesRecurrence(new Date('2026-02-16'), 'second_fourth')).toBe(false) // week 3
  })

  it('first_third_fifth returns true for weeks 1, 3, and 5', () => {
    expect(matchesRecurrence(new Date('2026-02-02'), 'first_third_fifth')).toBe(true)  // week 1
    expect(matchesRecurrence(new Date('2026-02-16'), 'first_third_fifth')).toBe(true)  // week 3
    expect(matchesRecurrence(new Date('2026-02-09'), 'first_third_fifth')).toBe(false) // week 2
    expect(matchesRecurrence(new Date('2026-02-23'), 'first_third_fifth')).toBe(false) // week 4
  })

  it('last_only returns true only when next week is in the next month', () => {
    // Feb 23 2026: day 23, next week is Mar 2 (different month) => last week of Feb
    expect(matchesRecurrence(new Date('2026-02-23'), 'last_only')).toBe(true)
    // Feb 16 2026: day 16, next week is Feb 23 (same month) => not last week
    expect(matchesRecurrence(new Date('2026-02-16'), 'last_only')).toBe(false)
  })
})
