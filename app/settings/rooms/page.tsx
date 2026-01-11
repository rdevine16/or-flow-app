'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import EditableList from '../../../components/settings/EditableList'

interface ORRoom {
  id: string
  name: string
}

interface Facility {
  id: string
  name: string
}

export default function RoomsSettingsPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<ORRoom[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id, access_level')
        .eq('id', user.id)
        .single()

      if (userData) {
        const isGlobal = userData.access_level === 'global_admin'
        setIsGlobalAdmin(isGlobal)
        setUserFacilityId(userData.facility_id)

        if (isGlobal) {
          // Fetch all facilities for global admin
          const { data: facilitiesData } = await supabase
            .from('facilities')
            .select('id, name')
            .order('name')

          if (facilitiesData && facilitiesData.length > 0) {
            setFacilities(facilitiesData)
            setSelectedFacilityId(facilitiesData[0].id)
            fetchRooms(facilitiesData[0].id)
          } else {
            setLoading(false)
          }
        } else {
          // Regular user - use their facility
          setSelectedFacilityId(userData.facility_id)
          fetchRooms(userData.facility_id)
        }
      }
    }
  }

  const fetchRooms = async (facilityId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('or_rooms')
      .select('id, name')
      .eq('facility_id', facilityId)
      .order('name')
    
    setRooms(data || [])
    setLoading(false)
  }

  const handleFacilityChange = (facilityId: string) => {
    setSelectedFacilityId(facilityId)
    fetchRooms(facilityId)
  }

  const handleAdd = async (name: string) => {
    if (!selectedFacilityId) return

    const { data, error } = await supabase
      .from('or_rooms')
      .insert({ name, facility_id: selectedFacilityId })
      .select()
      .single()

    if (!error && data) {
      setRooms([...rooms, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const handleEdit = async (id: string, name: string) => {
    const { error } = await supabase
      .from('or_rooms')
      .update({ name })
      .eq('id', id)

    if (!error) {
      setRooms(
        rooms
          .map(r => r.id === id ? { ...r, name } : r)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('or_rooms')
      .delete()
      .eq('id', id)

    if (!error) {
      setRooms(rooms.filter(r => r.id !== id))
    }
  }

  const selectedFacility = facilities.find(f => f.id === selectedFacilityId)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="OR Rooms"
          description={isGlobalAdmin 
            ? "Manage operating rooms across all facilities." 
            : "Manage the operating rooms available at your facility."
          }
        >
          {/* Facility Selector (Global Admin Only) */}
          {isGlobalAdmin && facilities.length > 0 && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Facility
              </label>
              <select
                value={selectedFacilityId || ''}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className="w-full md:w-80 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Managing rooms for: <span className="font-medium text-slate-700">{selectedFacility?.name}</span>
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : !selectedFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <EditableList
              items={rooms}
              onAdd={handleAdd}
              onUpdate={handleEdit}
              onDelete={handleDelete}
              placeholder="Enter room name (e.g., OR 1, OR 2)"
            />
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}
