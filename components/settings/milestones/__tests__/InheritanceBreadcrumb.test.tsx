// components/settings/milestones/__tests__/InheritanceBreadcrumb.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InheritanceBreadcrumb } from '../InheritanceBreadcrumb'

describe('InheritanceBreadcrumb', () => {
  it('renders all level labels', () => {
    render(
      <InheritanceBreadcrumb
        levels={[
          { label: 'Facility Default', active: false },
          { label: 'ACDF', active: true },
        ]}
      />
    )

    expect(screen.getByText('Facility Default')).toBeInTheDocument()
    expect(screen.getByText('ACDF')).toBeInTheDocument()
  })

  it('highlights the active level with blue styling', () => {
    render(
      <InheritanceBreadcrumb
        levels={[
          { label: 'Facility Default', active: false },
          { label: 'ACDF', active: true },
        ]}
      />
    )

    const activeLevel = screen.getByText('ACDF')
    expect(activeLevel.className).toContain('bg-blue-50')
    expect(activeLevel.className).toContain('text-blue-700')
    expect(activeLevel.className).toContain('font-semibold')
  })

  it('renders inactive levels without blue styling', () => {
    render(
      <InheritanceBreadcrumb
        levels={[
          { label: 'Facility Default', active: false },
          { label: 'ACDF', active: true },
        ]}
      />
    )

    const inactiveLevel = screen.getByText('Facility Default')
    expect(inactiveLevel.className).toContain('text-slate-400')
    expect(inactiveLevel.className).not.toContain('bg-blue-50')
  })

  it('renders 3-level breadcrumb for surgeon page', () => {
    render(
      <InheritanceBreadcrumb
        levels={[
          { label: 'Facility Default', active: false },
          { label: 'ACDF', active: false },
          { label: 'Chen', active: true },
        ]}
      />
    )

    expect(screen.getByText('Facility Default')).toBeInTheDocument()
    expect(screen.getByText('ACDF')).toBeInTheDocument()
    expect(screen.getByText('Chen')).toBeInTheDocument()
  })

  it('shows "Inheritance:" label', () => {
    render(
      <InheritanceBreadcrumb
        levels={[{ label: 'Facility Default', active: true }]}
      />
    )

    expect(screen.getByText('Inheritance:')).toBeInTheDocument()
  })
})
