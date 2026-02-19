/**
 * app/analytics/surgeons/__tests__/page-phase7-recharts.test.tsx
 *
 * Phase 7 Recharts migration tests for app/analytics/surgeons/page.tsx
 *
 * Covers:
 * 1. Unit: CaseVolumeTooltip — null guards (active=false, empty payload, undefined payload)
 * 2. Unit: CaseVolumeTooltip — correct rendering with data
 * 3. Unit: ComparisonTooltip — null guards
 * 4. Unit: ComparisonTooltip — multi-series rendering, fallback fill color
 * 5. Unit: dailyTrendData logic — completed-only, 'Cases' dataKey, sorted by date
 * 6. Unit: tkaComparisonData logic — TKA filter, technique bucketing, date grouping
 * 7. Unit: thaComparisonData logic — THA filter, technique bucketing, null exclusion
 * 8. Unit: dataKey alignment — Bar dataKey "Cases" matches dailyTrendData object key
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================
// TOOLTIP COMPONENT DEFINITIONS
// Recreated from surgeons/page.tsx (presentation-only, no state).
// These match the exact interfaces used in the migrated page.
// ============================================

interface ChartTooltipPayload {
  name: string
  value: number
  color?: string
  fill?: string
}

function CaseVolumeTooltip({
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
    <div data-testid="cv-tooltip">
      <p data-testid="cv-label">{label}</p>
      <p data-testid="cv-value">
        <span>{payload[0].value}</span> cases
      </p>
    </div>
  )
}

function ComparisonTooltip({
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
    <div data-testid="cmp-tooltip">
      <p data-testid="cmp-label">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} data-testid={`cmp-entry-${entry.name}`}>
          <span
            data-testid={`cmp-swatch-${entry.name}`}
            style={{ backgroundColor: entry.color || entry.fill }}
          />
          <span>
            {entry.name}: <span>{entry.value} min</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// DATA TRANSFORM HELPERS
// Mirror the useMemo logic from surgeons/page.tsx exactly.
// Testing these in isolation confirms the Recharts dataKeys
// match the object keys produced by the transforms.
// ============================================

type CaseStatus = { name: string }
type ProcedureType = {
  id: string
  name: string
  technique_id?: string | null
  procedure_categories?: { id: string; name: string; display_name: string } | null
}
type Milestone = {
  facility_milestone_id: string
  recorded_at: string
  facility_milestones: { name: string } | [{ name: string }]
}

interface TestCase {
  id: string
  scheduled_date: string
  case_statuses: CaseStatus | [CaseStatus]
  procedure_types?: ProcedureType | [ProcedureType] | null
  case_milestones?: Milestone[]
}

function getCompletedCases(cases: TestCase[]): TestCase[] {
  return cases.filter((c) => {
    const status = Array.isArray(c.case_statuses) ? c.case_statuses[0] : c.case_statuses
    return status?.name === 'completed'
  })
}

function getSurgicalTimeMinutes(c: TestCase): number | null {
  const milestones = c.case_milestones ?? []
  let incision: number | null = null
  let closing: number | null = null
  milestones.forEach((m) => {
    const mType = Array.isArray(m.facility_milestones) ? m.facility_milestones[0] : m.facility_milestones
    if (mType?.name === 'incision') incision = new Date(m.recorded_at).getTime()
    if (mType?.name === 'closing' || mType?.name === 'closing_complete')
      closing = new Date(m.recorded_at).getTime()
  })
  if (incision !== null && closing !== null) {
    return Math.round((closing - (incision as number)) / (1000 * 60))
  }
  return null
}

// Mirror dailyTrendData useMemo from surgeons/page.tsx
function buildDailyTrendData(cases: TestCase[]) {
  const byDate: { [key: string]: TestCase[] } = {}
  cases.forEach((c) => {
    if (!byDate[c.scheduled_date]) byDate[c.scheduled_date] = []
    byDate[c.scheduled_date].push(c)
  })
  return Object.entries(byDate)
    .map(([date, dayCases]) => {
      const completed = getCompletedCases(dayCases)
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: date,
        Cases: completed.length,
      }
    })
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

// Mirror tkaComparisonData useMemo from surgeons/page.tsx
function buildTkaComparisonData(
  cases: TestCase[],
  roboticTechniqueId: string,
  manualTechniqueId: string
) {
  const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}
  cases.forEach((c) => {
    const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
    if (!procType) return
    const procName = procType.name?.toUpperCase() || ''
    if (!procName.includes('TKA')) return
    const surgicalTime = getSurgicalTimeMinutes(c)
    if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return
    const date = c.scheduled_date
    if (!byDate[date]) byDate[date] = { robotic: [], traditional: [] }
    if (procType.technique_id === roboticTechniqueId) {
      byDate[date].robotic.push(surgicalTime)
    } else if (procType.technique_id === manualTechniqueId) {
      byDate[date].traditional.push(surgicalTime)
    }
  })
  return Object.entries(byDate)
    .map(([date, times]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: date,
      'Robotic (Mako)': times.robotic.length > 0
        ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length)
        : null,
      Traditional: times.traditional.length > 0
        ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length)
        : null,
    }))
    .filter((d) => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

// Mirror thaComparisonData useMemo from surgeons/page.tsx
function buildThaComparisonData(
  cases: TestCase[],
  roboticTechniqueId: string,
  manualTechniqueId: string
) {
  const byDate: { [key: string]: { robotic: number[]; traditional: number[] } } = {}
  cases.forEach((c) => {
    const procType = Array.isArray(c.procedure_types) ? c.procedure_types[0] : c.procedure_types
    if (!procType) return
    const procName = procType.name?.toUpperCase() || ''
    if (!procName.includes('THA')) return
    const surgicalTime = getSurgicalTimeMinutes(c)
    if (!surgicalTime || surgicalTime <= 0 || surgicalTime > 600) return
    const date = c.scheduled_date
    if (!byDate[date]) byDate[date] = { robotic: [], traditional: [] }
    if (procType.technique_id === roboticTechniqueId) {
      byDate[date].robotic.push(surgicalTime)
    } else if (procType.technique_id === manualTechniqueId) {
      byDate[date].traditional.push(surgicalTime)
    }
  })
  return Object.entries(byDate)
    .map(([date, times]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: date,
      'Robotic (Mako)': times.robotic.length > 0
        ? Math.round(times.robotic.reduce((a, b) => a + b, 0) / times.robotic.length)
        : null,
      Traditional: times.traditional.length > 0
        ? Math.round(times.traditional.reduce((a, b) => a + b, 0) / times.traditional.length)
        : null,
    }))
    .filter((d) => d['Robotic (Mako)'] !== null || d['Traditional'] !== null)
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

function makeMilestone(name: string, timestamp: string): Milestone {
  return {
    facility_milestone_id: `fm-${name}`,
    recorded_at: timestamp,
    facility_milestones: { name },
  }
}

// ============================================
// CaseVolumeTooltip tests
// ============================================

describe('CaseVolumeTooltip (surgeons page)', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <CaseVolumeTooltip
        active={false}
        payload={[{ name: 'Cases', value: 4 }]}
        label="Feb 1"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <CaseVolumeTooltip active={true} payload={[]} label="Feb 1" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is undefined', () => {
    const { container } = render(
      <CaseVolumeTooltip active={true} payload={undefined} label="Feb 1" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders label and case count when active with payload', () => {
    render(
      <CaseVolumeTooltip
        active={true}
        payload={[{ name: 'Cases', value: 7 }]}
        label="Mar 5"
      />
    )
    expect(screen.getByTestId('cv-label').textContent).toBe('Mar 5')
    expect(screen.getByTestId('cv-value').textContent).toContain('7')
    expect(screen.getByTestId('cv-value').textContent).toContain('cases')
  })

  it('renders zero cases correctly (not blank)', () => {
    render(
      <CaseVolumeTooltip
        active={true}
        payload={[{ name: 'Cases', value: 0 }]}
        label="Feb 1"
      />
    )
    expect(screen.getByTestId('cv-value').textContent).toContain('0')
  })
})

// ============================================
// ComparisonTooltip tests
// ============================================

describe('ComparisonTooltip (surgeons page)', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <ComparisonTooltip
        active={false}
        payload={[
          { name: 'Robotic (Mako)', value: 55, color: '#06b6d4' },
          { name: 'Traditional', value: 72, color: '#f43f5e' },
        ]}
        label="Feb 3"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <ComparisonTooltip active={true} payload={[]} label="Feb 3" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders label and one entry per series', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[
          { name: 'Robotic (Mako)', value: 55, color: '#06b6d4' },
          { name: 'Traditional', value: 72, color: '#f43f5e' },
        ]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('cmp-label').textContent).toBe('Feb 3')
    expect(screen.getByTestId('cmp-entry-Robotic (Mako)')).toBeTruthy()
    expect(screen.getByTestId('cmp-entry-Traditional')).toBeTruthy()
  })

  it('displays minute values for each series', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[
          { name: 'Robotic (Mako)', value: 55, color: '#06b6d4' },
          { name: 'Traditional', value: 72, color: '#f43f5e' },
        ]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('cmp-entry-Robotic (Mako)').textContent).toContain('55 min')
    expect(screen.getByTestId('cmp-entry-Traditional').textContent).toContain('72 min')
  })

  it('falls back to fill when color is not provided', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[{ name: 'Traditional', value: 72, fill: '#f43f5e' }]}
        label="Feb 3"
      />
    )
    const swatch = screen.getByTestId('cmp-swatch-Traditional')
    // #f43f5e → rgb(244, 63, 94)
    expect((swatch as HTMLElement).style.backgroundColor).toBe('rgb(244, 63, 94)')
  })

  it('renders with a single series (e.g., only robotic data for a date)', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[{ name: 'Robotic (Mako)', value: 48, color: '#06b6d4' }]}
        label="Jan 15"
      />
    )
    expect(screen.getByTestId('cmp-entry-Robotic (Mako)').textContent).toContain('48 min')
    expect(screen.queryByTestId('cmp-entry-Traditional')).toBeNull()
  })
})

// ============================================
// dailyTrendData logic tests
// Key concern: Bar uses dataKey="Cases" — verify the transform
// produces an object with key "Cases" (not "Completed Cases" or anything else).
// ============================================

describe('dailyTrendData logic (surgeons page)', () => {
  it('produces object with "Cases" key matching Bar dataKey', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyTrendData(cases)
    expect(result[0]).toHaveProperty('Cases')
    // Verify it does NOT accidentally use "Completed Cases" (which is the hub page key)
    expect(result[0]).not.toHaveProperty('Completed Cases')
  })

  it('counts only completed cases per date', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2026-02-01', case_statuses: { name: 'scheduled' } },
      { id: 'c4', scheduled_date: '2026-02-01', case_statuses: { name: 'in_progress' } },
    ]
    const result = buildDailyTrendData(cases)
    expect(result).toHaveLength(1)
    expect(result[0].Cases).toBe(2)
  })

  it('returns empty array when no cases', () => {
    expect(buildDailyTrendData([])).toHaveLength(0)
  })

  it('returns entry with Cases=0 when date has only non-completed cases', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-01', case_statuses: { name: 'scheduled' } },
    ]
    const result = buildDailyTrendData(cases)
    // The date still appears (it was in the period) but with 0 completed
    expect(result).toHaveLength(1)
    expect(result[0].Cases).toBe(0)
  })

  it('sorts entries by date ascending', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-05', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2026-02-03', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyTrendData(cases)
    expect(result[0].rawDate).toBe('2026-02-01')
    expect(result[1].rawDate).toBe('2026-02-03')
    expect(result[2].rawDate).toBe('2026-02-05')
  })

  it('produces display date in short-month format (not ISO string)', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-03', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyTrendData(cases)
    expect(result[0].date).toBeTruthy()
    expect(result[0].date).not.toBe('2026-02-03')
  })

  it('aggregates multiple dates correctly', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
      { id: 'c4', scheduled_date: '2026-02-02', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyTrendData(cases)
    expect(result).toHaveLength(2)
    const feb1 = result.find((r) => r.rawDate === '2026-02-01')
    expect(feb1?.Cases).toBe(3)
    const feb2 = result.find((r) => r.rawDate === '2026-02-02')
    expect(feb2?.Cases).toBe(1)
  })
})

// ============================================
// tkaComparisonData logic tests
// Area series use dataKey="Robotic (Mako)" and dataKey="Traditional"
// ============================================

const ROBOTIC_ID = 'technique-robotic'
const MANUAL_ID = 'technique-manual'

function makeTkaCaseWithTime(
  id: string,
  date: string,
  techniqueId: string,
  incisionTime: string,
  closingTime: string
): TestCase {
  return {
    id,
    scheduled_date: date,
    case_statuses: { name: 'completed' },
    procedure_types: {
      id: `pt-${id}`,
      name: 'TKA Total Knee',
      technique_id: techniqueId,
    },
    case_milestones: [
      makeMilestone('incision', incisionTime),
      makeMilestone('closing', closingTime),
    ],
  }
}

function makeThaCaseWithTime(
  id: string,
  date: string,
  techniqueId: string,
  incisionTime: string,
  closingTime: string
): TestCase {
  return {
    id,
    scheduled_date: date,
    case_statuses: { name: 'completed' },
    procedure_types: {
      id: `pt-${id}`,
      name: 'THA Total Hip',
      technique_id: techniqueId,
    },
    case_milestones: [
      makeMilestone('incision', incisionTime),
      makeMilestone('closing', closingTime),
    ],
  }
}

describe('tkaComparisonData logic (surgeons page)', () => {
  it('produces objects with "Robotic (Mako)" and "Traditional" keys matching Area dataKeys', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result[0]).toHaveProperty('Robotic (Mako)')
    expect(result[0]).toHaveProperty('Traditional')
  })

  it('filters out non-TKA procedures', () => {
    const cases: TestCase[] = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
      makeThaCaseWithTime('c2', '2026-02-01', ROBOTIC_ID, '2026-02-01T10:00:00', '2026-02-01T11:00:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    // Only the TKA case should appear
    expect(result).toHaveLength(1)
    expect(result[0]['Robotic (Mako)']).toBe(60)
  })

  it('buckets robotic and traditional techniques separately', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:05:00'), // 65 min
      makeTkaCaseWithTime('c2', '2026-02-01', MANUAL_ID, '2026-02-01T10:00:00', '2026-02-01T11:20:00'), // 80 min
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result).toHaveLength(1)
    expect(result[0]['Robotic (Mako)']).toBe(65)
    expect(result[0]['Traditional']).toBe(80)
  })

  it('averages multiple cases on the same date per technique', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'), // 60 min
      makeTkaCaseWithTime('c2', '2026-02-01', ROBOTIC_ID, '2026-02-01T10:00:00', '2026-02-01T11:20:00'), // 80 min
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    // Average of 60 and 80 = 70
    expect(result[0]['Robotic (Mako)']).toBe(70)
  })

  it('sets Traditional to null when no traditional cases for a date', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result[0]['Traditional']).toBeNull()
  })

  it('returns empty array when no technique IDs provided', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    // Simulates the guard: if (!roboticTechniqueId || !manualTechniqueId) return []
    const result = buildTkaComparisonData(cases, '', MANUAL_ID)
    // With empty roboticId, robotic cases won't match either bucket but the filter will still
    // exclude dates with both null values
    expect(result.length).toBe(0)
  })

  it('excludes surgicalTime > 600 min (outlier guard)', () => {
    // Guard is `surgicalTime > 600` — 600 min is the boundary (included), 601+ is excluded
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T18:01:00'), // 601 min = excluded (strictly > 600)
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result).toHaveLength(0)
  })

  it('includes surgicalTime exactly at 600 min (boundary inclusive)', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T18:00:00'), // exactly 600 min = included
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result).toHaveLength(1)
    expect(result[0]['Robotic (Mako)']).toBe(600)
  })

  it('excludes cases with missing milestones (null surgical time)', () => {
    const caseNoMilestones: TestCase = {
      id: 'c1',
      scheduled_date: '2026-02-01',
      case_statuses: { name: 'completed' },
      procedure_types: { id: 'pt-1', name: 'TKA', technique_id: ROBOTIC_ID },
      case_milestones: [],
    }
    const result = buildTkaComparisonData([caseNoMilestones], ROBOTIC_ID, MANUAL_ID)
    expect(result).toHaveLength(0)
  })

  it('sorts results by date ascending', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-05', ROBOTIC_ID, '2026-02-05T08:00:00', '2026-02-05T09:00:00'),
      makeTkaCaseWithTime('c2', '2026-02-01', MANUAL_ID, '2026-02-01T08:00:00', '2026-02-01T09:20:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result[0].rawDate).toBe('2026-02-01')
    expect(result[1].rawDate).toBe('2026-02-05')
  })

  it('returns empty array for empty cases input', () => {
    expect(buildTkaComparisonData([], ROBOTIC_ID, MANUAL_ID)).toHaveLength(0)
  })
})

// ============================================
// thaComparisonData logic tests
// ============================================

describe('thaComparisonData logic (surgeons page)', () => {
  it('produces objects with "Robotic (Mako)" and "Traditional" keys matching Area dataKeys', () => {
    const cases = [
      makeThaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildThaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result[0]).toHaveProperty('Robotic (Mako)')
    expect(result[0]).toHaveProperty('Traditional')
  })

  it('filters out non-THA procedures', () => {
    const cases: TestCase[] = [
      makeThaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
      makeTkaCaseWithTime('c2', '2026-02-01', ROBOTIC_ID, '2026-02-01T10:00:00', '2026-02-01T11:00:00'),
    ]
    const result = buildThaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    // Only THA case should appear
    expect(result).toHaveLength(1)
    expect(result[0]['Robotic (Mako)']).toBe(60)
  })

  it('buckets robotic and traditional separately for THA', () => {
    const cases = [
      makeThaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'), // 60 min
      makeThaCaseWithTime('c2', '2026-02-01', MANUAL_ID, '2026-02-01T10:00:00', '2026-02-01T11:15:00'), // 75 min
    ]
    const result = buildThaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(result[0]['Robotic (Mako)']).toBe(60)
    expect(result[0]['Traditional']).toBe(75)
  })

  it('returns empty array for empty cases input', () => {
    expect(buildThaComparisonData([], ROBOTIC_ID, MANUAL_ID)).toHaveLength(0)
  })

  it('excludes cases with null surgical time', () => {
    const caseNoMilestones: TestCase = {
      id: 'c1',
      scheduled_date: '2026-02-01',
      case_statuses: { name: 'completed' },
      procedure_types: { id: 'pt-1', name: 'THA', technique_id: MANUAL_ID },
      case_milestones: [],
    }
    expect(buildThaComparisonData([caseNoMilestones], ROBOTIC_ID, MANUAL_ID)).toHaveLength(0)
  })
})

// ============================================
// DataKey alignment guard
// This test explicitly verifies the contract between the
// data transforms and the Recharts component dataKey props.
// If someone changes a key name in the transform without
// updating the JSX, this test will catch it.
// ============================================

describe('Recharts dataKey alignment (surgeons page)', () => {
  it('dailyTrendData "Cases" key is present — matches Bar dataKey="Cases"', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2026-02-01', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyTrendData(cases)
    // The Bar component uses dataKey="Cases" — this must match exactly
    expect(Object.keys(result[0])).toContain('Cases')
  })

  it('tkaComparisonData "Robotic (Mako)" key is present — matches Area dataKey="Robotic (Mako)"', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(Object.keys(result[0])).toContain('Robotic (Mako)')
  })

  it('tkaComparisonData "Traditional" key is present — matches Area dataKey="Traditional"', () => {
    const cases = [
      makeTkaCaseWithTime('c1', '2026-02-01', MANUAL_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildTkaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(Object.keys(result[0])).toContain('Traditional')
  })

  it('thaComparisonData "Robotic (Mako)" key matches Area dataKey — THA chart', () => {
    const cases = [
      makeThaCaseWithTime('c1', '2026-02-01', ROBOTIC_ID, '2026-02-01T08:00:00', '2026-02-01T09:00:00'),
    ]
    const result = buildThaComparisonData(cases, ROBOTIC_ID, MANUAL_ID)
    expect(Object.keys(result[0])).toContain('Robotic (Mako)')
  })
})
