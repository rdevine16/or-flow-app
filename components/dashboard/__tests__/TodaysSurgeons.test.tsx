import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodaysSurgeons } from '../TodaysSurgeons'
import type { TodaySurgeonData } from '@/lib/hooks/useTodayStatus'

function makeSurgeon(overrides: Partial<TodaySurgeonData> = {}): TodaySurgeonData {
  return {
    surgeonId: 'surg-1',
    surgeonName: 'Dr. Smith',
    firstName: 'John',
    lastName: 'Smith',
    casesRemaining: 2,
    casesTotal: 4,
    grade: { letter: 'B', label: 'Strong', text: '#2563EB', bg: '#EFF6FF' },
    compositeScore: 72,
    ...overrides,
  }
}

describe('TodaysSurgeons', () => {
  it('renders loading skeleton when loading', () => {
    const { container } = render(<TodaysSurgeons surgeons={[]} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
    expect(screen.getByText("Today's Surgeons")).toBeTruthy()
  })

  it('renders empty state when no surgeons', () => {
    render(<TodaysSurgeons surgeons={[]} />)
    expect(screen.getByText('No surgeons scheduled today')).toBeTruthy()
  })

  it('renders surgeon name and grade badge', () => {
    render(<TodaysSurgeons surgeons={[makeSurgeon()]} />)
    expect(screen.getByText('Dr. Smith')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })

  it('displays cases remaining count', () => {
    render(<TodaysSurgeons surgeons={[makeSurgeon({ casesRemaining: 3 })]} />)
    expect(screen.getByText('3 cases remaining')).toBeTruthy()
  })

  it('uses singular "case" for single remaining', () => {
    render(<TodaysSurgeons surgeons={[makeSurgeon({ casesRemaining: 1 })]} />)
    expect(screen.getByText('1 case remaining')).toBeTruthy()
  })

  it('shows "All cases complete" when 0 remaining', () => {
    render(<TodaysSurgeons surgeons={[makeSurgeon({ casesRemaining: 0 })]} />)
    expect(screen.getByText('All cases complete')).toBeTruthy()
  })

  it('shows dash when no grade available', () => {
    render(
      <TodaysSurgeons
        surgeons={[makeSurgeon({ grade: null, compositeScore: null })]}
      />
    )
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('links to analytics surgeons page', () => {
    render(<TodaysSurgeons surgeons={[makeSurgeon()]} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/analytics/surgeons')
  })

  it('renders multiple surgeons', () => {
    const surgeons = [
      makeSurgeon({ surgeonId: 's1', surgeonName: 'Dr. Smith' }),
      makeSurgeon({ surgeonId: 's2', surgeonName: 'Dr. Jones' }),
    ]
    render(<TodaysSurgeons surgeons={surgeons} />)
    expect(screen.getByText('Dr. Smith')).toBeTruthy()
    expect(screen.getByText('Dr. Jones')).toBeTruthy()
  })
})
