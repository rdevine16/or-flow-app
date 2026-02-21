import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import IssuesTable from '../IssuesTable'
import type { MetricIssue, IssueType } from '@/lib/dataQuality'

const mockIssueTypes: IssueType[] = [
  { id: '1', name: 'missing', display_name: 'Missing Milestone', description: null, severity: 'error' },
  { id: '2', name: 'too_fast', display_name: 'Too Fast', description: null, severity: 'warning' },
  { id: '3', name: 'timeout', display_name: 'Timeout', description: null, severity: 'warning' },
]

const createMockIssue = (overrides?: Partial<MetricIssue>): MetricIssue => ({
  id: 'issue-1',
  facility_id: 'facility-1',
  case_id: 'case-1',
  issue_type_id: '1',
  issue_type: mockIssueTypes[0],
  facility_milestone_id: 'fm-1',
  milestone_id: null,
  facility_milestone: { name: 'incision', display_name: 'Incision' },
  detected_at: '2026-02-20T10:00:00Z',
  detected_value: null,
  expected_min: null,
  expected_max: null,
  resolution_type_id: null,
  resolved_at: null,
  resolved_by: null,
  resolution_notes: null,
  expires_at: '2026-02-27T10:00:00Z',
  created_at: '2026-02-20T10:00:00Z',
  cases: {
    case_number: 'OR-001',
    scheduled_date: '2026-02-20',
    surgeon: { first_name: 'John', last_name: 'Smith' },
    procedure_types: { name: 'Total Hip Replacement' },
    operative_side: 'left',
  },
  details: null,
  ...overrides,
})

