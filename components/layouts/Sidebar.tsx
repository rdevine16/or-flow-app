// components/layouts/Sidebar.tsx
// Primary navigation sidebar with expand/collapse behavior

'use client'

import { useState, useRef } from 'react'
import { Bookmark } from 'lucide-react'
import Link from 'next/link'
import { OrbitLogoFull } from '../icons/OrbitLogo'
import {
  NavItem,
  NavGroup,
  adminNavGroups,
  SIDEBAR_COLLAPSED,
  SIDEBAR_EXPANDED,
  isNavItemActive,
} from './navigation-config'

interface SidebarProps {
  pathname: string
  isAdminMode: boolean
  navigation: NavItem[]
  onExpandChange?: (expanded: boolean) => void
}

export default function Sidebar({
  pathname,
  isAdminMode,
  navigation,
  onExpandChange,
}: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const isExpanded = isHovered || isPinned
  const sidebarWidth = isExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  const handleMouseEnter = () => {
    setIsHovered(true)
    onExpandChange?.(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (!isPinned) {
      onExpandChange?.(false)
    }
  }

  const handlePinToggle = () => {
    const newPinned = !isPinned
    setIsPinned(newPinned)
    onExpandChange?.(newPinned || isHovered)
  }

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ width: sidebarWidth }}
      className="fixed top-0 left-0 h-full bg-slate-900 text-white z-50 flex flex-col transition-all duration-300 ease-out"
    >
      {/* Logo */}
      <div className="h-16 flex items-center border-b border-slate-800 px-2">
        <Link
          href="/dashboard"
          className="flex items-center text-white h-10 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <div className="w-12 flex items-center justify-center flex-shrink-0">
            <OrbitLogoFull className="w-12 h-12" />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {isAdminMode ? (
          <AdminNavigation
            groups={adminNavGroups}
            pathname={pathname}
            isExpanded={isExpanded}
          />
        ) : (
          <FacilityNavigation
            items={navigation}
            pathname={pathname}
            isExpanded={isExpanded}
          />
        )}
      </nav>

      {/* Pin & Version */}
      <div className="px-2 py-3 border-t border-slate-800">
        {isExpanded && (
          <button
            onClick={handlePinToggle}
            className={`w-full flex items-center h-10 rounded-lg text-sm transition-colors ${
              isPinned
                ? 'bg-slate-800 text-blue-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            <div className="w-12 flex items-center justify-center flex-shrink-0">
              <Bookmark
                className="w-4 h-4"
                fill={isPinned ? 'currentColor' : 'none'}
              />
            </div>
            <span className="whitespace-nowrap">
              {isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            </span>
          </button>
        )}
        <p
          className={`text-xs text-slate-600 mt-2 ${
            isExpanded ? 'pl-12' : 'text-center'
          }`}
        >
          {isExpanded ? 'Version 1.0.0' : 'v1.0'}
        </p>
      </div>
    </aside>
  )
}

// Get the current sidebar width (for use by parent)
export function useSidebarWidth(isExpanded: boolean): number {
  return isExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
}

// ============================================
// Admin Navigation (grouped)
// ============================================

function AdminNavigation({
  groups,
  pathname,
  isExpanded,
}: {
  groups: NavGroup[]
  pathname: string
  isExpanded: boolean
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          {/* Group Header */}
          {isExpanded && (
            <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </h3>
          )}
          {/* Group Items */}
          <div className="space-y-1 px-2">
            {group.items.map((item) => (
              <NavLink
                key={item.name}
                item={item}
                isActive={isNavItemActive(item.href, pathname)}
                isExpanded={isExpanded}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Facility Navigation (flat list)
// ============================================

function FacilityNavigation({
  items,
  pathname,
  isExpanded,
}: {
  items: NavItem[]
  pathname: string
  isExpanded: boolean
}) {
  return (
    <div className="space-y-1 px-2">
      {items.map((item) => (
        <NavLink
          key={item.name}
          item={item}
          isActive={isNavItemActive(item.href, pathname)}
          isExpanded={isExpanded}
        />
      ))}
    </div>
  )
}

// ============================================
// Single Nav Link
// ============================================

function NavLink({
  item,
  isActive,
  isExpanded,
}: {
  item: NavItem
  isActive: boolean
  isExpanded: boolean
}) {
  return (
    <Link
      href={item.href}
      className={`flex items-center h-10 rounded-xl text-sm font-medium transition-colors duration-200
        ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      title={!isExpanded ? item.name : undefined}
    >
      {/* Fixed-width icon container */}
      <div className="w-12 flex items-center justify-center flex-shrink-0">
        {item.icon}
      </div>
      {/* Text - only rendered when expanded */}
      {isExpanded && (
        <span className="pr-3 whitespace-nowrap">{item.name}</span>
      )}
    </Link>
  )
}
