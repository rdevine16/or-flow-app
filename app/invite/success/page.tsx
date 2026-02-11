'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

export default function InviteSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">You're All Set!</h1>
        <p className="text-slate-600 mb-8">
          Your account has been created and you now have access to view surgical cases.
        </p>

        {/* Download App CTA */}
        <div className="bg-slate-50 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-2">Download the ORbit App</h2>
          <p className="text-sm text-slate-600 mb-4">
            Use the mobile app to view your case calendar and receive push notifications.
          </p>

          {/* App Store Buttons */}
          <div className="flex flex-col gap-3">
            <a
              href="https://apps.apple.com/app/orbit-surgical"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 bg-black text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wide opacity-80">Download on the</div>
                <div className="text-lg font-semibold -mt-1">App Store</div>
              </div>
            </a>

            {/* Future: Google Play
            <a
              href="https://play.google.com/store/apps/details?id=com.orbitsurgical.android"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 bg-black text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31M6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
              </svg>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wide opacity-80">Get it on</div>
                <div className="text-lg font-semibold -mt-1">Google Play</div>
              </div>
            </a>
            */}
          </div>
        </div>

        {/* What's Next */}
        <div className="text-left mb-6">
          <h3 className="font-medium text-slate-900 mb-3">What happens next?</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
              Download the ORbit app from the App Store
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
              Sign in with your email and password
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
              View cases and receive notifications
            </li>
          </ul>
        </div>

        {/* Help */}
        <p className="text-xs text-slate-400">
          Questions? Contact the facility that invited you or email support@orbitsurgical.com
        </p>
      </div>
    </div>
  )
}
