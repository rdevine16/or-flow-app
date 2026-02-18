// components/dashboard/__tests__/FacilityScoreMini.test.tsx
// Unit tests for FacilityScoreMini — the compact score card that replaced FacilityScoreCard
// on the dashboard in Phase 3.
// Integration: verifies ScoreRing is rendered with the correct score from FacilityScoreResult.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FacilityScoreMini } from '../FacilityScoreMini'
import type { FacilityScoreResult } from '@/lib/facilityScoreStub'

const mockScore: FacilityScoreResult = {
  score: 76,
  grade: { letter: 'B', label: 'Strong', text: '#2563EB', bg: '#EFF6FF' },
  components: { utilization: 80, turnover: 50, fcots: 90, cancellation: 85 },
}

describe('FacilityScoreMini', () => {
  it('renders loading skeleton when loading=true', () => {
    const { container } = render(<FacilityScoreMini score={null} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders "No data" when score is null and not loading', () => {
    render(<FacilityScoreMini score={null} />)
    expect(screen.getByText('No data')).toBeTruthy()
  })

  it('renders ORbit Score label', () => {
    render(<FacilityScoreMini score={mockScore} />)
    expect(screen.getAllByText('ORbit Score').length).toBeGreaterThan(0)
  })

  it('renders grade letter from score', () => {
    render(<FacilityScoreMini score={mockScore} />)
    expect(screen.getByText('B')).toBeTruthy()
  })

  it('renders grade label from score', () => {
    render(<FacilityScoreMini score={mockScore} />)
    expect(screen.getByText('Strong')).toBeTruthy()
  })

  it('renders default trendLabel "vs prior period"', () => {
    render(<FacilityScoreMini score={mockScore} />)
    expect(screen.getByText('vs prior period')).toBeTruthy()
  })

  it('renders custom trendLabel when provided', () => {
    render(<FacilityScoreMini score={mockScore} trendLabel="vs last week" />)
    expect(screen.getByText('vs last week')).toBeTruthy()
  })

  // Integration: ScoreRing must be rendered with the score value
  it('passes score value to the ScoreRing SVG text', () => {
    const { container } = render(<FacilityScoreMini score={mockScore} />)
    const svgText = container.querySelector('svg text')
    expect(svgText?.textContent).toBe('76')
  })

  it('renders the ScoreRing at 52px size', () => {
    const { container } = render(<FacilityScoreMini score={mockScore} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('52')
    expect(svg?.getAttribute('height')).toBe('52')
  })

  it('applies grade text color to the badge span', () => {
    const { container } = render(<FacilityScoreMini score={mockScore} />)
    // The grade badge is a span with inline style color = grade.text
    const gradeSpan = container.querySelector('span[style*="color"]') as HTMLElement | null
    expect(gradeSpan?.style.color).toBe('rgb(37, 99, 235)') // #2563EB converted
  })

  it('renders "No data" state when score is null (not loading)', () => {
    render(<FacilityScoreMini score={null} loading={false} />)
    // Should not render ScoreRing SVG with a score
    const svgText = document.querySelector('svg text')
    expect(svgText).toBeNull()
  })

  it('does not render ScoreRing when loading', () => {
    const { container } = render(<FacilityScoreMini score={mockScore} loading />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
