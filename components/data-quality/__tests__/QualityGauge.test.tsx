import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import QualityGauge from '../QualityGauge'

describe('QualityGauge', () => {
  describe('rendering', () => {
    it('renders the gauge with score label', () => {
      render(<QualityGauge score={85} />)
      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('renders with custom size', () => {
      const { container } = render(<QualityGauge score={75} size={200} />)
      const gauge = container.querySelector('[data-testid="quality-gauge"]')
      expect(gauge).toHaveStyle({ width: '200px' })
    })

    it('has accessible aria-label', () => {
      render(<QualityGauge score={92} />)
      const svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('aria-label', 'Quality score: 92%')
    })
  })

  describe('color coding', () => {
    it('displays green color for score >= 90', () => {
      render(<QualityGauge score={95} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#059669"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('displays green color for score exactly 90', () => {
      render(<QualityGauge score={90} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#059669"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('displays amber color for score >= 70 and < 90', () => {
      render(<QualityGauge score={75} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#D97706"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('displays amber color for score exactly 70', () => {
      render(<QualityGauge score={70} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#D97706"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('displays red color for score < 70', () => {
      render(<QualityGauge score={45} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#DC2626"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('displays red color for score 0', () => {
      render(<QualityGauge score={0} />)
      const svg = screen.getByRole('img')
      const progressPath = svg.querySelector('path[stroke="#DC2626"]')
      expect(progressPath).toBeInTheDocument()
    })
  })

  describe('arc progress calculation', () => {
    it('calculates correct arc for 100% score', () => {
      const { container } = render(<QualityGauge score={100} size={130} />)
      const svg = container.querySelector('svg')
      const progressPath = svg?.querySelectorAll('path')[1] // second path is progress

      // At 100%, strokeDashoffset should be 0 (full arc visible)
      const dashoffset = progressPath?.getAttribute('stroke-dashoffset')
      expect(dashoffset).toBe('0')
    })

    it('calculates correct arc for 50% score', () => {
      const { container } = render(<QualityGauge score={50} size={130} />)
      const svg = container.querySelector('svg')
      const progressPath = svg?.querySelectorAll('path')[1]

      const radius = (130 - 12) / 2 // 59
      const circumference = Math.PI * radius // ~185.35
      const progress = (50 / 100) * circumference // ~92.67
      const expectedOffset = circumference - progress // ~92.67

      const dashoffset = progressPath?.getAttribute('stroke-dashoffset')
      expect(Number(dashoffset)).toBeCloseTo(expectedOffset, 1)
    })

    it('calculates correct arc for 0% score', () => {
      const { container } = render(<QualityGauge score={0} size={130} />)
      const svg = container.querySelector('svg')
      const progressPath = svg?.querySelectorAll('path')[1]

      const radius = (130 - 12) / 2
      const circumference = Math.PI * radius

      // At 0%, strokeDashoffset equals full circumference (no arc visible)
      const dashoffset = progressPath?.getAttribute('stroke-dashoffset')
      expect(Number(dashoffset)).toBeCloseTo(circumference, 1)
    })
  })

  describe('edge cases', () => {
    it('handles score values at color boundaries correctly', () => {
      const boundaries = [
        { score: 89, expectedColor: '#D97706' }, // amber (just below 90)
        { score: 90, expectedColor: '#059669' }, // green (exactly 90)
        { score: 69, expectedColor: '#DC2626' }, // red (just below 70)
        { score: 70, expectedColor: '#D97706' }, // amber (exactly 70)
      ]

      boundaries.forEach(({ score, expectedColor }) => {
        const { container } = render(<QualityGauge score={score} />)
        const svg = container.querySelector('svg')
        const progressPath = svg?.querySelector(`path[stroke="${expectedColor}"]`)
        expect(progressPath).toBeInTheDocument()
      })
    })
  })
})
