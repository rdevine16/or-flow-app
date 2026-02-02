// components/layouts/Header.tsx
// Header with facility info, search, notifications, and user menu

'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import GlobalSearch from '../GlobalSearch'
import { NavItem, isNavItemActive } from './navigation-config'

interface UserData {
  firstName: string
  lastName: string
  accessLevel: string
  facilityId: string | null
  facilityName: string | null
}

interface ImpersonationState {
  facilityId: string
  facilityName: string
  facilityLogo: string | null
  sessionId: string
}

interface FacilityStatus {
  subscriptionStatus: string | null
  trialEndsAt: string | null
  facilityName: string | null
  facilityLogo: string | null
}

interface HeaderProps {
  pathname: string
  navigation: NavItem[]
  userData: UserData
  impersonation: ImpersonationState | null
  facilityStatus: FacilityStatus | null
  isAdmin: boolean
  onEndImpersonation: () => void
  onLogout: () => void
}

export default function Header({
  pathname,
  navigation,
  userData,
  impersonation,
  facilityStatus,
  isAdmin,
  onEndImpersonation,
  onLogout,
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Computed values
  const userName =
    `${userData.firstName} ${userData.lastName}`.trim() || 'User'
  const userInitials =
    userData.firstName && userData.lastName
      ? `${userData.firstName[0]}${userData.lastName[0]}`.toUpperCase()
      : 'U'

  const getRoleDisplay = () => {
    switch (userData.accessLevel) {
      case 'global_admin':
        return 'Global Administrator'
      case 'facility_admin':
        return 'Facility Administrator'
      default:
        return 'Staff'
    }
  }

  const displayFacilityName = impersonation
    ? impersonation.facilityName
    : userData.facilityName

  const currentPageName =
    navigation.find((n) => isNavItemActive(n.href, pathname))?.name || 'Dashboard'

  const facilityLogo = impersonation?.facilityLogo || facilityStatus?.facilityLogo

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
      {/* Left: Facility info and breadcrumb */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {facilityLogo && (
          <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src={facilityLogo}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
        <div className="flex items-center gap-2 text-sm min-w-0">
          {displayFacilityName && (
            <>
              <span className="text-slate-500 truncate">
                {displayFacilityName}
              </span>
              <svg
                className="w-4 h-4 text-slate-300 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </>
          )}
          <span className="font-semibold text-slate-900 truncate">
            {currentPageName}
          </span>
        </div>
      </div>

      {/* Right: Search, notifications, user menu */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden md:block">
          <GlobalSearch
            facilityId={userData?.facilityId || impersonation?.facilityId || null}
          />
        </div>

        <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block" />

        {/* Notifications */}
        <button className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
        </button>

        <div className="w-px h-8 bg-slate-200 mx-2" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 hover:bg-slate-50 rounded-xl transition-all"
          >
            <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-sm font-bold">
              {userInitials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold text-slate-700">{userName}</p>
              <p className="text-xs text-slate-400">
                {userData.facilityName || getRoleDisplay()}
              </p>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                userMenuOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-700 rounded-xl flex items-center justify-center text-white font-bold">
                    {userInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-slate-500">{getRoleDisplay()}</p>
                    {userData.facilityName && (
                      <p className="text-xs text-slate-400 truncate">
                        {userData.facilityName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Your Profile
                </Link>
                {isAdmin && (
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <svg
                      className="w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                  </Link>
                )}
              </div>

              {/* Logout */}
              <div className="pt-1 mt-1 border-t border-slate-100">
                <button
                  onClick={onLogout}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ============================================
// Banners
// ============================================

interface TrialBannerProps {
  daysRemaining: number
}

export function TrialBanner({ daysRemaining }: TrialBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-medium">
          Your trial expires in {daysRemaining} day
          {daysRemaining !== 1 ? 's' : ''}.
        </span>
      </div>
      <a
        href="mailto:support@orbitsurgical.com"
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
      >
        Contact Support
      </a>
    </div>
  )
}

interface ImpersonationBannerProps {
  facilityName: string
  onEndImpersonation: () => void
}

export function ImpersonationBanner({
  facilityName,
  onEndImpersonation,
}: ImpersonationBannerProps) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
          <svg
            className="w-4 h-4 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </div>
        <span className="text-sm font-medium text-amber-800">
          Viewing as: <span className="font-semibold">{facilityName}</span>
        </span>
      </div>
      <button
        onClick={onEndImpersonation}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        Exit
      </button>
    </div>
  )
}
