/**
 * components/analytics/flags/__tests__/RoomAnalysisCards.test.tsx
 *
 * Unit tests for RoomAnalysisCards — room analysis cards grid.
 *
 * Covers:
 * 1. Renders nothing when data is empty (returns null)
 * 2. Renders a card for each room
 * 3. Cards are sorted by flag rate descending (highest rate first)
 * 4. Each card shows room name, flags count, cases count, and rate
 * 5. Rate color coding:
 *    - rate > 40 → rose
 *    - rate 25-40 → amber
 *    - rate <= 25 → emerald
 * 6. Rate badge formats as integer (toFixed(0))
 * 7. topIssue is displayed when present
 * 8. topDelay is displayed when present
 * 9. topIssue / topDelay are hidden when absent (empty string)
 * 10. Progress bar width is capped at 100%
 * 11. onRoomClick fires with the correct roomId when a card is clicked
 * 12. Single room renders correctly
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RoomFlagRow } from '@/types/flag-analytics'

import RoomAnalysisCards from '../RoomAnalysisCards'

// ============================================
// Fixtures
// ============================================

function makeRoom(overrides: Partial<RoomFlagRow> & { roomId: string; room: string }): RoomFlagRow {
  return {
    cases: 20,
    flags: 6,
    rate: 30,
    topIssue: '',
    topDelay: '',
    ...overrides,
  }
}

const ROOMS: RoomFlagRow[] = [
  makeRoom({ roomId: 'rm-1', room: 'OR 1', cases: 30, flags: 8, rate: 26.7, topIssue: 'Threshold exceeded', topDelay: 'Late Patient' }),
  makeRoom({ roomId: 'rm-2', room: 'OR 2', cases: 20, flags: 9, rate: 45, topIssue: 'Equipment failure', topDelay: '' }),
  makeRoom({ roomId: 'rm-3', room: 'OR 3', cases: 25, flags: 5, rate: 20, topIssue: '', topDelay: 'Consent Issue' }),
]

// ============================================
// Tests
// ============================================

describe('RoomAnalysisCards', () => {
  // ------------------------------------------
  // 1. Empty state — returns null
  // ------------------------------------------

  it('renders nothing when data array is empty', () => {
    const { container } = render(<RoomAnalysisCards data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // ------------------------------------------
  // 2. Renders a card for each room
  // ------------------------------------------

  it('renders a card for each room in the data', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    expect(screen.getByText('OR 1')).toBeDefined()
    expect(screen.getByText('OR 2')).toBeDefined()
    expect(screen.getByText('OR 3')).toBeDefined()
  })

  it('renders the correct number of cards', () => {
    const { container } = render(<RoomAnalysisCards data={ROOMS} />)
    // Each card is a div with the cursor-pointer class
    const cards = container.querySelectorAll('.cursor-pointer')
    expect(cards.length).toBe(3)
  })

  // ------------------------------------------
  // 3. Cards are sorted by rate descending
  // ------------------------------------------

  it('displays the highest-rate room card first', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    const roomNames = screen.getAllByText(/^OR \d$/)
    // OR 2 (rate=45) > OR 1 (rate=26.7) > OR 3 (rate=20)
    expect(roomNames[0].textContent).toBe('OR 2')
  })

  it('displays the lowest-rate room card last', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    const roomNames = screen.getAllByText(/^OR \d$/)
    expect(roomNames[roomNames.length - 1].textContent).toBe('OR 3')
  })

  // ------------------------------------------
  // 4. Card content: flags and cases counts
  // ------------------------------------------

  it('renders flags count for each room', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    // flags counts are 8, 9, 5
    expect(screen.getByText('8')).toBeDefined()
    expect(screen.getByText('9')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })

  it('renders the text "flags" label in each card', () => {
    const { container } = render(<RoomAnalysisCards data={ROOMS} />)
    const flagLabels = container.querySelectorAll('div.text-xs.text-slate-500')
    expect(flagLabels.length).toBe(3)
    flagLabels.forEach((label) => {
      expect(label.textContent).toContain('flags')
    })
  })

  it('renders cases count for each room', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    expect(screen.getByText('30')).toBeDefined()
    expect(screen.getByText('20')).toBeDefined()
    expect(screen.getByText('25')).toBeDefined()
  })

  // ------------------------------------------
  // 5. Rate color coding
  // ------------------------------------------

  it('uses rose badge for rate > 40', () => {
    const high = [makeRoom({ roomId: 'rm-h', room: 'OR High', rate: 45 })]
    const { container } = render(<RoomAnalysisCards data={high} />)
    const badge = container.querySelector('.bg-rose-50.text-rose-600')
    expect(badge).not.toBeNull()
  })

  it('uses amber badge for rate between 25 and 40', () => {
    const medium = [makeRoom({ roomId: 'rm-m', room: 'OR Med', rate: 30 })]
    const { container } = render(<RoomAnalysisCards data={medium} />)
    const badge = container.querySelector('.bg-amber-50.text-amber-600')
    expect(badge).not.toBeNull()
  })

  it('uses emerald badge for rate <= 25', () => {
    const low = [makeRoom({ roomId: 'rm-l', room: 'OR Low', rate: 20 })]
    const { container } = render(<RoomAnalysisCards data={low} />)
    const badge = container.querySelector('.bg-emerald-50.text-emerald-600')
    expect(badge).not.toBeNull()
  })

  it('uses amber badge for rate exactly 25 (boundary: not > 25, so emerald)', () => {
    // rate of exactly 25 is NOT > 25, so it gets emerald
    const boundary = [makeRoom({ roomId: 'rm-b', room: 'OR Boundary', rate: 25 })]
    const { container } = render(<RoomAnalysisCards data={boundary} />)
    expect(container.querySelector('.bg-emerald-50.text-emerald-600')).not.toBeNull()
    expect(container.querySelector('.bg-amber-50.text-amber-600')).toBeNull()
  })

  it('uses rose badge for rate exactly 40 (boundary: not > 40, so amber)', () => {
    // rate of exactly 40 is NOT > 40, so it gets amber
    const boundary = [makeRoom({ roomId: 'rm-b40', room: 'OR Boundary40', rate: 40 })]
    const { container } = render(<RoomAnalysisCards data={boundary} />)
    expect(container.querySelector('.bg-amber-50.text-amber-600')).not.toBeNull()
    expect(container.querySelector('.bg-rose-50.text-rose-600')).toBeNull()
  })

  // ------------------------------------------
  // 6. Rate badge format (toFixed(0))
  // ------------------------------------------

  it('displays rate as integer (toFixed(0)) in the badge', () => {
    const room = [makeRoom({ roomId: 'rm-fmt', room: 'OR Fmt', rate: 33.6 })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('34%')).toBeDefined()
  })

  it('displays round rate correctly', () => {
    const room = [makeRoom({ roomId: 'rm-rd', room: 'OR Round', rate: 45 })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('45%')).toBeDefined()
  })

  // ------------------------------------------
  // 7. topIssue display
  // ------------------------------------------

  it('renders topIssue when provided', () => {
    const room = [makeRoom({ roomId: 'rm-ti', room: 'OR TI', topIssue: 'Threshold exceeded' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('Threshold exceeded')).toBeDefined()
  })

  it('renders the "Top auto:" label when topIssue is present', () => {
    const room = [makeRoom({ roomId: 'rm-ti2', room: 'OR TI2', topIssue: 'Equipment failure' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('Top auto:')).toBeDefined()
  })

  it('does not render "Top auto:" label when topIssue is empty string', () => {
    const room = [makeRoom({ roomId: 'rm-nti', room: 'OR NTI', topIssue: '' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.queryByText('Top auto:')).toBeNull()
  })

  // ------------------------------------------
  // 8. topDelay display
  // ------------------------------------------

  it('renders topDelay when provided', () => {
    const room = [makeRoom({ roomId: 'rm-td', room: 'OR TD', topDelay: 'Late Patient' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('Late Patient')).toBeDefined()
  })

  it('renders the "Top delay:" label when topDelay is present', () => {
    const room = [makeRoom({ roomId: 'rm-td2', room: 'OR TD2', topDelay: 'Consent Issue' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.getByText('Top delay:')).toBeDefined()
  })

  it('does not render "Top delay:" label when topDelay is empty string', () => {
    const room = [makeRoom({ roomId: 'rm-ntd', room: 'OR NTD', topDelay: '' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.queryByText('Top delay:')).toBeNull()
  })

  // ------------------------------------------
  // 9. Both topIssue and topDelay absent
  // ------------------------------------------

  it('renders no labels or issue/delay text when both are empty', () => {
    const room = [makeRoom({ roomId: 'rm-none', room: 'OR None', topIssue: '', topDelay: '' })]
    render(<RoomAnalysisCards data={room} />)
    expect(screen.queryByText('Top auto:')).toBeNull()
    expect(screen.queryByText('Top delay:')).toBeNull()
  })

  // ------------------------------------------
  // 10. Progress bar width is capped at 100%
  // ------------------------------------------

  it('caps progress bar width at 100% even for rate > 100', () => {
    // rate = 120 → Math.min(120, 100) = 100
    const room = [makeRoom({ roomId: 'rm-ov', room: 'OR Overflow', rate: 120 })]
    const { container } = render(<RoomAnalysisCards data={room} />)
    const progressBar = container.querySelector('.h-full.rounded-full.opacity-70') as HTMLElement
    expect(progressBar).not.toBeNull()
    expect(progressBar.style.width).toBe('100%')
  })

  it('sets progress bar width to the rate percentage for normal rates', () => {
    const room = [makeRoom({ roomId: 'rm-pw', room: 'OR PW', rate: 30 })]
    const { container } = render(<RoomAnalysisCards data={room} />)
    const progressBar = container.querySelector('.h-full.rounded-full.opacity-70') as HTMLElement
    expect(progressBar.style.width).toBe('30%')
  })

  // ------------------------------------------
  // 11. onRoomClick callback
  // ------------------------------------------

  it('calls onRoomClick with the correct roomId when a card is clicked', () => {
    const handleClick = vi.fn()
    render(<RoomAnalysisCards data={ROOMS} onRoomClick={handleClick} />)
    // Cards are sorted by rate desc: OR 2 (45%), OR 1 (26.7%), OR 3 (20%)
    const cards = screen.getAllByText(/^OR \d$/)
    // First card is OR 2 (rm-2)
    fireEvent.click(cards[0].closest('.cursor-pointer')!)
    expect(handleClick).toHaveBeenCalledOnce()
    expect(handleClick).toHaveBeenCalledWith('rm-2')
  })

  it('does not throw when onRoomClick is not provided and a card is clicked', () => {
    render(<RoomAnalysisCards data={ROOMS} />)
    const cards = screen.getAllByText(/^OR \d$/)
    expect(() => fireEvent.click(cards[0].closest('.cursor-pointer')!)).not.toThrow()
  })

  // ------------------------------------------
  // 12. Single room renders correctly
  // ------------------------------------------

  it('renders correctly with a single room', () => {
    const single = [makeRoom({ roomId: 'rm-only', room: 'OR Solo', rate: 15, flags: 3, cases: 20 })]
    render(<RoomAnalysisCards data={single} />)
    expect(screen.getByText('OR Solo')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('20')).toBeDefined()
  })
})
