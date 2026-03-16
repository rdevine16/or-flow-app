import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">
          Last updated: March 16, 2026
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              1. Introduction
            </h2>
            <p>
              ORbit Surgical (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
              operates the ORbit platform, including our web application and iOS
              mobile application (collectively, the &quot;Service&quot;). This
              Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              2. Information We Collect
            </h2>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">
              Account Information
            </h3>
            <p>
              When you create an account, we collect your name, email address,
              and professional role. Accounts are provisioned by your facility
              administrator.
            </p>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">
              Operational Data
            </h3>
            <p>
              The Service records surgical workflow data including case
              milestones, timestamps, room assignments, and procedural
              information. This data is entered by authorized facility staff and
              is used for operational analytics and efficiency tracking.
            </p>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">
              Device Information
            </h3>
            <p>
              We collect device identifiers for push notification delivery and
              basic device information to ensure app compatibility.
            </p>

            <h3 className="font-medium text-gray-900 mt-4 mb-2">
              Usage Data
            </h3>
            <p>
              We store user preferences such as display settings and
              notification preferences locally on your device using standard
              platform storage (UserDefaults on iOS).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Provide and maintain the Service, including real-time surgical
                workflow tracking
              </li>
              <li>
                Generate analytics and efficiency metrics for your facility
              </li>
              <li>
                Send push notifications for case updates, schedule changes, and
                system alerts
              </li>
              <li>Authenticate your identity and enforce access controls</li>
              <li>Improve and optimize the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              4. Data Storage and Security
            </h2>
            <p>
              Your data is stored securely using Supabase (built on PostgreSQL)
              with row-level security policies that ensure users can only access
              data within their authorized facility. All data is transmitted over
              HTTPS/TLS encryption. We implement role-based access controls to
              limit data access to authorized personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              5. Data Sharing
            </h2>
            <p>
              We do not sell, rent, or trade your personal information. We may
              share data with:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Service providers:</strong> Supabase (database hosting),
                Apple Push Notification Service (push notifications), and Vercel
                (web hosting) — solely to operate the Service
              </li>
              <li>
                <strong>Your facility:</strong> Aggregated analytics and
                operational data are accessible to authorized administrators
                within your facility
              </li>
              <li>
                <strong>Legal requirements:</strong> When required by law,
                regulation, or legal process
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              6. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active or as
              needed to provide the Service. Facility administrators may request
              deletion of facility data. Upon account deletion, your personal
              information is removed, though de-identified analytics data may be
              retained.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              7. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and personal data</li>
              <li>Opt out of non-essential push notifications</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, contact your facility administrator or
              reach out to us directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              8. Third-Party Tracking
            </h2>
            <p>
              We do not use third-party tracking, advertising SDKs, or analytics
              platforms that track users across apps or websites. We do not
              participate in cross-app or cross-site tracking.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              The Service is designed for healthcare professionals and is not
              intended for use by individuals under the age of 18. We do not
              knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the updated policy
              on this page with a revised &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or our data
              practices, please contact us at:
            </p>
            <p className="mt-2 font-medium">
              ORbit Surgical
              <br />
              Email: contact@orbitsurgical.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
