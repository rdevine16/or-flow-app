'use client'
// components/layouts/BlockedScreen.tsx
// Full-screen blocking UI for expired trials or disabled accounts


import { Ban, Clock, LogOut } from 'lucide-react'
interface BlockedScreenProps {
  type: 'trial' | 'disabled'
  facilityName?: string | null
  onLogout: () => void
}

export default function BlockedScreen({
  type,
  facilityName,
  onLogout,
}: BlockedScreenProps) {
  const isTrial = type === 'trial'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header with gradient */}
        <div
          className={`p-6 ${
            isTrial
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}
        >
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            {isTrial ? (
              <Clock className="w-8 h-8 text-white" />
            ) : (
              <Ban className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-semibold text-white text-center">
            {isTrial ? 'Trial Expired' : 'Access Disabled'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-600 text-center mb-6">
            {isTrial ? (
              <>
                Your trial for{' '}
                <span className="font-semibold">{facilityName}</span> has ended.
              </>
            ) : (
              <>
                Access to{' '}
                <span className="font-semibold">{facilityName}</span> has been
                disabled.
              </>
            )}
          </p>

          {/* Help Box */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Need help?
            </h3>
            <p className="text-sm text-slate-500">
              Contact{' '}
              <a
                href="mailto:support@orbitsurgical.com"
                className="text-slate-900 font-medium hover:underline"
              >
                support@orbitsurgical.com
              </a>
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
