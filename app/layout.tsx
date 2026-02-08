'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0   
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "../lib/UserContext";
import { SubNavProvider } from "../lib/SubNavContext";
import { ToastProvider } from "@/components/ui/Toast/ToastProvider"; // ← ADD THIS

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ORbit",
  description: "Operating room efficiency tracking",
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
        <ToastProvider>  {/* ← ADD THIS */}
          <UserProvider>
            <SubNavProvider>
              {children}
            </SubNavProvider>
          </UserProvider>
        </ToastProvider>  {/* ← ADD THIS */}
      </body>
    </html>
  );
}