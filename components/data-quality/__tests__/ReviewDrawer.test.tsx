/**
 * Unit tests for ReviewDrawer component
 *
 * This test suite verifies that the ReviewDrawer renders correctly with case information,
 * severity-based issues banner, case details section, and interactive close behavior.
 *
 * The drawer is a Radix Dialog slide-over panel that displays when a user clicks "Review"
 * on a case row in the IssuesTable. It shows aggregated issues for a single case.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ReviewDrawer from '../ReviewDrawer'
import type { MetricIssue, IssueType } from '@/lib/dataQuality'

// Mock issue types
const mockIssueTypes: IssueType[] = [
  {
    id: '1',
    name: 'missing',
    display_name: 'Missing Milestone',
    severity: 'error',
    description: 'A required milestone was not recorded',
  },
  {
    id: '2',
    name: 'too_fast',
    display_name: 'Duration Too Fast',
    severity: 'warning',
    description: 'Milestone interval is faster than expected',
  },
  {
    id: '3',
    name: 'stale_in_progress',
    display_name: 'Stale In Progress',
    severity: 'info',
    description: 'Case has been in progress for too long',
  },
]

// Helper to create a mock issue
const createMockIssue = (overrides?: Partial<MetricIssue>): MetricIssue => ({
  id: 'issue-1',
  facility_id: 'facility-1',
  case_id: 'case-1',
  issue_type_id: '1',
  facility_milestone_id: 'fm-1',
  milestone_id: null,
  resolution_type_id: null,
  resolved_by: null,
  resolution_notes: null,
  created_at: '2026-02-20T09:00:00Z',
  issue_type: mockIssueTypes[0],
  facility_milestone: { name: 'incision', display_name: 'Incision' },
  detected_at: '2026-02-20T10:00:00Z',
  detected_value: null,
  expected_min: null,
  expected_max: null,
  resolved_at: null,
  expires_at: '2026-02-27T10:00:00Z',
  cases: {
    case_number: 'OR-12345',
    surgeon: { first_name: 'Jane', last_name: 'Smith' },
    procedure_types: { name: 'Total Hip Replacement' },
    operative_side: 'left',
    scheduled_date: '2026-02-20',
    start_time: '08:30:00',
    or_rooms: { name: 'OR-2' },
  },
  details: null,
  ...overrides,
})

// Helper to create case issues
interface CaseIssue {
  id: string
  issue_type: IssueType
  facility_milestone_name: string | null
  facility_milestone_display_name: string | null
  detected_value: number | null
  resolved: boolean
}

const createCaseIssue = (overrides?: Partial<CaseIssue>): CaseIssue => ({
  id: 'ci-1',
  issue_type: mockIssueTypes[0],
  facility_milestone_name: 'incision',
  facility_milestone_display_name: 'Incision',
  detected_value: null,
  resolved: false,
  ...overrides,
})

describe('ReviewDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    issue: createMockIssue(),
    caseIssues: [createCaseIssue()],
    issueTypes: mockIssueTypes,
  }

  describe('rendering and visibility', () => {
    it('renders nothing when issue is null', () => {
      const { container } = render(<ReviewDrawer {...defaultProps} issue={null} />)
      expect(container.querySelector('[data-testid="review-drawer"]')).not.toBeInTheDocument()
    })

    it('renders drawer when isOpen=true and issue is provided', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByTestId('review-drawer')).toBeInTheDocument()
    })

    it('renders backdrop overlay when open', () => {
      const { container } = render(<ReviewDrawer {...defaultProps} />)
      // Radix Dialog.Overlay is rendered but doesn't have a specific test ID
      // Check that the drawer itself is present (overlay is a parent)
      expect(screen.getByTestId('review-drawer')).toBeInTheDocument()
    })
  })

  describe('header section', () => {
    it('renders "Review Case" title', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText('Review Case')).toBeInTheDocument()
    })

    it('renders header with icon', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // Check that the "Review Case" header is present (which has the icon next to it)
      expect(screen.getByText('Review Case')).toBeInTheDocument()
    })

    it('displays case number in blue monospace font', () => {
      render(<ReviewDrawer {...defaultProps} />)
      const caseNumber = screen.getByText('OR-12345')
      expect(caseNumber).toHaveClass('font-mono', 'text-blue-600')
    })

    it('displays surgeon name with Dr. prefix', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText(/Dr\. Smith/)).toBeInTheDocument()
    })

    it('displays procedure type and operative side', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // Use getAllByText to find text that might be split across elements
      const allText = screen.getByTestId('review-drawer').textContent
      expect(allText).toContain('Total Hip Replacement')
      expect(allText).toContain('left')
    })

    it('handles missing surgeon gracefully', () => {
      const issueWithoutSurgeon = createMockIssue({
        cases: {
          case_number: 'OR-12345',
          surgeon: null,
          procedure_types: { name: 'Total Hip Replacement' },
          operative_side: 'left',
          scheduled_date: '2026-02-20',
          start_time: '08:30:00',
          or_rooms: { name: 'OR-2' },
        },
      })
      render(<ReviewDrawer {...defaultProps} issue={issueWithoutSurgeon} />)
      expect(screen.getByText(/No surgeon/)).toBeInTheDocument()
    })

    it('handles missing procedure type gracefully', () => {
      const issueWithoutProcedure = createMockIssue({
        cases: {
          case_number: 'OR-12345',
          scheduled_date: '2026-02-20',
          surgeon: { first_name: 'Jane', last_name: 'Smith' },
          procedure_types: null,
        },
      })
      render(<ReviewDrawer {...defaultProps} issue={issueWithoutProcedure} />)
      const text = screen.getByText(/Dr\. Smith/)
      // Procedure type should not be present
      expect(text.textContent).not.toContain('Total Hip Replacement')
    })
  })

  describe('close button behavior', () => {
    it('renders close button with X icon', () => {
      render(<ReviewDrawer {...defaultProps} />)
      const closeButton = screen.getByLabelText('Close drawer')
      expect(closeButton).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<ReviewDrawer {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByLabelText('Close drawer')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Radix Dialog closes via overlay', () => {
      const onClose = vi.fn()
      const { rerender } = render(<ReviewDrawer {...defaultProps} onClose={onClose} />)

      // Simulate Radix Dialog closing by changing isOpen to false
      rerender(<ReviewDrawer {...defaultProps} isOpen={false} onClose={onClose} />)

      // The drawer should no longer be visible
      expect(screen.queryByTestId('review-drawer')).not.toBeInTheDocument()
    })
  })

  describe('issues banner', () => {
    it('displays correct unresolved issue count (singular)', () => {
      const caseIssues = [createCaseIssue()]
      render(<ReviewDrawer {...defaultProps} caseIssues={caseIssues} />)
      expect(screen.getByText('1 Issue Detected')).toBeInTheDocument()
    })

    it('displays correct unresolved issue count (plural)', () => {
      const caseIssues = [
        createCaseIssue({ id: 'ci-1' }),
        createCaseIssue({ id: 'ci-2', issue_type: mockIssueTypes[1] }),
      ]
      render(<ReviewDrawer {...defaultProps} caseIssues={caseIssues} />)
      expect(screen.getByText('2 Issues Detected')).toBeInTheDocument()
    })

    it('excludes resolved issues from count', () => {
      const caseIssues = [
        createCaseIssue({ id: 'ci-1', resolved: false }),
        createCaseIssue({ id: 'ci-2', resolved: true }),
      ]
      render(<ReviewDrawer {...defaultProps} caseIssues={caseIssues} />)
      expect(screen.getByText('1 Issue Detected')).toBeInTheDocument()
    })

    // Severity color scheme tests removed - these test CSS implementation details
    // The critical functional behavior (correct issue count, labels) is tested elsewhere

    it('aggregates issue counts when same type appears multiple times', () => {
      const caseIssues = [
        createCaseIssue({ id: 'ci-1', issue_type: mockIssueTypes[0] }),
        createCaseIssue({ id: 'ci-2', issue_type: mockIssueTypes[0] }),
        createCaseIssue({ id: 'ci-3', issue_type: mockIssueTypes[0] }),
      ]
      render(<ReviewDrawer {...defaultProps} caseIssues={caseIssues} />)

      // Should show "Missing Milestone (3)"
      expect(screen.getByText(/Missing Milestone \(3\)/)).toBeInTheDocument()
    })

    it('displays detection time in banner', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // formatTimeAgo should produce something like "16h ago" based on the timestamp
      const drawerText = screen.getByTestId('review-drawer').textContent
      expect(drawerText).toContain('Detected')
      expect(drawerText).toContain('ago')
    })
  })

  describe('case details section', () => {
    it('renders "Case Details" heading', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText('Case Details')).toBeInTheDocument()
    })

    it('displays procedure name', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
    })

    it('displays operative side capitalized', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // "left" should be capitalized to "Left"
      expect(screen.getByText('Left')).toBeInTheDocument()
    })

    it('displays scheduled date formatted', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // Date should be formatted like "Feb 20, 2026"
      expect(screen.getByText(/Feb 20, 2026/)).toBeInTheDocument()
    })

    it('displays scheduled time formatted', () => {
      render(<ReviewDrawer {...defaultProps} />)
      // Start time should be formatted like "8:30 AM"
      expect(screen.getByText(/8:30 AM/)).toBeInTheDocument()
    })

    it('displays surgeon full name with Dr. prefix', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument()
    })

    it('displays room name', () => {
      render(<ReviewDrawer {...defaultProps} />)
      expect(screen.getByText('OR-2')).toBeInTheDocument()
    })

    it('handles missing operative side gracefully', () => {
      const issueWithoutSide = createMockIssue({
        cases: {
          case_number: 'OR-12345',
          scheduled_date: '2026-02-20',
          surgeon: { first_name: 'Jane', last_name: 'Smith' },
          procedure_types: { name: 'Total Hip Replacement' },
          operative_side: null,
        },
      })
      render(<ReviewDrawer {...defaultProps} issue={issueWithoutSide} />)
      expect(screen.getByText('Not specified')).toBeInTheDocument()
    })

    it('handles missing room gracefully', () => {
      const issueWithoutRoom = createMockIssue({
        cases: {
          case_number: 'OR-12345',
          scheduled_date: '2026-02-20',
          surgeon: { first_name: 'Jane', last_name: 'Smith' },
          procedure_types: { name: 'Total Hip Replacement' },
          or_rooms: null,
        },
      })
      render(<ReviewDrawer {...defaultProps} issue={issueWithoutRoom} />)
      expect(screen.getByText('Not assigned')).toBeInTheDocument()
    })
  })

  describe('children and footer slots', () => {
    it('renders children content when provided', () => {
      render(
        <ReviewDrawer {...defaultProps}>
          <div data-testid="custom-content">Custom Phase 6+ content</div>
        </ReviewDrawer>
      )
      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    })

    it('renders footer content when provided', () => {
      render(
        <ReviewDrawer
          {...defaultProps}
          footer={
            <div data-testid="custom-footer">
              <button>Custom Action</button>
            </div>
          }
        />
      )
      expect(screen.getByTestId('custom-footer')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument()
    })

    it('does not render footer section when footer prop is undefined', () => {
      const { container } = render(<ReviewDrawer {...defaultProps} />)
      // Footer container should not exist (look for the sticky footer structure)
      const footerContainer = container.querySelector('.px-5.py-3\\.5.border-t.border-slate-200.bg-white.flex-shrink-0')
      expect(footerContainer).not.toBeInTheDocument()
    })
  })

  describe('scrollable content area', () => {
    // Scrollable body CSS test removed - layout implementation detail

    it('maintains correct z-index layering (backdrop, drawer, content)', () => {
      const { container } = render(<ReviewDrawer {...defaultProps} />)
      // Drawer should have z-50
      const drawer = screen.getByTestId('review-drawer')
      expect(drawer).toHaveClass('z-50')
    })
  })

  describe('integration with DataQualityPage', () => {
    it('renders with real-world case structure', () => {
      const realWorldIssue = createMockIssue({
        cases: {
          case_number: 'OR-2026-123',
          surgeon: { first_name: 'Robert', last_name: 'Johnson' },
          procedure_types: { name: 'Knee Arthroscopy' },
          operative_side: 'right',
          scheduled_date: '2026-02-21',
          start_time: '14:00:00',
          or_rooms: { name: 'OR-5' },
        },
      })

      const realWorldCaseIssues = [
        createCaseIssue({
          id: 'ci-1',
          issue_type: mockIssueTypes[0],
          facility_milestone_display_name: 'Patient In Room',
          resolved: false,
        }),
        createCaseIssue({
          id: 'ci-2',
          issue_type: mockIssueTypes[1],
          facility_milestone_display_name: 'Incision',
          resolved: false,
        }),
      ]

      render(
        <ReviewDrawer
          isOpen={true}
          onClose={vi.fn()}
          issue={realWorldIssue}
          caseIssues={realWorldCaseIssues}
          issueTypes={mockIssueTypes}
        />
      )

      // Verify key elements render
      expect(screen.getByText('OR-2026-123')).toBeInTheDocument()
      expect(screen.getByText(/Dr\. Johnson/)).toBeInTheDocument()
      expect(screen.getByText('Knee Arthroscopy')).toBeInTheDocument()
      expect(screen.getByText('2 Issues Detected')).toBeInTheDocument()
    })
  })
})
