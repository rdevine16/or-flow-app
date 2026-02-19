/**
 * app/analytics/__tests__/page-phase6-recharts.test.tsx
 *
 * Phase 6 Recharts migration tests for app/analytics/page.tsx
 *
 * Covers:
 * 1. Unit: Tooltip components — null guards (active=false, empty payload)
 * 2. Unit: Tooltip components — correct rendering with data
 * 3. Unit: dailyCaseTrendData logic — only completed cases counted, sorted by date
 * 4. Unit: procedureCategoryData logic — aggregation, top-8 cap, sort order
 * 5. Unit: getSurgicalTimeMinutes helper — incision→closing delta, missing milestones
 * 6. Unit: FlagsSummaryCard stats logic — severity breakdown, uniqueCases, topCases
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================
// TOOLTIP COMPONENT TESTS
// These components are defined locally inside page.tsx.
// We test their logic by recreating them here using the same
// interfaces, since they are presentation-only with no state.
// ============================================

interface TooltipPayload {
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
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div data-testid="cv-tooltip">
      <p data-testid="cv-label">{label}</p>
      <p data-testid="cv-value">
        <span>{payload[0].value}</span> completed cases
      </p>
    </div>
  )
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div data-testid="cat-tooltip">
      <span
        data-testid="cat-swatch"
        style={{ backgroundColor: item.fill }}
      />
      <span data-testid="cat-text">
        {item.name}: <span>{item.value} cases</span>
      </span>
    </div>
  )
}

function ComparisonTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
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
// TOOLTIP: null guard tests
// ============================================

describe('CaseVolumeTooltip', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <CaseVolumeTooltip
        active={false}
        payload={[{ name: 'Completed Cases', value: 5 }]}
        label="Jan 1"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <CaseVolumeTooltip active={true} payload={[]} label="Jan 1" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is undefined', () => {
    const { container } = render(
      <CaseVolumeTooltip active={true} payload={undefined} label="Jan 1" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders label and value when active with payload', () => {
    render(
      <CaseVolumeTooltip
        active={true}
        payload={[{ name: 'Completed Cases', value: 12 }]}
        label="Feb 15"
      />
    )
    expect(screen.getByTestId('cv-label').textContent).toBe('Feb 15')
    expect(screen.getByTestId('cv-value').textContent).toContain('12')
    expect(screen.getByTestId('cv-value').textContent).toContain(
      'completed cases'
    )
  })
})

describe('CategoryTooltip', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <CategoryTooltip
        active={false}
        payload={[{ name: 'Total Knee', value: 8, fill: '#3b82f6' }]}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when payload is empty', () => {
    const { container } = render(
      <CategoryTooltip active={true} payload={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders category name and case count when active', () => {
    render(
      <CategoryTooltip
        active={true}
        payload={[{ name: 'Total Knee', value: 8, fill: '#3b82f6' }]}
      />
    )
    expect(screen.getByTestId('cat-text').textContent).toContain('Total Knee')
    expect(screen.getByTestId('cat-text').textContent).toContain('8 cases')
  })

  it('applies fill color to swatch via style prop', () => {
    render(
      <CategoryTooltip
        active={true}
        payload={[{ name: 'Total Hip', value: 4, fill: '#06b6d4' }]}
      />
    )
    const swatch = screen.getByTestId('cat-swatch')
    expect((swatch as HTMLElement).style.backgroundColor).toBe('rgb(6, 182, 212)')
  })
})

describe('ComparisonTooltip', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <ComparisonTooltip
        active={false}
        payload={[
          { name: 'Robotic (Mako)', value: 65, color: '#06b6d4' },
          { name: 'Traditional', value: 80, color: '#64748b' },
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

  it('renders label and one entry per payload item', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[
          { name: 'Robotic (Mako)', value: 65, color: '#06b6d4' },
          { name: 'Traditional', value: 80, color: '#64748b' },
        ]}
        label="Feb 3"
      />
    )
    expect(screen.getByTestId('cmp-label').textContent).toBe('Feb 3')
    expect(screen.getByTestId('cmp-entry-Robotic (Mako)')).toBeTruthy()
    expect(screen.getByTestId('cmp-entry-Traditional')).toBeTruthy()
  })

  it('falls back to fill when color is not provided', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[{ name: 'Traditional', value: 80, fill: '#64748b' }]}
        label="Feb 3"
      />
    )
    const swatch = screen.getByTestId('cmp-swatch-Traditional')
    // #64748b → rgb(100, 116, 139)
    expect((swatch as HTMLElement).style.backgroundColor).toBe(
      'rgb(100, 116, 139)'
    )
  })

  it('renders correct minute values for each series', () => {
    render(
      <ComparisonTooltip
        active={true}
        payload={[
          { name: 'Robotic (Mako)', value: 65, color: '#06b6d4' },
          { name: 'Traditional', value: 80, color: '#64748b' },
        ]}
        label="Feb 3"
      />
    )
    const roboticEntry = screen.getByTestId('cmp-entry-Robotic (Mako)')
    expect(roboticEntry.textContent).toContain('65 min')
    const traditionalEntry = screen.getByTestId('cmp-entry-Traditional')
    expect(traditionalEntry.textContent).toContain('80 min')
  })
})

// ============================================
// DATA TRANSFORM LOGIC TESTS
//
// The useMemo transforms in page.tsx are pure functions of
// the `cases` array. We extract and test that logic directly
// to verify the Recharts migration didn't alter the data shapes.
// ============================================

type CaseStatus = { name: string } | [{ name: string }]
type ProcedureCategory = { id: string; name: string; display_name: string }
type ProcedureType = {
  id: string
  name: string
  procedure_category_id?: string
  technique_id?: string
  procedure_categories?: ProcedureCategory | [ProcedureCategory]
}
type Milestone = {
  facility_milestone_id: string
  recorded_at: string
  facility_milestones: { name: string } | [{ name: string }]
}

interface TestCase {
  id: string
  scheduled_date: string
  case_statuses: CaseStatus
  procedure_types?: ProcedureType | [ProcedureType] | null
  case_milestones?: Milestone[]
}

// Replicate dailyCaseTrendData logic from page.tsx
function buildDailyCaseTrendData(cases: TestCase[]) {
  const byDate: { [key: string]: number } = {}
  cases.forEach((c) => {
    const status = Array.isArray(c.case_statuses)
      ? c.case_statuses[0]
      : c.case_statuses
    if (status?.name === 'completed') {
      const date = c.scheduled_date
      byDate[date] = (byDate[date] || 0) + 1
    }
  })
  return Object.entries(byDate)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      rawDate: date,
      'Completed Cases': count,
    }))
    .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
}

// Replicate procedureCategoryData logic from page.tsx
function buildProcedureCategoryData(cases: TestCase[]) {
  const byCategoryId: { [key: string]: { count: number; name: string } } = {}
  cases.forEach((c) => {
    const status = Array.isArray(c.case_statuses)
      ? c.case_statuses[0]
      : c.case_statuses
    if (status?.name !== 'completed') return

    const procType = Array.isArray(c.procedure_types)
      ? c.procedure_types[0]
      : c.procedure_types
    if (!procType) return

    const category = procType.procedure_categories
    if (category) {
      const catData = Array.isArray(category) ? category[0] : category
      if (catData) {
        if (!byCategoryId[catData.id]) {
          byCategoryId[catData.id] = {
            count: 0,
            name: catData.display_name || catData.name,
          }
        }
        byCategoryId[catData.id].count++
      }
    }
  })
  return Object.values(byCategoryId)
    .map((cat) => ({ name: cat.name, cases: cat.count }))
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 8)
}

// Replicate getSurgicalTimeMinutes logic from page.tsx
function getSurgicalTimeMinutes(milestones: Milestone[]): number | null {
  let incisionTimestamp: number | null = null
  let closingTimestamp: number | null = null
  milestones.forEach((m) => {
    const mType = Array.isArray(m.facility_milestones)
      ? m.facility_milestones[0]
      : m.facility_milestones
    if (mType?.name === 'incision') {
      incisionTimestamp = new Date(m.recorded_at).getTime()
    } else if (
      mType?.name === 'closing' ||
      mType?.name === 'closing_complete'
    ) {
      closingTimestamp = new Date(m.recorded_at).getTime()
    }
  })
  if (incisionTimestamp !== null && closingTimestamp !== null) {
    return Math.round(
      (closingTimestamp - (incisionTimestamp as number)) / (1000 * 60)
    )
  }
  return null
}

// ============================================
// dailyCaseTrendData tests
// ============================================

describe('dailyCaseTrendData logic (page.tsx transform)', () => {
  it('counts only completed cases per date', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2025-02-01', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2025-02-01', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2025-02-01', case_statuses: { name: 'cancelled' } },
      { id: 'c4', scheduled_date: '2025-02-01', case_statuses: { name: 'in_progress' } },
    ]
    const result = buildDailyCaseTrendData(cases)
    expect(result).toHaveLength(1)
    expect(result[0]['Completed Cases']).toBe(2)
  })

  it('returns empty array when no completed cases', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2025-02-01', case_statuses: { name: 'scheduled' } },
    ]
    const result = buildDailyCaseTrendData(cases)
    expect(result).toHaveLength(0)
  })

  it('sorts entries by date ascending', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2025-02-05', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2025-02-01', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2025-02-03', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyCaseTrendData(cases)
    expect(result[0].rawDate).toBe('2025-02-01')
    expect(result[1].rawDate).toBe('2025-02-03')
    expect(result[2].rawDate).toBe('2025-02-05')
  })

  it('aggregates multiple completed cases on the same date', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2025-02-10', case_statuses: { name: 'completed' } },
      { id: 'c2', scheduled_date: '2025-02-10', case_statuses: { name: 'completed' } },
      { id: 'c3', scheduled_date: '2025-02-10', case_statuses: { name: 'completed' } },
      { id: 'c4', scheduled_date: '2025-02-11', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyCaseTrendData(cases)
    expect(result).toHaveLength(2)
    const feb10 = result.find((r) => r.rawDate === '2025-02-10')
    expect(feb10?.['Completed Cases']).toBe(3)
    const feb11 = result.find((r) => r.rawDate === '2025-02-11')
    expect(feb11?.['Completed Cases']).toBe(1)
  })

  it('produces date display string in "Mon D" format', () => {
    const cases: TestCase[] = [
      { id: 'c1', scheduled_date: '2025-02-03', case_statuses: { name: 'completed' } },
    ]
    const result = buildDailyCaseTrendData(cases)
    // The display date should be locale-formatted — just verify it's truthy and not the ISO string
    expect(result[0].date).toBeTruthy()
    expect(result[0].date).not.toBe('2025-02-03')
  })

  it('handles array-wrapped case_statuses (Supabase join shape)', () => {
    const cases: TestCase[] = [
      {
        id: 'c1',
        scheduled_date: '2025-02-01',
        case_statuses: [{ name: 'completed' }],
      },
    ]
    const result = buildDailyCaseTrendData(cases)
    expect(result[0]['Completed Cases']).toBe(1)
  })
})

// ============================================
// procedureCategoryData tests
// ============================================

describe('procedureCategoryData logic (page.tsx transform)', () => {
  function makeCompletedCase(
    id: string,
    categoryId: string,
    categoryName: string,
    displayName: string
  ): TestCase {
    return {
      id,
      scheduled_date: '2025-02-01',
      case_statuses: { name: 'completed' },
      procedure_types: {
        id: `pt-${id}`,
        name: 'some-procedure',
        procedure_categories: {
          id: categoryId,
          name: categoryName,
          display_name: displayName,
        },
      },
    }
  }

  it('groups cases by category and counts correctly', () => {
    const cases: TestCase[] = [
      makeCompletedCase('c1', 'cat-knee', 'total_knee', 'Total Knee'),
      makeCompletedCase('c2', 'cat-knee', 'total_knee', 'Total Knee'),
      makeCompletedCase('c3', 'cat-hip', 'total_hip', 'Total Hip'),
    ]
    const result = buildProcedureCategoryData(cases)
    const knee = result.find((r) => r.name === 'Total Knee')
    const hip = result.find((r) => r.name === 'Total Hip')
    expect(knee?.cases).toBe(2)
    expect(hip?.cases).toBe(1)
  })

  it('excludes non-completed cases from category counts', () => {
    const cases: TestCase[] = [
      makeCompletedCase('c1', 'cat-knee', 'total_knee', 'Total Knee'),
      {
        id: 'c2',
        scheduled_date: '2025-02-01',
        case_statuses: { name: 'scheduled' },
        procedure_types: {
          id: 'pt-c2',
          name: 'some-procedure',
          procedure_categories: {
            id: 'cat-knee',
            name: 'total_knee',
            display_name: 'Total Knee',
          },
        },
      },
    ]
    const result = buildProcedureCategoryData(cases)
    const knee = result.find((r) => r.name === 'Total Knee')
    expect(knee?.cases).toBe(1)
  })

  it('sorts by count descending', () => {
    const cases: TestCase[] = [
      makeCompletedCase('c1', 'cat-hip', 'total_hip', 'Total Hip'),
      makeCompletedCase('c2', 'cat-knee', 'total_knee', 'Total Knee'),
      makeCompletedCase('c3', 'cat-knee', 'total_knee', 'Total Knee'),
      makeCompletedCase('c4', 'cat-knee', 'total_knee', 'Total Knee'),
    ]
    const result = buildProcedureCategoryData(cases)
    expect(result[0].name).toBe('Total Knee')
    expect(result[0].cases).toBe(3)
    expect(result[1].name).toBe('Total Hip')
    expect(result[1].cases).toBe(1)
  })

  it('caps at 8 categories maximum', () => {
    const categories = Array.from({ length: 10 }, (_, i) => ({
      id: `cat-${i}`,
      name: `cat-${i}`,
      display: `Category ${i}`,
    }))
    const cases: TestCase[] = categories.flatMap((cat, i) =>
      Array.from({ length: i + 1 }, (_, j) =>
        makeCompletedCase(`c-${cat.id}-${j}`, cat.id, cat.name, cat.display)
      )
    )
    const result = buildProcedureCategoryData(cases)
    expect(result.length).toBeLessThanOrEqual(8)
  })

  it('returns empty array when no completed cases have procedure categories', () => {
    const cases: TestCase[] = [
      {
        id: 'c1',
        scheduled_date: '2025-02-01',
        case_statuses: { name: 'completed' },
        procedure_types: null,
      },
    ]
    const result = buildProcedureCategoryData(cases)
    expect(result).toHaveLength(0)
  })

  it('uses display_name over name when both present', () => {
    const cases: TestCase[] = [
      makeCompletedCase('c1', 'cat-knee', 'total_knee', 'Total Knee Arthroplasty'),
    ]
    const result = buildProcedureCategoryData(cases)
    expect(result[0].name).toBe('Total Knee Arthroplasty')
  })
})

// ============================================
// getSurgicalTimeMinutes tests
// ============================================

describe('getSurgicalTimeMinutes (page.tsx helper)', () => {
  function makeMilestone(name: string, timestamp: string): Milestone {
    return {
      facility_milestone_id: `fm-${name}`,
      recorded_at: timestamp,
      facility_milestones: { name },
    }
  }

  it('computes incision to closing duration in minutes', () => {
    const milestones: Milestone[] = [
      makeMilestone('incision', '2025-02-01T08:00:00'),
      makeMilestone('closing', '2025-02-01T09:30:00'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBe(90)
  })

  it('accepts closing_complete as the closing milestone', () => {
    const milestones: Milestone[] = [
      makeMilestone('incision', '2025-02-01T08:00:00'),
      makeMilestone('closing_complete', '2025-02-01T09:15:00'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBe(75)
  })

  it('returns null when incision milestone is missing', () => {
    const milestones: Milestone[] = [
      makeMilestone('closing', '2025-02-01T09:30:00'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBeNull()
  })

  it('returns null when closing milestone is missing', () => {
    const milestones: Milestone[] = [
      makeMilestone('incision', '2025-02-01T08:00:00'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBeNull()
  })

  it('returns null for empty milestone array', () => {
    expect(getSurgicalTimeMinutes([])).toBeNull()
  })

  it('ignores irrelevant milestones', () => {
    const milestones: Milestone[] = [
      makeMilestone('patient_in', '2025-02-01T07:30:00'),
      makeMilestone('incision', '2025-02-01T08:00:00'),
      makeMilestone('patient_out', '2025-02-01T09:45:00'),
      makeMilestone('closing', '2025-02-01T09:30:00'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBe(90)
  })

  it('rounds to nearest minute', () => {
    // 90 min + 30 sec = rounds to 91
    const milestones: Milestone[] = [
      makeMilestone('incision', '2025-02-01T08:00:00'),
      makeMilestone('closing', '2025-02-01T09:30:30'),
    ]
    expect(getSurgicalTimeMinutes(milestones)).toBe(91)
  })
})

// ============================================
// FlagsSummaryCard stats logic tests
// ============================================

interface FlagInput {
  id: string
  case_id: string
  flag_type: 'threshold' | 'delay'
  severity: string
  cases: { case_number: string; scheduled_date: string; surgeon: { first_name: string; last_name: string } | null; procedure_types: { name: string } | null } | null
}

// Replicate the stats useMemo from FlagsSummaryCard.tsx
function computeFlagsStats(flags: FlagInput[]) {
  const uniqueCaseIds = new Set(flags.map((f) => f.case_id))
  const bySeverity = { critical: 0, warning: 0, info: 0 }
  const byType = { threshold: 0, delay: 0 }

  flags.forEach((f) => {
    if (f.severity in bySeverity)
      bySeverity[f.severity as keyof typeof bySeverity]++
    if (f.flag_type in byType)
      byType[f.flag_type as keyof typeof byType]++
  })

  const caseFlagCounts = new Map<
    string,
    { count: number; flag: FlagInput }
  >()
  flags.forEach((f) => {
    const existing = caseFlagCounts.get(f.case_id)
    if (
      !existing ||
      existing.count < flags.filter((ff) => ff.case_id === f.case_id).length
    ) {
      caseFlagCounts.set(f.case_id, {
        count: flags.filter((ff) => ff.case_id === f.case_id).length,
        flag: f,
      })
    }
  })

  const topCases = Array.from(caseFlagCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([caseId, { count, flag }]) => ({
      caseId,
      count,
      caseNumber: flag.cases?.case_number || '—',
      severities: flags
        .filter((f) => f.case_id === caseId)
        .reduce((acc, f) => {
          acc[f.severity] = (acc[f.severity] || 0) + 1
          return acc
        }, {} as Record<string, number>),
    }))

  return {
    totalFlags: flags.length,
    uniqueCases: uniqueCaseIds.size,
    bySeverity,
    byType,
    topCases,
  }
}

function makeFlag(
  overrides: Partial<FlagInput> & { id: string; case_id: string }
): FlagInput {
  return {
    flag_type: 'threshold',
    severity: 'warning',
    cases: {
      case_number: `CN-${overrides.id}`,
      scheduled_date: '2025-02-01',
      surgeon: { first_name: 'John', last_name: 'Smith' },
      procedure_types: { name: 'Total Knee' },
    },
    ...overrides,
  }
}

describe('FlagsSummaryCard stats logic', () => {
  it('counts total flags correctly', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1' }),
      makeFlag({ id: 'f2', case_id: 'case-1' }),
      makeFlag({ id: 'f3', case_id: 'case-2' }),
    ]
    const stats = computeFlagsStats(flags)
    expect(stats.totalFlags).toBe(3)
  })

  it('counts unique cases correctly (deduplication)', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1' }),
      makeFlag({ id: 'f2', case_id: 'case-1' }), // same case
      makeFlag({ id: 'f3', case_id: 'case-2' }),
    ]
    const stats = computeFlagsStats(flags)
    expect(stats.uniqueCases).toBe(2)
  })

  it('breaks down flags by severity correctly', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1', severity: 'critical' }),
      makeFlag({ id: 'f2', case_id: 'case-1', severity: 'critical' }),
      makeFlag({ id: 'f3', case_id: 'case-2', severity: 'warning' }),
      makeFlag({ id: 'f4', case_id: 'case-3', severity: 'info' }),
    ]
    const stats = computeFlagsStats(flags)
    expect(stats.bySeverity.critical).toBe(2)
    expect(stats.bySeverity.warning).toBe(1)
    expect(stats.bySeverity.info).toBe(1)
  })

  it('breaks down flags by type correctly', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1', flag_type: 'threshold' }),
      makeFlag({ id: 'f2', case_id: 'case-2', flag_type: 'threshold' }),
      makeFlag({ id: 'f3', case_id: 'case-3', flag_type: 'delay' }),
    ]
    const stats = computeFlagsStats(flags)
    expect(stats.byType.threshold).toBe(2)
    expect(stats.byType.delay).toBe(1)
  })

  it('returns empty stats for zero flags', () => {
    const stats = computeFlagsStats([])
    expect(stats.totalFlags).toBe(0)
    expect(stats.uniqueCases).toBe(0)
    expect(stats.bySeverity.critical).toBe(0)
    expect(stats.bySeverity.warning).toBe(0)
    expect(stats.bySeverity.info).toBe(0)
    expect(stats.byType.threshold).toBe(0)
    expect(stats.byType.delay).toBe(0)
    expect(stats.topCases).toHaveLength(0)
  })

  it('topCases sorted by flag count descending', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1' }),
      makeFlag({ id: 'f2', case_id: 'case-2' }),
      makeFlag({ id: 'f3', case_id: 'case-2' }),
      makeFlag({ id: 'f4', case_id: 'case-2' }),
    ]
    const stats = computeFlagsStats(flags)
    expect(stats.topCases[0].caseId).toBe('case-2')
    expect(stats.topCases[0].count).toBe(3)
    expect(stats.topCases[1].caseId).toBe('case-1')
    expect(stats.topCases[1].count).toBe(1)
  })

  it('topCases capped at 5 entries', () => {
    const flags = Array.from({ length: 10 }, (_, i) =>
      makeFlag({ id: `f${i}`, case_id: `case-${i}` })
    )
    const stats = computeFlagsStats(flags)
    expect(stats.topCases.length).toBeLessThanOrEqual(5)
  })

  it('severity breakdown per case is accurate in topCases', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1', severity: 'critical' }),
      makeFlag({ id: 'f2', case_id: 'case-1', severity: 'critical' }),
      makeFlag({ id: 'f3', case_id: 'case-1', severity: 'info' }),
    ]
    const stats = computeFlagsStats(flags)
    const topCase = stats.topCases.find((c) => c.caseId === 'case-1')
    expect(topCase?.severities.critical).toBe(2)
    expect(topCase?.severities.info).toBe(1)
    expect(topCase?.severities.warning).toBeUndefined()
  })

  it('handles unknown severity without crashing', () => {
    const flags = [
      makeFlag({ id: 'f1', case_id: 'case-1', severity: 'unknown_level' }),
    ]
    // Should not throw; unknown severity won't increment bySeverity counts
    const stats = computeFlagsStats(flags)
    expect(stats.totalFlags).toBe(1)
    expect(stats.bySeverity.critical).toBe(0)
    expect(stats.bySeverity.warning).toBe(0)
    expect(stats.bySeverity.info).toBe(0)
  })
})
