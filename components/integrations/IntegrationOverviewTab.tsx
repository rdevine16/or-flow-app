/**
 * IntegrationOverviewTab — shared Overview tab for all HL7v2 integration pages.
 *
 * Shows: Setup instructions, quick actions, connection status, stats, and retention policy.
 * System-specific content (display name, setup description) comes from EhrSystemConfig.
 */

'use client'

import React, { useState } from 'react'
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Power,
  RotateCw,
  Clock,
  Save,
} from 'lucide-react'
import SetupInstructionsCard from '@/components/integrations/SetupInstructionsCard'
import type { EhrSystemConfig } from '@/components/integrations/system-config'
import type { EhrIntegration, EhrProcessingStatus } from '@/lib/integrations/shared/integration-types'

// =====================================================
// TYPES
// =====================================================

type TabId = 'overview' | 'review' | 'mappings' | 'logs'

interface IntegrationStats {
  totalProcessed: number
  pendingReview: number
  errors: number
  messagesToday: number
}

export interface IntegrationOverviewTabProps {
  systemConfig: EhrSystemConfig
  integration: EhrIntegration | null
  stats: IntegrationStats | null
  endpointUrl: string
  actionLoading: string | null
  onSetup: () => Promise<void>
  onToggleActive: () => Promise<void>
  onRotateKey: () => Promise<void>
  onUpdateRetention: (days: number) => Promise<void>
  onNavigateTab: (tab: TabId) => void
  onNavigateLogsWithFilter: (filter: EhrProcessingStatus) => void
}

// =====================================================
// HELPERS
// =====================================================

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// =====================================================
// RETENTION POLICY CARD
// =====================================================

const RETENTION_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days (default)' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
]

function RetentionPolicyCard({
  retentionDays,
  actionLoading,
  onUpdate,
}: {
  retentionDays: number
  actionLoading: string | null
  onUpdate: (days: number) => Promise<void>
}) {
  const [selectedDays, setSelectedDays] = useState(retentionDays)

  const hasChanged = selectedDays !== retentionDays

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-slate-500" />
        <h3 className="font-medium text-slate-900">Raw Message Retention</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Raw HL7v2 messages contain PHI. They are automatically purged after the retention period.
        Parsed data and audit logs are preserved indefinitely.
      </p>
      <div className="flex items-center gap-3">
        <select
          value={selectedDays}
          onChange={(e) => setSelectedDays(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {RETENTION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {hasChanged && (
          <button
            onClick={() => onUpdate(selectedDays)}
            disabled={actionLoading === 'retention'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'retention' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        )}
      </div>
    </div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function IntegrationOverviewTab({
  systemConfig,
  integration,
  stats,
  endpointUrl,
  actionLoading,
  onSetup,
  onToggleActive,
  onRotateKey,
  onUpdateRetention,
  onNavigateTab,
  onNavigateLogsWithFilter,
}: IntegrationOverviewTabProps) {
  if (!integration) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Set Up HL7v2 Integration</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-6">
          Generate an API key to start receiving surgical scheduling messages from your {systemConfig.displayName} integration engine.
        </p>
        <button
          onClick={onSetup}
          disabled={actionLoading === 'setup'}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {actionLoading === 'setup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Initialize Integration
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SetupInstructionsCard
        endpointUrl={endpointUrl}
        apiKey={integration.config?.api_key}
        isActive={integration.is_active}
        setupDescription={systemConfig.setupDescription}
        curlMshPlaceholder={systemConfig.curlMshPlaceholder}
      />

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleActive}
          disabled={actionLoading === 'toggle'}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            integration.is_active
              ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
              : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {actionLoading === 'toggle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          {integration.is_active ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={onRotateKey}
          disabled={actionLoading === 'rotate'}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {actionLoading === 'rotate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
          Rotate API Key
        </button>
      </div>

      {/* Status Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-medium text-slate-900 mb-4">Connection Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500 mb-0.5">Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${integration.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <p className="font-medium text-slate-900">{integration.is_active ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Last Message</p>
            <p className="font-medium text-slate-900">{formatRelativeTime(integration.last_message_at)}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Messages Today</p>
            <p className="font-medium text-slate-900">{stats?.messagesToday ?? 0}</p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">Last Error</p>
            <p className={`font-medium ${integration.last_error ? 'text-red-600' : 'text-slate-900'}`}>
              {integration.last_error || 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-slate-500">Total Imported</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{stats?.totalProcessed ?? 0}</p>
        </div>
        <button
          className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-amber-300 transition-colors"
          onClick={() => onNavigateTab('review')}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-500">Pending Review</span>
          </div>
          <p className="text-2xl font-semibold text-amber-600">{stats?.pendingReview ?? 0}</p>
        </button>
        <button
          className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-red-300 transition-colors"
          onClick={() => onNavigateLogsWithFilter('error')}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-slate-500">Errors</span>
          </div>
          <p className="text-2xl font-semibold text-red-600">{stats?.errors ?? 0}</p>
        </button>
      </div>

      {/* Retention Policy Card */}
      <RetentionPolicyCard
        retentionDays={integration.config?.retention_days ?? 90}
        actionLoading={actionLoading}
        onUpdate={onUpdateRetention}
      />
    </div>
  )
}
