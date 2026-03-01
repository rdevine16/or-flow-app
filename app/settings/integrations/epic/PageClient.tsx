// app/settings/integrations/epic/PageClient.tsx
// Epic Integration overview — connection status, quick actions, mapping summary

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Link2,
  Unlink,
  MapPin,
  Download,
  RefreshCw,
  Clock,
  Shield,
  Users,
  LayoutGrid,
  ClipboardList,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks'
import type { EpicConnectionStatus } from '@/lib/epic/types'

// =====================================================
// TYPES
// =====================================================

interface ConnectionData {
  id: string
  status: EpicConnectionStatus
  last_connected_at: string | null
  connected_by: string | null
  token_expires_at: string | null
  fhir_base_url: string
}

interface MappingStats {
  surgeon: { total: number; mapped: number }
  room: { total: number; mapped: number }
  procedure: { total: number; mapped: number }
}

interface EpicStatusResponse {
  connection: ConnectionData | null
  mappingStats: MappingStats | null
}

// =====================================================
// HELPERS
// =====================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleString()
}

function getTokenExpiryInfo(expiresAt: string | null): {
  isExpired: boolean
  minutesRemaining: number | null
  label: string
} {
  if (!expiresAt) return { isExpired: true, minutesRemaining: null, label: 'No token' }
  const now = Date.now()
  const expires = new Date(expiresAt).getTime()
  const diff = expires - now
  if (diff <= 0) return { isExpired: true, minutesRemaining: 0, label: 'Expired' }
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return { isExpired: false, minutesRemaining: 0, label: 'Less than 1 minute' }
  return { isExpired: false, minutesRemaining: minutes, label: `${minutes} min remaining` }
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function StatusIndicator({ status }: { status: EpicConnectionStatus }) {
  const config = {
    connected: { color: 'bg-emerald-500', ring: 'ring-emerald-500/20', label: 'Connected' },
    disconnected: { color: 'bg-slate-400', ring: 'ring-slate-400/20', label: 'Disconnected' },
    token_expired: { color: 'bg-amber-500', ring: 'ring-amber-500/20', label: 'Token Expired' },
    error: { color: 'bg-red-500', ring: 'ring-red-500/20', label: 'Error' },
  }[status]

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color} ring-4 ${config.ring}`} />
      <span className="text-sm font-medium text-slate-700">{config.label}</span>
    </div>
  )
}

function MappingStatCard({
  icon: Icon,
  label,
  mapped,
  total,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  mapped: number
  total: number
}) {
  const pct = total > 0 ? Math.round((mapped / total) * 100) : 0
  const color = total === 0 ? 'text-slate-400' : pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-slate-400">No entities found</p>
      ) : (
        <>
          <p className={`text-lg font-semibold ${color}`}>
            {mapped} / {total}
          </p>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full transition-all ${
                pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function EpicOverviewPage() {
  const router = useRouter()
  const { data: currentUser } = useCurrentUser()
  const [epicStatus, setEpicStatus] = useState<EpicStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!currentUser?.facilityId) return
    try {
      const res = await fetch(`/api/epic/status?facility_id=${currentUser.facilityId}`)
      if (res.ok) {
        setEpicStatus(await res.json())
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [currentUser?.facilityId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleConnect = () => {
    if (!currentUser?.facilityId) return
    window.location.href = `/api/epic/auth/connect?facility_id=${currentUser.facilityId}`
  }

  const handleDisconnect = async () => {
    if (!currentUser?.facilityId) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/epic/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility_id: currentUser.facilityId }),
      })
      if (res.ok) {
        setShowDisconnectConfirm(false)
        await fetchStatus()
      }
    } catch {
      // Error will show via status refetch
    } finally {
      setDisconnecting(false)
    }
  }

  const connection = epicStatus?.connection
  const stats = epicStatus?.mappingStats
  const isConnected = connection?.status === 'connected'
  const isExpired = connection?.status === 'token_expired'
  const tokenInfo = connection ? getTokenExpiryInfo(connection.token_expires_at) : null

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/settings/integrations')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Epic Integration</h1>
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/settings/integrations')} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Epic Integration</h1>
          <p className="text-slate-500 text-sm">Connect to Epic EHR via SMART on FHIR</p>
        </div>
      </div>

      {/* State 1: Not Connected */}
      {(!connection || connection.status === 'disconnected') && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect to Epic</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Link your Epic EHR instance to import surgical cases, map surgeons and rooms, and streamline your OR scheduling workflow.
            </p>

            {/* Requirements */}
            <div className="bg-slate-50 rounded-lg p-4 max-w-sm mx-auto mb-6 text-left">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Requirements</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  Epic admin credentials
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  Network access to FHIR server
                </li>
              </ul>
            </div>

            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect to Epic
            </button>
          </div>
        </div>
      )}

      {/* State 2: Connected / Token Expired / Error */}
      {connection && connection.status !== 'disconnected' && (
        <>
          {/* Connection Status Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium text-slate-900 mb-1">Connection Status</h3>
                <StatusIndicator status={connection.status} />
              </div>
              <div className="flex items-center gap-2">
                {(isExpired || connection.status === 'error') && (
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect
                  </button>
                )}
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-0.5">Connected At</p>
                <p className="text-slate-900 font-medium">{formatDate(connection.last_connected_at)}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">FHIR Server</p>
                <p className="text-slate-900 font-medium truncate">{connection.fhir_base_url}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Token Status</p>
                {tokenInfo && (
                  <div className="flex items-center gap-1.5">
                    <Clock className={`w-3.5 h-3.5 ${tokenInfo.isExpired ? 'text-red-500' : tokenInfo.minutesRemaining !== null && tokenInfo.minutesRemaining < 10 ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <p className={`font-medium ${tokenInfo.isExpired ? 'text-red-600' : tokenInfo.minutesRemaining !== null && tokenInfo.minutesRemaining < 10 ? 'text-amber-600' : 'text-slate-900'}`}>
                      {tokenInfo.label}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/settings/integrations/epic/import')}
              disabled={!isConnected}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 text-blue-600 mb-2" />
              <p className="font-medium text-slate-900 text-sm">Import Cases</p>
              <p className="text-xs text-slate-500 mt-0.5">Fetch appointments from Epic</p>
            </button>

            <button
              onClick={() => router.push('/settings/integrations/epic/mappings')}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all text-left"
            >
              <MapPin className="w-5 h-5 text-blue-600 mb-2" />
              <p className="font-medium text-slate-900 text-sm">Entity Mappings</p>
              <p className="text-xs text-slate-500 mt-0.5">Map surgeons, rooms, procedures</p>
            </button>

            <button
              onClick={handleConnect}
              disabled={isConnected}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-5 h-5 text-blue-600 mb-2" />
              <p className="font-medium text-slate-900 text-sm">Reconnect</p>
              <p className="text-xs text-slate-500 mt-0.5">Refresh Epic OAuth token</p>
            </button>
          </div>

          {/* Mapping Summary */}
          {stats && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-900">Entity Mapping Summary</h3>
                <button
                  onClick={() => router.push('/settings/integrations/epic/mappings')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Manage Mappings
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MappingStatCard icon={Users} label="Surgeons" mapped={stats.surgeon.mapped} total={stats.surgeon.total} />
                <MappingStatCard icon={LayoutGrid} label="Rooms" mapped={stats.room.mapped} total={stats.room.total} />
                <MappingStatCard icon={ClipboardList} label="Procedures" mapped={stats.procedure.mapped} total={stats.procedure.total} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDisconnectConfirm(false)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Disconnect from Epic?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will revoke the access token and disconnect your facility from Epic. Existing imported cases will not be affected. You can reconnect at any time.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
