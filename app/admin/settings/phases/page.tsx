// app/admin/settings/phases/page.tsx
// Admin Phase Templates — manages global default phase definitions
// that get seeded to newly created facilities via seed_facility_phases().

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { PageLoader } from '@/components/ui/Loading'
import { PhaseTemplateSection } from '@/components/settings/phases/PhaseTemplateSection'

export default function AdminPhasesSettingsPage() {
  const router = useRouter()
  const { isGlobalAdmin, loading: userLoading } = useUser()

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !isGlobalAdmin) {
      router.push('/dashboard')
    }
  }, [userLoading, isGlobalAdmin, router])

  if (userLoading) {
    return (
      <DashboardLayout>
        <Container className="py-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Phase Templates</h1>
          <p className="text-slate-500 mb-6">
            Configure default phases for new facilities.
          </p>
          <PageLoader message="Loading phase templates..." />
        </Container>
      </DashboardLayout>
    )
  }

  if (!isGlobalAdmin) {
    return null
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-4xl mx-auto">
          <PhaseTemplateSection />
        </div>
      </Container>
    </DashboardLayout>
  )
}
