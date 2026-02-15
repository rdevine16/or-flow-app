import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AccessDenied from '../AccessDenied'

describe('AccessDenied', () => {
  it('renders default message', () => {
    render(<AccessDenied />)
    expect(screen.getByText('Access Denied')).toBeDefined()
    expect(screen.getByText("You don't have permission to access this page.")).toBeDefined()
  })

  it('renders custom message', () => {
    render(<AccessDenied message="Contact your admin for analytics access." />)
    expect(screen.getByText('Contact your admin for analytics access.')).toBeDefined()
  })

  it('has a link back to dashboard', () => {
    render(<AccessDenied />)
    const link = screen.getByRole('link', { name: /back to dashboard/i })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })
})
