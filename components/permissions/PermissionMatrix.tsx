// components/permissions/PermissionMatrix.tsx
// Shared permission matrix component used by both global admin (templates)
// and facility admin (permissions) pages.
//
// Renders a matrix grouped by category, with resource rows and
// action columns (View / Create / Edit / Delete). Cells that don't
// apply to a resource show "—". Uses Toggle (sm) for each permission.
//
// The matrix is fully dynamic — adding a row to the `permissions` table
// automatically renders it in this component.

'use client'

import { useMemo } from 'react'
import { Toggle } from '@/components/ui/Toggle'

// =====================================================
// TYPES
// =====================================================

export interface Permission {
  id: string
  key: string
  label: string
  description: string | null
  category: string
  resource: string
  resource_type: string
  action: string
  sort_order: number
  is_active: boolean
}

interface PermissionMatrixProps {
  permissions: Permission[]
  grants: Record<string, boolean>
  onToggle: (key: string, granted: boolean) => void
  readOnly?: boolean
}

// =====================================================
// CONSTANTS
// =====================================================

const ACTION_COLUMNS = ['view', 'create', 'edit', 'delete'] as const
const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
}

// =====================================================
// HELPERS
// =====================================================

interface ResourceGroup {
  resource: string
  label: string
  actionMap: Record<string, Permission>
}

interface CategoryGroup {
  category: string
  resources: ResourceGroup[]
}

function getResourceLabel(perms: Permission[]): string {
  const viewPerm = perms.find(p => p.action === 'view')
  if (viewPerm) {
    const label = viewPerm.label
    // Tab labels: "Case Financials Tab" → "Financials"
    if (label.endsWith(' Tab')) {
      return label.replace(/^Case\s+/, '').replace(/\s+Tab$/, '')
    }
    // Regular labels: "View Cases" → "Cases"
    return label.replace(/^View\s+/, '')
  }
  // Fallback: strip action prefix from any permission label
  const anyPerm = perms[0]
  if (anyPerm) {
    return anyPerm.label
      .replace(/^(Create|Edit|Delete|Record|Set|Assign|Remove|Add|Manage)\s+/, '')
  }
  return 'Unknown'
}

function buildMatrixData(permissions: Permission[]): CategoryGroup[] {
  // 1. Group by category (preserving sort order)
  const categoryOrder: string[] = []
  const byCategory = new Map<string, Permission[]>()

  for (const p of permissions) {
    if (!byCategory.has(p.category)) {
      categoryOrder.push(p.category)
      byCategory.set(p.category, [])
    }
    byCategory.get(p.category)!.push(p)
  }

  // 2. Within each category, group by resource
  const result: CategoryGroup[] = []

  for (const category of categoryOrder) {
    const catPerms = byCategory.get(category)!
    const resourceOrder: string[] = []
    const byResource = new Map<string, Permission[]>()

    for (const p of catPerms) {
      if (!byResource.has(p.resource)) {
        resourceOrder.push(p.resource)
        byResource.set(p.resource, [])
      }
      byResource.get(p.resource)!.push(p)
    }

    const resources: ResourceGroup[] = resourceOrder.map(resource => {
      const perms = byResource.get(resource)!
      const actionMap: Record<string, Permission> = {}
      for (const p of perms) {
        actionMap[p.action] = p
      }
      return {
        resource,
        label: getResourceLabel(perms),
        actionMap,
      }
    })

    result.push({ category, resources })
  }

  return result
}

// =====================================================
// COMPONENT
// =====================================================

export function PermissionMatrix({
  permissions,
  grants,
  onToggle,
  readOnly = false,
}: PermissionMatrixProps) {
  const matrixData = useMemo(() => buildMatrixData(permissions), [permissions])

  if (permissions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No permissions found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {matrixData.map(({ category, resources }) => (
        <div
          key={category}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          {/* Category Header */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">{category}</h3>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">
                    Resource
                  </th>
                  {ACTION_COLUMNS.map(action => (
                    <th
                      key={action}
                      className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24"
                    >
                      {ACTION_LABELS[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resources.map(({ resource, label, actionMap }) => (
                  <tr key={resource} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-slate-900">
                        {label}
                      </span>
                    </td>
                    {ACTION_COLUMNS.map(action => {
                      const perm = actionMap[action]
                      if (!perm) {
                        return (
                          <td
                            key={action}
                            className="px-4 py-3 text-center text-slate-300"
                          >
                            —
                          </td>
                        )
                      }
                      const granted = grants[perm.key] ?? false
                      return (
                        <td key={action} className="px-4 py-3">
                          <div
                            className="flex justify-center"
                            title={perm.description ?? perm.label}
                          >
                            <Toggle
                              checked={granted}
                              onChange={() => onToggle(perm.key, !granted)}
                              disabled={readOnly}
                              size="sm"
                              aria-label={perm.label}
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
