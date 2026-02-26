import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "../lib/UserContext";
import { SubNavProvider } from "../lib/SubNavContext";
import { ToastProvider } from "@/components/ui/Toast/ToastProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ORbit",
    template: "%s | ORbit",
  },
  description: "Real-time operating room efficiency tracking and surgical analytics",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <OfflineBanner />
        <ToastProvider>
          <ErrorBoundary>
            <UserProvider>
              <SubNavProvider>
                {children}
              </SubNavProvider>
            </UserProvider>
          </ErrorBoundary>
        </ToastProvider> 
      </body>
    </html>
  );
}