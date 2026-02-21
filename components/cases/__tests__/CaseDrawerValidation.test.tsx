import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaseDrawerValidation from '../CaseDrawerValidation'
import type { MetricIssue } from '@/lib/dataQuality'

// Mock next/link to render <a>
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ============================================
// FIXTURES
// ============================================

function makeIssue(overrides: Partial<MetricIssue> = {}): MetricIssue {
  return {
    id: 'issue-1',
    facility_id: 'fac-1',
    case_id: 'case-123',
    issue_type_id: 'it-1',
    facility_milestone_id: 'fm-1',
    milestone_id: null,
    detected_value: 42,
    expected_min: 10,
    expected_max: 30,
    details: null,
    resolution_type_id: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    issue_type: {
      id: 'it-1',
      name: 'outlier',
      display_name: 'Statistical Outlier',
      description: null,
      severity: 'warning',
    },
    resolution_type: null,
    facility_milestone: {
      name: 'incision_to_closing',
      display_name: 'Incision to Closing',
    },
    ...overrides,
  }
}

// ============================================
// TESTS
// ============================================

describe('CaseDrawerValidation — unit', () => {
  it('renders loading state with spinner', () => {
    render(
      <CaseDrawerValidation issues={[]} loading={true} caseId="case-123" />
    )
    expect(screen.getByText('Loading validation issues...')).toBeDefined()
  })

  it('renders empty state when no issues and not loading', () => {
    render(
      <CaseDrawerValidation issues={[]} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('No validation issues')).toBeDefined()
    expect(screen.getByText('All metrics look good')).toBeDefined()
  })

  it('renders issue count header', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('1 unresolved issue')).toBeDefined()
  })

  it('uses plural "issues" for multiple items', () => {
    const issues = [
      makeIssue({ id: 'issue-1' }),
      makeIssue({ id: 'issue-2', issue_type: { id: 'it-2', name: 'missing', display_name: 'Missing Milestone', description: null, severity: 'error' } }),
    ]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('2 unresolved issues')).toBeDefined()
  })

  it('renders "Resolve in Data Quality" link with correct href', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    const link = screen.getByText('Resolve in Data Quality')
    expect(link).toBeDefined()
    expect(link.closest('a')?.getAttribute('href')).toBe('/data-quality?caseId=case-123')
  })

  it('renders severity badge text', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('warning')).toBeDefined()
  })

  it('renders issue type display name', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('Statistical Outlier')).toBeDefined()
  })

  it('renders affected milestone display name', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('Milestone: Incision to Closing')).toBeDefined()
  })

  it('renders detected value with expected range', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    // formatDetectedValue returns "42 min (expected 10-30 min)"
    expect(screen.getByText('42 min (expected 10-30 min)')).toBeDefined()
  })

  it('renders time detected as relative time', () => {
    const issues = [makeIssue()]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    // formatTimeAgo for 2h ago → "2h ago"
    expect(screen.getByText('Detected 2h ago')).toBeDefined()
  })

  it('renders error severity issue correctly', () => {
    const issues = [
      makeIssue({
        id: 'issue-err',
        issue_type: {
          id: 'it-err',
          name: 'missing',
          display_name: 'Missing Milestone',
          description: null,
          severity: 'error',
        },
        detected_value: null,
        facility_milestone: {
          name: 'patient_in',
          display_name: 'Patient In',
        },
      }),
    ]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.getByText('error')).toBeDefined()
    expect(screen.getByText('Missing Milestone')).toBeDefined()
    expect(screen.getByText('Milestone: Patient In')).toBeDefined()
  })

  it('does not render milestone line when facility_milestone is null', () => {
    const issues = [
      makeIssue({
        facility_milestone: null,
      }),
    ]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    expect(screen.queryByText(/Milestone:/)).toBeNull()
  })

  it('does not render detected value when null', () => {
    const issues = [
      makeIssue({
        detected_value: null,
      }),
    ]
    render(
      <CaseDrawerValidation issues={issues} loading={false} caseId="case-123" />
    )
    // Should not render the formatDetectedValue line at all
    expect(screen.queryByText(/min/)).toBeNull()
  })
})
