'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface SurgeonPreference {
  id: string
  surgeon_id: string
  procedure_type_id: string
  procedure_types: { name: string } | null
  surgeon_preference_companies: {
    implant_company_id: string
    implant_companies: { name: string } | null
  }[]
}

export default function SurgeonPreferencesPage() {
  const supabase = createClient()
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [selectedSurgeon, setSelectedSurgeon] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<SurgeonPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(false)

  useEffect(() => {
    fetchSurgeons()
  }, [])

  useEffect(() => {
    if (selectedSurgeon) {
      fetchPreferences(selectedSurgeon)
    }
  }, [selectedSurgeon])

  const fetchSurgeons = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userData } = await supabase
      .from('users')
      .select('facility_id')
      .eq('id', user.id)
      .single()

    if (!userData) return

    // Fetch surgeons (users with surgeon role)
    const { data: surgeonRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('name', 'surgeon')
      .single()

    if (!surgeonRole) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('facility_id', userData.facility_id)
      .eq('role_id', surgeonRole.id)
      .order('last_name')

    setSurgeons(data || [])
    setLoading(false)
  }

  const fetchPreferences = async (surgeonId: string) => {
    setPrefsLoading(true)
    
    const { data } = await supabase
      .from('surgeon_preferences')
      .select(`
        id,
        surgeon_id,
        procedure_type_id,
        procedure_types (name),
        surgeon_preference_companies (
          implant_company_id,
          implant_companies (name)
        )
      `)
      .eq('surgeon_id', surgeonId)
      .order('created_at')

    setPreferences(data as SurgeonPreference[] || [])
    setPrefsLoading(false)
  }

  const selectedSurgeonData = surgeons.find(s => s.id === selectedSurgeon)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Surgeon Preferences"
          description="Create quick-fill templates for surgeon + procedure combinations"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Surgeon Selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Surgeon
                </label>
                <select
                  value={selectedSurgeon || ''}
                  onChange={(e) => setSelectedSurgeon(e.target.value || null)}
                  className="w-full max-w-md px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Choose a surgeon...</option>
                  {surgeons.map((surgeon) => (
                    <option key={surgeon.id} value={surgeon.id}>
                      Dr. {surgeon.first_name} {surgeon.last_name}
                    </option>
                  ))}
                </select>

                {surgeons.length === 0 && (
                  <p className="mt-3 text-sm text-slate-500">
                    No surgeons found. Add surgeons in Users & Roles first.
                  </p>
                )}
              </div>

              {/* Preferences List */}
              {selectedSurgeon && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">
                        Dr. {selectedSurgeonData?.first_name} {selectedSurgeonData?.last_name}'s Preferences
                      </h3>
                      <p className="text-sm text-slate-500">
                        {preferences.length} preference{preferences.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                    <button
                      onClick={() => {/* TODO: Open add modal */}}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Preference
                    </button>
                  </div>

                  {prefsLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : preferences.length === 0 ? (
                    <div className="p-8 text-center">
                      <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="text-slate-500 mb-2">No preferences set up yet</p>
                      <p className="text-sm text-slate-400">
                        Add preferences to speed up case creation for this surgeon
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {preferences.map((pref) => (
                        <div key={pref.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-slate-900">
                                {pref.procedure_types?.name || 'Unknown Procedure'}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {pref.surgeon_preference_companies.map((spc) => (
                                  <span
                                    key={spc.implant_company_id}
                                    className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                                  >
                                    {spc.implant_companies?.name || 'Unknown'}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {/* TODO: Edit */}}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {/* TODO: Delete */}}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Help Text */}
              {!selectedSurgeon && surgeons.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                  <h4 className="font-medium text-slate-900 mb-2">How Surgeon Preferences Work</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Select a surgeon to view and manage their preferences
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Each preference links a procedure to one or more implant companies
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      When creating a case, selecting a preference auto-fills the procedure and companies
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      Users can still modify values after selecting a preference
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}
