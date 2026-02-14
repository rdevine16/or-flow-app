import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaseDrawerFlags from '../CaseDrawerFlags'
import type { CaseFlag } from '@/lib/dal/cases'

// ============================================
// HELPERS
// ============================================

function makeFlag(overrides: Partial<CaseFlag> = {}): CaseFlag {
  return {
    id: 'flag-1',
    case_id: 'case-1',
    delay_type_id: null,
    flag_type: 'warning',
    notes: null,
    minutes: null,
    delay_type: undefined,
    ...overrides,
  }
}

// ============================================
// UNIT TESTS
// ============================================

describe('CaseDrawerFlags — unit', () => {
  it('renders empty state when no flags', () => {
    render(<CaseDrawerFlags flags={[]} />)
    expect(screen.getByText('No flags')).toBeDefined()
    expect(screen.getByText('This case is clean')).toBeDefined()
  })

  it('renders flag cards for each flag', () => {
    const flags: CaseFlag[] = [
      makeFlag({ id: 'f1', flag_type: 'critical', notes: 'Exceeded max time' }),
      makeFlag({ id: 'f2', flag_type: 'warning', notes: 'Late start' }),
    ]
    render(<CaseDrawerFlags flags={flags} />)
    expect(screen.getByText('Exceeded max time')).toBeDefined()
    expect(screen.getByText('Late start')).toBeDefined()
  })

  it('shows severity label for each flag', () => {
    const flags = [
      makeFlag({ id: 'f1', flag_type: 'critical' }),
      makeFlag({ id: 'f2', flag_type: 'warning' }),
      makeFlag({ id: 'f3', flag_type: 'info' }),
    ]
    render(<CaseDrawerFlags flags={flags} />)
    expect(screen.getByText('critical')).toBeDefined()
    expect(screen.getByText('warning')).toBeDefined()
    expect(screen.getByText('info')).toBeDefined()
  })

  it('shows delay type name when present', () => {
    const flags = [
      makeFlag({ id: 'f1', delay_type_id: 'dt-1', delay_type: { name: 'Equipment Delay' } }),
    ]
    render(<CaseDrawerFlags flags={flags} />)
    expect(screen.getByText('Equipment Delay')).toBeDefined()
  })

  it('shows delay minutes when present and > 0', () => {
    const flags = [makeFlag({ id: 'f1', minutes: 15, notes: 'Waited for implants' })]
    render(<CaseDrawerFlags flags={flags} />)
    expect(screen.getByText('15 min delay')).toBeDefined()
  })

  it('does not show delay minutes when 0', () => {
    const flags = [makeFlag({ id: 'f1', minutes: 0, notes: 'No delay' })]
    render(<CaseDrawerFlags flags={flags} />)
    expect(screen.queryByText(/min delay/)).toBeNull()
  })
})
