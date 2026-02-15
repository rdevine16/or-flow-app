'use client'

import { ReactNode } from 'react'
import { useUser } from '@/lib/UserContext'
import AccessDenied from '@/components/ui/AccessDenied'

interface PermissionGuardProps {
  /** Single permission key to check */
  permission?: string
  /** Multiple permission keys — user needs at least one */
  anyPermission?: string[]
  /** Custom fallback instead of AccessDenied */
  fallback?: ReactNode
  children: ReactNode
}

export default function PermissionGuard({
  permission,
  anyPermission,
  fallback,
  children,
}: PermissionGuardProps) {
  const { can, canAny } = useUser()

  let hasAccess = false

  if (permission) {
    hasAccess = can(permission)
  } else if (anyPermission && anyPermission.length > 0) {
    hasAccess = canAny(...anyPermission)
  } else {
    // No permission specified — allow access
    hasAccess = true
  }

  if (!hasAccess) {
    return <>{fallback ?? <AccessDenied />}</>
  }

  return <>{children}</>
}
