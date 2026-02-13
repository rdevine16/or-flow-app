import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FacilityScoreCard } from '../FacilityScoreCard'
import type { FacilityScoreResult } from '@/lib/facilityScoreStub'

const mockScore: FacilityScoreResult = {
  score: 76,
  grade: { letter: 'B', label: 'Strong', text: '#2563EB', bg: '#EFF6FF' },
  components: { utilization: 80, turnover: 50, fcots: 90, cancellation: 85 },
}

describe('FacilityScoreCard', () => {
  it('renders loading skeleton when loading', () => {
    const { container } = render(<FacilityScoreCard score={null} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders no-data state when score is null', () => {
    render(<FacilityScoreCard score={null} />)
    expect(screen.getByText('No data available')).toBeTruthy()
  })

  it('renders score and grade when data is present', () => {
    render(<FacilityScoreCard score={mockScore} />)
    expect(screen.getByText('76')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByText('Strong')).toBeTruthy()
  })

  it('renders trend when trendValue is provided', () => {
    render(<FacilityScoreCard score={mockScore} trendValue={5} />)
    expect(screen.getByText('+5 pts')).toBeTruthy()
  })

  it('renders negative trend correctly', () => {
    render(<FacilityScoreCard score={mockScore} trendValue={-3} />)
    expect(screen.getByText('-3 pts')).toBeTruthy()
  })

  it('does not render trend when trendValue is undefined', () => {
    render(<FacilityScoreCard score={mockScore} />)
    expect(screen.queryByText('pts')).toBeNull()
  })

  it('shows custom trend label', () => {
    render(<FacilityScoreCard score={mockScore} trendValue={2} trendLabel="vs last week" />)
    expect(screen.getByText('vs last week')).toBeTruthy()
  })
})
