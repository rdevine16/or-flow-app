import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// This endpoint checks which user IDs have corresponding auth.users records
// We check by matching emails since staff-only users have UUIDs not in auth.users
// Used to determine account status (active vs no_account)
const { showToast } = useToast()
export async function POST(request: Request) {
  try {
    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ authUserIds: [] })
    }

    // Use service role to access auth.users and users table
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // First, get the emails for the requested user IDs
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', userIds)

    if (usersError) {
      showToast({
  type: 'error',
  title: 'Error fetching users:',
  message: `Error fetching users: ${usersError}`
})
      return NextResponse.json({ authUserIds: [] })
    }

    // Filter to only users with emails
    const usersWithEmails = usersData?.filter(u => u.email) || []
    
    if (usersWithEmails.length === 0) {
      return NextResponse.json({ authUserIds: [] })
    }

    // Get all auth users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) {
      showToast({
  type: 'error',
  title: 'Error fetching auth users:',
  message: `Error fetching auth users: ${authError}`
})
      return NextResponse.json({ authUserIds: [] })
    }

    // Create a set of emails that exist in auth.users
    const authEmails = new Set(authData.users.map(u => u.email?.toLowerCase()))

    // Return user IDs whose emails exist in auth.users
    const authUserIds = usersWithEmails
      .filter(u => authEmails.has(u.email?.toLowerCase()))
      .map(u => u.id)

    return NextResponse.json({ authUserIds })

  } catch (error) {
    showToast({
  type: 'error',
  title: 'Error in check-auth-status:',
  message: error instanceof Error ? error.message : 'Error in check-auth-status:'
})
    return NextResponse.json({ authUserIds: [] })
  }
}