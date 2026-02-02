// components/layouts/BlockedScreen.tsx
// Full-screen blocking UI for expired trials or disabled accounts

'use client'

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
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header with gradient */}
        <div
          className={`p-6 ${
            isTrial
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-red-500 to-red-600'
          }`}
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isTrial ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              )}
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white text-center">
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
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
