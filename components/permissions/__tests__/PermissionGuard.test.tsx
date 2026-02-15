import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PermissionGuard from '../PermissionGuard'

// Mock useUser with controllable can() responses
let mockPermissions: Record<string, boolean> = {}

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: (key: string) => mockPermissions[key] === true,
    canAny: (...keys: string[]) => keys.some(k => mockPermissions[k] === true),
    canAll: (...keys: string[]) => keys.every(k => mockPermissions[k] === true),
  }),
}))

describe('PermissionGuard', () => {
  it('renders children when single permission is granted', () => {
    mockPermissions = { 'analytics.view': true }
    render(
      <PermissionGuard permission="analytics.view">
        <div>Analytics Content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Analytics Content')).toBeDefined()
  })

  it('renders AccessDenied when single permission is denied', () => {
    mockPermissions = { 'analytics.view': false }
    render(
      <PermissionGuard permission="analytics.view">
        <div>Analytics Content</div>
      </PermissionGuard>
    )
    expect(screen.queryByText('Analytics Content')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('renders children when any permission matches', () => {
    mockPermissions = { 'settings.view': false, 'settings.manage': true }
    render(
      <PermissionGuard anyPermission={['settings.view', 'settings.manage']}>
        <div>Settings Content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Settings Content')).toBeDefined()
  })

  it('renders AccessDenied when no permissions match', () => {
    mockPermissions = { 'settings.view': false, 'settings.manage': false }
    render(
      <PermissionGuard anyPermission={['settings.view', 'settings.manage']}>
        <div>Settings Content</div>
      </PermissionGuard>
    )
    expect(screen.queryByText('Settings Content')).toBeNull()
    expect(screen.getByText('Access Denied')).toBeDefined()
  })

  it('renders custom fallback when provided', () => {
    mockPermissions = { 'analytics.view': false }
    render(
      <PermissionGuard permission="analytics.view" fallback={<div>Custom Denied</div>}>
        <div>Analytics Content</div>
      </PermissionGuard>
    )
    expect(screen.queryByText('Analytics Content')).toBeNull()
    expect(screen.getByText('Custom Denied')).toBeDefined()
  })

  it('renders children when no permission is specified', () => {
    mockPermissions = {}
    render(
      <PermissionGuard>
        <div>Open Content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Open Content')).toBeDefined()
  })
})
