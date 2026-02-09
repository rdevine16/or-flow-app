// This is the layout for all admin pages. It is used to wrap the admin pages and provide a common layout for them.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}