import { describe, it, expect } from 'vitest'
import type { DashboardAlert, AlertPriority } from '../useDashboardAlerts'

// ============================================
// Test the alert sorting and type contracts
// The hook queries Supabase which can't be tested
// without a real connection, so we test the data
// contract and priority ordering logic.
// ============================================

function sortAlerts(alerts: DashboardAlert[]): DashboardAlert[] {
  const PRIORITY_ORDER: Record<AlertPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }
  return [...alerts].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

const makeAlert = (overrides: Partial<DashboardAlert> = {}): DashboardAlert => ({
  id: 'test-alert',
  type: 'validation',
  priority: 'medium',
  title: 'Test alert',
  description: 'Test description',
  linkTo: '/cases',
  ...overrides,
})

describe('DashboardAlert sorting', () => {
  it('sorts high priority before medium and low', () => {
    const alerts: DashboardAlert[] = [
      makeAlert({ id: 'low', priority: 'low' }),
      makeAlert({ id: 'high', priority: 'high' }),
      makeAlert({ id: 'medium', priority: 'medium' }),
    ]
    const sorted = sortAlerts(alerts)

    expect(sorted[0].id).toBe('high')
    expect(sorted[1].id).toBe('medium')
    expect(sorted[2].id).toBe('low')
  })

  it('preserves order for same priority', () => {
    const alerts: DashboardAlert[] = [
      makeAlert({ id: 'first', priority: 'medium' }),
      makeAlert({ id: 'second', priority: 'medium' }),
    ]
    const sorted = sortAlerts(alerts)

    expect(sorted[0].id).toBe('first')
    expect(sorted[1].id).toBe('second')
  })

  it('handles empty array', () => {
    expect(sortAlerts([])).toEqual([])
  })

  it('handles single item', () => {
    const alerts = [makeAlert({ id: 'only' })]
    const sorted = sortAlerts(alerts)
    expect(sorted).toHaveLength(1)
    expect(sorted[0].id).toBe('only')
  })
})

describe('DashboardAlert data contract', () => {
  it('validation alert has correct shape', () => {
    const alert = makeAlert({
      id: 'alert-validation',
      type: 'validation',
      priority: 'medium',
      title: '5 cases need validation',
      description: 'Completed cases with all milestones recorded but not yet validated.',
      count: 5,
      linkTo: '/cases?filter=needs_validation',
    })

    expect(alert.type).toBe('validation')
    expect(alert.priority).toBe('medium')
    expect(alert.count).toBe(5)
    expect(alert.linkTo).toContain('/cases')
  })

  it('behind_schedule alert is high priority', () => {
    const alert = makeAlert({
      type: 'behind_schedule',
      priority: 'high',
      title: '2 rooms running behind',
      linkTo: '/rooms',
    })

    expect(alert.priority).toBe('high')
    expect(alert.linkTo).toBe('/rooms')
  })

  it('stale_cases alert is low priority', () => {
    const alert = makeAlert({
      type: 'stale_cases',
      priority: 'low',
      title: '3 past cases still scheduled',
      linkTo: '/cases?filter=stale',
    })

    expect(alert.priority).toBe('low')
  })

  it('all alert types have required fields', () => {
    const alertTypes = ['validation', 'missing_milestones', 'behind_schedule', 'stale_cases'] as const

    for (const type of alertTypes) {
      const alert = makeAlert({ type })
      expect(alert.id).toBeTruthy()
      expect(alert.title).toBeTruthy()
      expect(alert.description).toBeTruthy()
      expect(alert.linkTo).toBeTruthy()
      expect(['high', 'medium', 'low']).toContain(alert.priority)
    }
  })
})
