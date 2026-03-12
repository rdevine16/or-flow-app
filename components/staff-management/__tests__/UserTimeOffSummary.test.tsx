// components/staff-management/__tests__/UserTimeOffSummary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserTimeOffSummaryDisplay } from '../UserTimeOffSummary'
import type { UserTimeOffSummary } from '@/types/time-off'

describe('UserTimeOffSummaryDisplay', () => {
  describe('variant: inline', () => {
    it('renders 0d when totals is undefined', () => {
      render(<UserTimeOffSummaryDisplay totals={undefined} variant="inline" />)
      expect(screen.getByText('0d')).toBeInTheDocument()
    })

    it('renders 0d when total_days is 0', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 0,
        sick_days: 0,
        personal_days: 0,
        total_days: 0,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="inline" />)
      expect(screen.getByText('0d')).toBeInTheDocument()
    })

    it('renders only PTO when other types are 0', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 5,
        sick_days: 0,
        personal_days: 0,
        total_days: 5,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="inline" />)
      expect(screen.getByText('PTO: 5d')).toBeInTheDocument()
    })

    it('renders multiple types separated by pipe', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 3,
        sick_days: 2,
        personal_days: 1,
        total_days: 6,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="inline" />)
      expect(screen.getByText('PTO: 3d | Sick: 2d | Personal: 1d')).toBeInTheDocument()
    })

    it('formats partial days with one decimal', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 2.5,
        sick_days: 0,
        personal_days: 0,
        total_days: 2.5,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="inline" />)
      expect(screen.getByText('PTO: 2.5d')).toBeInTheDocument()
    })
  })

  describe('variant: detail', () => {
    it('renders empty message when totals is undefined', () => {
      render(<UserTimeOffSummaryDisplay totals={undefined} variant="detail" />)
      expect(screen.getByText('No approved time off this year.')).toBeInTheDocument()
    })

    it('renders empty message when total_days is 0', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 0,
        sick_days: 0,
        personal_days: 0,
        total_days: 0,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="detail" />)
      expect(screen.getByText('No approved time off this year.')).toBeInTheDocument()
    })

    it('renders all three badge types with values', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 5,
        sick_days: 3,
        personal_days: 2,
        total_days: 10,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="detail" />)

      // Check for badge labels
      expect(screen.getByText('PTO')).toBeInTheDocument()
      expect(screen.getByText('Sick')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()

      // Check for day counts
      expect(screen.getByText('5d')).toBeInTheDocument()
      expect(screen.getByText('3d')).toBeInTheDocument()
      expect(screen.getByText('2d')).toBeInTheDocument()

      // Check for total
      expect(screen.getByText(/Total: 10d/)).toBeInTheDocument()
    })

    it('renders badges even when some types are 0', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 8,
        sick_days: 0,
        personal_days: 0,
        total_days: 8,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="detail" />)

      // All badges still render
      expect(screen.getByText('PTO')).toBeInTheDocument()
      expect(screen.getByText('Sick')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()

      // Check counts
      expect(screen.getByText('8d')).toBeInTheDocument() // PTO
      const zeroDayElements = screen.getAllByText('0d')
      expect(zeroDayElements.length).toBeGreaterThanOrEqual(2) // Sick + Personal
    })

    it('formats partial days in detail view', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 3.5,
        sick_days: 1.5,
        personal_days: 0.5,
        total_days: 5.5,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} variant="detail" />)

      expect(screen.getByText('3.5d')).toBeInTheDocument()
      expect(screen.getByText('1.5d')).toBeInTheDocument()
      expect(screen.getByText('0.5d')).toBeInTheDocument()
      expect(screen.getByText(/Total: 5\.5d/)).toBeInTheDocument()
    })
  })

  describe('default variant', () => {
    it('defaults to detail variant when variant not specified', () => {
      const totals: UserTimeOffSummary = {
        user_id: 'u1',
        pto_days: 4,
        sick_days: 2,
        personal_days: 1,
        total_days: 7,
      }
      render(<UserTimeOffSummaryDisplay totals={totals} />)

      // Detail view shows badges
      expect(screen.getByText('PTO')).toBeInTheDocument()
      expect(screen.getByText('Sick')).toBeInTheDocument()
      expect(screen.getByText('Personal')).toBeInTheDocument()
      expect(screen.getByText(/Total: 7d/)).toBeInTheDocument()
    })
  })
})
