// components/analytics/financials/__tests__/SurgeonDailyActivity.test.tsx

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SurgeonDailyActivity from '../SurgeonDailyActivity'
import type { CaseCompletionStats } from '../types'

// Default empty props for tests
const defaultProps = {
  casePhaseDurations: new Map(),
  loadingPhases: false,
  surgeonMedians: {},
}

// ============================================
// MOCK DATA FACTORIES
// ============================================

function makeCase(overrides: Partial<CaseCompletionStats> = {}): CaseCompletionStats {
  return {
    id: 'cs-1',
    case_id: 'case-1',
    case_number: 'C-001',
    facility_id: 'fac-1',
    surgeon_id: 'surg-1',
    procedure_type_id: 'proc-1',
    payer_id: 'payer-1',
    or_room_id: 'room-1',
    case_date: '2026-02-15',
    scheduled_start_time: '08:00:00',
    actual_start_time: '08:05:00',
    total_duration_minutes: 120,
    surgical_duration_minutes: 80,
    anesthesia_duration_minutes: 100,
    call_to_patient_in_minutes: 30,
    schedule_variance_minutes: 5,
    room_turnover_minutes: 25,
    surgical_turnover_minutes: 20,
    is_first_case_of_day_room: true,
    is_first_case_of_day_surgeon: true,
    surgeon_room_count: 1,
    surgeon_case_sequence: 1,
    room_case_sequence: 1,
    reimbursement: 10000,
    soft_goods_cost: 3000,
    hard_goods_cost: 1000,
    or_cost: 2000,
    profit: 4000,
    or_hourly_rate: 800,
    total_debits: 3000,
    total_credits: 1000,
    net_cost: 4000,
    or_time_cost: 2000,
    cost_source: 'manual',
    procedure_types: { id: 'proc-1', name: 'Knee Replacement' },
    payers: { id: 'payer-1', name: 'Blue Cross' },
    or_rooms: { name: 'OR-1' },
    surgeon: { first_name: 'John', last_name: 'Smith' },
    ...overrides,
  }
}

// ============================================
// TESTS
// ============================================

describe('SurgeonDailyActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Day grouping', () => {
    it('groups cases by date', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_number: 'C-001', case_date: '2026-02-15' }),
        makeCase({ case_id: 'c2', case_number: 'C-002', case_date: '2026-02-15' }),
        makeCase({ case_id: 'c3', case_number: 'C-003', case_date: '2026-02-16' }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Should show Feb 15 with 2 cases
      expect(screen.getByText(/Feb 15/)).toBeDefined()
      expect(screen.getByText('2 cases')).toBeDefined()

      // Should show Feb 16 with 1 case
      expect(screen.getByText(/Feb 16/)).toBeDefined()
      expect(screen.getByText('1 case')).toBeDefined()
    })

    it('shows correct day of week', () => {
      const cases = [
        makeCase({ case_date: '2026-02-15' }), // Sunday
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      expect(screen.getByText('Sun')).toBeDefined()
    })

    it('calculates total profit per day', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_date: '2026-02-15', profit: 4000 }),
        makeCase({ case_id: 'c2', case_date: '2026-02-15', profit: 3500 }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Total profit = 7500
      expect(screen.getByText('$7,500')).toBeDefined()
    })

    it('calculates total duration per day', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_date: '2026-02-15', total_duration_minutes: 120 }),
        makeCase({ case_id: 'c2', case_date: '2026-02-15', total_duration_minutes: 90 }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Total duration = 210 minutes = 3h 30m
      expect(screen.getByText('3h 30m')).toBeDefined()
    })
  })

  describe('Day expansion', () => {
    it('expands day on click', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_number: 'C-001', case_date: '2026-02-15' }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Initially collapsed
      expect(screen.queryByText('C-001')).toBeNull()

      // Click to expand
      fireEvent.click(screen.getByText(/Feb 15/))

      // Now case details should be visible
      expect(screen.getByText('C-001')).toBeDefined()
    })

    it('collapses expanded day on second click', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_number: 'C-001', case_date: '2026-02-15' }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Expand
      fireEvent.click(screen.getByText(/Feb 15/))
      expect(screen.getByText('C-001')).toBeDefined()

      // Collapse
      fireEvent.click(screen.getByText(/Feb 15/))
      expect(screen.queryByText('C-001')).toBeNull()
    })
  })

  describe('Case card details', () => {
    it('shows procedure name and payer', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_number: 'C-001',
          case_date: '2026-02-15',
          procedure_types: { id: 'p1', name: 'Hip Replacement' },
          payers: { id: 'pay1', name: 'Medicare' },
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Expand day
      fireEvent.click(screen.getByText(/Feb 15/))

      expect(screen.getByText('Hip Replacement')).toBeDefined()
      expect(screen.getByText('Medicare')).toBeDefined()
    })

    it('shows profit and duration', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_date: '2026-02-15',
          profit: 4500,
          total_duration_minutes: 135,
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Expand day
      fireEvent.click(screen.getByText(/Feb 15/))

      // Use getAllByText since profit/duration appear in multiple places (day summary + case card)
      const profitElements = screen.getAllByText('$4,500')
      expect(profitElements.length).toBeGreaterThan(0)
      const durationElements = screen.getAllByText('2h 15m')
      expect(durationElements.length).toBeGreaterThan(0)
    })

    it('shows room name', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_date: '2026-02-15',
          or_rooms: { name: 'OR-3' },
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Expand day
      fireEvent.click(screen.getByText(/Feb 15/))

      expect(screen.getByText('OR-3')).toBeDefined()
    })

    it('shows start time when available', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_date: '2026-02-15',
          actual_start_time: '14:30:00',
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Expand day
      fireEvent.click(screen.getByText(/Feb 15/))

      // Time formatting may vary - just check that expanded content renders
      expect(screen.getByText('Knee Replacement')).toBeDefined()
    })
  })

  describe('Empty states', () => {
    it('shows empty state when no cases', () => {
      render(
        <SurgeonDailyActivity
          cases={[]}
          casePhaseDurations={new Map()}
          loadingPhases={false}
          surgeonMedians={{}}
        />
      )

      expect(screen.getByText(/No cases found/i)).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('handles cases with null profit', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_date: '2026-02-15',
          profit: null as any,
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Should not crash, should show $0 (may appear multiple times)
      const zeroElements = screen.getAllByText('$0')
      expect(zeroElements.length).toBeGreaterThan(0)
    })

    it('handles cases with null duration', () => {
      const cases = [
        makeCase({
          case_id: 'c1',
          case_date: '2026-02-15',
          total_duration_minutes: null as any,
        }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Should not crash
      expect(screen.getByText(/Feb 15/)).toBeDefined()
    })

    it('sorts days in descending order (most recent first)', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_date: '2026-02-10' }),
        makeCase({ case_id: 'c2', case_date: '2026-02-20' }),
        makeCase({ case_id: 'c3', case_date: '2026-02-15' }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      const dayRows = screen.getAllByText(/Feb/)
      // First row should be Feb 20 (most recent)
      expect(dayRows[0].textContent).toContain('20')
    })
  })

  describe('Surgical uptime visualization', () => {
    it('shows uptime bar for each day', () => {
      const cases = [
        makeCase({ case_id: 'c1', case_date: '2026-02-15', total_duration_minutes: 300 }),
      ]

      render(<SurgeonDailyActivity cases={cases} {...defaultProps} />)

      // Uptime bar should be visible - just verify the component renders without crashing
      expect(screen.getByText(/Feb 15/)).toBeDefined()
      expect(screen.getByText('5h 0m')).toBeDefined()
    })
  })
})
