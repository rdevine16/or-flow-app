import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimerChip, ProgressChip } from '../TimerChip'

describe('TimerChip', () => {
  describe('rendering', () => {
    it('renders label and formatted time', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      expect(screen.getByText('Total Time')).toBeInTheDocument()
      expect(screen.getByText('1h 23m')).toBeInTheDocument()
    })

    it('renders median when provided', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted="1h 30m"
          isRunning={false}
          color="indigo"
          ratio={0.92}
        />
      )
      expect(screen.getByText(/\/ 1h 30m/)).toBeInTheDocument()
    })

    it('does not render median when null', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      expect(screen.queryByText(/\//)).not.toBeInTheDocument()
    })

    it('shows running indicator when isRunning is true', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={true}
          color="indigo"
          ratio={null}
        />
      )
      const indicator = container.querySelector('.bg-emerald-500.animate-pulse')
      expect(indicator).toBeInTheDocument()
    })

    it('hides running indicator when isRunning is false', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      const indicator = container.querySelector('.bg-emerald-500.animate-pulse')
      expect(indicator).not.toBeInTheDocument()
    })
  })

  describe('color themes', () => {
    it('applies indigo theme', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      const chip = container.firstChild as HTMLElement
      expect(chip.className).toMatch(/from-indigo-500/)
      expect(chip.className).toMatch(/border-indigo-500/)
    })

    it('applies cyan theme', () => {
      const { container } = render(
        <TimerChip
          label="Surgical Time"
          formattedTime="45m"
          medianFormatted={null}
          isRunning={false}
          color="cyan"
          ratio={null}
        />
      )
      const chip = container.firstChild as HTMLElement
      expect(chip.className).toMatch(/from-cyan-500/)
      expect(chip.className).toMatch(/border-cyan-500/)
    })
  })

  describe('progress bar', () => {
    it('does not render progress bar when ratio is null', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 23m"
          medianFormatted={null}
          isRunning={false}
          color="indigo"
          ratio={null}
        />
      )
      const progressBar = container.querySelector('.h-\\[3px\\]')
      expect(progressBar).not.toBeInTheDocument()
    })

    it('renders progress bar when ratio is provided', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="45m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.75}
        />
      )
      const progressBar = container.querySelector('.h-\\[3px\\]')
      expect(progressBar).toBeInTheDocument()
    })

    it('uses indigo color for progress bar when under 85%', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="40m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.67}
        />
      )
      const progressBarFill = container.querySelector('.bg-indigo-500')
      expect(progressBarFill).toBeInTheDocument()
    })

    it('uses cyan color for progress bar when under 85%', () => {
      const { container } = render(
        <TimerChip
          label="Surgical Time"
          formattedTime="30m"
          medianFormatted="45m"
          isRunning={false}
          color="cyan"
          ratio={0.67}
        />
      )
      const progressBarFill = container.querySelector('.bg-cyan-500')
      expect(progressBarFill).toBeInTheDocument()
    })

    it('uses amber color for warning state (85-100%)', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="52m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.87}
        />
      )
      const progressBarFill = container.querySelector('.bg-amber-500')
      expect(progressBarFill).toBeInTheDocument()
    })

    it('uses red color when over median (>100%)', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 15m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={1.25}
        />
      )
      const progressBarFill = container.querySelector('.bg-red-500')
      expect(progressBarFill).toBeInTheDocument()
    })

    it('shows red text when over median', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="1h 15m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={1.25}
        />
      )
      const timeText = screen.getByText('1h 15m')
      expect(timeText.className).toMatch(/text-red-500/)
    })

    it('shows normal text when under median', () => {
      render(
        <TimerChip
          label="Total Time"
          formattedTime="45m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.75}
        />
      )
      const timeText = screen.getByText('45m')
      expect(timeText.className).toMatch(/text-slate-900/)
    })

    it('caps progress bar width at 100%', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="2h"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={2.0}
        />
      )
      const progressBarFill = container.querySelector('.bg-red-500')
      expect(progressBarFill).toHaveStyle({ width: '100%' })
    })

    it('calculates correct progress bar width for partial completion', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="30m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.5}
        />
      )
      const progressBarFill = container.querySelector('.bg-indigo-500')
      expect(progressBarFill).toHaveStyle({ width: '50%' })
    })
  })

  describe('edge cases', () => {
    it('handles ratio of 0', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="0m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0}
        />
      )
      const progressBarFill = container.querySelector('.bg-indigo-500')
      expect(progressBarFill).toHaveStyle({ width: '0%' })
    })

    it('handles ratio exactly at 85% threshold', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="51m"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={0.85}
        />
      )
      // At exactly 0.85, should NOT be warning (warning is >0.85 and <=1)
      const progressBarFill = container.querySelector('.bg-indigo-500')
      expect(progressBarFill).toBeInTheDocument()
    })

    it('handles ratio exactly at 100% threshold', () => {
      const { container } = render(
        <TimerChip
          label="Total Time"
          formattedTime="1h"
          medianFormatted="1h"
          isRunning={false}
          color="indigo"
          ratio={1.0}
        />
      )
      // At exactly 1.0, should be warning (not over)
      const progressBarFill = container.querySelector('.bg-amber-500')
      expect(progressBarFill).toBeInTheDocument()
      const timeText = screen.getByText('1h')
      expect(timeText.className).toMatch(/text-slate-900/)
    })
  })
})

describe('ProgressChip', () => {
  describe('rendering', () => {
    it('renders progress percentage', () => {
      render(<ProgressChip completedCount={5} totalCount={10} />)
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('renders milestone count', () => {
      render(<ProgressChip completedCount={5} totalCount={10} />)
      expect(screen.getByText('5/10 milestones')).toBeInTheDocument()
    })

    it('shows 0% when no milestones completed', () => {
      render(<ProgressChip completedCount={0} totalCount={10} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0/10 milestones')).toBeInTheDocument()
    })

    it('shows 100% when all milestones completed', () => {
      render(<ProgressChip completedCount={10} totalCount={10} />)
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('10/10 milestones')).toBeInTheDocument()
    })

    it('handles partial progress', () => {
      render(<ProgressChip completedCount={3} totalCount={7} />)
      expect(screen.getByText('43')).toBeInTheDocument() // 3/7 = 42.857... rounds to 43
      expect(screen.getByText('3/7 milestones')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles zero total count', () => {
      render(<ProgressChip completedCount={0} totalCount={0} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0/0 milestones')).toBeInTheDocument()
    })

    it('rounds progress correctly', () => {
      render(<ProgressChip completedCount={2} totalCount={3} />)
      expect(screen.getByText('67')).toBeInTheDocument() // 2/3 = 66.666... rounds to 67
    })

    it('handles single milestone', () => {
      render(<ProgressChip completedCount={1} totalCount={1} />)
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('1/1 milestones')).toBeInTheDocument()
    })

    it('handles 1 of 2 milestones (exactly 50%)', () => {
      render(<ProgressChip completedCount={1} totalCount={2} />)
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('1/2 milestones')).toBeInTheDocument()
    })
  })
})
