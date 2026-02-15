import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionMatrix, Permission } from '../PermissionMatrix'

// ============================================
// TEST DATA
// ============================================

const mockPermissions: Permission[] = [
  // Cases category — full CRUD
  { id: '1', key: 'cases.view', label: 'View Cases', description: 'View the cases list', category: 'Cases', resource: 'cases', resource_type: 'page', action: 'view', sort_order: 1, is_active: true },
  { id: '2', key: 'cases.create', label: 'Create Cases', description: 'Create new cases', category: 'Cases', resource: 'cases', resource_type: 'page', action: 'create', sort_order: 2, is_active: true },
  { id: '3', key: 'cases.edit', label: 'Edit Cases', description: 'Edit case info', category: 'Cases', resource: 'cases', resource_type: 'page', action: 'edit', sort_order: 3, is_active: true },
  { id: '4', key: 'cases.delete', label: 'Delete Cases', description: 'Delete cases', category: 'Cases', resource: 'cases', resource_type: 'page', action: 'delete', sort_order: 4, is_active: true },

  // Case Tabs category — view only
  { id: '5', key: 'tab.case_financials', label: 'Case Financials Tab', description: 'View financials tab', category: 'Case Tabs', resource: 'tab_case_financials', resource_type: 'tab', action: 'view', sort_order: 40, is_active: true },
  { id: '6', key: 'tab.case_milestones', label: 'Case Milestones Tab', description: 'View milestones tab', category: 'Case Tabs', resource: 'tab_case_milestones', resource_type: 'tab', action: 'view', sort_order: 41, is_active: true },

  // Partial actions (view + create only)
  { id: '7', key: 'milestones.view', label: 'View Milestones', description: 'View milestones', category: 'Case Operations', resource: 'milestones', resource_type: 'action', action: 'view', sort_order: 10, is_active: true },
  { id: '8', key: 'milestones.manage', label: 'Manage Milestones', description: 'Record, undo, and clear milestones', category: 'Case Operations', resource: 'milestones', resource_type: 'action', action: 'edit', sort_order: 11, is_active: true },
]

const defaultGrants: Record<string, boolean> = {
  'cases.view': true,
  'cases.create': true,
  'cases.edit': false,
  'cases.delete': false,
  'tab.case_financials': false,
  'tab.case_milestones': true,
  'milestones.view': true,
  'milestones.manage': false,
}

// ============================================
// TESTS
// ============================================

describe('PermissionMatrix', () => {
  it('renders category headers', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
      />,
    )

    // Category headers are <h3> elements
    const headers = screen.getAllByRole('heading', { level: 3 })
    const headerTexts = headers.map(h => h.textContent)
    expect(headerTexts).toContain('Cases')
    expect(headerTexts).toContain('Case Tabs')
    expect(headerTexts).toContain('Case Operations')
  })

  it('renders resource labels derived from permission data', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
      />,
    )

    // "View Cases" → resource label "Cases" (plus category header = 2 elements)
    const casesElements = screen.getAllByText('Cases')
    expect(casesElements.length).toBeGreaterThanOrEqual(2)

    // Tab labels: "Case Financials Tab" → "Financials"
    expect(screen.getByText('Financials')).toBeInTheDocument()

    // "View Milestones" → "Milestones" — may appear multiple times
    // (once as resource label in Case Operations, once as tab label in Case Tabs)
    const milestoneElements = screen.getAllByText('Milestones')
    expect(milestoneElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders action column headers', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
      />,
    )

    // Each category table has column headers
    const viewHeaders = screen.getAllByText('View')
    expect(viewHeaders.length).toBeGreaterThanOrEqual(1)

    const createHeaders = screen.getAllByText('Create')
    expect(createHeaders.length).toBeGreaterThanOrEqual(1)
  })

  it('renders "—" for non-applicable actions', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
      />,
    )

    // Tab resources only have "view" action, so create/edit/delete should show "—"
    const dashCells = screen.getAllByText('—')
    // At least 6 dashes: 3 per tab row (create/edit/delete) x 2 tab rows
    // Plus milestones is missing edit and delete = 2 more
    expect(dashCells.length).toBeGreaterThanOrEqual(8)
  })

  it('renders toggles with correct checked state', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
      />,
    )

    // cases.view is granted
    const viewCasesToggle = screen.getByRole('switch', { name: 'View Cases' })
    expect(viewCasesToggle).toHaveAttribute('aria-checked', 'true')

    // cases.edit is denied
    const editCasesToggle = screen.getByRole('switch', { name: 'Edit Cases' })
    expect(editCasesToggle).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onToggle with correct key and new value when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={onToggle}
      />,
    )

    // Click the "Edit Cases" toggle (currently false → should toggle to true)
    const editToggle = screen.getByRole('switch', { name: 'Edit Cases' })
    await user.click(editToggle)

    expect(onToggle).toHaveBeenCalledWith('cases.edit', true)
  })

  it('calls onToggle to disable when a granted toggle is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={onToggle}
      />,
    )

    // Click "View Cases" toggle (currently true → should toggle to false)
    const viewToggle = screen.getByRole('switch', { name: 'View Cases' })
    await user.click(viewToggle)

    expect(onToggle).toHaveBeenCalledWith('cases.view', false)
  })

  it('disables toggles when readOnly is true', () => {
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={defaultGrants}
        onToggle={vi.fn()}
        readOnly
      />,
    )

    const toggles = screen.getAllByRole('switch')
    for (const toggle of toggles) {
      expect(toggle).toBeDisabled()
    }
  })

  it('shows empty state when no permissions', () => {
    render(
      <PermissionMatrix
        permissions={[]}
        grants={{}}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('No permissions found.')).toBeInTheDocument()
  })

  it('defaults ungranteed permissions to false', () => {
    // Pass grants that are missing some keys
    render(
      <PermissionMatrix
        permissions={mockPermissions}
        grants={{ 'cases.view': true }}
        onToggle={vi.fn()}
      />,
    )

    // cases.create is not in grants → should default to false (unchecked)
    const createToggle = screen.getByRole('switch', { name: 'Create Cases' })
    expect(createToggle).toHaveAttribute('aria-checked', 'false')
  })
})
