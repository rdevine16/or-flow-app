'use client'

import { usePathname } from 'next/navigation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsTabLayout from '@/components/settings/SettingsTabLayout'

export default function SettingsRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLandingPage = pathname === '/settings'

  return (
    <DashboardLayout>
      <Container>
        {isLandingPage ? (
          // Landing page: full-width card grid, no tab bar
          children
        ) : (
          // Sub-pages: tab bar + sub-nav + content
          <SettingsTabLayout>
            {children}
          </SettingsTabLayout>
        )}
      </Container>
    </DashboardLayout>
  )
}
