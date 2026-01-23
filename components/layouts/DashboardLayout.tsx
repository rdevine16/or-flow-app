// components/layouts/DashboardLayout.tsx
// Enterprise-grade layout with Supabase-style 3-panel architecture
// Panel 1: Global nav (collapsed by default, expands on hover)
// Panel 2: Sub-navigation (visible when page has sub-nav items)
// Panel 3: Content area (only this refreshes on navigation)

'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import { useUser } from '../../lib/UserContext'
import { useSubNav } from '../../lib/SubNavContext'
import { getImpersonationState, endImpersonation } from '../../lib/impersonation'
import { authAudit, adminAudit } from '../../lib/audit-logger'

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Navigation config
interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  allowedRoles: string[]
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

// ORbit Logo Components
const OrbitLogoMark = ({ className = "w-9 h-9" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 488 488" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Orbital ring with small circle (O element) */}
    <path 
      d="M326.75,474.73c83.46-4.13,157.32-52.48,194.68-126.83,1.71-3.4,5.17-4.74,8.39-3.57,3.14,1.14,5.51,5.2,3.76,8.72-18.2,36.64-45.34,68.21-78.97,91.63-38.39,26.73-83.48,41.54-130.25,43.39-29.69,1.17-59.54-2.85-87.48-12.71l-3.99-1.41-3.51-1.26c-67.14-24.19-119.72-78.57-144.08-145.75C36.34,330.74-1.66,291.31-.57,243.21c.16-37.53,24.27-71.32,61.26-80.2,8.18-1.96,16.29-2.4,24.71-2.12C119.41,67.62,206.6,3.66,305.94.02c6.14-.54,11.8-.2,17.53,0,88.67,2.89,168.52,53.61,208.91,132.53,1.68,3.27,1.02,7.32-2.49,9.22-3.76,2.03-7.58.09-9.38-3.42-35.75-69.74-104.38-117.1-182.48-124.14l-3.78-.34c-38.47-3.47-77.12,3.19-112.43,18.87-56.51,25.08-100.91,71.71-122.98,129.87,34.72,8.19,58.43,36.7,61.95,71.9,4.32,42.28-20.95,81.41-62.01,90.85,35.89,94.13,127.34,154.37,227.99,149.39l-.02-.02ZM148.84,242.69c-.24-12.67-3.22-24.44-9.24-35.54-9.16-16.9-24.86-29.44-43.72-33.68-29.98-6.74-59.58,5.64-74.5,32.36-14.64,26.23-12.65,60.42,5.56,84.29,14.58,19.12,37.61,28.57,61.47,25.91,37.33-4.17,61.14-36.46,60.43-73.33h0Z"
      fill="currentColor"
      transform="translate(-0.59, -0.27) scale(0.68)"
    />
    {/* Right arc segment */}
    <path 
      d="M544.76,327.2c-1.43,3.96-4.92,5.45-8.4,4.4-3.09-.94-5.58-4.58-4.24-8.24,15.81-43.39,18.21-90.52,7.14-135.36-.91-3.7,1.17-6.89,4.37-7.89s7.33.48,8.28,4.26c11.83,47.23,9.42,96.83-7.14,142.83h-.01Z"
      fill="currentColor"
      transform="translate(-0.59, -0.27) scale(0.68)"
    />
    {/* Dot */}
    <path 
      d="M535.11,155.86c3.76-1.26,7.34.82,8.41,4.35.95,3.12-.84,6.75-4.1,7.89-3.31,1.17-7.11-.49-8.29-3.95-1.06-3.1.23-7.04,3.98-8.29h0Z"
      fill="currentColor"
      transform="translate(-0.59, -0.27) scale(0.68)"
    />
  </svg>
)

const OrbitLogoFull = ({ className = "h-8", isExpanded = true }: { className?: string; isExpanded?: boolean }) => (
  <svg className={className} viewBox="0 0 718 488" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Orbital ring with small circle (O element) - always visible */}
    <path 
      d="M327.34,475c83.46-4.13,157.32-52.48,194.68-126.83,1.71-3.4,5.17-4.74,8.39-3.57,3.14,1.14,5.51,5.2,3.76,8.72-18.2,36.64-45.34,68.21-78.97,91.63-38.39,26.73-83.48,41.54-130.25,43.39-29.69,1.17-59.54-2.85-87.48-12.71l-3.99-1.41-3.51-1.26c-67.14-24.19-119.72-78.57-144.08-145.75C36.93,331.01-1.07,291.58.02,243.48c.16-37.53,24.27-71.32,61.26-80.2,8.18-1.96,16.29-2.4,24.71-2.12C120,67.89,207.19,3.93,306.53.29c6.14-.54,11.8-.2,17.53,0,88.67,2.89,168.52,53.61,208.91,132.53,1.68,3.27,1.02,7.32-2.49,9.22-3.76,2.03-7.58.09-9.38-3.42-35.75-69.74-104.38-117.1-182.48-124.14l-3.78-.34c-38.47-3.47-77.12,3.19-112.43,18.87-56.51,25.08-100.91,71.71-122.98,129.87,34.72,8.19,58.43,36.7,61.95,71.9,4.32,42.28-20.95,81.41-62.01,90.85,35.89,94.13,127.34,154.37,227.99,149.39l-.02-.02ZM149.43,242.96c-.24-12.67-3.22-24.44-9.24-35.54-9.16-16.9-24.86-29.44-43.72-33.68-29.98-6.74-59.58,5.64-74.5,32.36-14.64,26.23-12.65,60.42,5.56,84.29,14.58,19.12,37.61,28.57,61.47,25.91,37.33-4.17,61.14-36.46,60.43-73.33h0Z"
      fill="currentColor"
    />
    {/* R letter */}
    <path 
      className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
      d="M330.85,314.9c2.55,3.3,2.54,6.97-.55,9.35s-7.32,1.38-9.23-2.3l-50.97-66.27h-52.6v65.54c-.19,3.29-2.4,5.59-5.45,5.92-2.51.26-6.55-1.53-6.55-5l-.03-151.17c0-5.19,3.53-9.5,8.9-9.5h60.92c7.47,0,14.4,1.18,21.4,3.29,19.88,6.01,34.49,21.91,33.82,43.33.04,27.48-21.63,42.1-47.04,45.56l47.37,61.24h.01ZM318.58,205.68c-.85-14.46-8.22-23.57-20.94-29.12-7.25-2.96-14.64-3.99-22.56-4.28l-57.61-.05.03,72.72,56.85-.02c9.7-.48,18.7-2.45,27.03-7.2,11.49-6.56,18-18.24,17.19-32.04h.01Z"
      fill="currentColor"
    />
    {/* B letter */}
    <path 
      className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
      d="M462.8,242.19c19.56,4.84,35.99,16.09,36.39,38.23.28,15.53-7.82,29-21.65,36.22-9.88,5.16-20.75,8.01-32.21,8.03l-65.7.09c-4.24,0-7.87-3.59-7.87-7.95v-144.82c0-4.82,3.79-8.18,8.34-8.17l59.98.04c25.83.02,51.89,13.63,50.08,42.9-1.11,17.96-11.89,28.95-27.36,35.44h0ZM478.28,205.76c.28-10.93-4.7-20.07-14.06-25.33-6.96-4.06-14.75-5.24-22.98-5.78l-57.55-.06v63.76l53.98-.03c20.18-.11,40.03-9.67,40.61-32.56h0ZM476.7,258.77c-4.6-3.46-9.77-5.57-15.33-7.14-5.94-1.4-11.56-2.05-17.74-2.51l-59.92-.06.03,64.87h60.18c8.03-.13,15.43-1.27,22.75-4.19,6.36-2.69,11.95-6.57,15.83-12.31,7.54-11.17,6.69-29.28-5.78-38.65h-.02Z"
      fill="currentColor"
    />
    {/* i and T letters (using the arc) */}
    <path 
      d="M545.35,327.47c-1.43,3.96-4.92,5.45-8.4,4.4-3.09-.94-5.58-4.58-4.24-8.24,15.81-43.39,18.21-90.52,7.14-135.36-.91-3.7,1.17-6.89,4.37-7.89s7.33.48,8.28,4.26c11.83,47.23,9.42,96.83-7.14,142.83h-.01Z"
      fill="currentColor"
    />
    {/* Dot for i */}
    <path 
      d="M535.7,156.13c3.76-1.26,7.34.82,8.41,4.35.95,3.12-.84,6.75-4.1,7.89-3.31,1.17-7.11-.49-8.29-3.95-1.06-3.1.23-7.04,3.98-8.29h0Z"
      fill="currentColor"
    />
    {/* T letter */}
    <path 
      className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}
      d="M645.44,321.18l-.02-148.1-54.89.05c-3.34,0-5.91-1.02-6.59-4.53-.46-2.36,1.24-6.24,4.68-6.24l123.17-.04c3.64,0,6.26,1.74,6.38,5.03.16,4.27-2.87,5.82-6.69,5.82l-54.1-.06v147.6c0,3.3-3.01,5.45-5.72,5.6-2.49.14-6.23-1.82-6.23-5.13h.01Z"
      fill="currentColor"
    />
  </svg>
)

