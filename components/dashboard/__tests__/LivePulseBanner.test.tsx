// components/dashboard/__tests__/LivePulseBanner.test.tsx
// Unit + integration tests for LivePulseBanner.
// Verifies: loading skeleton, empty state, status pill rendering, case progress, next case display.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LivePulseBanner } from '../LivePulseBanner'
import type { TodayStatusData } from '@/lib/hooks/useTodayStatus'

const makeRoom = (
  overrides: Partial<TodayStatusData['rooms'][number]> = {},
): TodayStatusData['rooms'][number] => ({
  roomId: 'room-1',
  roomName: 'OR 1',
  status: 'in_case',
  totalCases: 3,
  completedCases: 1,
  currentCase: null,
  nextCase: null,
  ...overrides,
})

const baseTodayStatus: TodayStatusData = {
  rooms: [makeRoom()],
  surgeons: [],
}

describe('LivePulseBanner', () => {
  it('renders loading skeleton when loading=true', () => {
    const { container } = render(<LivePulseBanner data={null} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders "No cases scheduled today" when data is null', () => {
    render(<LivePulseBanner data={null} loading={false} />)
    expect(screen.getByText('No cases scheduled today')).toBeTruthy()
  })

  it('renders "No cases scheduled today" when rooms array is empty', () => {
    render(<LivePulseBanner data={{ rooms: [], surgeons: [] }} loading={false} />)
    expect(screen.getByText('No cases scheduled today')).toBeTruthy()
  })

  it('renders the Live indicator when rooms are present', () => {
    render(<LivePulseBanner data={baseTodayStatus} />)
    expect(screen.getByText('Live')).toBeTruthy()
  })

  it('renders "In Surgery" pill when a room has in_case status', () => {
    render(<LivePulseBanner data={baseTodayStatus} />)
    expect(screen.getByText(/In Surgery/)).toBeTruthy()
  })

  it('renders "Turnover" pill when a room has turning_over status', () => {
    const data: TodayStatusData = {
      rooms: [makeRoom({ roomId: 'r2', status: 'turning_over' })],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    expect(screen.getByText(/Turnover/)).toBeTruthy()
  })

  it('renders "Available" pill when a room has idle status', () => {
    const data: TodayStatusData = {
      rooms: [makeRoom({ roomId: 'r3', status: 'idle' })],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    expect(screen.getByText(/Available/)).toBeTruthy()
  })

  it('renders "Done" pill when a room has done status', () => {
    const data: TodayStatusData = {
      rooms: [makeRoom({ roomId: 'r4', status: 'done' })],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    expect(screen.getByText(/Done/)).toBeTruthy()
  })

  it('omits a status pill when no room has that status', () => {
    // Only in_case — no idle, no turnover, no done pills
    render(<LivePulseBanner data={baseTodayStatus} />)
    expect(screen.queryByText(/Turnover/)).toBeNull()
    expect(screen.queryByText(/Available/)).toBeNull()
    expect(screen.queryByText(/Done/)).toBeNull()
  })

  it('aggregates multiple rooms of the same status into a single pill with count', () => {
    const data: TodayStatusData = {
      rooms: [
        makeRoom({ roomId: 'r1', status: 'in_case' }),
        makeRoom({ roomId: 'r2', status: 'in_case' }),
      ],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    // Should see "2 In Surgery" rather than two separate pills
    expect(screen.getByText(/2 In Surgery/)).toBeTruthy()
  })

  it('shows correct case progress: completed / total', () => {
    const data: TodayStatusData = {
      rooms: [
        makeRoom({ roomId: 'r1', totalCases: 4, completedCases: 2 }),
        makeRoom({ roomId: 'r2', totalCases: 3, completedCases: 1 }),
      ],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    // 3 completed of 7 total
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('/ 7 cases')).toBeTruthy()
  })

  it('shows the next case section when a room has a nextCase', () => {
    const data: TodayStatusData = {
      rooms: [
        makeRoom({
          nextCase: {
            caseId: 'c1',
            surgeonName: 'Dr. Smith',
            startTime: '10:30',
          },
        }),
      ],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    expect(screen.getByText(/Dr. Smith/)).toBeTruthy()
    expect(screen.getByText(/10:30/)).toBeTruthy()
  })

  it('does not render next case section when no rooms have a nextCase', () => {
    render(<LivePulseBanner data={baseTodayStatus} />)
    // nextCase is null in baseTodayStatus — "Next:" label should not appear
    expect(screen.queryByText(/Next:/)).toBeNull()
  })

  it('picks the earliest nextCase across multiple rooms', () => {
    const data: TodayStatusData = {
      rooms: [
        makeRoom({
          roomId: 'r1',
          nextCase: { caseId: 'c2', surgeonName: 'Dr. Late', startTime: '14:00' },
        }),
        makeRoom({
          roomId: 'r2',
          nextCase: { caseId: 'c3', surgeonName: 'Dr. Early', startTime: '10:00' },
        }),
      ],
      surgeons: [],
    }
    render(<LivePulseBanner data={data} />)
    // Dr. Early at 10:00 should be shown as next
    expect(screen.getByText(/Dr. Early/)).toBeTruthy()
    expect(screen.queryByText(/Dr. Late/)).toBeNull()
  })
})
