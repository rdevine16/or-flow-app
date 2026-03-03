/**
 * SwitchIntegrationDialog.test.tsx — Unit tests for the switch dialog
 *
 * Tests rendering of system names, warning message, button labels,
 * and callback invocation for confirm/cancel actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SwitchIntegrationDialog from '@/components/integrations/SwitchIntegrationDialog'

// Mock createPortal so the dialog renders in the test container
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  }
})

// Mock design tokens
vi.mock('@/lib/design-tokens', () => ({
  tokens: { zIndex: { modal: 1000, modalBackdrop: 999 } },
}))

// Mock toast provider
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

describe('SwitchIntegrationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    currentType: 'epic_hl7v2' as const,
    targetType: 'cerner_hl7v2' as const,
    loading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct system names', () => {
    render(<SwitchIntegrationDialog {...defaultProps} />)
    expect(screen.getByText('Switch to Oracle Cerner?')).toBeDefined()
    // "Epic" appears in body text, "Oracle Cerner" in title, body, and confirm button
    expect(screen.getAllByText(/Epic/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Oracle Cerner/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows disconnection warning message', () => {
    render(<SwitchIntegrationDialog {...defaultProps} />)
    expect(screen.getByText(/disconnect your current HL7v2 integration/)).toBeDefined()
    expect(screen.getByText(/Entity mappings.*will be preserved/)).toBeDefined()
  })

  it('shows correct button labels', () => {
    render(<SwitchIntegrationDialog {...defaultProps} />)
    expect(screen.getByText('Switch to Oracle Cerner')).toBeDefined()
    expect(screen.getByText('Keep Current')).toBeDefined()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup()
    render(<SwitchIntegrationDialog {...defaultProps} />)
    await user.click(screen.getByText('Switch to Oracle Cerner'))
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup()
    render(<SwitchIntegrationDialog {...defaultProps} />)
    await user.click(screen.getByText('Keep Current'))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing when open is false', () => {
    const { container } = render(
      <SwitchIntegrationDialog {...defaultProps} open={false} />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows MEDITECH name when switching to meditech_hl7v2', () => {
    render(
      <SwitchIntegrationDialog
        {...defaultProps}
        targetType="meditech_hl7v2"
      />
    )
    expect(screen.getByText('Switch to MEDITECH?')).toBeDefined()
    expect(screen.getByText('Switch to MEDITECH')).toBeDefined()
  })

  it('shows Epic as current when switching from Epic to MEDITECH', () => {
    render(
      <SwitchIntegrationDialog
        {...defaultProps}
        currentType="epic_hl7v2"
        targetType="meditech_hl7v2"
      />
    )
    expect(screen.getAllByText(/Epic/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/MEDITECH/).length).toBeGreaterThanOrEqual(1)
  })
})
