import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoomStatusCard, RoomStatusCardSkeleton } from '../RoomStatusCard'
import type { RoomStatusData, RoomStatus } from '@/lib/hooks/useTodayStatus'

function makeRoom(overrides: Partial<RoomStatusData> = {}): RoomStatusData {
  return {
    roomId: 'room-1',
    roomName: 'OR 1',
    status: 'idle',
    currentCase: null,
    nextCase: null,
    completedCases: 0,
    totalCases: 3,
    ...overrides,
  }
}

describe('RoomStatusCard', () => {
  it('renders room name', () => {
    render(<RoomStatusCard room={makeRoom({ roomName: 'OR 3' })} />)
    expect(screen.getByText('OR 3')).toBeTruthy()
  })

  it('renders correct status badge for each status type', () => {
    const statuses: { status: RoomStatus; label: string }[] = [
      { status: 'in_case', label: 'In Case' },
      { status: 'turning_over', label: 'Turning Over' },
      { status: 'idle', label: 'Idle' },
      { status: 'done', label: 'Done' },
    ]

    for (const { status, label } of statuses) {
      const { unmount } = render(<RoomStatusCard room={makeRoom({ status })} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })

  it('displays current case surgeon and procedure when in case', () => {
    render(
      <RoomStatusCard
        room={makeRoom({
          status: 'in_case',
          currentCase: {
            caseId: 'c-1',
            surgeonName: 'Dr. Smith',
            procedureName: 'Total Hip Replacement',
          },
        })}
      />
    )
    expect(screen.getByText('Dr. Smith')).toBeTruthy()
    expect(screen.getByText('Total Hip Replacement')).toBeTruthy()
  })

  it('displays next case when no current case', () => {
    render(
      <RoomStatusCard
        room={makeRoom({
          status: 'idle',
          nextCase: {
            caseId: 'c-2',
            surgeonName: 'Dr. Jones',
            startTime: '10:30 AM',
          },
        })}
      />
    )
    expect(screen.getByText('Dr. Jones')).toBeTruthy()
    expect(screen.getByText(/10:30 AM/)).toBeTruthy()
  })

  it('displays "No more cases" when no current or next case', () => {
    render(
      <RoomStatusCard
        room={makeRoom({ status: 'done', currentCase: null, nextCase: null })}
      />
    )
    expect(screen.getByText('No more cases')).toBeTruthy()
  })

  it('renders progress count', () => {
    render(
      <RoomStatusCard
        room={makeRoom({ completedCases: 2, totalCases: 5 })}
      />
    )
    expect(screen.getByText('2/5')).toBeTruthy()
  })

  it('renders link to rooms page', () => {
    render(<RoomStatusCard room={makeRoom()} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/rooms')
  })
})

describe('RoomStatusCardSkeleton', () => {
  it('renders animated skeleton', () => {
    const { container } = render(<RoomStatusCardSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