describe('IssuesTable', () => {
  const defaultProps = {
    issues: [],
    issueTypes: mockIssueTypes,
    selectedIds: new Set<string>(),
    onSelectionChange: vi.fn(),
    onReview: vi.fn(),
    activeCaseId: null,
  }

  describe('empty state', () => {
    it('renders empty state when no issues are provided', () => {
      render(<IssuesTable {...defaultProps} />)

      expect(screen.getByText('No issues found')).toBeInTheDocument()
      expect(screen.getByText("Your data quality looks great!")).toBeInTheDocument()
    })

    it('renders checkmark icon in empty state', () => {
      const { container } = render(<IssuesTable {...defaultProps} />)

      const emptyStateIcon = container.querySelector('.bg-green-100')
      expect(emptyStateIcon).toBeInTheDocument()
    })
  })

  describe('case grouping', () => {
    it('groups multiple issues from same case into one row', () => {
      const issues = [
        createMockIssue({ id: 'issue-1', case_id: 'case-1' }),
        createMockIssue({ id: 'issue-2', case_id: 'case-1', issue_type_id: '2', issue_type: mockIssueTypes[1] }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      // Should only have ONE case row
      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)
      const caseRows = container.querySelectorAll('[data-testid^="case-row-"]')
      expect(caseRows).toHaveLength(1)
    })

    it('creates separate rows for different cases', () => {
      const issues = [
        createMockIssue({ id: 'issue-1', case_id: 'case-1' }),
        createMockIssue({ id: 'issue-2', case_id: 'case-2', cases: { case_number: 'OR-002', scheduled_date: '2026-02-20' } }),
      ]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)
      const caseRows = container.querySelectorAll('[data-testid^="case-row-"]')
      expect(caseRows).toHaveLength(2)
    })

    it('displays case number in monospace blue text', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const caseNumber = screen.getByText('OR-001')
      expect(caseNumber).toHaveClass('font-mono', 'text-blue-600')
    })

    it('displays surgeon name when present', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('Dr. Smith')).toBeInTheDocument()
    })

    it('displays procedure name when present', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('Total Hip Replacement')).toBeInTheDocument()
    })

    it('displays operative side capitalized', () => {
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)
      const sideText = screen.getByText('left')
      expect(sideText).toHaveClass('capitalize')
    })
  })

  describe('issue type chips', () => {
    it('renders IssueChip for each unique issue type', () => {
      const issues = [
        createMockIssue({ id: 'i1', issue_type_id: '1', issue_type: mockIssueTypes[0] }),
        createMockIssue({ id: 'i2', issue_type_id: '2', issue_type: mockIssueTypes[1] }),
      ]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(container.querySelector('[data-testid="issue-chip-error"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="issue-chip-warning"]')).toBeInTheDocument()
    })

    it('shows count on issue chip when same type appears multiple times', () => {
      const issues = [
        createMockIssue({ id: 'i1', issue_type_id: '1', facility_milestone_id: 'fm-1' }),
        createMockIssue({ id: 'i2', issue_type_id: '1', facility_milestone_id: 'fm-2' }),
        createMockIssue({ id: 'i3', issue_type_id: '1', facility_milestone_id: 'fm-3' }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      // Should show "Missing Milestone (3)"
      expect(screen.getByText(/Missing Milestone \(3\)/)).toBeInTheDocument()
    })
  })

  describe('severity indicator', () => {
    it('shows red dot and text for error severity', () => {
      const issues = [createMockIssue({ issue_type: mockIssueTypes[0] })] // error

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const dot = container.querySelector('.bg-red-600')
      expect(dot).toBeInTheDocument()
      expect(screen.getByText(/1 issue/)).toHaveClass('text-red-600')
    })

    it('shows amber dot and text for warning severity', () => {
      const issues = [createMockIssue({ issue_type_id: '2', issue_type: mockIssueTypes[1] })] // warning

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const dot = container.querySelector('.bg-amber-500')
      expect(dot).toBeInTheDocument()
      expect(screen.getByText(/1 issue/)).toHaveClass('text-amber-600')
    })

    it('displays issue count correctly (singular)', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('1 issue')).toBeInTheDocument()
    })

    it('displays issue count correctly (plural)', () => {
      const issues = [
        createMockIssue({ id: 'i1' }),
        createMockIssue({ id: 'i2', issue_type_id: '2' }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('2 issues')).toBeInTheDocument()
    })

    it('chooses highest severity when multiple types present', () => {
      const issues = [
        createMockIssue({ id: 'i1', issue_type_id: '1', issue_type: mockIssueTypes[0] }), // error
        createMockIssue({ id: 'i2', issue_type_id: '2', issue_type: mockIssueTypes[1] }), // warning
      ]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      // Should show error color (highest severity)
      const dot = container.querySelector('.bg-red-600')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('expiration display', () => {
    it('shows days until expiration in monospace', () => {
      const now = new Date('2026-02-20T10:00:00Z')
      const expires = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000) // 10 days

      const issues = [createMockIssue({ expires_at: expires.toISOString() })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const expiryText = screen.getByText(/10d/)
      expect(expiryText).toHaveClass('font-mono')
    })

    it('shows red text when expiring within 7 days', () => {
      const now = new Date('2026-02-20T10:00:00Z')
      const expires = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 days

      const issues = [createMockIssue({ expires_at: expires.toISOString() })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const expiryText = screen.getByText(/5d/)
      expect(expiryText).toHaveClass('text-red-600')
    })

    it('shows amber text when expiring within 8-14 days', () => {
      const now = new Date('2026-02-20T10:00:00Z')
      const expires = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000) // 10 days

      const issues = [createMockIssue({ expires_at: expires.toISOString() })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const expiryText = screen.getByText(/10d/)
      expect(expiryText).toHaveClass('text-amber-600')
    })

    it('shows en-dash when no expiration date', () => {
      const issues = [createMockIssue({ expires_at: undefined as unknown as string })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('selection behavior', () => {
    it('renders select-all checkbox in header', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const selectAll = screen.getByRole('checkbox', { name: /select all cases/i })
      expect(selectAll).toBeInTheDocument()
    })

    it('calls onSelectionChange with all IDs when select-all is checked', () => {
      const onChange = vi.fn()
      const issues = [
        createMockIssue({ id: 'i1' }),
        createMockIssue({ id: 'i2', case_id: 'case-2' }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} onSelectionChange={onChange} />)

      const selectAll = screen.getByRole('checkbox', { name: /select all cases/i })
      fireEvent.click(selectAll)

      expect(onChange).toHaveBeenCalledWith(new Set(['i1', 'i2']))
    })

    it('calls onSelectionChange with empty set when unchecking select-all', () => {
      const onChange = vi.fn()
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} selectedIds={new Set(['issue-1'])} onSelectionChange={onChange} />)

      const selectAll = screen.getByRole('checkbox', { name: /select all cases/i })
      fireEvent.click(selectAll)

      expect(onChange).toHaveBeenCalledWith(new Set())
    })

    it('renders per-case checkbox', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const caseCheckbox = screen.getByRole('checkbox', { name: /select case OR-001/i })
      expect(caseCheckbox).toBeInTheDocument()
    })

    it('toggles case selection when case checkbox is clicked', () => {
      const onChange = vi.fn()
      const issues = [createMockIssue({ id: 'i1' })]

      render(<IssuesTable {...defaultProps} issues={issues} onSelectionChange={onChange} />)

      const caseCheckbox = screen.getByRole('checkbox', { name: /select case OR-001/i })
      fireEvent.click(caseCheckbox)

      expect(onChange).toHaveBeenCalledWith(new Set(['i1']))
    })

    it('does not render checkbox for resolved cases', () => {
      const issues = [createMockIssue({ resolved_at: '2026-02-20T12:00:00Z' })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      const caseCheckbox = screen.queryByRole('checkbox', { name: /select case OR-001/i })
      expect(caseCheckbox).not.toBeInTheDocument()
    })
  })

  describe('Review button', () => {
    it('renders Review button for unresolved issues', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument()
    })

    it('calls onReview with first issue when Review button is clicked', () => {
      const onReview = vi.fn()
      const issues = [createMockIssue({ id: 'i1' })]

      render(<IssuesTable {...defaultProps} issues={issues} onReview={onReview} />)

      const reviewButton = screen.getByRole('button', { name: /review/i })
      fireEvent.click(reviewButton)

      expect(onReview).toHaveBeenCalledWith(issues[0])
    })

    it('highlights Review button when row is hovered', () => {
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      fireEvent.mouseEnter(row!)

      const reviewButton = screen.getByRole('button', { name: /review/i })
      expect(reviewButton).toHaveClass('bg-blue-600', 'text-white')
    })

    it('highlights Review button when case is active', () => {
      const issues = [createMockIssue()]

      render(<IssuesTable {...defaultProps} issues={issues} activeCaseId="case-1" />)

      const reviewButton = screen.getByRole('button', { name: /review/i })
      expect(reviewButton).toHaveClass('bg-blue-600', 'text-white')
    })

    it('does not render Review button for resolved issues', () => {
      const issues = [createMockIssue({ resolved_at: '2026-02-20T12:00:00Z' })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument()
    })
  })

  describe('resolved issues display', () => {
    it('shows Resolved badge for resolved issues', () => {
      const issues = [createMockIssue({ resolved_at: '2026-02-20T12:00:00Z' })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('Resolved')).toBeInTheDocument()
    })

    it('applies opacity to resolved case rows', () => {
      const issues = [createMockIssue({ resolved_at: '2026-02-20T12:00:00Z' })]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      expect(row).toHaveClass('opacity-60')
    })
  })

  describe('row hover and active states', () => {
    it('applies blue background when case is active', () => {
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} activeCaseId="case-1" />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      expect(row).toHaveClass('bg-blue-50')
    })

    it('applies stone background on hover', () => {
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      fireEvent.mouseEnter(row!)

      expect(row).toHaveClass('bg-stone-50')
    })

    it('applies blue left border when case is active', () => {
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} activeCaseId="case-1" />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      expect(row).toHaveClass('border-l-blue-600')
    })

    it('applies red left border when case has error severity and is unresolved', () => {
      const issues = [createMockIssue({ issue_type: mockIssueTypes[0] })] // error severity

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      expect(row).toHaveClass('border-l-red-500')
    })

    it('does not apply red border when error issue is resolved', () => {
      const issues = [createMockIssue({ issue_type: mockIssueTypes[0], resolved_at: '2026-02-20T12:00:00Z' })]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      expect(row).not.toHaveClass('border-l-red-500')
    })
  })

  describe('row click behavior', () => {
    it('calls onReview when row is clicked', () => {
      const onReview = vi.fn()
      const issues = [createMockIssue()]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} onReview={onReview} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      fireEvent.click(row!)

      expect(onReview).toHaveBeenCalledWith(issues[0])
    })

    it('does not call onReview when row is clicked for resolved issue', () => {
      const onReview = vi.fn()
      const issues = [createMockIssue({ resolved_at: '2026-02-20T12:00:00Z' })]

      const { container } = render(<IssuesTable {...defaultProps} issues={issues} onReview={onReview} />)

      const row = container.querySelector('[data-testid="case-row-case-1"]')
      fireEvent.click(row!)

      expect(onReview).not.toHaveBeenCalled()
    })
  })

  describe('milestone summary', () => {
    it('displays single milestone name', () => {
      const issues = [createMockIssue({ facility_milestone: { name: 'incision', display_name: 'Incision' } })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('Incision')).toBeInTheDocument()
    })

    it('displays up to 3 unique milestone names', () => {
      const issues = [
        createMockIssue({ id: 'i1', facility_milestone_id: 'fm-1', facility_milestone: { name: 'incision', display_name: 'Incision' } }),
        createMockIssue({ id: 'i2', facility_milestone_id: 'fm-2', facility_milestone: { name: 'closure', display_name: 'Closure' } }),
        createMockIssue({ id: 'i3', facility_milestone_id: 'fm-3', facility_milestone: { name: 'exit_or', display_name: 'Exit OR' } }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('Incision, Closure, Exit OR')).toBeInTheDocument()
    })

    it('shows "+N more" when more than 3 milestones', () => {
      const issues = [
        createMockIssue({ id: 'i1', facility_milestone_id: 'fm-1', facility_milestone: { name: 'incision', display_name: 'Incision' } }),
        createMockIssue({ id: 'i2', facility_milestone_id: 'fm-2', facility_milestone: { name: 'closure', display_name: 'Closure' } }),
        createMockIssue({ id: 'i3', facility_milestone_id: 'fm-3', facility_milestone: { name: 'exit_or', display_name: 'Exit OR' } }),
        createMockIssue({ id: 'i4', facility_milestone_id: 'fm-4', facility_milestone: { name: 'pacu_in', display_name: 'PACU In' } }),
        createMockIssue({ id: 'i5', facility_milestone_id: 'fm-5', facility_milestone: { name: 'pacu_out', display_name: 'PACU Out' } }),
      ]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText(/\+2 more/)).toBeInTheDocument()
    })

    it('shows "No milestone specified" when no milestones have display_name', () => {
      const issues = [createMockIssue({ facility_milestone: null })]

      render(<IssuesTable {...defaultProps} issues={issues} />)

      expect(screen.getByText('No milestone specified')).toBeInTheDocument()
    })
  })
})
