import Navbar from '../ui/Navbar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main>
        {children}
      </main>
    </div>
  )
}