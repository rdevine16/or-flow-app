'use client'

import DashboardLayout from '@/components/layouts/DashboardLayout'
import ConfigurationLanding from '@/components/admin/ConfigurationLanding'

export default function PageClient() {
  return (
    <DashboardLayout>
      <ConfigurationLanding />
    </DashboardLayout>
  )
}