// Icons for admin nav
const adminIcons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  facilities: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  procedures: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  categories: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  milestones: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  procedureMilestones: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  delays: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  implants: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  bodyRegions: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  auditLog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  costCategories: (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
),
}

// Admin navigation groups (for global_admin when not impersonating)
const adminNavGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/admin',
        icon: adminIcons.dashboard,
        allowedRoles: ['global_admin'],
      },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      {
        name: 'Facilities',
        href: '/admin/facilities',
        icon: adminIcons.facilities,
        allowedRoles: ['global_admin'],
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      {
        name: 'Procedures',
        href: '/admin/settings/procedures',
        icon: adminIcons.procedures,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Categories',
        href: '/admin/settings/procedure-categories',
        icon: adminIcons.categories,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Milestones',
        href: '/admin/settings/milestones',
        icon: adminIcons.milestones,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Procedure Milestones',
        href: '/admin/settings/procedure-milestones',
        icon: adminIcons.procedureMilestones,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Delay Types',
        href: '/admin/settings/delay-types',
        icon: adminIcons.delays,
        allowedRoles: ['global_admin'],
      },
            {
        name: 'Complexities',
        href: '/admin/complexities',
        icon: adminIcons.delays,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Body Regions',
        href: '/admin/settings/body-regions',
        icon: adminIcons.bodyRegions,
        allowedRoles: ['global_admin'],
      },
      {
        name: 'Implant Companies',
        href: '/admin/settings/implant-companies',
        icon: adminIcons.implants,
        allowedRoles: ['global_admin'],
      },
      {
  name: 'Cost Categories',
  href: '/admin/settings/cost-categories',
  icon: adminIcons.costCategories,
  allowedRoles: ['global_admin'],
},
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      {
        name: 'Audit Log',
        href: '/admin/audit-log',
        icon: adminIcons.auditLog,
        allowedRoles: ['global_admin'],
      },
    ],
  },
]

const baseNavigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    allowedRoles: ['global_admin', 'facility_admin', 'user'],
  },
    {
    name: 'Block Schedule',
    href: '/block-schedule',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    allowedRoles: ['global_admin', 'facility_admin'],
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    allowedRoles: ['global_admin', 'facility_admin', 'user'],
  },
  {
  name: 'SPD',
  href: '/spd',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  allowedRoles: ['global_admin', 'facility_admin'],
},
  
{
    name: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    allowedRoles: ['global_admin', 'facility_admin'],
  },
 {
    name: 'Data Quality',
    href: '/dashboard/data-quality',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    allowedRoles: ['facility_admin'],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    allowedRoles: ['global_admin', 'facility_admin'],
  },
]

// Sidebar widths
const SIDEBAR_COLLAPSED = 64
const SIDEBAR_EXPANDED = 240
const SUBNAV_WIDTH = 256

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  // Sidebar state
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // User menu
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Sub-nav from context
  const { items: subNavItems, title: subNavTitle, isVisible: hasSubNav } = useSubNav()
  
  // Impersonation
  const [impersonation, setImpersonation] = useState<{
    facilityId: string
    facilityName: string
    facilityLogo: string | null
    sessionId: string
  } | null>(null)

  // Facility status
  const [facilityStatus, setFacilityStatus] = useState<{
    subscriptionStatus: string | null
    trialEndsAt: string | null
    facilityName: string | null
    facilityLogo: string | null
  } | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null)

  const { userData, loading, isGlobalAdmin, isFacilityAdmin, isAdmin } = useUser()
  const effectiveIsGlobalAdmin = userAccessLevel === 'global_admin' || isGlobalAdmin
  const isExpanded = isHovered || isPinned

  // Check facility access
  useEffect(() => {
    async function checkFacilityAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCheckingAccess(false)
          return
        }

        const { data: userRecord } = await supabase
          .from('users')
          .select('facility_id, must_change_password, access_level')
          .eq('id', user.id)
          .single()

        if (userRecord?.access_level) setUserAccessLevel(userRecord.access_level)
        if (userRecord?.must_change_password) {
          setMustChangePassword(true)
          setCheckingAccess(false)
          return
        }
        if (userRecord?.access_level === 'global_admin') {
          setCheckingAccess(false)
          return
        }
        if (!userRecord?.facility_id) {
          setCheckingAccess(false)
          return
        }

        const { data: facility } = await supabase
          .from('facilities')
          .select('name, subscription_status, trial_ends_at, logo_url')
          .eq('id', userRecord.facility_id)
          .single()

        if (facility) {
          setFacilityStatus({
            subscriptionStatus: facility.subscription_status,
            trialEndsAt: facility.trial_ends_at,
            facilityName: facility.name,
            facilityLogo: facility.logo_url,
          })
        }
        setCheckingAccess(false)
      } catch (error) {
        console.error('Error checking facility access:', error)
        setCheckingAccess(false)
      }
    }
    if (!loading) checkFacilityAccess()
  }, [loading, supabase])

  // Load impersonation
  useEffect(() => {
    async function loadImpersonation() {
      const impState = getImpersonationState()
      if (impState && effectiveIsGlobalAdmin) {
        const { data: facility } = await supabase
          .from('facilities')
          .select('logo_url')
          .eq('id', impState.facilityId)
          .single()
        
        setImpersonation({
          facilityId: impState.facilityId,
          facilityName: impState.facilityName,
          facilityLogo: facility?.logo_url || null,
          sessionId: impState.sessionId,
        })
      }
    }
    loadImpersonation()
    setMounted(true)
  }, [effectiveIsGlobalAdmin, supabase])

  // Handlers
  const handleEndImpersonation = async () => {
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
    }
    await endImpersonation(supabase)
    setImpersonation(null)
    router.push('/admin/facilities')
  }

  const handleLogout = async () => {
    if (impersonation) {
      await adminAudit.impersonationEnded(supabase, impersonation.facilityName, impersonation.facilityId)
      await endImpersonation(supabase)
    }
    await authAudit.logout(supabase)
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Computed
  const userName = `${userData.firstName} ${userData.lastName}`.trim() || 'User'
  const userInitials = userData.firstName && userData.lastName 
    ? `${userData.firstName[0]}${userData.lastName[0]}`.toUpperCase() 
    : 'U'

  const getRoleDisplay = () => {
    switch (userData.accessLevel) {
      case 'global_admin': return 'Global Administrator'
      case 'facility_admin': return 'Facility Administrator'
      default: return 'Staff'
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  // Determine if showing admin nav (grouped) or facility nav (flat)
  const isAdminMode = effectiveIsGlobalAdmin && !impersonation

  const getNavigation = (): NavItem[] => {
    // Global admin not impersonating -> no flat nav (uses grouped admin nav instead)
    if (isAdminMode) return []
    // Impersonating or regular user -> facility nav only (no admin link)
    return baseNavigation.filter(item => item.allowedRoles.includes(userData.accessLevel))
  }

  const navigation = getNavigation()
  const displayFacilityName = impersonation ? impersonation.facilityName : userData.facilityName

  const isTrialExpired = () => {
    if (!facilityStatus) return false
    if (facilityStatus.subscriptionStatus !== 'trial') return false
    if (!facilityStatus.trialEndsAt) return false
    return new Date(facilityStatus.trialEndsAt) < new Date()
  }

  const isDisabled = () => facilityStatus?.subscriptionStatus === 'disabled'

  const getTrialDaysRemaining = () => {
    if (!facilityStatus?.trialEndsAt || facilityStatus.subscriptionStatus !== 'trial') return null
    const diff = new Date(facilityStatus.trialEndsAt).getTime() - Date.now()
    return Math.ceil(diff / 86400000)
  }

  const trialDaysRemaining = getTrialDaysRemaining()
  const showTrialWarning = trialDaysRemaining !== null && trialDaysRemaining > 0 && trialDaysRemaining <= 7

  // Loading states
console.log('DEBUG:', { loading, mounted, checkingAccess })
if (!mounted) {   return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (mustChangePassword) {
    router.push('/auth/change-password')
    return null
  }

  if (isTrialExpired() && !effectiveIsGlobalAdmin) {
    return <BlockedScreen type="trial" facilityName={facilityStatus?.facilityName} onLogout={handleLogout} />
  }

  if (isDisabled() && !effectiveIsGlobalAdmin) {
    return <BlockedScreen type="disabled" facilityName={facilityStatus?.facilityName} onLogout={handleLogout} />
  }

  const sidebarWidth = isExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const contentMarginLeft = sidebarWidth + (hasSubNav ? SUBNAV_WIDTH : 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* PANEL 1: Global Sidebar */}
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ width: sidebarWidth }}
        className="fixed top-0 left-0 h-full bg-[#141414] text-white z-50 flex flex-col transition-all duration-300 ease-out"
      >
        {/* Logo */}
        <div className={`h-16 flex items-center border-b border-white/10 ${isExpanded ? 'px-4' : 'justify-center'}`}>
          <Link href="/dashboard" className={`flex items-center ${isExpanded ? 'gap-3' : 'justify-center w-full'}`}>
            {isExpanded ? (
              <OrbitLogoFull className="h-7 text-white" isExpanded={isExpanded} />
            ) : (
              <OrbitLogoMark className="w-8 h-8 text-white" />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto overflow-x-hidden">
          {isAdminMode ? (
            /* Grouped Admin Navigation */
            <div className="space-y-6">
              {adminNavGroups.map((group) => (
                <div key={group.id}>
                  {/* Group Header */}
                  {isExpanded && (
                    <h3 className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      {group.label}
                    </h3>
                  )}
                  {/* Group Items */}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                            ${active ? 'bg-white text-[#141414]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                          title={!isExpanded ? item.name : undefined}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                            {item.name}
                          </span>
                          {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/60 rounded-r-full" />}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Flat Facility Navigation */
            <div className="space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                      ${active ? 'bg-white text-[#141414]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                      {item.name}
                    </span>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/60 rounded-r-full" />}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>

        {/* Pin & Version */}
        <div className="p-3 border-t border-white/10">
          {isExpanded && (
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isPinned ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="whitespace-nowrap">{isPinned ? 'Unpin sidebar' : 'Pin sidebar'}</span>
            </button>
          )}
          <p className={`text-xs text-white/30 mt-2 ${isExpanded ? 'px-3' : 'text-center'}`}>
            {isExpanded ? 'Version 1.0.0' : 'v1.0'}
          </p>
        </div>
      </aside>

      {/* PANEL 2: Sub-Navigation */}
      {hasSubNav && (
        <aside
          style={{ left: sidebarWidth, width: SUBNAV_WIDTH }}
          className="fixed top-0 h-full bg-white border-r border-slate-200 z-40 flex flex-col transition-all duration-300 ease-out"
        >
          <div className="h-16 flex items-center px-5 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">{subNavTitle}</h2>
          </div>
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {subNavItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                    ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  {item.icon && (
                    <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-slate-600 rounded-r-full" />}
                </Link>
              )
            })}
          </nav>
        </aside>
      )}

      {/* PANEL 3: Main Content */}
      <div style={{ marginLeft: contentMarginLeft }} className="min-h-screen flex flex-col transition-all duration-300 ease-out">
        {/* Banners */}
        {showTrialWarning && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">
                Your trial expires in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}.
              </span>
            </div>
            <a href="mailto:support@orbitsurgical.com" className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              Contact Support
            </a>
          </div>
        )}

        {impersonation && effectiveIsGlobalAdmin && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-amber-800">
                Viewing as: <span className="font-semibold">{impersonation.facilityName}</span>
              </span>
            </div>
            <button onClick={handleEndImpersonation} className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit
            </button>
          </div>
        )}

        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {(impersonation?.facilityLogo || facilityStatus?.facilityLogo) && (
              <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={impersonation?.facilityLogo || facilityStatus?.facilityLogo || ''} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm min-w-0">
              {displayFacilityName && (
                <>
                  <span className="text-slate-500 truncate">{displayFacilityName}</span>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
              <span className="font-semibold text-slate-900 truncate">
                {navigation.find(n => isActive(n.href))?.name || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:block">
              <input type="text" placeholder="Search cases, rooms..." className="w-64 pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400" />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">⌘K</kbd>
            </div>

            <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block" />

            {/* Notifications */}
            <button className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>

            <div className="w-px h-8 bg-slate-200 mx-2" />

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-3 p-1.5 pr-3 hover:bg-slate-50 rounded-xl transition-all">
                <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-white text-sm font-bold">
                  {userInitials}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold text-slate-700">{userName}</p>
                  <p className="text-xs text-slate-400">{userData.facilityName || getRoleDisplay()}</p>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-slate-700 rounded-xl flex items-center justify-center text-white font-bold">
                        {userInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-500">{getRoleDisplay()}</p>
                        {userData.facilityName && <p className="text-xs text-slate-400 truncate">{userData.facilityName}</p>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Your Profile
                    </Link>
                    {isAdmin && (
                      <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => setUserMenuOpen(false)}>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                    )}
                  </div>

                  <div className="pt-1 mt-1 border-t border-slate-100">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

// Blocked screen component
function BlockedScreen({ type, facilityName, onLogout }: { type: 'trial' | 'disabled'; facilityName?: string | null; onLogout: () => void }) {
  const isTrial = type === 'trial'
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className={`p-6 ${isTrial ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isTrial ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white text-center">{isTrial ? 'Trial Expired' : 'Access Disabled'}</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-600 text-center mb-6">
            {isTrial 
              ? <>Your trial for <span className="font-semibold">{facilityName}</span> has ended.</>
              : <>Access to <span className="font-semibold">{facilityName}</span> has been disabled.</>
            }
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Need help?</h3>
            <p className="text-sm text-slate-500">
              Contact <a href="mailto:support@orbitsurgical.com" className="text-slate-900 font-medium hover:underline">support@orbitsurgical.com</a>
            </p>
          </div>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}