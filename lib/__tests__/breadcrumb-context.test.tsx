import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreadcrumbProvider, useBreadcrumbContext, useBreadcrumbLabel } from '../BreadcrumbContext'

// ============================================
// TEST HELPERS
// ============================================

function ContextReader() {
  const labels = useBreadcrumbContext()
  return (
    <div data-testid="labels">
      {JSON.stringify(Object.fromEntries(labels))}
    </div>
  )
}

function LabelRegistrar({ labelKey, label }: { labelKey: string; label: string | undefined }) {
  useBreadcrumbLabel(labelKey, label)
  return null
}

function TestApp({ showLabel = true, labelKey = '/cases/[id]', label = 'Case #1042' }: {
  showLabel?: boolean
  labelKey?: string
  label?: string | undefined
}) {
  return (
    <BreadcrumbProvider>
      {showLabel && <LabelRegistrar labelKey={labelKey} label={label} />}
      <ContextReader />
    </BreadcrumbProvider>
  )
}

// ============================================
// TESTS
// ============================================

describe('BreadcrumbContext', () => {
  describe('BreadcrumbProvider', () => {
    it('provides an empty map by default', () => {
      render(
        <BreadcrumbProvider>
          <ContextReader />
        </BreadcrumbProvider>
      )
      expect(screen.getByTestId('labels').textContent).toBe('{}')
    })
  })

  describe('useBreadcrumbLabel', () => {
    it('registers a dynamic label', () => {
      render(<TestApp showLabel label="Case #1042" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1042')
    })

    it('does not register when label is undefined', () => {
      render(
        <BreadcrumbProvider>
          <LabelRegistrar labelKey="/cases/[id]" label={undefined} />
          <ContextReader />
        </BreadcrumbProvider>
      )
      expect(screen.getByTestId('labels').textContent).toBe('{}')
    })

    it('cleans up label on unmount', () => {
      const { rerender } = render(<TestApp showLabel label="Case #1042" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1042')

      rerender(<TestApp showLabel={false} />)
      expect(screen.getByTestId('labels').textContent).toBe('{}')
    })

    it('updates label when value changes', () => {
      const { rerender } = render(<TestApp showLabel label="Case #1042" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1042')

      rerender(<TestApp showLabel label="Case #1043" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1043')
      expect(screen.getByTestId('labels').textContent).not.toContain('Case #1042')
    })

    it('supports multiple labels', () => {
      render(
        <BreadcrumbProvider>
          <LabelRegistrar labelKey="/cases/[id]" label="Case #1042" />
          <LabelRegistrar labelKey="/admin/facilities/[id]" label="St. Mary" />
          <ContextReader />
        </BreadcrumbProvider>
      )
      const text = screen.getByTestId('labels').textContent!
      expect(text).toContain('Case #1042')
      expect(text).toContain('St. Mary')
    })
  })

  describe('useBreadcrumbContext', () => {
    it('returns the label map', () => {
      render(<TestApp showLabel label="Case #1042" />)
      const parsed = JSON.parse(screen.getByTestId('labels').textContent!)
      expect(parsed['/cases/[id]']).toBe('Case #1042')
    })
  })

  describe('bail-out optimization', () => {
    it('does not trigger state update when registering same label twice', () => {
      const { rerender } = render(<TestApp showLabel label="Case #1042" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1042')

      // Re-render with the same label — should not cause issues
      rerender(<TestApp showLabel label="Case #1042" />)
      expect(screen.getByTestId('labels').textContent).toContain('Case #1042')
    })
  })
})
