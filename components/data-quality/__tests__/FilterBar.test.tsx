import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from '../FilterBar'

const mockIssueTypes = [
  { id: '1', name: 'missing', display_name: 'Missing Milestone', severity: 'error' as const },
  { id: '2', name: 'too_fast', display_name: 'Too Fast', severity: 'warning' as const },
  { id: '3', name: 'timeout', display_name: 'Timeout', severity: 'warning' as const },
]

describe('FilterBar', () => {
  const defaultProps = {
    filterType: 'all',
    onFilterTypeChange: vi.fn(),
    showResolved: false,
    onShowResolvedChange: vi.fn(),
    issueTypes: mockIssueTypes,
    selectedCount: 0,
    onBulkExclude: vi.fn(),
    caseCount: 12,
    issueCount: 25,
    filterCaseId: null,
    filterCaseNumber: null,
    onClearCaseFilter: vi.fn(),
  }

  describe('filter controls', () => {
    it('renders issue type dropdown with all types', () => {
      render(<FilterBar {...defaultProps} />)

      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select).toBeInTheDocument()
      expect(select.value).toBe('all')

      // Check options
      const options = Array.from(select.options).map(opt => opt.textContent)
      expect(options).toContain('All Issue Types')
      expect(options).toContain('Missing Milestone')
      expect(options).toContain('Too Fast')
      expect(options).toContain('Timeout')
    })

    it('calls onFilterTypeChange when issue type is changed', () => {
      const onChange = vi.fn()
      render(<FilterBar {...defaultProps} onFilterTypeChange={onChange} />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'missing' } })

      expect(onChange).toHaveBeenCalledWith('missing')
    })

    it('renders show resolved checkbox', () => {
      render(<FilterBar {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('calls onShowResolvedChange when checkbox is toggled', () => {
      const onChange = vi.fn()
      render(<FilterBar {...defaultProps} onShowResolvedChange={onChange} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(onChange).toHaveBeenCalledWith(true)
    })

    it('shows checkbox as checked when showResolved is true', () => {
      render(<FilterBar {...defaultProps} showResolved={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })
  })

  describe('case filter chip', () => {
    it('does not render chip when filterCaseId is null', () => {
      render(<FilterBar {...defaultProps} />)

      expect(screen.queryByText(/Case:/)).not.toBeInTheDocument()
    })

    it('renders chip when filterCaseId is provided', () => {
      render(<FilterBar {...defaultProps} filterCaseId="case-123" filterCaseNumber="OR-001" />)

      expect(screen.getByText(/Case: OR-001/)).toBeInTheDocument()
    })

    it('shows placeholder when filterCaseId exists but filterCaseNumber is null', () => {
      render(<FilterBar {...defaultProps} filterCaseId="case-123" filterCaseNumber={null} />)

      expect(screen.getByText(/Case: \.\.\./)).toBeInTheDocument()
    })

    it('calls onClearCaseFilter when X button is clicked', () => {
      const onClear = vi.fn()
      render(<FilterBar {...defaultProps} filterCaseId="case-123" filterCaseNumber="OR-001" onClearCaseFilter={onClear} />)

      const clearButton = screen.getByRole('button', { name: /clear case filter/i })
      fireEvent.click(clearButton)

      expect(onClear).toHaveBeenCalled()
    })
  })

  describe('bulk action button', () => {
    it('does not show bulk exclude button when selectedCount is 0', () => {
      render(<FilterBar {...defaultProps} selectedCount={0} />)

      expect(screen.queryByText(/Exclude Selected/)).not.toBeInTheDocument()
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
    })

    it('shows selected count and bulk exclude button when items are selected', () => {
      render(<FilterBar {...defaultProps} selectedCount={5} />)

      expect(screen.getByText('5 selected')).toBeInTheDocument()
      expect(screen.getByText(/Exclude Selected/)).toBeInTheDocument()
    })

    it('calls onBulkExclude when bulk exclude button is clicked', () => {
      const onBulk = vi.fn()
      render(<FilterBar {...defaultProps} selectedCount={3} onBulkExclude={onBulk} />)

      const button = screen.getByText(/Exclude Selected/)
      fireEvent.click(button)

      expect(onBulk).toHaveBeenCalled()
    })

    it('updates selected count text dynamically', () => {
      const { rerender } = render(<FilterBar {...defaultProps} selectedCount={1} />)
      expect(screen.getByText('1 selected')).toBeInTheDocument()

      rerender(<FilterBar {...defaultProps} selectedCount={12} />)
      expect(screen.getByText('12 selected')).toBeInTheDocument()
    })
  })

  describe('case and issue count summary', () => {
    it('displays case count with singular label when count is 1', () => {
      render(<FilterBar {...defaultProps} caseCount={1} issueCount={5} />)

      expect(screen.getByText(/1 case/)).toBeInTheDocument()
    })

    it('displays case count with plural label when count is not 1', () => {
      render(<FilterBar {...defaultProps} caseCount={12} issueCount={25} />)

      expect(screen.getByText(/12 cases/)).toBeInTheDocument()
    })

    it('displays issue count with singular label when count is 1', () => {
      render(<FilterBar {...defaultProps} caseCount={5} issueCount={1} />)

      expect(screen.getByText(/1 issue/)).toBeInTheDocument()
    })

    it('displays issue count with plural label when count is not 1', () => {
      render(<FilterBar {...defaultProps} caseCount={12} issueCount={25} />)

      expect(screen.getByText(/25 issues/)).toBeInTheDocument()
    })

    it('renders both counts separated by middot', () => {
      render(<FilterBar {...defaultProps} caseCount={8} issueCount={15} />)

      const summary = screen.getByText(/8 cases · 15 issues/)
      expect(summary).toBeInTheDocument()
    })
  })

  describe('layout and structure', () => {
    it('renders with correct test id', () => {
      const { container } = render(<FilterBar {...defaultProps} />)

      expect(container.querySelector('[data-testid="filter-bar"]')).toBeInTheDocument()
    })

    it('maintains layout structure with left and right sides', () => {
      const { container } = render(<FilterBar {...defaultProps} selectedCount={2} />)

      const filterBar = container.querySelector('[data-testid="filter-bar"]')
      expect(filterBar).toHaveClass('flex', 'items-center', 'justify-between')
    })
  })
})
