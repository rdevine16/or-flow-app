'use client'

import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'

export default function UsersSettingsPage() {
  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Users & Roles"
          description="Manage staff members and their permissions."
        >
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              User management will allow you to add, edit, and manage staff members and their roles.
            </p>
          </div>
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}